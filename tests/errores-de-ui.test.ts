import { describe, expect, it } from "vitest";
import { describirError, digestDeError } from "@/lib/ui/errores";

// Los boundaries reciben el error tipado `unknown` porque lo que se lanza en un
// Client Component viaja tal cual y puede no ser un `Error`.
describe("digestDeError", () => {
  it("saca el digest de un error del server", () => {
    const error = Object.assign(new Error("fallo al leer /public/listings"), {
      digest: "3920146891",
    });
    expect(digestDeError(error)).toBe("3920146891");
  });

  it("devuelve null cuando no hay digest, en vez de inventar uno", () => {
    expect(digestDeError(new Error("x"))).toBeNull();
    expect(digestDeError(Object.assign(new Error("x"), { digest: "" }))).toBeNull();
    expect(digestDeError(Object.assign(new Error("x"), { digest: 42 }))).toBeNull();
  });

  it("tolera que lo lanzado no sea un Error", () => {
    for (const valor of ["string pelado", null, undefined, 42, { digest: "no-soy-error" }]) {
      expect(digestDeError(valor)).toBeNull();
    }
  });
});

describe("describirError", () => {
  // La razón de ser del helper: el `message` de un error del server llega con
  // el texto original en desarrollo, y puede traer rutas, URLs internas o datos.
  it("nunca incluye el mensaje del error", () => {
    const error = Object.assign(new Error("ECONNREFUSED http://api-interna:8000/public/listings"), {
      digest: "abc123",
      name: "NetworkError",
    });
    const descripcion = describirError(error);
    expect(descripcion).not.toContain("api-interna");
    expect(descripcion).not.toContain("ECONNREFUSED");
    expect(descripcion).toBe("NetworkError (digest abc123)");
  });

  it("dice que no hay digest en vez de dejar el hueco", () => {
    expect(describirError(new TypeError("x"))).toBe("TypeError (sin digest)");
  });

  it("no explota con lo que no es un Error", () => {
    expect(describirError("algo")).toBe("Error desconocido (sin digest)");
  });
});
