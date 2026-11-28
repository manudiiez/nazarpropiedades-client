import { describe, expect, it } from "vitest";
import {
  PARAMS,
  filtrosDesdeSearchParams,
  paginaDesdeSearchParams,
  searchParamsDesdeFiltros,
} from "@/lib/filters";
import { mapCatalog } from "@/lib/data/http/mappers";
import { validateFilters } from "@/lib/data/validate-filters";
import {
  AGE_RANGES,
  CONDITIONS,
  CURRENCIES,
  DEFAULT_PAGE_SIZE,
  LISTING_SORTS,
  type AgeRange,
  type Catalog,
  type Condition,
  type Currency,
  type GarageCount,
  type ListingFilters,
  type ListingSort,
  type RoomCount,
} from "@/lib/domain";
import catalogFixture from "@/lib/data/mock/fixtures/catalog.json";

// El catálogo real de la API (vía las fixtures del mock), para que los valores
// de ubicación de los tests sean los que existen de verdad.
const CATALOGO: Catalog = mapCatalog(catalogFixture);

const parsear = (query: string, catalog: Catalog = CATALOGO) =>
  filtrosDesdeSearchParams(new URLSearchParams(query), catalog);

const filtros = (query: string, catalog: Catalog = CATALOGO): ListingFilters =>
  parsear(query, catalog).filtros;

const serializar = (f: ListingFilters, pagina?: number): string =>
  searchParamsDesdeFiltros(f, pagina).toString();

describe("los params están en español y no son los de la API", () => {
  it("no hay ningún param con el nombre de la API", () => {
    const nombres = Object.values(PARAMS);
    for (const deLaApi of ["condition", "property_type", "search", "sort", "limit", "page"]) {
      expect(nombres).not.toContain(deLaApi);
    }
  });

  it("una URL legible se traduce al dominio", () => {
    expect(
      filtros("operacion=venta&tipo=house&zona=chacras_de_coria&precio_max=300000"),
    ).toEqual({
      condition: ["sale"],
      propertyType: ["house"],
      zone: ["chacras_de_coria"],
      priceMax: 300000,
      sort: "reciente",
    });
  });
});

describe("multi-valor", () => {
  // Repetido, no separado por comas: `URLSearchParams` lo maneja solo y es lo
  // que ya hace la capa HTTP contra la API.
  it("los params se repiten", () => {
    expect(filtros("operacion=venta&operacion=alquiler").condition).toEqual(["sale", "rent"]);
    expect(serializar({ condition: ["sale", "rent"] })).toBe("operacion=venta&operacion=alquiler");
  });

  it("un valor con comas no se parte: se descarta como desconocido", () => {
    const { filtros: f, descartados } = parsear("operacion=venta,alquiler");
    expect(f.condition).toBeUndefined();
    expect(descartados).toEqual([
      { param: "operacion", valor: "venta,alquiler", motivo: "desconocido" },
    ]);
  });

  it("los repetidos iguales y los vacíos no duplican ni ensucian", () => {
    expect(filtros("zona=chacras_de_coria&zona=chacras_de_coria&zona=").zone).toEqual([
      "chacras_de_coria",
    ]);
  });
});

