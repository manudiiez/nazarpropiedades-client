import { describe, expect, it } from "vitest";
import {
  mapCatalog,
  mapFacets,
  mapListing,
  mapListingSummary,
  normalizeAddress,
} from "@/lib/data/http/mappers";
import { buildLabelIndex, humanize, EMPTY_LABEL_INDEX } from "@/lib/data/http/label-index";
import { MappingError } from "@/lib/data/http/parse";
import catalogo from "@/lib/data/mock/fixtures/catalog.json";
import respuestas from "./fixtures/respuestas-api.json";

// Payloads capturados de la API corriendo, no inventados: si el contrato
// cambia, estos tests son los que avisan.
const ITEM_LISTADO = respuestas.listado.data[0] as unknown;
const DETALLE = respuestas.detalle.data as unknown;
const LABELS = buildLabelIndex(mapCatalog(catalogo));

describe("mapListingSummary contra un payload real", () => {
  const listing = mapListingSummary(ITEM_LISTADO, "x", LABELS);

  it("convierte el precio de string a número y conserva la moneda", () => {
    expect(typeof listing.price.amount).toBe("number");
    expect(listing.price.amount).toBeGreaterThan(0);
    expect(["USD", "ARS"]).toContain(listing.price.currency);
  });

  it("resuelve las etiquetas de ubicación contra el catálogo", () => {
    // Los listings devuelven solo slugs; la etiqueta sale del catálogo.
    expect(listing.location.department).toBe("godoy_cruz");
    expect(listing.location.departmentLabel).toBe("Godoy Cruz");
    expect(listing.location.zoneLabel).toBe("Godoy Cruz Centro");
  });

  it("resuelve la etiqueta del tipo de propiedad y de la condición", () => {
    expect(listing.propertyTypeLabel).toBe("Casa");
    expect(listing.conditionLabel).toBe("Venta");
  });

  it("normaliza la dirección, que la API manda en mayúsculas", () => {
    expect(listing.location.fullAddress).not.toBe(listing.location.fullAddress.toUpperCase());
    expect(listing.location.fullAddress).toMatch(/Godoy Cruz/);
  });

  it("convierte createdAt a Date", () => {
    expect(listing.createdAt).toBeInstanceOf(Date);
    expect(Number.isNaN(listing.createdAt.getTime())).toBe(false);
  });

  it("deja keyAttributes como números cuando el valor es numérico", () => {
    expect(typeof listing.keyAttributes.bedrooms).toBe("number");
  });
});

describe("mapListing contra el detalle real", () => {
  const detalle = mapListing(DETALLE, "x", LABELS);

  it("mapea las fotos ordenadas por sortOrder", () => {
    expect(detalle.photos.length).toBeGreaterThan(0);
    const ordenes = detalle.photos.map((p) => p.sortOrder);
    expect([...ordenes].sort((a, b) => a - b)).toEqual(ordenes);
  });

  it("parsea los atributos enriquecidos y convierte sus valores numéricos", () => {
    const superficie = detalle.attributes.find((a) => a.key === "total_area");
    expect(superficie).toBeDefined();
    // La API los manda como string ("620"): el mapper los convierte.
    expect(typeof superficie?.value).toBe("number");
    expect(superficie?.label).toBeTruthy();
  });

  it("los booleanos del JSONB llegan capitalizados como en Python", () => {
    // Las amenities y las zonas cercanas vienen con "True"/"False", no con
    // "true"/"false": sin convertirlos, la ficha muestra "Piscina: True".
    const conAmenity = mapListing(
      {
        ...(DETALLE as Record<string, unknown>),
        amenities: [
          { key: "swimming_pool", value: "True", label: "Piscina", suffix: null, section: null },
          { key: "elevator", value: "False", label: "Ascensor", suffix: null, section: null },
        ],
      },
      "x",
      LABELS,
    );
    expect(conAmenity.amenities.map((a) => a.value)).toEqual([true, false]);
  });

  it("respeta showMap y las coordenadas", () => {
    expect(typeof detalle.map.showMap).toBe("boolean");
  });

  // El detalle NO trae key_attributes: eso fue el bug de #17.
  it("el detalle no tiene keyAttributes", () => {
    expect("keyAttributes" in detalle).toBe(false);
  });
});

