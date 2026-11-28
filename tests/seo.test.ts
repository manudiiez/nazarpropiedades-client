import { describe, expect, it } from "vitest";
import {
  MAX_DESCRIPCION,
  debeIndexar,
  escaparParaXml,
  urlsDeListados,
  descripcionDeListado,
  descripcionDePropiedad,
  fotosParaCompartir,
  jsonLdAHtml,
  jsonLdDePropiedad,
  recortar,
  tituloDeListado,
} from "@/lib/seo";
import { mapCatalog } from "@/lib/data/http/mappers";
import type { Catalog, Facets, Listing, ListingFilters } from "@/lib/domain";
import catalogFixture from "@/lib/data/mock/fixtures/catalog.json";

const CATALOGO: Catalog = mapCatalog(catalogFixture);

const ficha = (parcial: Partial<Listing> = {}): Listing =>
  ({
    id: 7,
    propertyType: "house",
    propertyTypeLabel: "Casa",
    condition: "sale",
    conditionLabel: "Venta",
    price: { amount: 320000, currency: "USD" },
    expenses: null,
    createdAt: new Date("2026-11-20T14:00:00.000Z"),
    title: null,
    description: null,
    photos: [],
    attributes: [],
    amenities: [],
    nearbyZones: [],
    siblingListings: [],
    videoUrl: null,
    tour360Url: null,
    status: "active",
    map: { showMap: false, latitude: null, longitude: null, mode: null, range: null },
    location: {
      province: "mendoza",
      provinceLabel: "Mendoza",
      department: "lujan_de_cuyo",
      departmentLabel: "Luján de Cuyo",
      zone: "chacras_de_coria",
      zoneLabel: "Chacras de Coria",
      neighborhoodOrStreet: "Viamonte 2300",
      fullAddress: "Viamonte 2300, Chacras de Coria, Luján de Cuyo, Mendoza",
    },
    ...parcial,
  }) as Listing;

describe("título del listado", () => {
  it("nombra la búsqueda: tipo, operación y lugar", () => {
    const filtros: ListingFilters = {
      propertyType: ["house"],
      condition: ["sale"],
      zone: ["chacras_de_coria"],
    };
    expect(tituloDeListado(filtros, CATALOGO)).toBe("Casa en venta en Chacras de Coria");
  });

  it("sin un tipo único dice 'Propiedades': las etiquetas del catálogo no se pluralizan", () => {
    // "Local comercial" → "Local comerciales" es el bug que evita esta decisión.
    expect(tituloDeListado({ condition: ["sale"] }, CATALOGO)).toBe("Propiedades en venta");
    expect(tituloDeListado({ propertyType: ["house", "ph"] }, CATALOGO)).toBe("Propiedades");
  });

  it("usa el lugar más preciso, y solo cuando hay uno", () => {
    expect(tituloDeListado({ department: ["lujan_de_cuyo"] }, CATALOGO)).toBe(
      "Propiedades en Luján de Cuyo",
    );
    // Dos zonas no se enumeran en un título.
    expect(tituloDeListado({ zone: ["chacras_de_coria", "vistalba"] }, CATALOGO)).toBe(
      "Propiedades",
    );
  });

  it("la página se nombra para que no compitan dos URLs con el mismo título", () => {
    expect(tituloDeListado({ condition: ["sale"] }, CATALOGO, 3)).toBe(
      "Propiedades en venta — Página 3",
    );
  });

  it("la descripción no arruina los nombres propios", () => {
    const descripcion = descripcionDeListado({ condition: ["sale"], zone: ["chacras_de_coria"] }, CATALOGO);
    expect(descripcion).toContain("propiedades en venta en Chacras de Coria");
    expect(descripcion.length).toBeLessThanOrEqual(MAX_DESCRIPCION);
  });
});

describe("qué listados se indexan", () => {
  it("la portada y las combinaciones que alguien buscaría en Google", () => {
    expect(debeIndexar({ filtros: {}, pagina: 1 })).toBe(true);
    expect(debeIndexar({ filtros: { condition: ["sale"] }, pagina: 1 })).toBe(true);
    expect(
      debeIndexar({
        filtros: { condition: ["sale"], propertyType: ["house"], province: "mendoza", zone: ["chacras_de_coria"] },
        pagina: 1,
      }),
    ).toBe(true);
    // El orden por defecto siempre viene resuelto desde la URL.
    expect(debeIndexar({ filtros: { sort: "reciente" }, pagina: 1 })).toBe(true);
  });

  it("no se indexan los filtros profundos, el orden ni la paginación", () => {
    const noIndexables: ConsultaDePrueba[] = [
      { filtros: { priceMax: 300000 }, pagina: 1 },
      { filtros: { amenities: ["pool"] }, pagina: 1 },
      { filtros: { addressQuery: "viamonte" }, pagina: 1 },
      { filtros: { bedrooms: [3] }, pagina: 1 },
      { filtros: { sort: "menor_precio" }, pagina: 1 },
      { filtros: { condition: ["sale", "rent"] }, pagina: 1 },
      { filtros: { zone: ["chacras_de_coria", "vistalba"] }, pagina: 1 },
      { filtros: {}, pagina: 2 },
    ];
    for (const consulta of noIndexables) {
      expect(debeIndexar(consulta), JSON.stringify(consulta)).toBe(false);
    }
  });
});

type ConsultaDePrueba = { filtros: ListingFilters; pagina: number };

