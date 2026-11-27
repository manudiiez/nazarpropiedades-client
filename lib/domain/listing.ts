import type { Condition, Currency, ListingStatus, PropertyType } from "./enums";

// Una foto ya procesada por el worker de la API. `thumbnailUrl` puede faltar.
export interface Photo {
  url: string;
  thumbnailUrl: string | null;
  sortOrder: number;
}

// Atributo listo para renderizar: la API manda `label` y `suffix`, así que el
// front NO tiene su propio diccionario de etiquetas. `section` sirve para agrupar.
export interface AttributeItem {
  key: string;
  value: string | number | boolean;
  label: string;
  suffix: string | null;
  section: string | null;
}

// La API elige hasta 5 claves por prioridad (bedrooms, bathrooms, total_area,
// garage_capacity, covered_area, floors, orientation, storage_units, age) y
// saltea las que son null, 0 o "". O sea: las claves varían por propiedad y
// nada garantiza que una esté presente. No se puede tipar como objeto fijo.
// `Partial` es deliberado: hace que leer cualquier clave tipe como
// `string | number | undefined`, así el compilador obliga a manejar la ausencia
// sin depender de `noUncheckedIndexedAccess` a nivel proyecto.
export type KeyAttributes = Readonly<Partial<Record<string, string | number>>>;

// Otro listing de la misma propiedad, p. ej. la misma casa en venta y en alquiler.
export interface SiblingListing {
  id: number;
  condition: Condition;
  status: ListingStatus;
  price: number;
  currency: Currency;
}

export interface Money {
  amount: number;
  currency: Currency;
}

export interface Location {
  province: string;
  department: string;
  zone: string | null;
  neighborhoodOrStreet: string | null;
  // Dirección exacta. Hoy la API la expone al público en listado y detalle.
  fullAddress: string;
}

// Cómo quiere la API que se muestre el mapa. `showMap` manda: puede haber
// coordenadas cargadas y aun así no corresponder dibujar el mapa.
export interface MapSettings {
  showMap: boolean;
  latitude: number | null;
  longitude: number | null;
  mode: string | null;
  range: number | null;
}

// Lo que devuelve el listado. Deliberadamente más chico que `Listing`.
export interface ListingSummary {
  id: number;
  propertyType: PropertyType;
  condition: Condition;
  price: Money;
  expenses: Money | null;
  location: Location;
  keyAttributes: KeyAttributes;
  // null mientras el worker no terminó de procesar las imágenes.
  coverPhoto: Photo | null;
  createdAt: Date;
}

// El detalle completo.
export interface Listing extends ListingSummary {
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
