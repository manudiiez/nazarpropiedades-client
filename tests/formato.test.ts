import { describe, expect, it } from "vitest";
import {
  DIAS_PARA_FECHA_ABSOLUTA,
  PRECIO_SIN_VALOR,
  formatearAtributo,
  formatearAtributos,
  formatearExpensas,
  formatearFecha,
  formatearPrecio,
  formatearPrecioPorMes,
  formatearPublicacion,
  formatearSuperficie,
  formatearValorDeAtributo,
  pluralizar,
  valorDeKeyAttribute,
} from "@/lib/format";
import type { AttributeItem, Condition, KeyAttributes, Money } from "@/lib/domain";

const usd = (amount: number): Money => ({ amount, currency: "USD" });
const ars = (amount: number): Money => ({ amount, currency: "ARS" });

const atributo = (parcial: Partial<AttributeItem>): AttributeItem => ({
  key: "total_area",
  value: 620,
  label: "Superficie total",
  suffix: "m²",
  section: null,
  ...parcial,
});

describe("precios", () => {
  it("se muestran con la convención de es-AR y sin decimales", () => {
    expect(formatearPrecio(usd(320000))).toBe("USD 320.000");
    expect(formatearPrecio(ars(450000))).toBe("$ 450.000");
  });

  it("los decimales del contrato de la API se redondean", () => {
    // La API manda "845000.50" como string; el mapper ya lo convirtió.
    expect(formatearPrecio(usd(845000.5))).toBe("USD 845.001");
  });

  // Que una cifra se lea en la moneda que al visitante se le ocurra es el peor
  // error posible acá.
  it("nunca se muestra una cifra sin su moneda", () => {
    for (const money of [usd(1), ars(1), usd(999999999)]) {
      expect(formatearPrecio(money)).toMatch(/^(USD|\$) /);
    }
  });

  it("las monedas no se convierten: se muestran como vienen", () => {
    expect(formatearPrecio(usd(100000))).toContain("USD");
    expect(formatearPrecio(ars(100000))).toContain("$");
    expect(formatearPrecio(ars(100000))).not.toContain("USD");
  });

  it("un precio en 0, negativo o ausente se muestra como consultar", () => {
    expect(formatearPrecio(usd(0))).toBe(PRECIO_SIN_VALOR);
    expect(formatearPrecio(usd(-1))).toBe(PRECIO_SIN_VALOR);
    expect(formatearPrecio(null)).toBe(PRECIO_SIN_VALOR);
    expect(formatearPrecio(undefined)).toBe(PRECIO_SIN_VALOR);
    expect(formatearPrecio({ amount: Number.NaN, currency: "USD" })).toBe(PRECIO_SIN_VALOR);
  });

  it("un valor enorme no rompe el formato", () => {
    expect(formatearPrecio(ars(12345678901))).toBe("$ 12.345.678.901");
  });
});

describe("precio por mes", () => {
  const casos: [Condition, boolean][] = [
    ["rent", true],
    ["temporary_rent", true],
    ["sale", false],
    ["exchange", false],
  ];

  // Un alquiler mostrado como precio total hace que el visitante crea que son
  // 450.000 en total.
  it("solo los alquileres llevan 'por mes'", () => {
    for (const [condition, esAlquiler] of casos) {
      expect(formatearPrecioPorMes(ars(450000), condition).endsWith("por mes"), condition).toBe(
        esAlquiler,
      );
    }
  });

  it("sin precio no se agrega 'por mes': 'Consultar precio por mes' no se entiende", () => {
    expect(formatearPrecioPorMes(ars(0), "rent")).toBe(PRECIO_SIN_VALOR);
  });
});

describe("expensas", () => {
  it("se muestran con su moneda y el texto completo", () => {
    expect(formatearExpensas(ars(78000))).toBe("+ $ 78.000 de expensas");
  });

  // Devolver null y no "" es lo que le permite al componente no dibujar la
  // línea en vez de dibujarla vacía.
  it("sin expensas devuelve null", () => {
    expect(formatearExpensas(null)).toBeNull();
    expect(formatearExpensas(undefined)).toBeNull();
    expect(formatearExpensas(ars(0))).toBeNull();
  });
});

