import type { Currency } from "./enums";

// Lo que la API devuelve en GET /public/facets: las opciones CON cuántas
// publicaciones activas tiene cada una. Es lo que corresponde para el filtro.
//
// Dos criterios distintos conviven en la misma respuesta, y es deliberado
// (está documentado en el endpoint):
//   - tipos de propiedad y condiciones vienen COMPLETOS, con count 0 incluido,
//     para que el filtro no cambie de opciones según el stock;
//   - las ubicaciones vienen solo donde hay algo publicado, porque son texto
//     libre y no hay catálogo del que sacar una opción sin resultados.
//
// Decisión del front: las opciones con count 0 se muestran deshabilitadas con
// su conteo, no se esconden. Un combo cuyas opciones aparecen y desaparecen
// desorienta; "Estación de servicio (0)" en gris informa.

export interface FacetEntry {
  value: string;
  label: string;
  count: number;
}

export type ZoneFacet = FacetEntry;

export interface DepartmentFacet extends FacetEntry {
  // Ojo: `count` del departamento puede ser MAYOR que la suma de sus zonas.
  // Las propiedades sin zona cargada suman al departamento pero no aparecen
  // como zona, porque no se puede filtrar por ellas. No es un error de datos.
  zones: ZoneFacet[];
}

export interface ProvinceFacet extends FacetEntry {
  departments: DepartmentFacet[];
}

export interface PriceBounds {
  min: number;
  max: number;
}

// Una moneda sin publicaciones activas NO aparece. Con la base recién sembrada
// puede venir solo USD, o vacío.
export type PriceRange = Partial<Record<Currency, PriceBounds>>;

export interface Facets {
  provinces: ProvinceFacet[];
  propertyTypes: FacetEntry[];
  conditions: FacetEntry[];
  priceRange: PriceRange;
  total: number;
}
