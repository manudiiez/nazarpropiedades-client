import type {
  Catalog,
  Facets,
  Inquiry,
  Listing,
  ListingFilters,
  ListingSummary,
  NewInquiry,
  Page,
  PageRequest,
} from "@/lib/domain";
import { DEFAULT_PAGE_SIZE } from "@/lib/domain";
import { catalogsRepository, inquiriesRepository, listingsRepository } from "./index";
import type { ContextoPedido } from "./inquiries-repository";
import { attempt, attemptOr, type DataResult } from "./failures";
import { MappingError } from "./http/parse";
import { validateFilters } from "./validate-filters";
import { validateInquiry } from "./validate-inquiry";

// La capa que consume la UI. Ninguna de estas funciones lanza: todas devuelven
// DataResult, así que un server component no puede reventar la página por un
// problema de datos.
//
// Las que devuelven `attemptOr` son secciones accesorias: si fallan, la página
// se muestra igual sin ellas. La falla se loguea de todos modos — silencio en
// la UI no es silencio en el log.

export async function searchListings(
  filters: ListingFilters = {},
  page: PageRequest = { page: 1, limit: DEFAULT_PAGE_SIZE },
): Promise<DataResult<Page<ListingSummary>>> {
  return attempt("searchListings", async () => {
    // Se validan los valores del catálogo antes de salir a la red: la API
    // antes ignoraba en silencio las amenities que no conocía, devolviendo
    // resultados sin filtrar. Mejor fallar acá que mostrar datos equivocados.
    const catalog = await catalogsRepository().getCatalog();
    validateFilters(filters, catalog);
    return listingsRepository().search(filters, page);
  });
}

// `null` cuando no existe: es un resultado esperado, no una falla. La página
// decide si llama a notFound().
export async function getListing(id: number): Promise<DataResult<Listing | null>> {
  if (!Number.isInteger(id) || id <= 0) return { ok: true, data: null };
  return attempt(`getListing(${id})`, () => listingsRepository().getById(id));
}

export async function getLatestListings(): Promise<ListingSummary[]> {
  return attemptOr("getLatestListings", [], () => listingsRepository().getLatest());
}

// Hoy la API no tiene destacados curados: se usan las más recientes. Cuando
// exista el endpoint, cambia solo esta función.
export async function getFeaturedListings(): Promise<ListingSummary[]> {
  return getLatestListings();
}

export async function getRelatedListings(id: number): Promise<ListingSummary[]> {
  return attemptOr(`getRelatedListings(${id})`, [], () => listingsRepository().getRelated(id));
}

export async function getListingsByIds(ids: number[]): Promise<ListingSummary[]> {
  const validos = ids.filter((id) => Number.isInteger(id) && id > 0);
  if (validos.length === 0) return [];
  return attemptOr("getListingsByIds", [], () => listingsRepository().getByIds(validos));
}

export async function getCatalog(): Promise<DataResult<Catalog>> {
  return attempt("getCatalog", async () => {
    const catalog = await catalogsRepository().getCatalog();
    // Un catálogo sin provincias no permite armar el filtro de ubicación. Acá
    // sí, vacío ES un problema: no es "no hay resultados", es "no podemos
    // mostrar las opciones de búsqueda".
    if ((catalog.provinces ?? []).length === 0) {
      throw new MappingError("catalogs.provinces", "al menos una provincia", catalog.provinces);
    }
    return catalog;
  });
}

export async function getFacets(): Promise<DataResult<Facets>> {
  return attempt("getFacets", () => catalogsRepository().getFacets());
}

// El formulario necesita saber por qué falló para marcar el campo, así que
// devuelve DataResult y el llamador decide.
export async function createInquiry(
  input: NewInquiry,
  contexto?: ContextoPedido,
): Promise<DataResult<Inquiry>> {
  return attempt("createInquiry", () => {
    // Antes de la red: la API acepta campos vacíos y devuelve 201, así que si
    // no se valida acá el CRM recibe consultas en blanco.
    validateInquiry(input);
    return inquiriesRepository().create(input, contexto);
  });
}
