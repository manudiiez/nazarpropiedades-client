import { describe, expect, it } from "vitest";
import {
  createMockCatalogsRepository,
  createMockListingsRepository,
} from "@/lib/data/mock/repositories";
import { createHttpCatalogsRepository } from "@/lib/data/http/catalogs";
import { createHttpListingsRepository } from "@/lib/data/http/listings";
import type { CatalogsRepository, ListingsRepository } from "@/lib/data";
import { DEFAULT_PAGE_SIZE, type Catalog, type Facets, type Listing, type ListingSummary, type Page } from "@/lib/domain";

// Suite de contrato: la misma batería contra las dos implementaciones.
//
// Su razón de ser: el bug caro de tener dos fuentes de datos no es "esta
// función devuelve mal", es "el mock se comporta distinto de la API y la UI que
// armé contra el mock se rompe en producción". Esta suite ataca eso y ya
// encontró dos divergencias reales (totalPages con 0 resultados, y getRelated
// con un id inexistente).
//
// Las dos implementaciones corren sobre datos distintos, así que los casos no
// comparan cantidades ni ids: comparan INVARIANTES, lo que tiene que valer
// siempre con cualquier dato.
//
// La implementación HTTP solo entra si hay una API respondiendo. Si no la hay,
// se SALTEA con un aviso en vez de fallar: en CI no hay API levantada, y un
// rojo por falta de infraestructura entrena a la gente a ignorar el rojo.
//
// Los datos se piden UNA vez por implementación y después se verifican muchas
// invariantes sobre ellos. No es solo por velocidad: en los tests el
// `use cache` es un no-op (ver tests/stubs/next-cache.ts), así que cada llamada
// pega a la red de verdad, y una aserción por pedido agotaba los 60/min de la
// API. El caché que protege a producción no existe acá.

const API_URL = process.env.TEST_API_URL ?? "http://localhost:8000/api/v1";

