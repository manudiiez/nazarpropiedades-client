import type { Condition, Currency } from "./enums";

// La API acepta cualquier string numérico y trata "5 o más" como un tramo.
export type RoomCount = 0 | 1 | 2 | 3 | 4 | "5+";

// 0 significa explícitamente sin cochera, no "no me importa".
export type GarageCount = 0 | 1 | 2 | "3+";

export const AGE_RANGES = ["brand_new", "1-5", "6-10", "11-20", "over-20"] as const;

export type AgeRange = (typeof AGE_RANGES)[number];

export const LISTING_SORTS = ["reciente", "menor_precio", "mayor_precio"] as const;

export type ListingSort = (typeof LISTING_SORTS)[number];

// Los valores respaldados por el catálogo van como `string`, no como unions:
// son 16 tipos de propiedad, 44 amenities y 215 zonas, cambian sin avisar, y el
// front no tiene lógica que dependa de cuál es. Se validan en runtime contra el
// catálogo (lib/data/validate-filters.ts), que es la única fuente de verdad.
//
// Una union de TS acá daría seguridad ilusoria: la lista anterior de 9
// amenities compilaba perfecto y estaba mal igual.
export interface ListingFilters {
  condition?: Condition[];
  propertyType?: string[];
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
  // true matchea barrio cerrado Y semiprivado.
  gatedCommunity?: boolean;
  age?: AgeRange[];
  // Se combinan con AND: la propiedad tiene que tener todas.
  amenities?: string[];
  // La API lo busca SOLO en barrio/calle y dirección completa, no en título ni
  // descripción. El campo de la UI tiene que decir "dirección o barrio".
  addressQuery?: string;
  sort?: ListingSort;
}
