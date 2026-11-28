import type { AgeRange, GarageCount, ListingFilters, ListingSort, RoomCount } from "@/lib/domain";

// Replica en memoria la semántica REAL de los filtros de la API, incluidas las
// convenciones raras. Si el mock filtrara distinto, la UI construida contra
// mocks se rompería recién en producción, que es exactamente el bug caro que
// las dos implementaciones existen para evitar.
//
// Opera sobre el payload CRUDO (snake_case, números como strings), igual que la
// implementación HTTP, para que las fixtures pasen por el mismo mapper.

export type RawListing = Record<string, unknown>;

function num(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function attr(listing: RawListing, key: string): unknown {
  const keyAttributes = listing.key_attributes;
  if (typeof keyAttributes === "object" && keyAttributes !== null) {
    const value = (keyAttributes as Record<string, unknown>)[key];
    if (value !== undefined) return value;
  }
  // En el detalle los atributos viven en el array enriquecido.
  const attributes = listing.attributes;
  if (Array.isArray(attributes)) {
    const found = attributes.find(
      (item) => typeof item === "object" && item !== null && (item as RawListing).key === key,
    );
    if (found !== undefined) return (found as RawListing).value;
  }
  return undefined;
}

function amenityValues(listing: RawListing): Set<string> {
  const amenities = listing.amenities;
  if (!Array.isArray(amenities)) return new Set();
  return new Set(
    amenities
      .filter((item): item is RawListing => typeof item === "object" && item !== null)
      .map((item) => String(item.key)),
  );
}

// "5" significa 5 o más: un dormitorio 7 matchea el filtro "5+".
function matchesCount(value: number | null, selected: RoomCount[], tope: number): boolean {
  if (value === null) return false;
  return selected.some((option) =>
    option === `${tope}+` ? value >= tope : value === Number(option),
  );
}

function matchesGarage(listing: RawListing, selected: GarageCount[]): boolean {
  const capacity = num(attr(listing, "garage_capacity"));
  const sinCochera = attr(listing, "garage_type") === "sin_cochera" || capacity === null || capacity === 0;

  return selected.some((option) => {
    if (option === 0) return sinCochera;
    if (option === "3+") return capacity !== null && capacity >= 3;
    return capacity === option;
  });
}

const AGE_BOUNDS: Record<AgeRange, [number, number]> = {
  brand_new: [0, 0],
  "1-5": [1, 5],
  "6-10": [6, 10],
  "11-20": [11, 20],
  "over-20": [21, Number.POSITIVE_INFINITY],
};

function matchesAge(listing: RawListing, selected: AgeRange[]): boolean {
  const age = num(attr(listing, "age"));
  if (age === null) return false;
  return selected.some((range) => {
    const [min, max] = AGE_BOUNDS[range];
    return age >= min && age <= max;
  });
}

// La API matchea `si` Y `semi_privado` cuando se pide true.
function matchesGated(listing: RawListing, wanted: boolean): boolean {
  const value = attr(listing, "gated_community");
  const text = value === undefined || value === null ? "no" : String(value);
  const esCerrado = text === "si" || text === "semi_privado";
  return wanted ? esCerrado : !esCerrado;
}

// La API busca SOLO en barrio/calle y dirección, con unaccent. No en título ni
// descripción: si el mock buscara ahí, el front prometería algo que la API no
// hace y nadie lo notaría hasta producción.
function matchesAddress(listing: RawListing, query: string): boolean {
  const normalizar = (text: string): string =>
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();

  const needle = normalizar(query.trim());
  if (needle === "") return true;

  return [listing.neighborhood_or_street, listing.full_address]
    .filter((value): value is string => typeof value === "string")
    .some((value) => normalizar(value).includes(needle));
}

function inRange(value: number | null, min?: number, max?: number): boolean {
  if (value === null) return min === undefined && max === undefined;
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

export function matchesFilters(listing: RawListing, filters: ListingFilters): boolean {
  // La API solo devuelve publicaciones activas.
  if (listing.status !== undefined && listing.status !== "active") return false;

  if (filters.condition?.length && !filters.condition.includes(listing.condition as never)) return false;
  if (filters.propertyType?.length && !filters.propertyType.includes(String(listing.property_type))) return false;
  if (filters.province !== undefined && listing.province !== filters.province) return false;
  if (filters.department?.length && !filters.department.includes(String(listing.department))) return false;
  if (filters.zone?.length && !filters.zone.includes(String(listing.zone ?? ""))) return false;
  if (filters.currency !== undefined && listing.currency !== filters.currency) return false;

  // El precio solo se compara dentro de la misma moneda: la API no convierte.
  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    if (!inRange(num(listing.price), filters.priceMin, filters.priceMax)) return false;
  }

  if (filters.totalAreaMin !== undefined || filters.totalAreaMax !== undefined) {
    if (!inRange(num(attr(listing, "total_area")), filters.totalAreaMin, filters.totalAreaMax)) {
      return false;
    }
  }

  if (filters.bedrooms?.length && !matchesCount(num(attr(listing, "bedrooms")), filters.bedrooms, 5)) return false;
  if (filters.bathrooms?.length && !matchesCount(num(attr(listing, "bathrooms")), filters.bathrooms, 5)) return false;
  if (filters.garageCapacity?.length && !matchesGarage(listing, filters.garageCapacity)) return false;
  if (filters.gatedCommunity !== undefined && !matchesGated(listing, filters.gatedCommunity)) return false;
  if (filters.age?.length && !matchesAge(listing, filters.age)) return false;

  // AND entre amenities: la propiedad tiene que tener todas.
  if (filters.amenities?.length) {
    const presentes = amenityValues(listing);
    if (!filters.amenities.every((amenity) => presentes.has(amenity))) return false;
  }

  if (filters.addressQuery !== undefined && !matchesAddress(listing, filters.addressQuery)) return false;

  return true;
}

export function sortListings(listings: RawListing[], sort: ListingSort = "reciente"): RawListing[] {
  const copia = [...listings];

  switch (sort) {
    case "menor_precio":
      return copia.sort((a, b) => (num(a.price) ?? 0) - (num(b.price) ?? 0));
    case "mayor_precio":
      return copia.sort((a, b) => (num(b.price) ?? 0) - (num(a.price) ?? 0));
    case "reciente":
    default:
      return copia.sort(
        (a, b) =>
          new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime(),
      );
  }
}
