import type { Condition, Currency, PropertyType } from "./enums";

// La API acepta cualquier string numérico y trata "5 o más" como un solo tramo.
// Esta union es el conjunto que el sitio ofrece; traducirla a los strings que
// espera la API es trabajo de la implementación HTTP, no del llamador.
export type RoomCount = 0 | 1 | 2 | 3 | 4 | "5+";

// "0" significa explícitamente sin cochera, no "no me importa".
export type GarageCount = 0 | 1 | 2 | "3+";

// La antigüedad se filtra por tramos, no por años exactos.
export const AGE_RANGES = ["brand_new", "1-5", "6-10", "11-20", "over-20"] as const;

export type AgeRange = (typeof AGE_RANGES)[number];

// Lista cerrada. La API descarta en silencio cualquier valor que no esté acá,
// así que el front tiene que validar contra esta lista y fallar, no mandar
// valores que se pierden sin aviso.
export const AMENITIES = [
  "swimming_pool",
  "garden",
  "elevator",
  "balcony",
  "grill",
  "terrace",
  "quincho",
  "event_hall",
  "wheelchair_ramp",
] as const;

export type Amenity = (typeof AMENITIES)[number];

export function isAmenity(value: string): value is Amenity {
  return (AMENITIES as readonly string[]).includes(value);
}

export const LISTING_SORTS = ["reciente", "menor_precio", "mayor_precio"] as const;

export type ListingSort = (typeof LISTING_SORTS)[number];

export interface ListingFilters {
  condition?: Condition[];
  propertyType?: PropertyType[];
  // Una sola provincia: así lo acepta la API.
  province?: string;
  department?: string[];
  zone?: string[];
  currency?: Currency;
  priceMin?: number;
  priceMax?: number;
  totalAreaMin?: number;
  totalAreaMax?: number;
  bedrooms?: RoomCount[];
  bathrooms?: RoomCount[];
  garageCapacity?: GarageCount[];
  // true matchea tanto barrio cerrado como semiprivado.
  gatedCommunity?: boolean;
  age?: AgeRange[];
  // Se combinan con AND: la propiedad tiene que tener todas.
  amenities?: Amenity[];
  // Texto libre que la API busca SOLO en barrio/calle y dirección completa.
  // No busca en título ni descripción: el campo del front tiene que decir
  // "dirección o barrio", no "buscar".
  addressQuery?: string;
  sort?: ListingSort;
}
