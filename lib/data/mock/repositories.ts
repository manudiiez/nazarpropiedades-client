import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type Catalog,
  type CatalogSection,
  type Facets,
  type Inquiry,
  type Listing,
  type ListingFilters,
  type ListingSummary,
  type NewInquiry,
  type Page,
  type PageRequest,
} from "@/lib/domain";
import type { CatalogsRepository } from "../catalogs-repository";
import type { InquiriesRepository } from "../inquiries-repository";
import type { ListingsRepository } from "../listings-repository";
import { buildLabelIndex } from "../http/label-index";
import { mapCatalog, mapFacets, mapInquiry, mapListing, mapListingSummary } from "../http/mappers";
import { matchesFilters, sortListings, type RawListing } from "./filtering";
import catalogFixture from "./fixtures/catalog.json";
import listingsFixture from "./fixtures/listings.json";

// Las fixtures están en el formato CRUDO de la API (snake_case, números como
// strings) y pasan por el MISMO mapper que la implementación HTTP. Si fueran
// objetos de dominio ya mapeados, el mock no probaría el mapeo y los bugs de
// mapeo aparecerían solo en producción.

const RAW_LISTINGS = listingsFixture as unknown as RawListing[];
const CATALOG: Catalog = mapCatalog(catalogFixture);
const LABELS = buildLabelIndex(CATALOG);

