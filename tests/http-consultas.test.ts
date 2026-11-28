import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpInquiriesRepository } from "@/lib/data/http/inquiries";
import { RateLimitedError, ValidationError } from "@/lib/data/http/errors";
import type { NewInquiry } from "@/lib/domain";

// Verifica el pedido que sale de verdad, sin red: qué URL, qué headers y qué
// body. Es la única forma de comprobar que la IP del visitante viaja.

const consulta: NewInquiry = {
  nombre: "  Ana  ",
  apellido: "Díaz",
  numero: "261 456-7890",
  email: "ana@mail.com",
  fuente: "propiedad_individual",
  descripcion: "  Quiero coordinar una visita.  ",
  listingId: 42,
};

const respuestaOk = {
  success: true,
  data: {
    id: 7,
    nombre: "Ana",
    apellido: "Díaz",
    numero: "261 456-7890",
    email: "ana@mail.com",
    fuente: "propiedad_individual",
    descripcion: "Quiero coordinar una visita.",
    status: "nueva",
    listing_id: 42,
    created_at: "2026-11-28T12:00:00.000000Z",
  },
};

function stubFetch(status: number, body: unknown) {
  // Los parámetros se declaran para poder inspeccionar la llamada con tipos.
  const fetchStub = vi.fn(
    async (_url: string, _init?: RequestInit): Promise<Response> =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchStub);
  return fetchStub;
}

function pedido(fetchStub: ReturnType<typeof stubFetch>): { url: string; init: RequestInit } {
  const [url, init] = fetchStub.mock.calls[0];
  if (init === undefined) throw new Error("el fetch se llamó sin init");
  return { url, init };
}

function cuerpo(fetchStub: ReturnType<typeof stubFetch>): Record<string, unknown> {
  return JSON.parse(pedido(fetchStub).init.body as string);
}

function headersDe(fetchStub: ReturnType<typeof stubFetch>): Record<string, string> {
  return pedido(fetchStub).init.headers as Record<string, string>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createHttpInquiriesRepository", () => {
  it("postea al endpoint correcto con el payload en snake_case", async () => {
    const fetchStub = stubFetch(201, respuestaOk);
    await createHttpInquiriesRepository("http://api.local/api/v1").create(consulta);

    const { url, init } = pedido(fetchStub);
    expect(url).toBe("http://api.local/api/v1/public/consultas");
    expect(init.method).toBe("POST");

    const body = cuerpo(fetchStub);
    expect(body.listing_id).toBe(42);
    expect("listingId" in body).toBe(false);
  });

  it("recorta los espacios antes de enviar", async () => {
    const fetchStub = stubFetch(201, respuestaOk);
    await createHttpInquiriesRepository("http://api.local/api/v1").create(consulta);

    const body = cuerpo(fetchStub);
    expect(body.nombre).toBe("Ana");
    expect(body.descripcion).toBe("Quiero coordinar una visita.");
  });

  // La API devuelve 422 si el email viene vacío, así que la clave se omite.
  it("omite la clave email cuando no hay email", async () => {
    const fetchStub = stubFetch(201, respuestaOk);
    await createHttpInquiriesRepository("http://api.local/api/v1").create({
      ...consulta,
      email: "",
    });

    expect("email" in cuerpo(fetchStub)).toBe(false);
  });

  // El punto de todo el diseño del formulario: el POST sale del server, así
  // que sin reenviar la IP la API contaría sus 5/min contra el servidor y se
  // agotaría con cinco visitantes por minuto.
  it("reenvía la IP del visitante en X-Forwarded-For", async () => {
    const fetchStub = stubFetch(201, respuestaOk);
    await createHttpInquiriesRepository("http://api.local/api/v1").create(consulta, {
      clientIp: "203.0.113.55",
    });

    expect(headersDe(fetchStub)["X-Forwarded-For"]).toBe("203.0.113.55");
    expect(headersDe(fetchStub)["Content-Type"]).toBe("application/json");
  });

  it("sin IP no manda el header vacío", async () => {
    const fetchStub = stubFetch(201, respuestaOk);
    await createHttpInquiriesRepository("http://api.local/api/v1").create(consulta);

    expect("X-Forwarded-For" in headersDe(fetchStub)).toBe(false);
  });

  it("mapea la respuesta a dominio", async () => {
    stubFetch(201, respuestaOk);
    const creada = await createHttpInquiriesRepository("http://api.local/api/v1").create(consulta);

    expect(creada.id).toBe(7);
    expect(creada.status).toBe("nueva");
    expect(creada.listingId).toBe(42);
    expect(creada.createdAt).toBeInstanceOf(Date);
  });

  it("un 400 de validación llega como ValidationError con el campo", async () => {
    stubFetch(400, {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Error de validación",
        details: [{ field: "listing_id", message: "es obligatorio" }],
        request_id: "r-1",
      },
    });

    await expect(
      createHttpInquiriesRepository("http://api.local/api/v1").create(consulta),
    ).rejects.toThrow(ValidationError);
  });

  it("un 429 llega como RateLimitedError", async () => {
    stubFetch(429, {
      success: false,
      error: { code: "RATE_LIMITED", message: "Demasiadas solicitudes.", request_id: "r-2" },
    });

    await expect(
      createHttpInquiriesRepository("http://api.local/api/v1").create(consulta),
    ).rejects.toThrow(RateLimitedError);
  });
});