describe("casos que no pueden romper el mapeo", () => {
  const base = respuestas.listado.data[0] as Record<string, unknown>;

  it("una propiedad sin fotos procesadas se mapea con coverPhoto null", () => {
    const listing = mapListingSummary({ ...base, cover_photo: null }, "x", LABELS);
    expect(listing.coverPhoto).toBeNull();
  });

  it("sin zona ni calle se mapea con nulls, no con strings vacíos", () => {
    const listing = mapListingSummary(
      { ...base, zone: null, neighborhood_or_street: null },
      "x",
      LABELS,
    );
    expect(listing.location.zone).toBeNull();
    expect(listing.location.zoneLabel).toBeNull();
    expect(listing.location.neighborhoodOrStreet).toBeNull();
  });

  it("has_expenses en false ignora el monto aunque venga cargado", () => {
    const listing = mapListingSummary(
      { ...base, has_expenses: false, expenses: "99999.00", expenses_currency: "ARS" },
      "x",
      LABELS,
    );
    expect(listing.expenses).toBeNull();
  });

  it("has_expenses en true sí lee el monto", () => {
    const listing = mapListingSummary(
      { ...base, has_expenses: true, expenses: "35000.00", expenses_currency: "ARS" },
      "x",
      LABELS,
    );
    expect(listing.expenses).toEqual({ amount: 35000, currency: "ARS" });
  });

  it("un atributo roto se descarta sin tirar abajo la ficha entera", () => {
    const detalle = respuestas.detalle.data as Record<string, unknown>;
    const atributos = detalle.attributes as unknown[];
    const mapeado = mapListing(
      { ...detalle, attributes: [...atributos, { key: "roto" }] },
      "x",
      LABELS,
    );
    expect(mapeado.attributes).toHaveLength(atributos.length);
  });

  it("un tipo de propiedad que el catálogo no conoce no rompe: se degrada", () => {
    const listing = mapListingSummary({ ...base, property_type: "casa_rodante" }, "x", LABELS);
    expect(listing.propertyType).toBe("casa_rodante");
    expect(listing.propertyTypeLabel).toBe("Casa Rodante");
  });
});

describe("campos obligatorios que sí deben fallar", () => {
  const base = respuestas.listado.data[0] as Record<string, unknown>;

  it.each(["id", "price", "currency", "province", "department", "full_address", "created_at"])(
    "falla si falta %s",
    (campo) => {
      const roto = { ...base };
      delete roto[campo];
      expect(() => mapListingSummary(roto, "listing", LABELS)).toThrow(MappingError);
    },
  );

  it("falla con una condición desconocida: el front tiene lógica que depende de ella", () => {
    expect(() => mapListingSummary({ ...base, condition: "leasing" }, "x", LABELS)).toThrow(
      MappingError,
    );
  });

  it("falla con una moneda desconocida, por el formato de precio", () => {
    expect(() => mapListingSummary({ ...base, currency: "EUR" }, "x", LABELS)).toThrow(MappingError);
  });
});

describe("normalizeAddress", () => {
  it("pasa las mayúsculas a capitalizadas", () => {
    expect(normalizeAddress("BARRIO PALMARES, PRIMERA ETAPA, GODOY CRUZ")).toBe(
      "Barrio Palmares, Primera Etapa, Godoy Cruz",
    );
  });

  it("no toca una dirección ya bien escrita", () => {
    expect(normalizeAddress("Viamonte 2300, Chacras de Coria")).toBe(
      "Viamonte 2300, Chacras de Coria",
    );
  });

  it("capitaliza después de separadores, no solo después de espacios", () => {
    expect(normalizeAddress("OZAMIS SUR S/N")).toBe("Ozamis Sur S/N");
  });
});

