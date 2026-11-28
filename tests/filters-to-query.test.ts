import { describe, expect, it } from "vitest";
import { filtersToQuery, pageToQuery } from "@/lib/data/http/filters-to-query";
import { buildQuery, buildUrl } from "@/lib/data/http/query";

const query = (filtros: Parameters<typeof filtersToQuery>[0]): string =>
  buildQuery(filtersToQuery(filtros));

describe("params multi-valor", () => {
  // El bug más caro posible: un join con comas hace que la API lea "sale,rent"
  // como un valor único y devuelva 0 resultados SIN error.
  it("se repiten, no se juntan con comas", () => {
    expect(query({ condition: ["sale", "rent"] })).toBe("condition=sale&condition=rent");
  });

  it("un array vacío no genera el param", () => {
    expect(query({ condition: [], propertyType: [] })).toBe("");
  });
});

describe("convenciones de la API encapsuladas acá", () => {
  it('bedrooms "5+" viaja como 5, que la API interpreta como 5 o más', () => {
    expect(query({ bedrooms: [2, "5+"] })).toBe("bedrooms=2&bedrooms=5");
  });

  it("garage 0 viaja como 0: significa sin cochera, no 'no me importa'", () => {
    expect(query({ garageCapacity: [0] })).toBe("garage_capacity=0");
  });

  it('garage "3+" viaja como 3', () => {
    expect(query({ garageCapacity: ["3+"] })).toBe("garage_capacity=3");
  });

  it("los tramos de antigüedad se traducen a los códigos de la API", () => {
    expect(query({ age: ["brand_new"] })).toBe("age=0");
    expect(query({ age: ["1-5"] })).toBe("age=5");
    expect(query({ age: ["6-10"] })).toBe("age=10");
    expect(query({ age: ["11-20"] })).toBe("age=20");
    expect(query({ age: ["over-20"] })).toBe("age=30");
  });

  it("addressQuery se manda como `search`, que es como lo llama la API", () => {
    expect(query({ addressQuery: "chacras" })).toBe("search=chacras");
  });

  it("un addressQuery en blanco se omite en vez de mandar vacío", () => {
    expect(query({ addressQuery: "   " })).toBe("");
  });

  it("los nombres de campo pasan a snake_case", () => {
    expect(query({ priceMin: 1000, totalAreaMax: 500 })).toBe("price_min=1000&total_area_max=500");
  });
});

describe("valores que no se pueden perder", () => {
  it("gatedCommunity false viaja: es distinto de no filtrar", () => {
    expect(query({ gatedCommunity: false })).toBe("gated_community=false");
  });

  it("priceMin 0 viaja", () => {
    expect(query({ priceMin: 0 })).toBe("price_min=0");
  });

  it("undefined no viaja", () => {
    expect(query({ province: undefined, currency: undefined })).toBe("");
  });
});

describe("pageToQuery", () => {
  it("pasa página y límite normales", () => {
    expect(pageToQuery({ page: 2, limit: 24 })).toEqual({ page: 2, limit: 24 });
  });

  // Un limit de 5000 es un bug del llamador: se recorta en vez de hacerle
  // tirar un 422 al visitante.
  it("recorta el límite al máximo de la API", () => {
    expect(pageToQuery({ page: 1, limit: 5000 }).limit).toBe(100);
  });

  it("corrige valores absurdos en vez de propagarlos", () => {
    expect(pageToQuery({ page: 0, limit: 0 })).toEqual({ page: 1, limit: 12 });
    expect(pageToQuery({ page: -3, limit: -1 })).toEqual({ page: 1, limit: 1 });
    expect(pageToQuery({ page: 1.7, limit: 10.9 })).toEqual({ page: 1, limit: 10 });
  });
});

describe("buildUrl", () => {
  it("normaliza las barras para no generar // ni rutas sin barra", () => {
    expect(buildUrl("http://api/v1/", "/public/listings")).toBe("http://api/v1/public/listings");
    expect(buildUrl("http://api/v1", "public/listings")).toBe("http://api/v1/public/listings");
  });

  it("escapa los valores", () => {
    expect(buildUrl("http://api", "x", { q: "a & b" })).toBe("http://api/x?q=a+%26+b");
  });

  it("sin params no deja el signo de pregunta colgando", () => {
    expect(buildUrl("http://api", "x", {})).toBe("http://api/x");
  });
});
