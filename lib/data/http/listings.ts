import { cacheLife, cacheTag } from "next/cache";
import type {
  Listing,
  ListingFilters,
  ListingSummary,
  Page,
  PageRequest,
} from "@/lib/domain";
import type { ListingsRepository } from "../listings-repository";
import { HttpClient, type RawPage } from "./client";
import { NotFoundError } from "./errors";
import { filtersToQuery, pageToQuery } from "./filters-to-query";
import { buildLabelIndex } from "./label-index";
import { mapCatalog, mapListing, mapListingSummary } from "./mappers";
import type { QueryParams } from "./query";

// El caché vive acá y no en HttpClient: los argumentos de una función con
// `use cache` tienen que ser serializables, y ni una instancia de clase ni un
// AbortSignal lo son. Por eso estas funciones reciben la baseUrl como string y
// construyen el cliente adentro, que es barato.
//
// Se cachea el payload CRUDO, no el objeto de dominio: es JSON plano, así que
// no hay ninguna duda sobre si es serializable, y mapear de nuevo en cada
// pedido cuesta nada comparado con la red.

async function fetchJson<T>(baseUrl: string, path: string, query: QueryParams): Promise<T> {
  return new HttpClient({ baseUrl }).get<T>(path, { query });
}

async function fetchRawCatalog(baseUrl: string): Promise<unknown> {
  "use cache";
  // Es el dato más estático del sitio: 18 departamentos y 215 zonas que casi
  // nunca cambian. Un tag propio permite invalidarlo sin tocar las propiedades.
  cacheLife("days");
  cacheTag("catalogs");
  return fetchJson<unknown>(baseUrl, "/public/catalogs", {});
}

async function fetchRawListings(baseUrl: string, query: QueryParams): Promise<RawPage<unknown>> {
  "use cache";
  // Minutos, no segundos: el rate limit de la API es 60/min por IP y los
  // fetches del server cuentan contra la IP del server, así que acá el caché no
  // es una optimización, es lo que evita el 429 con tráfico real.
  cacheLife("minutes");
  cacheTag("listings");
  return new HttpClient({ baseUrl }).getPage<unknown>("/public/listings", { query });
}

async function fetchRawListing(baseUrl: string, id: number): Promise<unknown | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("listings", `listing-${id}`);
  try {
    return await fetchJson<unknown>(baseUrl, `/public/listings/${id}`, {});
  } catch (error) {
    // "No existe" es un resultado, no una falla: se cachea como null para no
    // volver a preguntar por cada visita a una URL vieja.
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

async function fetchRawList(baseUrl: string, path: string, query: QueryParams): Promise<unknown[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("listings");
  try {
    const data = await fetchJson<unknown>(baseUrl, path, query);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    // Un 404 acá significa que la propiedad base no existe. Para una sección
    // accesoria como "relacionadas" eso es "no hay nada que mostrar", no un
    // error: quién pregunta por la existencia es getById, que devuelve null.
    // Sin esto, la implementación HTTP lanzaba donde la mock devolvía vacío.
    if (error instanceof NotFoundError) return [];
    throw error;
  }
}

async function fetchRawBatch(baseUrl: string, ids: number[]): Promise<RawPage<unknown>> {
  "use cache";
  cacheLife("minutes");
  cacheTag("listings");
  return new HttpClient({ baseUrl }).getPage<unknown>("/public/listings/batch", {
    query: { ids, limit: ids.length },
  });
}

export function createHttpListingsRepository(baseUrl: string): ListingsRepository {
  // Las etiquetas de ubicación y tipo de propiedad no vienen en los listings:
  // se resuelven contra el catálogo al mapear. El catálogo está cacheado, así
  // que esto no agrega un pedido por request.
  const labels = async () => buildLabelIndex(mapCatalog(await fetchRawCatalog(baseUrl)));

  return {
    async search(filters: ListingFilters, page: PageRequest): Promise<Page<ListingSummary>> {
      const [raw, index] = await Promise.all([
        fetchRawListings(baseUrl, { ...filtersToQuery(filters), ...pageToQuery(page) }),
        labels(),
      ]);

      return {
        items: raw.items.map((item, i) => mapListingSummary(item, `listings[${i}]`, index)),
        page: raw.page,
        limit: raw.limit,
        total: raw.total,
        totalPages: raw.totalPages,
      };
    },

    async getById(id: number): Promise<Listing | null> {
      const [raw, index] = await Promise.all([fetchRawListing(baseUrl, id), labels()]);
      return raw === null ? null : mapListing(raw, `listing(${id})`, index);
    },

    async getLatest(): Promise<ListingSummary[]> {
      const [raw, index] = await Promise.all([
        fetchRawList(baseUrl, "/public/listings/latest", {}),
        labels(),
      ]);
      return raw.map((item, i) => mapListingSummary(item, `latest[${i}]`, index));
    },

    async getRelated(id: number): Promise<ListingSummary[]> {
      const [raw, index] = await Promise.all([
        fetchRawList(baseUrl, `/public/listings/${id}/related`, {}),
        labels(),
      ]);
      return raw.map((item, i) => mapListingSummary(item, `related(${id})[${i}]`, index));
    },

    async getByIds(ids: number[]): Promise<ListingSummary[]> {
      // La API acepta entre 1 y 100 ids. Sin ids no hay nada que pedir: se
      // evita un 422 por algo que se sabe de antemano.
      if (ids.length === 0) return [];
      const acotados = ids.slice(0, 100);
      const [raw, index] = await Promise.all([fetchRawBatch(baseUrl, acotados), labels()]);
      return raw.items.map((item, i) => mapListingSummary(item, `batch[${i}]`, index));
    },
  };
}