describe("humanize: el fallback cuando falta la etiqueta", () => {
  it("convierte el slug en algo legible", () => {
    expect(humanize("chacras_de_coria")).toBe("Chacras De Coria");
    expect(humanize("service-station")).toBe("Service Station");
  });

  // El fallback es deliberadamente imperfecto: si se ve así, falta en el
  // catálogo de la API y hay que corregirlo allá, no parchearlo acá.
  it("no intenta arreglar acentos ni preposiciones", () => {
    expect(humanize("lujan_de_cuyo")).toBe("Lujan De Cuyo");
  });
});

describe("mapCatalog", () => {
  const catalog = mapCatalog(catalogo);

  it("mapea el árbol completo de ubicaciones", () => {
    expect(catalog.provinces).toHaveLength(1);
    expect(catalog.provinces?.[0].departments).toHaveLength(18);
    const zonas = catalog.provinces?.[0].departments.reduce((n, d) => n + d.zones.length, 0);
    expect(zonas).toBe(215);
  });

  it("mapea las 44 amenities con su sección", () => {
    expect(catalog.amenities).toHaveLength(44);
    expect(catalog.amenities?.every((a) => a.section !== null)).toBe(true);
  });

  // Con `?include=` hay que poder distinguir "no la pedí" de "no hay nada".
  it("una sección ausente queda undefined, no array vacío", () => {
    const parcial = mapCatalog({ currencies: [{ value: "USD", label: "Dólares" }] });
    expect(parcial.currencies).toHaveLength(1);
    expect(parcial.provinces).toBeUndefined();
    expect(parcial.amenities).toBeUndefined();
  });

  it("una sección vacía queda como array vacío, distinto de ausente", () => {
    const vacia = mapCatalog({ amenities: [] });
    expect(vacia.amenities).toEqual([]);
  });

  it("una sección de amenity desconocida no descarta la amenity", () => {
    const raro = mapCatalog({
      amenities: [{ value: "x", label: "X", section: "seccion_nueva" }],
    });
    expect(raro.amenities?.[0].section).toBeNull();
    expect(raro.amenities?.[0].value).toBe("x");
  });
});

describe("mapFacets contra un payload real", () => {
  const facets = mapFacets(respuestas.facets.data);

  it("mapea los tres niveles con sus counts", () => {
    expect(facets.provinces[0].count).toBeGreaterThan(0);
    expect(facets.provinces[0].label).toBe("Mendoza");
  });

  it("conserva los tipos con count 0, que vienen a propósito", () => {
    expect(facets.propertyTypes.length).toBe(16);
    expect(facets.propertyTypes.some((t) => t.count === 0)).toBe(true);
  });

  it("convierte el priceRange de strings a números", () => {
    const usd = facets.priceRange.USD;
    expect(usd).toBeDefined();
    expect(typeof usd?.min).toBe("number");
  });

  it("una moneda ausente del priceRange queda ausente, no en cero", () => {
    const sinArs = mapFacets({ ...respuestas.facets.data, price_range: { USD: { min: "1", max: "2" } } });
    expect(sinArs.priceRange.ARS).toBeUndefined();
  });

  // La API devuelve 200 con todo vacío cuando no hay nada publicado.
  it("tolera una base vacía", () => {
    const vacio = mapFacets({ provinces: [], property_types: [], conditions: [], price_range: {}, total: 0 });
    expect(vacio.total).toBe(0);
    expect(vacio.provinces).toEqual([]);
    expect(vacio.priceRange).toEqual({});
  });
});

describe("buildLabelIndex", () => {
  it("un catálogo vacío no rompe: todo cae al fallback", () => {
    const listing = mapListingSummary(respuestas.listado.data[0], "x", EMPTY_LABEL_INDEX);
    expect(listing.location.departmentLabel).toBe("Godoy Cruz");
  });
});
