import { describe, expect, it } from "vitest";
import {
  OPCIONES_AMBIENTES,
  OPCIONES_ANTIGUEDAD,
  OPCIONES_BARRIO_CERRADO,
  OPCIONES_COCHERAS,
  OPCIONES_ORDEN,
  PARAMS,
  conMonedaParaOrden,
  filtrosAplicados,
  filtrosDesdeSearchParams,
  hayFiltrosAplicados,
  monedasConPublicaciones,
  urlDelListado,
  type OpcionDeFiltro,
} from "@/lib/filters";
import { mapCatalog } from "@/lib/data/http/mappers";
import { resumenDeKeyAttributes } from "@/lib/format";
import type { Catalog, ListingFilters } from "@/lib/domain";
import catalogFixture from "@/lib/data/mock/fixtures/catalog.json";

const CATALOGO: Catalog = mapCatalog(catalogFixture);

// Las opciones de los controles tienen que hablar el mismo idioma que el
// parseo de la URL. Si no, el filtro se dibuja bien, se manda y no filtra: un
// bug que no se ve hasta que alguien cuenta los resultados.
describe("las opciones de los filtros viajan en el vocabulario de la URL", () => {
  const casos: [string, readonly OpcionDeFiltro<unknown>[], (filtros: ListingFilters) => unknown][] = [
    [PARAMS.dormitorios, OPCIONES_AMBIENTES, (f) => f.bedrooms],
    [PARAMS.banos, OPCIONES_AMBIENTES, (f) => f.bathrooms],
    [PARAMS.cocheras, OPCIONES_COCHERAS, (f) => f.garageCapacity],
    [PARAMS.antiguedad, OPCIONES_ANTIGUEDAD, (f) => f.age],
    [PARAMS.orden, OPCIONES_ORDEN, (f) => f.sort],
    [PARAMS.barrioCerrado, OPCIONES_BARRIO_CERRADO, (f) => f.gatedCommunity],
  ];

  for (const [param, opciones, leer] of casos) {
    it(`${param}: cada opción se parsea de vuelta a su valor de dominio`, () => {
      for (const opcion of opciones) {
        const { filtros, descartados } = filtrosDesdeSearchParams(
          new URLSearchParams([[param, opcion.valor]]),
          CATALOGO,
        );
        expect(descartados).toEqual([]);
        const leido = leer(filtros);
        const esperado = opcion.dominio;
        expect(Array.isArray(leido) ? leido : [leido]).toEqual([esperado]);
      }
    });
  }
});

describe("moneda forzada al ordenar por precio", () => {
  it("ordenar por precio sin moneda fuerza una: la API no convierte", () => {
    const { filtros, monedaForzada } = conMonedaParaOrden({ sort: "menor_precio" }, ["ARS"]);
    expect(monedaForzada).toBe("ARS");
    expect(filtros.currency).toBe("ARS");
  });

  it("se respeta la moneda que eligió el visitante", () => {
    const elegidos: ListingFilters = { sort: "mayor_precio", currency: "ARS" };
    const { filtros, monedaForzada } = conMonedaParaOrden(elegidos, ["USD", "ARS"]);
    expect(monedaForzada).toBeNull();
    expect(filtros).toBe(elegidos);
  });

  it("el orden por fecha no fuerza nada: ahí la moneda no afecta el orden", () => {
    const { filtros, monedaForzada } = conMonedaParaOrden({ sort: "reciente" }, ["USD"]);
    expect(monedaForzada).toBeNull();
    expect(filtros.currency).toBeUndefined();
  });

  it("solo se eligen monedas con publicaciones: forzar una vacía daría cero resultados", () => {
    expect(monedasConPublicaciones({ ARS: { min: 1, max: 2 } })).toEqual(["ARS"]);
    // USD primero cuando están las dos: es la moneda en la que se publica la
    // mayoría de las propiedades en venta.
    expect(monedasConPublicaciones({ ARS: {}, USD: {} })).toEqual(["USD", "ARS"]);
    expect(monedasConPublicaciones(undefined)).toEqual([]);
  });

  it("sin facets igual se fuerza una moneda antes que dejar el orden mezclado", () => {
    expect(conMonedaParaOrden({ sort: "menor_precio" }, []).monedaForzada).toBe("USD");
  });
});

describe("filtros aplicados", () => {
  it("resuelve las etiquetas contra el catálogo, no contra diccionarios locales", () => {
    const aplicados = filtrosAplicados(
      { condition: ["sale"], propertyType: ["house"], sort: "reciente" },
      CATALOGO,
    );
    expect(aplicados.map((aplicado) => `${aplicado.etiqueta}: ${aplicado.valor}`)).toEqual([
      "Operación: Venta",
      "Tipo: Casa",
    ]);
  });

  it("el orden no es un filtro: no se ofrece quitarlo", () => {
    expect(filtrosAplicados({ sort: "menor_precio" }, CATALOGO)).toEqual([]);
    expect(hayFiltrosAplicados({ sort: "menor_precio" })).toBe(false);
  });

  it("quitar un valor deja el resto intacto y produce una URL que se vuelve a parsear igual", () => {
    const filtros: ListingFilters = {
      propertyType: ["house", "ph"],
      zone: ["chacras_de_coria"],
      sort: "reciente",
    };
    const [casa] = filtrosAplicados(filtros, CATALOGO);
    expect(casa.filtrosSin.propertyType).toEqual(["ph"]);

    const url = urlDelListado(casa.filtrosSin);
    const query = new URLSearchParams(url.slice(url.indexOf("?") + 1));
    expect(filtrosDesdeSearchParams(query, CATALOGO).filtros).toEqual(casa.filtrosSin);
  });

  it("quitar la provincia se lleva sus departamentos y zonas", () => {
    const filtros: ListingFilters = {
      province: "mendoza",
      department: ["lujan_de_cuyo"],
      zone: ["chacras_de_coria"],
    };
    const provincia = filtrosAplicados(filtros, CATALOGO).find(
      (aplicado) => aplicado.param === PARAMS.provincia,
    );
    expect(provincia?.filtrosSin).toEqual({});
  });

  it("un precio sin moneda elegida no se muestra con una moneda inventada", () => {
    const [sinMoneda] = filtrosAplicados({ priceMin: 320000 }, CATALOGO);
    expect(sinMoneda.valor).toBe("320.000 (cualquier moneda)");

    const [conMoneda] = filtrosAplicados({ currency: "USD", priceMin: 320000 }, CATALOGO).filter(
      (aplicado) => aplicado.param === PARAMS.precioMin,
    );
    expect(conMoneda.valor).toBe("USD 320.000");
  });
});

describe("resumen de la tarjeta", () => {
  it("nombra las claves conocidas y respeta siempre el mismo orden", () => {
    expect(
      resumenDeKeyAttributes({ total_area: 620, bedrooms: 3, bathrooms: 1 }),
    ).toEqual(["3 dormitorios", "1 baño", "620 m² totales"]);
  });

  it("un 0 es un dato: sin cochera se muestra", () => {
    expect(resumenDeKeyAttributes({ garage_capacity: 0 })).toEqual(["0 cocheras"]);
  });

  it("las claves ausentes son el caso normal y no dejan huecos", () => {
    expect(resumenDeKeyAttributes({})).toEqual([]);
  });

  it("una clave sin etiqueta no se muestra cruda en la tarjeta", () => {
    // `floors` existe en el contrato pero no está en la lista de la tarjeta:
    // mostrarla sería "floors: 2".
    expect(resumenDeKeyAttributes({ floors: 2 })).toEqual([]);
  });
});
