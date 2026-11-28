import { describe, expect, it } from "vitest";
import { mapCatalog } from "@/lib/data/http/mappers";
import { UnknownFilterValueError, validateFilters } from "@/lib/data/validate-filters";
import { InvalidInquiryError, validateInquiry } from "@/lib/data/validate-inquiry";
import catalogo from "@/lib/data/mock/fixtures/catalog.json";
import type { NewInquiry } from "@/lib/domain";

const CATALOGO = mapCatalog(catalogo);

describe("validateFilters", () => {
  // Existe por un bug concreto: la API aceptaba 9 amenities de 44 y las otras
  // 35 las ignoraba EN SILENCIO, devolviendo resultados sin filtrar.
  it("acepta valores que están en el catálogo", () => {
    expect(() =>
      validateFilters(
        { amenities: ["swimming_pool", "air_conditioning"], propertyType: ["house"], zone: ["chacras_de_coria"] },
        CATALOGO,
      ),
    ).not.toThrow();
  });

  it("rechaza una amenity inventada", () => {
    expect(() => validateFilters({ amenities: ["sauna_inexistente"] }, CATALOGO)).toThrow(
      UnknownFilterValueError,
    );
  });

  it("rechaza una zona inventada", () => {
    expect(() => validateFilters({ zone: ["narnia"] }, CATALOGO)).toThrow(UnknownFilterValueError);
  });

  it("rechaza un tipo de propiedad inventado", () => {
    expect(() => validateFilters({ propertyType: ["castillo"] }, CATALOGO)).toThrow(
      UnknownFilterValueError,
    );
  });

  it("el error dice qué campo y qué valores", () => {
    try {
      validateFilters({ amenities: ["a", "b"] }, CATALOGO);
      expect.unreachable("debió lanzar");
    } catch (error) {
      expect(error).toBeInstanceOf(UnknownFilterValueError);
      const e = error as UnknownFilterValueError;
      expect(e.field).toBe("amenities");
      expect(e.values).toEqual(["a", "b"]);
    }
  });

  // Si una sección no vino (por `?include=`), ese campo no se valida en vez de
  // rechazar todo por falta de datos.
  it("no valida contra una sección que el catálogo no trae", () => {
    expect(() => validateFilters({ amenities: ["lo_que_sea"] }, { provinces: [] })).not.toThrow();
  });

  it("no rechaza filtros que no son del catálogo", () => {
    expect(() =>
      validateFilters({ bedrooms: [3], priceMin: 100, sort: "menor_precio" }, CATALOGO),
    ).not.toThrow();
  });
});

const valida: NewInquiry = {
  nombre: "Ana",
  apellido: "Díaz",
  numero: "261 456-7890",
  fuente: "consulta_general",
  descripcion: "Quiero coordinar una visita.",
};

const campos = (input: NewInquiry): string[] => {
  try {
    validateInquiry(input);
    return [];
  } catch (error) {
    return (error as InvalidInquiryError).details.map((d) => d.field);
  }
};

describe("validateInquiry", () => {
  // Existe porque la API aceptaba los cuatro campos vacíos y devolvía 201,
  // metiéndole consultas en blanco al CRM.
  it("acepta una consulta completa", () => {
    expect(() => validateInquiry(valida)).not.toThrow();
  });

  it("acumula TODOS los campos que faltan, no solo el primero", () => {
    expect(campos({ nombre: "", apellido: "", numero: "", fuente: "consulta_general", descripcion: "" })).toEqual([
      "nombre",
      "apellido",
      "numero",
      "descripcion",
    ]);
  });

  it("los espacios no cuentan como contenido", () => {
    expect(campos({ ...valida, nombre: "   " })).toEqual(["nombre"]);
  });

  describe("teléfono", () => {
    it.each(["2614567890", "261 456-7890", "+54 9 261 456 7890", "(261) 4567890"])(
      "acepta el formato real %s",
      (numero) => {
        expect(campos({ ...valida, numero })).toEqual([]);
      },
    );

    it.each(["", "   ", "123", "12-34"])("rechaza %s por tener menos de 6 dígitos", (numero) => {
      expect(campos({ ...valida, numero })).toEqual(["numero"]);
    });
  });

  describe("email, que es opcional", () => {
    it("ausente está bien", () => {
      expect(campos({ ...valida, email: undefined })).toEqual([]);
    });

    // La API ahora devuelve 422 con email vacío, así que el front lo omite.
    it("vacío está bien: se omite al enviar", () => {
      expect(campos({ ...valida, email: "" })).toEqual([]);
    });

    it.each(["ana@", "@mail.com", "ana mail.com", "ana@mail"])("rechaza %s", (email) => {
      expect(campos({ ...valida, email })).toEqual(["email"]);
    });

    it("acepta uno válido", () => {
      expect(campos({ ...valida, email: "ana.diaz@mail.com.ar" })).toEqual([]);
    });
  });

  describe("largos máximos, que son los de las columnas de la API", () => {
    it.each([
      ["nombre", 100],
      ["apellido", 100],
      ["numero", 30],
      ["descripcion", 5000],
    ])("%s acepta %i y rechaza uno más", (campo, tope) => {
      const relleno = campo === "numero" ? "1" : "a";
      expect(campos({ ...valida, [campo]: relleno.repeat(tope) })).toEqual([]);
      expect(campos({ ...valida, [campo]: relleno.repeat(tope + 1) })).toEqual([campo]);
    });
  });

  it("rechaza una fuente que no está en el enum", () => {
    expect(campos({ ...valida, fuente: "whatsapp" as never })).toEqual(["fuente"]);
  });

  it("rechaza un listingId que no es un id", () => {
    expect(campos({ ...valida, listingId: -1 })).toEqual(["listingId"]);
    expect(campos({ ...valida, listingId: 1.5 })).toEqual(["listingId"]);
    expect(campos({ ...valida, listingId: 42 })).toEqual([]);
  });
});