describe("valores inválidos: se ignoran, no fallan", () => {
  it("una zona que ya no existe se descarta y el resto del filtro sobrevive", () => {
    const { filtros: f, descartados } = parsear("zona=barrio_que_ya_no_existe&operacion=venta");
    expect(f).toEqual({ condition: ["sale"], sort: "reciente" });
    expect(descartados).toEqual([
      { param: "zona", valor: "barrio_que_ya_no_existe", motivo: "desconocido" },
    ]);
  });

  it("una URL entera de basura devuelve filtros vacíos, no un error", () => {
    const { filtros: f, descartados } = parsear(
      "operacion=comprar&tipo=casita&precio_min=mucho&dormitorios=siete&antiguedad=vieja&barrio_cerrado=quizas",
    );
    expect(f).toEqual({ sort: "reciente" });
    expect(descartados).toHaveLength(6);
  });

  it("los números negativos y los no numéricos se descartan como inválidos", () => {
    expect(parsear("precio_min=-1").descartados).toEqual([
      { param: "precio_min", valor: "-1", motivo: "invalido" },
    ]);
    expect(filtros("precio_max=300000.75").priceMax).toBe(300000);
  });

  it("un param de un solo valor repetido usa el primero y reporta el resto", () => {
    const { filtros: f, descartados } = parsear("provincia=mendoza&provincia=san_juan");
    expect(f.province).toBe("mendoza");
    expect(descartados).toEqual([
      { param: "provincia", valor: "san_juan", motivo: "desconocido" },
    ]);
  });

  it("params que no son filtros se ignoran sin reportar", () => {
    const { filtros: f, descartados } = parsear("utm_source=whatsapp&fbclid=abc");
    expect(f).toEqual({ sort: "reciente" });
    expect(descartados).toEqual([]);
  });

  // La razón de ser de esto: lo que sale de acá se le pasa a la capa de datos,
  // que SÍ lanza con un valor que no está en el catálogo.
  it("lo que sale del parseo nunca hace lanzar a validateFilters", () => {
    const f = filtros(
      "tipo=casita&zona=inexistente&departamento=narnia&amenities=sauna_falso&provincia=atlantida",
    );
    expect(() => validateFilters(f, CATALOGO)).not.toThrow();
  });

  it("sin la sección del catálogo, el valor se deja pasar en vez de descartarse", () => {
    // El catálogo pedido con `?include=` puede no traer ubicaciones; eso es
    // distinto de traerlas vacías.
    expect(filtros("zona=lo_que_sea", {}).zone).toEqual(["lo_que_sea"]);
    expect(filtros("zona=lo_que_sea", { provinces: [] }).zone).toBeUndefined();
  });
});

describe("defaults omitidos", () => {
  it("el orden por defecto no se serializa", () => {
    expect(serializar({ sort: "reciente" })).toBe("");
    expect(serializar({ sort: "menor_precio" })).toBe("orden=menor_precio");
  });

  it("una URL sin orden y una con el orden por defecto dan el mismo objeto", () => {
    expect(filtros("")).toEqual(filtros("orden=reciente"));
    expect(filtros("").sort).toBe("reciente");
  });

  it("la página 1 no se serializa", () => {
    expect(serializar({}, 1)).toBe("");
    expect(serializar({}, 3)).toBe("pagina=3");
  });

  it("los arrays vacíos y los strings vacíos no generan params", () => {
    expect(serializar({ condition: [], zone: [], addressQuery: "   " })).toBe("");
  });
});

describe("paginación", () => {
  it("sin param, página 1 con el tamaño por defecto", () => {
    expect(paginaDesdeSearchParams(new URLSearchParams(""))).toEqual({
      page: 1,
      limit: DEFAULT_PAGE_SIZE,
    });
  });

  it("una página basura cae en 1 en vez de fallar", () => {
    for (const query of ["pagina=0", "pagina=-3", "pagina=ultima", "pagina="]) {
      expect(paginaDesdeSearchParams(new URLSearchParams(query)).page).toBe(1);
    }
  });

  // El tamaño de página no viaja en la URL: `?limit=100` sería un pedido caro
  // gratis y la misma lista en N URLs distintas.
  it("el tamaño de página no se puede cambiar desde la URL", () => {
    expect(paginaDesdeSearchParams(new URLSearchParams("limit=100&pagina=2"))).toEqual({
      page: 2,
      limit: DEFAULT_PAGE_SIZE,
    });
  });
});

describe("searchParams de una Server Component", () => {
  it("se acepta el objeto que entrega Next, con valores repetidos como array", () => {
    expect(
      filtrosDesdeSearchParams(
        { operacion: ["venta", "alquiler"], precio_max: "300000", vacio: undefined },
        CATALOGO,
      ).filtros,
    ).toEqual({ condition: ["sale", "rent"], priceMax: 300000, sort: "reciente" });
  });
});

