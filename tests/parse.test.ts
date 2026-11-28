import { describe, expect, it } from "vitest";
import {
  asArrayOrEmpty,
  asBoolean,
  asDate,
  asEnum,
  asNumber,
  asObject,
  asOptionalNumber,
  asOptionalString,
  asString,
  MappingError,
} from "@/lib/data/http/parse";

describe("asNumber", () => {
  // La API serializa los Decimal y el JSONB como string: el precio llega
  // "845000.00" y los dormitorios "3".
  it("acepta números que llegan como string", () => {
    expect(asNumber("845000.00", "x")).toBe(845000);
    expect(asNumber("3", "x")).toBe(3);
    expect(asNumber("0", "x")).toBe(0);
    expect(asNumber("-12.5", "x")).toBe(-12.5);
  });

  it("acepta números reales", () => {
    expect(asNumber(42, "x")).toBe(42);
    expect(asNumber(0, "x")).toBe(0);
  });

  // El punto de todo esto: nunca dejar pasar un NaN que después se renderiza
  // como "NaN" o rompe una comparación lejos de su causa.
  it.each([
    ["texto", "no es número"],
    ["vacío", ""],
    ["espacios", "   "],
    ["null", null],
    ["undefined", undefined],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["objeto", {}],
  ])("rechaza %s", (_caso, valor) => {
    expect(() => asNumber(valor, "campo.x")).toThrow(MappingError);
  });

  it("el error nombra el campo y qué llegó", () => {
    expect(() => asNumber("hola", "listing.price")).toThrow(/listing\.price/);
    expect(() => asNumber("hola", "listing.price")).toThrow(/"hola"/);
  });
});

describe("asOptionalNumber", () => {
  it("trata null, undefined y vacío como ausencia", () => {
    expect(asOptionalNumber(null, "x")).toBeNull();
    expect(asOptionalNumber(undefined, "x")).toBeNull();
    expect(asOptionalNumber("", "x")).toBeNull();
  });

  it("pero sigue rechazando basura", () => {
    expect(() => asOptionalNumber("abc", "x")).toThrow(MappingError);
  });
});

describe("asString", () => {
  it("rechaza el string vacío, que casi nunca es un valor válido", () => {
    expect(() => asString("", "x")).toThrow(MappingError);
    expect(() => asString("   ", "x")).toThrow(MappingError);
  });

  it("acepta texto", () => {
    expect(asString("Mendoza", "x")).toBe("Mendoza");
  });
});

describe("asOptionalString", () => {
  it("vacío y null son ausencia, no error", () => {
    expect(asOptionalString("", "x")).toBeNull();
    expect(asOptionalString(null, "x")).toBeNull();
    expect(asOptionalString(undefined, "x")).toBeNull();
  });

  it("rechaza un tipo que no es string", () => {
    expect(() => asOptionalString(5, "x")).toThrow(MappingError);
  });
});

describe("asBoolean", () => {
  it("acepta booleanos y sus formas como string", () => {
    expect(asBoolean(true, "x")).toBe(true);
    expect(asBoolean("false", "x")).toBe(false);
  });

  it("rechaza otras cosas", () => {
    expect(() => asBoolean("si", "x")).toThrow(MappingError);
    expect(() => asBoolean(1, "x")).toThrow(MappingError);
  });
});

describe("asDate", () => {
  it("parsea una fecha ISO con microsegundos, como las manda la API", () => {
    const fecha = asDate("2026-11-20T14:03:11.221000Z", "x");
    expect(fecha.getUTCFullYear()).toBe(2026);
    expect(fecha.getUTCMonth()).toBe(10);
  });

  it("rechaza una fecha inválida", () => {
    expect(() => asDate("ayer", "x")).toThrow(MappingError);
    expect(() => asDate("2026-13-45", "x")).toThrow(MappingError);
  });
});

describe("asEnum", () => {
  it("acepta un valor de la lista", () => {
    expect(asEnum("sale", "x", ["sale", "rent"] as const)).toBe("sale");
  });

  it("rechaza uno de afuera y lista los válidos en el mensaje", () => {
    expect(() => asEnum("permuta", "x", ["sale", "rent"] as const)).toThrow(/sale, rent/);
  });
});

describe("asArrayOrEmpty", () => {
  // La API omite las secciones que no pediste y devuelve [] cuando no hay
  // strategy para una propiedad: las dos cosas son normales.
  it("ausente y null son array vacío", () => {
    expect(asArrayOrEmpty(undefined, "x")).toEqual([]);
    expect(asArrayOrEmpty(null, "x")).toEqual([]);
  });

  it("rechaza algo que no es array", () => {
    expect(() => asArrayOrEmpty("hola", "x")).toThrow(MappingError);
  });
});

describe("asObject", () => {
  it("rechaza array y null, que son los dos casos que un typeof no distingue", () => {
    expect(() => asObject([], "x")).toThrow(MappingError);
    expect(() => asObject(null, "x")).toThrow(MappingError);
  });
});
