import { describe, expect, it, vi } from "vitest";
import { attempt, attemptOr, toDataFailure } from "@/lib/data/failures";
import {
  ApiError,
  NetworkError,
  NotFoundError,
  RateLimitedError,
  TimeoutError,
  ValidationError,
  toApiError,
} from "@/lib/data/http/errors";
import { MappingError } from "@/lib/data/http/parse";
import { UnknownFilterValueError } from "@/lib/data/validate-filters";
import { InvalidInquiryError } from "@/lib/data/validate-inquiry";
import { DataSourceConfigError } from "@/lib/data/data-source";

// Reproduce lo que hace React cuando un error cruza una frontera de
// `use cache`: lo reconstruye como Error plano, conservando solo name,
// message, stack y cause. Las propiedades propias (code, status, requestId)
// desaparecen. Medido contra Next 16.4.6 en dev.
function comoLoDejaElCache(original: Error): Error {
  const reconstruido = new Error(original.message);
  reconstruido.name = original.name;
  return reconstruido;
}

describe("toDataFailure con el error entero", () => {
  it.each([
    [new NetworkError("x", null), "sin-conexion", true],
    [new TimeoutError(8000), "demorado", true],
    [new MappingError("x", "y", null), "datos-invalidos", false],
    [new UnknownFilterValueError("zone", ["narnia"]), "datos-invalidos", false],
    [new InvalidInquiryError([{ field: "nombre", message: "falta" }]), "datos-invalidos", false],
    [new DataSourceConfigError("x"), "configuracion", false],
  ])("%s → %s", (error, kind, retryable) => {
    const failure = toDataFailure(error);
    expect(failure.kind).toBe(kind);
    expect(failure.retryable).toBe(retryable);
  });

  it("conserva el requestId y los details cuando están", () => {
    const error = new ValidationError({
      status: 422,
      message: "Error de validación",
      requestId: "abc-123",
      details: [{ field: "sort", message: "inválido" }],
    });
    const failure = toDataFailure(error);
    expect(failure.requestId).toBe("abc-123");
    expect(failure.details).toEqual([{ field: "sort", message: "inválido" }]);
  });
});

// Este es el hallazgo que casi pasa desapercibido: la primera versión usaba
// instanceof y funcionaba solo en el POST de consultas, el único camino sin
// caché. Con la API caída, TODAS las lecturas degradaban a "error inesperado".
describe("toDataFailure con el error reconstruido por use cache", () => {
  it.each([
    [new NetworkError("sin conexión", null), "sin-conexion"],
    [new TimeoutError(8000), "demorado"],
    [new MappingError("x", "y", null), "datos-invalidos"],
    [new UnknownFilterValueError("zone", ["narnia"]), "datos-invalidos"],
    [
      new RateLimitedError({ code: "RATE_LIMITED", status: 429, message: "basta", requestId: "r-1" }),
      "limite-alcanzado",
    ],
    [
      new NotFoundError({ code: "NOT_FOUND", status: 404, message: "no está", requestId: null }),
      "no-encontrado",
    ],
    [new DataSourceConfigError("x"), "configuracion"],
  ])("sobrevive a la reconstrucción y sigue dando $1", (original, kind) => {
    const reconstruido = comoLoDejaElCache(original);

    // Se perdió la identidad de clase...
    expect(reconstruido instanceof original.constructor).toBe(false);
    expect(reconstruido.constructor.name).toBe("Error");
    // ...pero la falla se clasifica igual.
    expect(toDataFailure(reconstruido).kind).toBe(kind);
  });

  it("el requestId se pierde como propiedad, pero queda en el mensaje", () => {
    const original = new RateLimitedError({
      code: "RATE_LIMITED",
      status: 429,
      message: "Demasiadas solicitudes.",
      requestId: "req-abc",
    });
    const reconstruido = comoLoDejaElCache(original);

    expect(toDataFailure(reconstruido).requestId).toBeNull();
    // Por eso se mete en el mensaje: es el único dato que sirve para rastrear
    // el pedido del lado de la API, y el mensaje sí sobrevive.
    expect(reconstruido.message).toContain("req-abc");
  });
});

describe("toDataFailure con algo que no es un error conocido", () => {
  it.each([["string", "boom"], ["null", null], ["objeto", {}], ["Error pelado", new Error("x")]])(
    "%s cae en la falla genérica, no revienta",
    (_caso, valor) => {
      const failure = toDataFailure(valor);
      expect(failure.kind).toBe("no-disponible");
      expect(failure.title).toBeTruthy();
      expect(failure.message).toBeTruthy();
    },
  );

  it("nunca expone el mensaje original al visitante", () => {
    const failure = toDataFailure(new Error("conexión a postgres://usuario:clave@host falló"));
    expect(failure.message).not.toContain("postgres");
    expect(failure.message).not.toContain("clave");
  });
});

describe("attempt", () => {
  it("devuelve ok con el dato cuando no falla", async () => {
    const result = await attempt("x", async () => 42);
    expect(result).toEqual({ ok: true, data: 42 });
  });

  it("no lanza nunca: convierte el error en falla", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await attempt("miOperacion", async () => {
      throw new NetworkError("caída", null);
    });
    expect(result.ok).toBe(false);
    expect(spy).toHaveBeenCalledOnce();
    // El log tiene que decir qué operación falló y de qué tipo.
    expect(spy.mock.calls[0][0]).toContain("miOperacion");
    expect(spy.mock.calls[0][0]).toContain("sin-conexion");
    spy.mockRestore();
  });
});

describe("attemptOr, para secciones accesorias", () => {
  it("devuelve el fallback si falla", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const data = await attemptOr("relacionadas", [], async () => {
      throw new NetworkError("caída", null);
    });
    expect(data).toEqual([]);
    // Silencio en la UI no es silencio en el log.
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});

describe("toApiError", () => {
  it.each([
    ["NOT_FOUND", 404, NotFoundError],
    ["VALIDATION_ERROR", 422, ValidationError],
    ["RATE_LIMITED", 429, RateLimitedError],
  ])("mapea %s a su clase", (code, status, clase) => {
    const error = toApiError(status, { success: false, error: { code, message: "m", request_id: "r" } });
    expect(error).toBeInstanceOf(clase);
    expect(error.requestId).toBe("r");
  });

  it("extrae los details por campo de un 422", () => {
    const error = toApiError(422, {
      error: { code: "VALIDATION_ERROR", message: "m", details: [{ field: "nombre", message: "falta" }] },
    });
    expect((error as ValidationError).details).toEqual([{ field: "nombre", message: "falta" }]);
  });

  // Un 502 de un proxy devuelve HTML: ahí el status es lo único confiable.
  it("sin body reconocible, deduce por status", () => {
    expect(toApiError(404, null)).toBeInstanceOf(NotFoundError);
    expect(toApiError(429, "<html>502</html>")).toBeInstanceOf(RateLimitedError);
    expect(toApiError(500, null)).toBeInstanceOf(ApiError);
  });

  it("descarta details malformados en vez de romper", () => {
    const error = toApiError(422, {
      error: { code: "VALIDATION_ERROR", message: "m", details: [{ campo: "x" }, "basura", null] },
    });
    expect((error as ValidationError).details).toEqual([]);
  });
});
