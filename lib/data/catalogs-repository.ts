import type { Catalog, CatalogSection, Facets } from "@/lib/domain";

// El catálogo (universo completo de opciones con sus etiquetas) y las facets
// (lo que hay publicado, con conteos). Van juntos porque los dos alimentan el
// filtro y los dos son datos de referencia, no contenido.
export interface CatalogsRepository {
  // `sections` omitido trae todo. Para el catálogo cacheado con vida larga
  // conviene pedirlo entero una vez: una entrada de caché en vez de cinco.
  getCatalog(sections?: CatalogSection[]): Promise<Catalog>;

  getFacets(): Promise<Facets>;
}
