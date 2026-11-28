// El catálogo que sirve la API en GET /public/catalogs: el universo completo de
// opciones con su etiqueta para mostrar, independiente de lo que esté publicado.
//
// Es la fuente de verdad de las etiquetas. El front no tiene diccionarios de
// nombres de zonas, tipos de propiedad ni amenities: si una etiqueta está mal
// escrita se corrige en la API, no acá, porque un parche local vuelve a partir
// en dos la fuente de verdad.

export interface CatalogEntry {
  value: string;
  label: string;
}

// Una zona no agrega nada sobre la entrada base; existe como nombre propio
// para que las firmas se lean.
export type ZoneEntry = CatalogEntry;

export interface DepartmentEntry extends CatalogEntry {
  zones: ZoneEntry[];
}

export interface ProvinceEntry extends CatalogEntry {
  departments: DepartmentEntry[];
}

// Secciones con las que la API agrupa las 44 amenities, para armar los
// checkboxes del filtro y los bloques de la ficha.
export const AMENITY_SECTIONS = [
  "utilities",
  "security",
  "amenities_rooms",
  "amenities_comfort",
  "common_areas",
] as const;

export type AmenitySection = (typeof AMENITY_SECTIONS)[number];

export interface AmenityEntry extends CatalogEntry {
  // `null` si la API trae una sección que el front todavía no conoce: se
  // muestra igual, agrupada aparte, en vez de descartar la amenity.
  section: AmenitySection | null;
}

// Las secciones que no se piden con `?include=` no vienen en la respuesta, y eso
// es distinto de venir vacías. Todas son opcionales por eso.
export interface Catalog {
  provinces?: ProvinceEntry[];
  propertyTypes?: CatalogEntry[];
  conditions?: CatalogEntry[];
  currencies?: CatalogEntry[];
  amenities?: AmenityEntry[];
}

export const CATALOG_SECTIONS = [
  "provinces",
  "property_types",
  "conditions",
  "currencies",
  "amenities",
] as const;

export type CatalogSection = (typeof CATALOG_SECTIONS)[number];