function clampPage(page: PageRequest): PageRequest {
  return {
    page: Math.max(Math.trunc(page.page) || 1, 1),
    limit: Math.min(Math.max(Math.trunc(page.limit) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE),
  };
}

function paginate<T>(items: T[], page: PageRequest): Page<T> {
  const { page: numero, limit } = clampPage(page);
  const desde = (numero - 1) * limit;

  return {
    items: items.slice(desde, desde + limit),
    page: numero,
    limit,
    total: items.length,
    // Sin resultados la API devuelve 0, no 1. El mock espeja a la API, no al
    // revés: la UI no debe dibujar paginador cuando total es 0.
    totalPages: Math.ceil(items.length / limit),
  };
}

function summary(raw: RawListing, path: string): ListingSummary {
  return mapListingSummary(raw, path, LABELS);
}

function findRaw(id: number): RawListing | undefined {
  return RAW_LISTINGS.find((listing) => Number(listing.id) === id);
}

export function createMockListingsRepository(): ListingsRepository {
  return {
    async search(filters: ListingFilters, page: PageRequest): Promise<Page<ListingSummary>> {
      const filtrados = sortListings(
        RAW_LISTINGS.filter((listing) => matchesFilters(listing, filters)),
        filters.sort,
      );
      const pagina = paginate(filtrados, page);

      return { ...pagina, items: pagina.items.map((item, i) => summary(item, `mock.listings[${i}]`)) };
    },

    async getById(id: number): Promise<Listing | null> {
      const raw = findRaw(id);
      if (raw === undefined || raw.status !== "active") return null;
      return mapListing(raw, `mock.listing(${id})`, LABELS);
    },

    // La API devuelve 8 fijos.
    async getLatest(): Promise<ListingSummary[]> {
      return sortListings(RAW_LISTINGS, "reciente")
        .slice(0, 8)
        .map((item, i) => summary(item, `mock.latest[${i}]`));
    },

    // Mismo scoreo que la API: tipo +4, condición +3, zona +2, departamento +1.
    // Tope 4, y nunca incluye la propiedad base.
    async getRelated(id: number): Promise<ListingSummary[]> {
      const base = findRaw(id);
      if (base === undefined) return [];

      return RAW_LISTINGS.filter((listing) => Number(listing.id) !== id)
        .map((listing) => {
          let score = 0;
          if (listing.property_type === base.property_type) score += 4;
          if (listing.condition === base.condition) score += 3;
          if (listing.zone !== null && listing.zone === base.zone) score += 2;
          if (listing.department === base.department) score += 1;
          return { listing, score };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map((item, i) => summary(item.listing, `mock.related(${id})[${i}]`));
    },

    // Respeta el orden en que se pidieron los ids.
    async getByIds(ids: number[]): Promise<ListingSummary[]> {
      if (ids.length === 0) return [];

      return ids
        .slice(0, 100)
        .map((id) => findRaw(id))
        .filter((raw): raw is RawListing => raw !== undefined && raw.status === "active")
        .map((raw, i) => summary(raw, `mock.batch[${i}]`));
    },
  };
}

export function createMockCatalogsRepository(): CatalogsRepository {
  return {
    async getCatalog(sections?: CatalogSection[]): Promise<Catalog> {
      if (sections === undefined || sections.length === 0) return CATALOG;

      // Se omiten las secciones no pedidas, igual que la API con `?include=`.
      const pedidas = new Set(sections);
      return {
        provinces: pedidas.has("provinces") ? CATALOG.provinces : undefined,
        propertyTypes: pedidas.has("property_types") ? CATALOG.propertyTypes : undefined,
        conditions: pedidas.has("conditions") ? CATALOG.conditions : undefined,
        currencies: pedidas.has("currencies") ? CATALOG.currencies : undefined,
        amenities: pedidas.has("amenities") ? CATALOG.amenities : undefined,
      };
    },

    // Se derivan de las fixtures, que es lo que hace el endpoint real.
    async getFacets(): Promise<Facets> {
      const activos = RAW_LISTINGS.filter((listing) => listing.status === "active");
      const contar = (predicado: (listing: RawListing) => boolean): number =>
        activos.filter(predicado).length;

      // Tipos y condiciones vienen COMPLETOS con count 0, como la API.
      const propertyTypes = (CATALOG.propertyTypes ?? []).map((entry) => ({
        ...entry,
        count: contar((listing) => listing.property_type === entry.value),
      }));
      const conditions = (CATALOG.conditions ?? []).map((entry) => ({
        ...entry,
        count: contar((listing) => listing.condition === entry.value),
      }));

      // Las ubicaciones, solo donde hay algo publicado.
      const provinces = (CATALOG.provinces ?? [])
        .map((province) => ({
          value: province.value,
          label: province.label,
          count: contar((listing) => listing.province === province.value),
          departments: province.departments
            .map((department) => ({
              value: department.value,
              label: department.label,
              count: contar((listing) => listing.department === department.value),
              zones: department.zones
                .map((zone) => ({
                  value: zone.value,
                  label: zone.label,
                  count: contar((listing) => listing.zone === zone.value),
                }))
                .filter((zone) => zone.count > 0),
            }))
            .filter((department) => department.count > 0),
        }))
        .filter((province) => province.count > 0);

      // Una moneda sin publicaciones no aparece, como en la API.
      const priceRange: Facets["priceRange"] = {};
      for (const currency of ["USD", "ARS"] as const) {
        const precios = activos
          .filter((listing) => listing.currency === currency)
          .map((listing) => Number(listing.price))
          .filter((price) => Number.isFinite(price));
        if (precios.length === 0) continue;
        priceRange[currency] = { min: Math.min(...precios), max: Math.max(...precios) };
      }

      return mapFacets({
        provinces,
        property_types: propertyTypes,
        conditions,
        price_range: Object.fromEntries(
          Object.entries(priceRange).map(([currency, bounds]) => [
            currency,
            { min: String(bounds.min), max: String(bounds.max) },
          ]),
        ),
        total: activos.length,
      });
    },
  };
}

export function createMockInquiriesRepository(): InquiriesRepository {
  // En memoria: se pierde al reiniciar, que es lo correcto para un mock.
  let siguienteId = 1;

  return {
    async create(input: NewInquiry): Promise<Inquiry> {
      return mapInquiry({
        id: siguienteId++,
        nombre: input.nombre,
        apellido: input.apellido,
        numero: input.numero,
        email: input.email ?? null,
        fuente: input.fuente,
        descripcion: input.descripcion,
        status: "nueva",
        listing_id: input.listingId ?? null,
        created_at: new Date().toISOString(),
      });
    },
  };
}
