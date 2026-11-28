import type {
  Listing,
  ListingFilters,
  ListingSummary,
  Page,
  PageRequest,
} from "@/lib/domain";

// Único contrato por el que la UI accede a los listings. Deliberadamente no
// menciona HTTP, URLs ni status codes: las implementaciones viven en
// lib/data/http y lib/data/mock, y quien consume no sabe cuál está activa.
export interface ListingsRepository {
  search(filters: ListingFilters, page: PageRequest): Promise<Page<ListingSummary>>;

  // `null` cuando no existe o no está publicado. "No existe" es un resultado
  // esperado del dominio (va a notFound() de Next), no una excepción.
  getById(id: number): Promise<Listing | null>;

  // Los más recientes, para la home. Hoy la API devuelve 8 y no acepta params.
  getLatest(): Promise<ListingSummary[]>;

  // Relacionadas a una propiedad, scoreadas por tipo, condición y ubicación.
  // Nunca incluye la propiedad base.
  getRelated(id: number): Promise<ListingSummary[]>;

  // Varios por id, respetando el orden pedido. Para favoritos guardados en el
  // browser. La API acepta entre 1 y 100 ids.
  getByIds(ids: number[]): Promise<ListingSummary[]>;
}