describe("descripción de una propiedad", () => {
  it("usa la del CRM, recortada", () => {
    const larga = "Casa amplia. ".repeat(40);
    const descripcion = descripcionDePropiedad(ficha({ description: larga }));
    expect(descripcion.length).toBeLessThanOrEqual(MAX_DESCRIPCION);
    expect(descripcion.endsWith("…")).toBe(true);
  });

  it("sin descripción compone una con lo que siempre está", () => {
    // `description` es nullable y la mayoría de las propiedades del CRM no la
    // trae: el fallback es el caso normal.
    expect(descripcionDePropiedad(ficha())).toBe(
      "Casa en venta en Chacras de Coria. Viamonte 2300, Chacras de Coria, Luján de Cuyo. Consultá por esta propiedad en Nazar Propiedades.",
    );
  });

  it("recortar no parte una palabra al medio", () => {
    expect(recortar("una frase bastante larga para el caso", 20)).toBe("una frase bastante…");
  });
});

describe("datos estructurados", () => {
  it("distingue una venta de un alquiler", () => {
    expect((jsonLdDePropiedad(ficha(), null).offers as Record<string, unknown>).businessFunction).toBe(
      "http://purl.org/goodrelations/v1#Sell",
    );
    const alquiler = ficha({ condition: "rent", conditionLabel: "Alquiler" });
    expect((jsonLdDePropiedad(alquiler, null).offers as Record<string, unknown>).businessFunction).toBe(
      "http://purl.org/goodrelations/v1#LeaseOut",
    );
  });

  it("publica las coordenadas SOLO si el mapa se muestra y el modo es exacto", () => {
    const coordenadas = { latitude: -32.98, longitude: -68.87 };
    const exacta = ficha({ map: { showMap: true, mode: "exact", range: null, ...coordenadas } });
    expect(jsonLdDePropiedad(exacta, null).geo).toEqual({
      "@type": "GeoCoordinates",
      ...coordenadas,
    });

    // Por área: la UI esconde el punto, así que publicarlo acá sería filtrarlo
    // por JSON.
    const porArea = ficha({ map: { showMap: true, mode: "radius", range: 500, ...coordenadas } });
    expect(jsonLdDePropiedad(porArea, null).geo).toBeUndefined();

    // `showMap` manda sobre las coordenadas.
    const oculta = ficha({ map: { showMap: false, mode: "exact", range: null, ...coordenadas } });
    expect(jsonLdDePropiedad(oculta, null).geo).toBeUndefined();
  });

  it("una propiedad sin fotos procesadas no inventa una imagen", () => {
    expect(fotosParaCompartir(ficha())).toEqual([]);
    expect(jsonLdDePropiedad(ficha(), null).image).toBeUndefined();
  });

  it("escapa el '<': la descripción la escribe el CRM", () => {
    // Sin esto, un "</script>" en la descripción cierra la etiqueta y lo que
    // siga se interpreta como HTML: XSS almacenado.
    const conScript = ficha({ description: "Casa <script>alert(1)</script> con pileta" });
    const html = jsonLdAHtml(jsonLdDePropiedad(conScript, null));
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("</script>");
    expect(html).toContain("\\u003c");
    // Y sigue siendo JSON válido.
    expect(() => JSON.parse(html)).not.toThrow();
  });
});

describe("sitemap", () => {
  const facets: Facets = {
    conditions: [
      { value: "sale", label: "Venta", count: 6 },
      { value: "rent", label: "Alquiler", count: 0 },
      { value: "inventada", label: "Inventada", count: 3 },
    ],
    propertyTypes: [],
    priceRange: {},
    total: 6,
    provinces: [
      {
        value: "mendoza",
        label: "Mendoza",
        count: 6,
        departments: [
          { value: "capital", label: "Capital", count: 4, zones: [] },
          { value: "maipu", label: "Maipú", count: 0, zones: [] },
        ],
      },
    ],
  };

  it("publica solo lo que tiene publicaciones y el front sabe filtrar", () => {
    const urls = urlsDeListados(facets);
    expect(urls).toContain("/");
    expect(urls).toContain("/propiedades");
    expect(urls).toContain("/propiedades?operacion=venta");
    expect(urls).toContain("/propiedades?provincia=mendoza&departamento=capital");
    // Sin publicaciones el link promete una lista vacía.
    expect(urls).not.toContain("/propiedades?operacion=alquiler");
    expect(urls.some((url) => url.includes("maipu"))).toBe(false);
    // Una condición que la API agregó y el front no conoce no se puede filtrar.
    expect(urls.some((url) => url.includes("inventada"))).toBe(false);
  });

  it("sin facets publica al menos las páginas fijas", () => {
    expect(urlsDeListados(null)).toEqual(["/", "/propiedades"]);
  });

  it("escapa el & de la query: Next no lo hace y el XML queda mal formado", () => {
    // Verificado contra el sitemap servido: sin esto, un parser de XML falla en
    // la primera URL con filtros y Google rechaza el sitemap entero.
    expect(escaparParaXml("https://x.com/propiedades?a=1&b=2")).toBe(
      "https://x.com/propiedades?a=1&amp;b=2",
    );
    // Si algún día Next empieza a escapar, este test queda como la señal para
    // sacar el escapeo de acá en vez de terminar con "&amp;amp;".
    expect(escaparParaXml("sin query")).toBe("sin query");
  });
});
