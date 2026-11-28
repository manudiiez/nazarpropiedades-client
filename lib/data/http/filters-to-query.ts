import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type AgeRange,
  type GarageCount,
  type ListingFilters,
  type PageRequest,
  type RoomCount,
} from "@/lib/domain";
import type { QueryParams } from "./query";

// Traduce los filtros del dominio a lo que espera la API. Todas las
// convenciones raras de la API viven acá y en ningún otro lado: el llamador
// expresa "a estrenar" o "5 o más" y no sabe cómo se codifica.

// La API recibe "0".."5" y trata 5 como "5 o más".
function roomCount(value: RoomCount): string {
  return value === "5+" ? "5" : String(value);
}

// "0" es sin cochera; "3" es 3 o más.
function garageCount(value: GarageCount): string {
  return value === "3+" ? "3" : String(value);
}

// La antigüedad va como tramos, codificados con el año tope de cada uno.
const AGE_QUERY: Record<AgeRange, string> = {
  brand_new: "0",
  "1-5": "5",
  "6-10": "10",
  "11-20": "20",
  "over-20": "30",
};

// Un array vacío se omite: mandar el param sin valores no filtra nada y suma
// ruido a la URL (y a la clave de caché).
function list<T>(values: T[] | undefined, encode: (value: T) => string): string[] | undefined {
  if (values === undefined || values.length === 0) return undefined;
  return values.map(encode);
}

const identity = (value: string): string => value;

export function pageToQuery(page: PageRequest): QueryParams {
  // Se recorta en vez de fallar: un limit de 500 es un bug del llamador, no
  // algo que deba tirarle un 422 al visitante.
  const limit = Math.min(Math.max(Math.trunc(page.limit) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  return { page: Math.max(Math.trunc(page.page) || 1, 1), limit };
}

export function filtersToQuery(filters: ListingFilters): QueryParams {
  return {
    condition: list(filters.condition, identity),
    property_type: list(filters.propertyType, identity),
    province: filters.province,
    department: list(filters.department, identity),
    zone: list(filters.zone, identity),
    currency: filters.currency,
    price_min: filters.priceMin,
    price_max: filters.priceMax,
    total_area_min: filters.totalAreaMin,
    total_area_max: filters.totalAreaMax,
    bedrooms: list(filters.bedrooms, roomCount),
    bathrooms: list(filters.bathrooms, roomCount),
    garage_capacity: list(filters.garageCapacity, garageCount),
    gated_community: filters.gatedCommunity,
    age: list(filters.age, (value) => AGE_QUERY[value]),
    amenities: list(filters.amenities, identity),
    // La API lo llama `search`; el dominio lo llama por lo que hace.
    search: filters.addressQuery?.trim() === "" ? undefined : filters.addressQuery,
    sort: filters.sort,
  };
}