describe("superficies y atributos", () => {
  it("la superficie lleva el sufijo que manda la API", () => {
    expect(formatearSuperficie(620)).toBe("620 m²");
    expect(formatearSuperficie(1.5, "ha")).toBe("1,5 ha");
  });

  it("sin sufijo se muestra el número solo, no una unidad inventada", () => {
    expect(formatearSuperficie(620, null)).toBe("620");
  });

  it("una superficie ausente devuelve null", () => {
    expect(formatearSuperficie(null)).toBeNull();
    expect(formatearSuperficie(undefined)).toBeNull();
    expect(formatearSuperficie(Number.NaN)).toBeNull();
  });

  // El valor ya viene parseado por el mapper: número cuando es numérico y
  // texto cuando no. Pasar una orientación por Intl daría "NaN".
  it("un atributo de texto se muestra como texto", () => {
    expect(formatearValorDeAtributo("Norte")).toBe("Norte");
    expect(formatearValorDeAtributo("  Norte  ")).toBe("Norte");
    expect(formatearValorDeAtributo("Norte", "orientación")).toBe("Norte orientación");
  });

  it("un booleano se muestra como tiene / no tiene, sin sufijo", () => {
    expect(formatearValorDeAtributo(true, "m²")).toBe("Sí");
    expect(formatearValorDeAtributo(false)).toBe("No");
  });

  it("el 0 se muestra: 'sin cochera' es un dato, no ausencia de dato", () => {
    expect(formatearValorDeAtributo(0)).toBe("0");
  });

  it("un atributo trae su etiqueta de la API, no de un diccionario del front", () => {
    expect(formatearAtributo(atributo({}))).toEqual({
      etiqueta: "Superficie total",
      valor: "620 m²",
    });
  });

  it("un atributo sin valor se descarta en vez de dibujar un hueco", () => {
    expect(formatearAtributo(atributo({ value: "" }))).toBeNull();
    expect(formatearAtributos([atributo({}), atributo({ value: "   " })])).toHaveLength(1);
  });
});

describe("keyAttributes", () => {
  // Las claves VARÍAN por propiedad: el tipo es Partial a propósito.
  const claves: KeyAttributes = { bedrooms: 3, total_area: 620, orientation: "Norte" };

  it("una clave presente se formatea con el sufijo que le pase el componente", () => {
    expect(valorDeKeyAttribute(claves, "bedrooms")).toBe("3");
    expect(valorDeKeyAttribute(claves, "total_area", "m²")).toBe("620 m²");
    expect(valorDeKeyAttribute(claves, "orientation")).toBe("Norte");
  });

  it("una clave ausente devuelve null, que es el caso normal", () => {
    expect(valorDeKeyAttribute(claves, "garage_capacity")).toBeNull();
  });
});

describe("pluralizar", () => {
  it("acompaña al número", () => {
    expect(pluralizar(1, "dormitorio")).toBe("1 dormitorio");
    expect(pluralizar(2, "dormitorio")).toBe("2 dormitorios");
    expect(pluralizar(0, "dormitorio")).toBe("0 dormitorios");
  });

  it("acepta un plural propio para las palabras que no terminan en s", () => {
    expect(pluralizar(1, "ambiente")).toBe("1 ambiente");
    expect(pluralizar(3, "m² cubierto", "m² cubiertos")).toBe("3 m² cubiertos");
  });

  it("separa los miles", () => {
    expect(pluralizar(1200, "metro")).toBe("1.200 metros");
  });
});

describe("fechas", () => {
  const ahora = new Date("2026-11-28T15:00:00Z");
  const hace = (ms: number) => new Date(ahora.getTime() - ms);
  const DIA = 86_400_000;

  it("lo reciente va relativo", () => {
    expect(formatearFecha(hace(30_000), ahora)).toBe("hace instantes");
    expect(formatearFecha(hace(5 * 60_000), ahora)).toBe("hace 5 minutos");
    expect(formatearFecha(hace(3 * 3_600_000), ahora)).toBe("hace 3 horas");
    expect(formatearFecha(hace(3 * DIA), ahora)).toBe("hace 3 días");
  });

  // Nadie lee "hace 237 días": a partir de un mes lo que importa es cuándo fue.
  it("lo viejo va absoluto", () => {
    expect(formatearFecha(hace(DIAS_PARA_FECHA_ABSOLUTA * DIA), ahora)).toBe(
      "29 de octubre de 2026",
    );
    expect(formatearFecha(new Date("2026-03-12T12:00:00Z"), ahora)).toBe("12 de marzo de 2026");
  });

  it("una fecha futura se muestra absoluta, no 'en 2 horas'", () => {
    expect(formatearFecha(new Date("2026-12-01T15:00:00Z"), ahora)).toBe(
      "1 de diciembre de 2026",
    );
  });

  it("una fecha inválida devuelve vacío en vez de 'Invalid Date'", () => {
    expect(formatearFecha(new Date("no es una fecha"), ahora)).toBe("");
    expect(formatearPublicacion(new Date("no es una fecha"), ahora)).toBe("");
  });

  // La preposición cambia según la forma, y el español devuelve "ayer" y
  // "anteayer", no solo "hace N días": por eso no se decide con un startsWith.
  it("la preposición de 'publicado' acompaña a la forma", () => {
    expect(formatearPublicacion(hace(3 * DIA), ahora)).toBe("Publicado hace 3 días");
    expect(formatearPublicacion(hace(DIA), ahora)).toBe("Publicado ayer");
    expect(formatearPublicacion(hace(2 * DIA), ahora)).toBe("Publicado anteayer");
    expect(formatearPublicacion(new Date("2026-03-12T12:00:00Z"), ahora)).toBe(
      "Publicado el 12 de marzo de 2026",
    );
  });
});
