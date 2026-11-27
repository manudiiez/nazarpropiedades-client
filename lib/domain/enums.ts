// Enums del contrato público de la API (repo `api`: app/utils/enums.ts).
// Se modelan como union types sobre arrays `const` en lugar de `enum` de TS:
// los valores viajan tal cual en JSON y los arrays sirven para validar en runtime.

export const PROPERTY_TYPES = [
  "house",
  "apartment",
  "lot",
  "garage",
  "office",
  "duplex",
  "commercial",
  "service-station",
  "farm",
  "goodwill",
  "shed",
  "ph",
  "parking-lot",
  "semi-floor",
  "land",
  "triplex",
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const CONDITIONS = ["sale", "rent", "temporary_rent", "exchange"] as const;

export type Condition = (typeof CONDITIONS)[number];

export const CURRENCIES = ["USD", "ARS"] as const;

export type Currency = (typeof CURRENCIES)[number];

// El sitio público solo recibe listings `active`; el resto de los estados existen
// en la API y aparecen en el detalle, así que el tipo los contempla.
export const LISTING_STATUSES = ["draft", "active", "paused", "discarded", "archived"] as const;

export type ListingStatus = (typeof LISTING_STATUSES)[number];

// `trabajar_con_mi_propiedad` cubre el caso "quiero vender / tasación": no hay
// un endpoint de tasaciones aparte.
export const INQUIRY_SOURCES = [
  "consulta_general",
  "propiedad_individual",
  "trabajar_con_mi_propiedad",
] as const;

export type InquirySource = (typeof INQUIRY_SOURCES)[number];

export function isPropertyType(value: string): value is PropertyType {
  return (PROPERTY_TYPES as readonly string[]).includes(value);
}

export function isCondition(value: string): value is Condition {
  return (CONDITIONS as readonly string[]).includes(value);
}

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}