// En tiempo de colección: `skipIf` se evalúa al armar la suite, antes de
// cualquier hook, así que un beforeAll llegaría tarde y saltearía siempre.
const apiViva = await (async (): Promise<boolean> => {
  try {
    const res = await fetch(`${API_URL}/public/facets`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
})();

if (!apiViva) {
  console.warn(
    `\n  ⚠ API no disponible en ${API_URL}: los casos de la implementación HTTP se saltean.` +
      `\n    Para correrlos: levantá la API y repetí (o TEST_API_URL=... npm test).\n`,
  );
}

interface Datos {
  page: Page<ListingSummary>;
  vacia: Page<ListingSummary>;
  fueraDeRango: Page<ListingSummary>;
  limiteAbusivo: Page<ListingSummary>;
  porVenta: Page<ListingSummary>;
  menorPrecio: Page<ListingSummary>;
  mayorPrecio: Page<ListingSummary>;
  detalle: Listing | null;
  inexistente: Listing | null;
  latest: ListingSummary[];
  relacionadas: ListingSummary[];
  relacionadasDeInexistente: ListingSummary[];
  sinIds: ListingSummary[];
  enOrdenPedido: { pedidos: number[]; devueltos: number[] };
  catalog: Catalog;
  catalogParcial: Catalog;
  facets: Facets;
}

// Un id que no puede existir en ninguna de las dos fuentes.
const ID_INEXISTENTE = 987_654_321;

async function recolectar(
  listings: ListingsRepository,
  catalogs: CatalogsRepository,
): Promise<Datos> {
  const page = await listings.search({}, { page: 1, limit: DEFAULT_PAGE_SIZE });
  const primero = page.items[0];

  const pedidos = page.items.slice(0, 3).map((i) => i.id).reverse();

  return {
    page,
    vacia: await listings.search({ priceMin: 999_999_999, currency: "USD" }, { page: 1, limit: 12 }),
    fueraDeRango: await listings.search({}, { page: 9999, limit: 10 }),
    limiteAbusivo: await listings.search({}, { page: 1, limit: 5000 }),
    porVenta: await listings.search({ condition: ["sale"] }, { page: 1, limit: 100 }),
    menorPrecio: await listings.search({ sort: "menor_precio" }, { page: 1, limit: 100 }),
    mayorPrecio: await listings.search({ sort: "mayor_precio" }, { page: 1, limit: 100 }),
    detalle: primero === undefined ? null : await listings.getById(primero.id),
    inexistente: await listings.getById(ID_INEXISTENTE),
    latest: await listings.getLatest(),
    relacionadas: primero === undefined ? [] : await listings.getRelated(primero.id),
    relacionadasDeInexistente: await listings.getRelated(ID_INEXISTENTE),
    sinIds: await listings.getByIds([]),
    enOrdenPedido: {
      pedidos,
      devueltos: (await listings.getByIds(pedidos)).map((i) => i.id),
    },
    catalog: await catalogs.getCatalog(),
    catalogParcial: await catalogs.getCatalog(["currencies"]),
    facets: await catalogs.getFacets(),
  };
}

const IMPLEMENTACIONES: { nombre: string; disponible: boolean; crear: () => Promise<Datos> }[] = [
  {
    nombre: "mock",
    disponible: true,
    crear: () => recolectar(createMockListingsRepository(), createMockCatalogsRepository()),
  },
  {
    nombre: "http",
    disponible: apiViva,
    crear: () =>
      recolectar(createHttpListingsRepository(API_URL), createHttpCatalogsRepository(API_URL)),
  },
];

for (const impl of IMPLEMENTACIONES) {
  describe.skipIf(!impl.disponible)(`contrato — ${impl.nombre}`, () => {
    // Una sola recolección por implementación, compartida por todos los casos.
    let d: Datos;

    it("recolecta los datos", async () => {
      d = await impl.crear();
      expect(d).toBeDefined();
    });

    describe("paginación", () => {
      it("la página es coherente consigo misma", () => {
        expect(d.page.page).toBe(1);
        expect(d.page.limit).toBe(DEFAULT_PAGE_SIZE);
        expect(d.page.total).toBeGreaterThanOrEqual(d.page.items.length);
        expect(d.page.items.length).toBeLessThanOrEqual(d.page.limit);
        expect(d.page.totalPages).toBe(Math.ceil(d.page.total / d.page.limit));
      });

      it("una búsqueda sin resultados es una página vacía, no un error", () => {
        expect(d.vacia.items).toEqual([]);
        expect(d.vacia.total).toBe(0);
        // La API devuelve 0, no 1: la UI no puede asumir que siempre hay al
        // menos una página. Con total 0 no va paginador.
        expect(d.vacia.totalPages).toBe(0);
      });

      it("una página fuera de rango viene vacía, no falla", () => {
        expect(d.fueraDeRango.items).toEqual([]);
      });

      it("recorta un límite abusivo al máximo de la API", () => {
        expect(d.limiteAbusivo.limit).toBe(100);
      });
    });

    describe("filtros y orden", () => {
      it("respeta el filtro de condición", () => {
        expect(d.porVenta.items.every((i) => i.condition === "sale")).toBe(true);
      });

      it("ordena por menor precio", () => {
        const precios = d.menorPrecio.items.map((i) => i.price.amount);
        expect([...precios].sort((a, b) => a - b)).toEqual(precios);
      });

      it("ordena por mayor precio", () => {
        const precios = d.mayorPrecio.items.map((i) => i.price.amount);
        expect([...precios].sort((a, b) => b - a)).toEqual(precios);
      });

      it("el orden por defecto es por fecha descendente", () => {
        const fechas = d.page.items.map((i) => i.createdAt.getTime());
        expect([...fechas].sort((a, b) => b - a)).toEqual(fechas);
      });
    });

    describe("mapeo de cada listing", () => {
      it("los precios son números finitos, nunca NaN", () => {
        for (const item of d.page.items) {
          expect(Number.isFinite(item.price.amount)).toBe(true);
          if (item.expenses !== null) expect(Number.isFinite(item.expenses.amount)).toBe(true);
        }
      });

      it("trae etiqueta de tipo, condición y ubicación, nunca el slug crudo", () => {
        for (const item of d.page.items) {
          expect(item.propertyTypeLabel).toBeTruthy();
          expect(item.conditionLabel).toBeTruthy();
          expect(item.location.provinceLabel).not.toMatch(/_/);
          expect(item.location.departmentLabel).not.toMatch(/_/);
          if (item.location.zone !== null) expect(item.location.zoneLabel).not.toMatch(/_/);
        }
      });

      it("la dirección no viene toda en mayúsculas", () => {
        for (const item of d.page.items) {
          const dir = item.location.fullAddress;
          if (dir.length > 3) expect(dir).not.toBe(dir.toUpperCase());
        }
      });

      it("createdAt es una fecha válida", () => {
        for (const item of d.page.items) {
          expect(item.createdAt).toBeInstanceOf(Date);
          expect(Number.isNaN(item.createdAt.getTime())).toBe(false);
        }
      });
    });

    describe("getById", () => {
      it("devuelve null para un id inexistente, no lanza", () => {
        expect(d.inexistente).toBeNull();
      });

      it("el detalle corresponde al listing pedido y está publicado", () => {
        if (d.page.items.length === 0) return;
        expect(d.detalle?.id).toBe(d.page.items[0].id);
        expect(d.detalle?.status).toBe("active");
      });

      it("el detalle no trae keyAttributes: lo reemplaza attributes", () => {
        if (d.detalle === null) return;
        expect("keyAttributes" in d.detalle).toBe(false);
      });
    });

    describe("getLatest", () => {
      it("devuelve como máximo 8, por fecha descendente", () => {
        expect(d.latest.length).toBeLessThanOrEqual(8);
        const fechas = d.latest.map((i) => i.createdAt.getTime());
        expect([...fechas].sort((a, b) => b - a)).toEqual(fechas);
      });
    });

    describe("getRelated", () => {
      it("devuelve como máximo 4 y nunca la propiedad base", () => {
        expect(d.relacionadas.length).toBeLessThanOrEqual(4);
        if (d.page.items.length === 0) return;
        expect(d.relacionadas.some((i) => i.id === d.page.items[0].id)).toBe(false);
      });

      // Divergencia encontrada por esta suite: la implementación HTTP lanzaba
      // NotFoundError donde la mock devolvía vacío.
      it("para un id inexistente devuelve vacío, no lanza", () => {
        expect(d.relacionadasDeInexistente).toEqual([]);
      });
    });

    describe("getByIds", () => {
      it("sin ids devuelve vacío sin hacer ningún pedido", () => {
        expect(d.sinIds).toEqual([]);
      });

      it("respeta el orden en que se pidieron los ids", () => {
        if (d.enOrdenPedido.pedidos.length < 2) return;
        expect(d.enOrdenPedido.devueltos).toEqual(d.enOrdenPedido.pedidos);
      });
    });

    describe("catálogo", () => {
      it("trae el árbol de ubicaciones con etiquetas legibles", () => {
        expect((d.catalog.provinces ?? []).length).toBeGreaterThan(0);
        for (const province of d.catalog.provinces ?? []) {
          expect(province.label).not.toMatch(/_/);
          for (const department of province.departments) {
            expect(department.label).not.toMatch(/_/);
            for (const zone of department.zones) expect(zone.label).not.toMatch(/_/);
          }
        }
      });

      it("trae los 16 tipos y las 44 amenities, todas con etiqueta", () => {
        expect(d.catalog.propertyTypes).toHaveLength(16);
        expect(d.catalog.amenities).toHaveLength(44);
        expect((d.catalog.amenities ?? []).every((a) => a.label !== "")).toBe(true);
      });

      it("con `include` omite las secciones no pedidas, no las vacía", () => {
        expect(d.catalogParcial.currencies).toBeDefined();
        expect(d.catalogParcial.provinces).toBeUndefined();
        expect(d.catalogParcial.amenities).toBeUndefined();
      });
    });

    describe("facets", () => {
      it("los tipos vienen completos, con los count 0 incluidos", () => {
        expect(d.facets.propertyTypes).toHaveLength(16);
        expect(d.facets.propertyTypes.every((t) => t.count >= 0)).toBe(true);
      });

      it("las ubicaciones solo aparecen donde hay algo publicado", () => {
        expect(d.facets.provinces.every((p) => p.count > 0)).toBe(true);
        for (const province of d.facets.provinces) {
          expect(province.departments.every((dep) => dep.count > 0)).toBe(true);
        }
      });

      it("el count de un departamento es >= la suma de sus zonas", () => {
        // Las propiedades sin zona cargada suman al departamento pero no
        // aparecen como zona. No es un error de datos.
        for (const province of d.facets.provinces) {
          for (const department of province.departments) {
            const suma = department.zones.reduce((n, z) => n + z.count, 0);
            expect(department.count).toBeGreaterThanOrEqual(suma);
          }
        }
      });

      it("el total coincide con el total del listado sin filtros", () => {
        expect(d.facets.total).toBe(d.page.total);
      });

      it("el priceRange tiene min <= max en cada moneda", () => {
        for (const bounds of Object.values(d.facets.priceRange)) {
          expect(bounds.min).toBeLessThanOrEqual(bounds.max);
        }
      });
    });
  });
}