describe("ida y vuelta", () => {
  const COMPLETO: ListingFilters = {
    condition: ["sale", "temporary_rent"],
    propertyType: ["house", "ph"],
    province: "mendoza",
    department: ["lujan_de_cuyo", "capital"],
    zone: ["chacras_de_coria"],
    currency: "USD",
    priceMin: 50000,
    priceMax: 300000,
    totalAreaMin: 100,
    totalAreaMax: 620,
    bedrooms: [0, 3, "5+"],
    bathrooms: [1, "5+"],
    garageCapacity: [0, "3+"],
    gatedCommunity: true,
    age: ["brand_new", "over-20"],
    amenities: ["swimming_pool", "alarm"],
    addressQuery: "San Martín",
    sort: "menor_precio",
  };

  it("un filtro completo vuelve igual", () => {
    expect(filtros(serializar(COMPLETO))).toEqual(COMPLETO);
  });

  it("la página vuelve igual", () => {
    expect(paginaDesdeSearchParams(searchParamsDesdeFiltros(COMPLETO, 4)).page).toBe(4);
  });

  it("serializar es idempotente: el historial no se vuelve impredecible", () => {
    const query = serializar(COMPLETO, 4);
    const params = new URLSearchParams(query);
    const vuelta = searchParamsDesdeFiltros(
      filtrosDesdeSearchParams(params, CATALOGO).filtros,
      paginaDesdeSearchParams(params).page,
    ).toString();
    expect(vuelta).toBe(query);
  });

  it("gatedCommunity false sobrevive: no es lo mismo que no filtrar", () => {
    expect(serializar({ gatedCommunity: false })).toBe("barrio_cerrado=no");
    expect(filtros("barrio_cerrado=no").gatedCommunity).toBe(false);
    expect(filtros("barrio_cerrado=si").gatedCommunity).toBe(true);
  });

  it("el 0 sobrevive: monoambiente y sin cochera son filtros, no ausencia", () => {
    expect(filtros("dormitorios=0&cocheras=0")).toMatchObject({
      bedrooms: [0],
      garageCapacity: [0],
    });
  });

  it("la dirección mantiene acentos y espacios", () => {
    expect(filtros(serializar({ addressQuery: "San Martín 1234" })).addressQuery).toBe(
      "San Martín 1234",
    );
  });
});

// Un conjunto cerrado al que se le agrega un valor y nadie actualiza el
// vocabulario de la URL es el bug de las amenities otra vez (issue #20): el
// filtro deja de funcionar para ese valor y nadie se entera.
describe("el vocabulario de la URL cubre todos los enums del dominio", () => {
  const ida = <T>(valor: T, arma: (valor: T) => ListingFilters, leer: (f: ListingFilters) => unknown) => {
    const query = serializar(arma(valor));
    expect(query, `${String(valor)} no se serializa`).not.toBe("");
    expect(leer(filtros(query)), `${String(valor)} no vuelve del parseo`).toEqual([valor]);
  };

  it("todas las operaciones", () => {
    for (const condition of CONDITIONS satisfies readonly Condition[]) {
      ida(condition, (v) => ({ condition: [v] }), (f) => f.condition);
    }
  });

  it("todos los tramos de antigüedad", () => {
    for (const age of AGE_RANGES satisfies readonly AgeRange[]) {
      ida(age, (v) => ({ age: [v] }), (f) => f.age);
    }
  });

  it("todos los ambientes y cocheras", () => {
    for (const valor of [0, 1, 2, 3, 4, "5+"] satisfies readonly RoomCount[]) {
      ida(valor, (v) => ({ bedrooms: [v] }), (f) => f.bedrooms);
      ida(valor, (v) => ({ bathrooms: [v] }), (f) => f.bathrooms);
    }
    for (const valor of [0, 1, 2, "3+"] satisfies readonly GarageCount[]) {
      ida(valor, (v) => ({ garageCapacity: [v] }), (f) => f.garageCapacity);
    }
  });

  it("todas las monedas", () => {
    for (const currency of CURRENCIES satisfies readonly Currency[]) {
      expect(filtros(serializar({ currency })).currency).toBe(currency);
    }
  });

  it("todos los órdenes", () => {
    for (const sort of LISTING_SORTS satisfies readonly ListingSort[]) {
      expect(filtros(serializar({ sort })).sort).toBe(sort);
    }
  });
});
