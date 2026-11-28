import { describe, expect, it } from "vitest";
import {
  CAMPOS,
  errorAEstado,
  parsearConsulta,
  valoresEnviados,
} from "@/lib/forms/consulta";
import { validateInquiry, InvalidInquiryError } from "@/lib/data/validate-inquiry";
import { toDataFailure } from "@/lib/data/failures";

const form = (valores: Record<string, string>): FormData => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(valores)) fd.set(k, v);
  return fd;
};

const completo = {
  nombre: "Ana",
  apellido: "Díaz",
  numero: "261 456-7890",
  email: "ana@mail.com",
  descripcion: "Quiero coordinar una visita.",
  fuente: "propiedad_individual",
  listingId: "42",
};

describe("parsearConsulta", () => {
  it("lee todos los campos del form", () => {
    expect(parsearConsulta(form(completo))).toEqual({
      nombre: "Ana",
      apellido: "Díaz",
      numero: "261 456-7890",
      email: "ana@mail.com",
      descripcion: "Quiero coordinar una visita.",
      fuente: "propiedad_individual",
      listingId: 42,
    });
  });

  // La API devuelve 422 con email vacío, así que se omite en vez de mandarlo.
  it("omite el email cuando viene vacío", () => {
    expect(parsearConsulta(form({ ...completo, email: "" })).email).toBeUndefined();
    expect(parsearConsulta(form({ ...completo, email: "   " })).email).toBeUndefined();
  });

  it("sin listingId lo omite", () => {
    expect(parsearConsulta(form({ ...completo, listingId: "" })).listingId).toBeUndefined();
  });

  // Descartar un listingId roto en silencio mandaría la consulta sin la
  // propiedad asociada, y nadie se enteraría de que se perdió.
  it("un listingId que no es número NO se descarta: se deja fallar la validación", () => {
    const consulta = parsearConsulta(form({ ...completo, listingId: "abc" }));
    expect(consulta.listingId).toBe(-1);
    expect(() => validateInquiry(consulta)).toThrow(InvalidInquiryError);
  });

  it("una fuente ausente cae en consulta general", () => {
    const fd = form(completo);
    fd.delete(CAMPOS.fuente);
    expect(parsearConsulta(fd).fuente).toBe("consulta_general");
  });

  it("una fuente inventada cae en consulta general, no rompe el parseo", () => {
    expect(parsearConsulta(form({ ...completo, fuente: "whatsapp" })).fuente).toBe(
      "consulta_general",
    );
  });

  it("un form vacío no revienta: devuelve strings vacíos que la validación rechaza", () => {
    const consulta = parsearConsulta(new FormData());
    expect(consulta.nombre).toBe("");
    expect(() => validateInquiry(consulta)).toThrow(InvalidInquiryError);
  });

  it("no recorta los espacios del nombre: eso es trabajo de la validación", () => {
    // Si el parseo trimeara, "   " pasaría a "" y el mensaje de error sería
    // el mismo, pero se perdería lo que el visitante escribió.
    expect(parsearConsulta(form({ ...completo, nombre: "  Ana  " })).nombre).toBe("  Ana  ");
  });
});

describe("valoresEnviados", () => {
  // Sin esto, un error le borra al visitante lo que tipeó, que es la forma más
  // rápida de que abandone la consulta.
  it("devuelve lo que el visitante escribió, para repoblar el form", () => {
    expect(valoresEnviados(form(completo))).toEqual(completo);
  });

  it("los campos ausentes vienen como string vacío, no undefined", () => {
    const valores = valoresEnviados(new FormData());
    expect(Object.values(valores).every((v) => v === "")).toBe(true);
    expect(Object.keys(valores).sort()).toEqual(Object.keys(CAMPOS).sort());
  });
});

describe("errorAEstado", () => {
  it("convierte los details por campo en un mapa para marcar inputs", () => {
    const failure = toDataFailure(
      new InvalidInquiryError([
        { field: "nombre", message: "Ingresá tu nombre." },
        { field: "numero", message: "Teléfono inválido." },
      ]),
    );
    const estado = errorAEstado(failure, valoresEnviados(form(completo)));

    expect(estado.estado).toBe("error");
    if (estado.estado !== "error") return;
    expect(estado.campos).toEqual({
      nombre: "Ingresá tu nombre.",
      numero: "Teléfono inválido.",
    });
    expect(estado.reintentable).toBe(false);
    // Los valores viajan de vuelta para no perder lo tipeado.
    expect(estado.valores.nombre).toBe("Ana");
  });

  it("una falla sin details deja el mapa vacío pero conserva el mensaje", () => {
    const estado = errorAEstado(toDataFailure(new Error("boom")), {});
    if (estado.estado !== "error") return expect.unreachable();
    expect(estado.campos).toEqual({});
    expect(estado.mensaje).toBeTruthy();
    expect(estado.reintentable).toBe(true);
  });

  it("nunca filtra el mensaje técnico al visitante", () => {
    const estado = errorAEstado(
      toDataFailure(new Error("fetch a http://api-interna:8000 falló: ECONNREFUSED")),
      {},
    );
    if (estado.estado !== "error") return expect.unreachable();
    expect(estado.mensaje).not.toContain("api-interna");
    expect(estado.mensaje).not.toContain("ECONNREFUSED");
  });
});

describe("reglas de la API que el formulario tiene que anticipar", () => {
  // Descubierta probando la API: una consulta por una propiedad concreta sin
  // listing_id devuelve 400. No estaba en el contrato.
  it("propiedad_individual sin listingId se rechaza antes de salir a la red", () => {
    const consulta = parsearConsulta(
      form({ ...completo, fuente: "propiedad_individual", listingId: "" }),
    );
    expect(() => validateInquiry(consulta)).toThrow(InvalidInquiryError);

    try {
      validateInquiry(consulta);
    } catch (error) {
      expect((error as InvalidInquiryError).details[0].field).toBe("listingId");
    }
  });

  it("las otras dos fuentes no exigen listingId", () => {
    for (const fuente of ["consulta_general", "trabajar_con_mi_propiedad"]) {
      const consulta = parsearConsulta(form({ ...completo, fuente, listingId: "" }));
      expect(() => validateInquiry(consulta)).not.toThrow();
    }
  });

  // La API usa snake_case y el form camelCase: sin traducir, un 400 del
  // servidor no marcaría ningún input.
  it("traduce el nombre de campo de la API al del formulario", () => {
    const estado = errorAEstado(
      {
        title: "t",
        message: "m",
        retryable: false,
        details: [{ field: "listing_id", message: "falta" }],
      },
      {},
    );
    if (estado.estado !== "error") return expect.unreachable();
    expect(estado.campos).toEqual({ listingId: "falta" });
  });
});
