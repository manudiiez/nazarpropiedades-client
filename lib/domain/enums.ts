// Valores cerrados que la API define en código (repo `api`: app/utils/enums.ts).
//
// Importante: acá viven solo los valores que el front necesita para RAZONAR
// (p. ej. mostrar "por mes" si es alquiler, o formatear según la moneda). Las
// ETIQUETAS para mostrar no están acá: vienen del catálogo de la API
// (GET /public/catalogs), que es la única fuente de verdad. Ver lib/domain/catalog.ts.
//
// Los tipos de propiedad, las amenities y las ubicaciones NO se enumeran acá a
// propósito: son demasiados, cambian sin avisar y el front no tiene lógica que
// dependa de cuál es. Esos van como `string` y se validan contra el catálogo.

export const CONDITIONS = ["sale", "rent", "temporary_rent", "exchange"] as const;

export type Condition = (typeof CONDITIONS)[number];

export const CURRENCIES = ["USD", "ARS"] as const;

export type Currency = (typeof CURRENCIES)[number];

export const LISTING_STATUSES = ["draft", "active", "paused", "discarded", "archived"] as const;

export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const INQUIRY_SOURCES = [
  "consulta_general",
  "propiedad_individual",
  "trabajar_con_mi_propiedad",
] as const;

export type InquirySource = (typeof INQUIRY_SOURCES)[number];

export function isCondition(value: unknown): value is Condition {
  return typeof value === "string" && (CONDITIONS as readonly string[]).includes(value);
}

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

export function isListingStatus(value: unknown): value is ListingStatus {
  return typeof value === "string" && (LISTING_STATUSES as readonly string[]).includes(value);
}

// Un alquiler se muestra como precio por mes; una venta y una permuta, no.
export function isRental(condition: Condition): boolean {
  return condition === "rent" || condition === "temporary_rent";
}
