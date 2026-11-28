import type { Condition, Currency, ListingStatus } from "./enums";

export interface Photo {
  url: string;
  thumbnailUrl: string | null;
  sortOrder: number;
}

// Atributo listo para renderizar: la etiqueta y el sufijo los manda la API.
// `value` ya viene parseado: la API lo serializa como string (el JSONB guarda
// lo que mandó el CRM) y el mapper lo convierte a número cuando corresponde.
export interface AttributeItem {
  key: string;
  value: string | number | boolean;
  label: string;
  suffix: string | null;
  section: string | null;
}

// Resumen de hasta 5 atributos que la API elige por prioridad, salteando los
// que son null, 0 o "". Las claves VARÍAN por propiedad: `Partial` fuerza a
// manejar la ausencia en vez de confiar en que estén.
export type KeyAttributes = Readonly<Partial<Record<string, string | number>>>;

export interface Money {
  amount: number;
  currency: Currency;
}

export interface SiblingListing {
  id: number;
  condition: Condition;
  status: ListingStatus;
  price: Money;
}

// Los tres primeros son valores del catálogo: acá viaja el valor crudo
// (`godoy_cruz`) y la etiqueta se resuelve contra el catálogo al mapear.
export interface Location {
  province: string;
  provinceLabel: string;
  department: string;
  departmentLabel: string;
  zone: string | null;
  zoneLabel: string | null;
  neighborhoodOrStreet: string | null;
  // La API la devuelve en MAYÚSCULAS, como la cargaron en el CRM. El mapper la
  // normaliza: normalizarla del lado del server taparía el problema de carga.
  fullAddress: string;
}

export interface MapSettings {
  // Manda sobre lat/lng: puede haber coordenadas y no corresponder el mapa.
  showMap: boolean;
  latitude: number | null;
  longitude: number | null;
  mode: string | null;
  range: number | null;
}

// Lo común al resumen y a la ficha.
//
// NO existe `Listing extends ListingSummary`: el detalle de la API no es un
// superconjunto del listado. `keyAttributes` solo viene en el listado, y en el
// detalle lo reemplaza `attributes` enriquecido. Son dos vistas distintas de lo
// mismo, no una contenida en la otra.
export interface ListingBase {
  id: number;
  // Valor del catálogo (`house`, `semi-floor`, …). La etiqueta va aparte: si la
  // API agrega un tipo nuevo, el front lo muestra igual en vez de romperse.
  propertyType: string;
  propertyTypeLabel: string;
  condition: Condition;
  conditionLabel: string;
  price: Money;
  expenses: Money | null;
  location: Location;
  createdAt: Date;
}

// Lo que devuelve el listado.
export interface ListingSummary extends ListingBase {
  keyAttributes: KeyAttributes;
  // null mientras el worker de imágenes no terminó de procesar.
  coverPhoto: Photo | null;
}

// Lo que devuelve el detalle.
export interface Listing extends ListingBase {
  status: ListingStatus;
  title: string | null;
  description: string | null;
  map: MapSettings;
  videoUrl: string | null;
  tour360Url: string | null;
  // Puede venir vacío aunque la propiedad sea válida: fotos sin procesar.
  photos: Photo[];
  siblingListings: SiblingListing[];
  // Vacíos si la API no tiene strategy para ese (propertyType, condition).
  attributes: AttributeItem[];
  amenities: AttributeItem[];
  nearbyZones: AttributeItem[];
}
