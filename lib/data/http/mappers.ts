import {
  AMENITY_SECTIONS,
  CONDITIONS,
  CURRENCIES,
  LISTING_STATUSES,
  INQUIRY_SOURCES,
  type AmenityEntry,
  type AmenitySection,
  type AttributeItem,
  type Catalog,
  type CatalogEntry,
  type Facets,
  type FacetEntry,
  type Inquiry,
  type KeyAttributes,
  type Listing,
  type ListingSummary,
  type Location,
  type Money,
  type Photo,
  type PriceRange,
  type ProvinceEntry,
  type ProvinceFacet,
  type SiblingListing,
} from "@/lib/domain";
import {
  asArray,
  asArrayOrEmpty,
  asBoolean,
  asDate,
  asEnum,
  asNumber,
  asObject,
  asOptionalBoolean,
  asOptionalNumber,
  asOptionalString,
  asString,
  MappingError,
} from "./parse";
import { labelFor, type LabelIndex } from "./label-index";

// ---------------------------------------------------------------- utilidades

// La API manda la dirección como la cargaron en el CRM, en MAYÚSCULAS:
// "BARRIO PALMARES, PRIMERA ETAPA, GODOY CRUZ". Mostrarla así parece un grito.
// Se normaliza acá y no del lado del server a propósito: normalizar en la
// respuesta taparía el problema real, que es la carga.
export function normalizeAddress(raw: string): string {
  const text = raw.trim();
  // Si tiene minúsculas, ya está escrita como corresponde: no se toca.
  if (/[a-záéíóúñü]/.test(text)) return text;

  return text
    .toLocaleLowerCase("es-AR")
    .replace(/(^|[\s,.;:/(-])([a-záéíóúñü])/g, (_, sep: string, letter: string) =>
      sep + letter.toLocaleUpperCase("es-AR"),
    );
}

function money(amount: unknown, currency: unknown, path: string): Money {
  return {
    amount: asNumber(amount, `${path}.price`),
    currency: asEnum(currency, `${path}.currency`, CURRENCIES),
  };
}

// --------------------------------------------------------------- fotos

export function mapPhoto(raw: unknown, path: string): Photo {
  const photo = asObject(raw, path);
  return {
    url: asString(photo.url, `${path}.url`),
    thumbnailUrl: asOptionalString(photo.thumbnail_url, `${path}.thumbnail_url`),
    sortOrder: asNumber(photo.sort_order, `${path}.sort_order`),
  };
}

// Las fotos sin procesar por el worker llegan sin `url` y la API las filtra,
// pero si alguna se escapa se descarta acá en vez de reventar la galería.
function mapPhotos(raw: unknown, path: string): Photo[] {
  return asArrayOrEmpty(raw, path)
    .map((item, i) => {
      try {
        return mapPhoto(item, `${path}[${i}]`);
      } catch {
        return null;
      }
    })
    .filter((photo): photo is Photo => photo !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

// ----------------------------------------------------------- atributos

// Los valores del JSONB llegan como string ("620"). Se convierten a número
// cuando el string ES un número, y se dejan como texto cuando no (una
// orientación, por ejemplo). Así la UI puede formatear y comparar.
function attributeValue(raw: unknown, path: string): string | number | boolean {
  if (typeof raw === "number" || typeof raw === "boolean") return raw;
  const text = asString(raw, path);
  // El JSONB guarda lo que mandó el CRM, y los booleanos llegan con la
  // capitalización de Python: las amenities y las zonas cercanas vienen como
  // "True"/"False", no como "true"/"false". Sin esto, la ficha muestra
  // "Piscina: True" en vez de "Piscina: Sí".
  const booleano = text.trim().toLowerCase();
  if (booleano === "true") return true;
  if (booleano === "false") return false;
  const parsed = Number(text);
  return text.trim() !== "" && Number.isFinite(parsed) ? parsed : text;
}

export function mapAttribute(raw: unknown, path: string): AttributeItem {
  const item = asObject(raw, path);
  return {
    key: asString(item.key, `${path}.key`),
    value: attributeValue(item.value, `${path}.value`),
    label: asString(item.label, `${path}.label`),
    suffix: asOptionalString(item.suffix, `${path}.suffix`),
    section: asOptionalString(item.section, `${path}.section`),
  };
}

// Un atributo roto no puede tirar abajo la ficha entera: se descarta ese y se
// muestran los demás.
function mapAttributes(raw: unknown, path: string): AttributeItem[] {
  return asArrayOrEmpty(raw, path)
    .map((item, i) => {
      try {
        return mapAttribute(item, `${path}[${i}]`);
      } catch {
        return null;
      }
    })
    .filter((item): item is AttributeItem => item !== null);
}

function mapKeyAttributes(raw: unknown, path: string): KeyAttributes {
  if (raw === null || raw === undefined) return {};
  const source = asObject(raw, path);
  const result: Record<string, string | number> = {};

  for (const [key, value] of Object.entries(source)) {
    if (value === null || value === undefined || value === "") continue;
    const parsed = attributeValue(value, `${path}.${key}`);
    result[key] = typeof parsed === "boolean" ? String(parsed) : parsed;
  }

  return result;
}

// ----------------------------------------------------------- ubicación

function mapLocation(raw: Record<string, unknown>, path: string, labels: LabelIndex): Location {
  const province = asString(raw.province, `${path}.province`);
  const department = asString(raw.department, `${path}.department`);
  const zone = asOptionalString(raw.zone, `${path}.zone`);

  return {
    province,
    provinceLabel: labelFor(labels.provinces, province),
    department,
    departmentLabel: labelFor(labels.departments, department),
    zone,
    zoneLabel: zone === null ? null : labelFor(labels.zones, zone),
    neighborhoodOrStreet: asOptionalString(
      raw.neighborhood_or_street,
      `${path}.neighborhood_or_street`,
    ),
    fullAddress: normalizeAddress(asString(raw.full_address, `${path}.full_address`)),
  };
}

// ------------------------------------------------------------- listings

function mapBase(raw: Record<string, unknown>, path: string, labels: LabelIndex) {
  const propertyType = asString(raw.property_type, `${path}.property_type`);
  const condition = asEnum(raw.condition, `${path}.condition`, CONDITIONS);
  const hasExpenses = asOptionalBoolean(raw.has_expenses, `${path}.has_expenses`, false);

  return {
    id: asNumber(raw.id, `${path}.id`),
    propertyType,
    propertyTypeLabel: labelFor(labels.propertyTypes, propertyType),
    condition,
    conditionLabel: labelFor(labels.conditions, condition),
    price: money(raw.price, raw.currency, path),
    // Las expensas solo se leen si has_expenses lo dice: el monto puede venir
    // cargado y la publicación igual no incluirlas.
    expenses:
      hasExpenses && raw.expenses !== null && raw.expenses !== undefined
        ? money(raw.expenses, raw.expenses_currency, `${path}.expenses`)
        : null,
    location: mapLocation(raw, path, labels),
    createdAt: asDate(raw.created_at, `${path}.created_at`),
  };
}

export function mapListingSummary(
  raw: unknown,
  path: string,
  labels: LabelIndex,
): ListingSummary {
  const item = asObject(raw, path);
  const cover = item.cover_photo;

  return {
    ...mapBase(item, path, labels),
    keyAttributes: mapKeyAttributes(item.key_attributes, `${path}.key_attributes`),
    coverPhoto:
      cover === null || cover === undefined ? null : mapPhoto(cover, `${path}.cover_photo`),
  };
}

function mapSibling(raw: unknown, path: string): SiblingListing {
  const item = asObject(raw, path);
  return {
    id: asNumber(item.id, `${path}.id`),
    condition: asEnum(item.condition, `${path}.condition`, CONDITIONS),
    status: asEnum(item.status, `${path}.status`, LISTING_STATUSES),
    price: money(item.price, item.currency, path),
  };
}

export function mapListing(raw: unknown, path: string, labels: LabelIndex): Listing {
  const item = asObject(raw, path);

  return {
    ...mapBase(item, path, labels),
    status: asEnum(item.status, `${path}.status`, LISTING_STATUSES),
    title: asOptionalString(item.title, `${path}.title`),
    description: asOptionalString(item.description, `${path}.description`),
    map: {
      showMap: asOptionalBoolean(item.show_map, `${path}.show_map`, false),
      latitude: asOptionalNumber(item.latitude, `${path}.latitude`),
      longitude: asOptionalNumber(item.longitude, `${path}.longitude`),
      mode: asOptionalString(item.map_mode, `${path}.map_mode`),
      range: asOptionalNumber(item.map_range, `${path}.map_range`),
    },
    videoUrl: asOptionalString(item.video_url, `${path}.video_url`),
    tour360Url: asOptionalString(item.tour360_url, `${path}.tour360_url`),
    photos: mapPhotos(item.photos, `${path}.photos`),
    siblingListings: asArrayOrEmpty(item.sibling_listings, `${path}.sibling_listings`).map(
      (sibling, i) => mapSibling(sibling, `${path}.sibling_listings[${i}]`),
    ),
    attributes: mapAttributes(item.attributes, `${path}.attributes`),
    amenities: mapAttributes(item.amenities, `${path}.amenities`),
    nearbyZones: mapAttributes(item.nearby_zones, `${path}.nearby_zones`),
  };
}

// -------------------------------------------------------------- catálogo

function mapCatalogEntry(raw: unknown, path: string): CatalogEntry {
  const item = asObject(raw, path);
  return {
    value: asString(item.value, `${path}.value`),
    label: asString(item.label, `${path}.label`),
  };
}

function mapAmenityEntry(raw: unknown, path: string): AmenityEntry {
  const item = asObject(raw, path);
  const section = asOptionalString(item.section, `${path}.section`);

  return {
    ...mapCatalogEntry(raw, path),
    // Una sección desconocida no descarta la amenity: se agrupa aparte.
    section: (AMENITY_SECTIONS as readonly string[]).includes(section ?? "")
      ? (section as AmenitySection)
      : null,
  };
}

function mapProvince(raw: unknown, path: string): ProvinceEntry {
  const item = asObject(raw, path);
  return {
    ...mapCatalogEntry(raw, path),
    departments: asArrayOrEmpty(item.departments, `${path}.departments`).map((dep, i) => {
      const depPath = `${path}.departments[${i}]`;
      const department = asObject(dep, depPath);
      return {
        ...mapCatalogEntry(dep, depPath),
        zones: asArrayOrEmpty(department.zones, `${depPath}.zones`).map((zone, j) =>
          mapCatalogEntry(zone, `${depPath}.zones[${j}]`),
        ),
      };
    }),
  };
}

// Las secciones ausentes quedan `undefined` y no vacías: con `?include=` hay
// que poder distinguir "no la pedí" de "no hay nada".
export function mapCatalog(raw: unknown, path = "catalogs"): Catalog {
  const item = asObject(raw, path);
  const section = <T>(key: string, map: (raw: unknown, path: string) => T): T[] | undefined =>
    item[key] === undefined
      ? undefined
      : asArray(item[key], `${path}.${key}`).map((entry, i) => map(entry, `${path}.${key}[${i}]`));

  return {
    provinces: section("provinces", mapProvince),
    propertyTypes: section("property_types", mapCatalogEntry),
    conditions: section("conditions", mapCatalogEntry),
    currencies: section("currencies", mapCatalogEntry),
    amenities: section("amenities", mapAmenityEntry),
  };
}

// ---------------------------------------------------------------- facets

function mapFacetEntry(raw: unknown, path: string): FacetEntry {
  const item = asObject(raw, path);
  return {
    ...mapCatalogEntry(raw, path),
    count: asNumber(item.count, `${path}.count`),
  };
}

function mapPriceRange(raw: unknown, path: string): PriceRange {
  if (raw === null || raw === undefined) return {};
  const item = asObject(raw, path);
  const range: PriceRange = {};

  for (const currency of CURRENCIES) {
    const bounds = item[currency];
    if (bounds === null || bounds === undefined) continue;
    const boundsPath = `${path}.${currency}`;
    const parsed = asObject(bounds, boundsPath);
    range[currency] = {
      min: asNumber(parsed.min, `${boundsPath}.min`),
      max: asNumber(parsed.max, `${boundsPath}.max`),
    };
  }

  return range;
}

export function mapFacets(raw: unknown, path = "facets"): Facets {
  const item = asObject(raw, path);

  return {
    provinces: asArrayOrEmpty(item.provinces, `${path}.provinces`).map((province, i): ProvinceFacet => {
      const provincePath = `${path}.provinces[${i}]`;
      const parsed = asObject(province, provincePath);
      return {
        ...mapFacetEntry(province, provincePath),
        departments: asArrayOrEmpty(parsed.departments, `${provincePath}.departments`).map(
          (dep, j) => {
            const depPath = `${provincePath}.departments[${j}]`;
            const department = asObject(dep, depPath);
            return {
              ...mapFacetEntry(dep, depPath),
              zones: asArrayOrEmpty(department.zones, `${depPath}.zones`).map((zone, k) =>
                mapFacetEntry(zone, `${depPath}.zones[${k}]`),
              ),
            };
          },
        ),
      };
    }),
    propertyTypes: asArrayOrEmpty(item.property_types, `${path}.property_types`).map((entry, i) =>
      mapFacetEntry(entry, `${path}.property_types[${i}]`),
    ),
    conditions: asArrayOrEmpty(item.conditions, `${path}.conditions`).map((entry, i) =>
      mapFacetEntry(entry, `${path}.conditions[${i}]`),
    ),
    priceRange: mapPriceRange(item.price_range, `${path}.price_range`),
    total: asNumber(item.total, `${path}.total`),
  };
}

// -------------------------------------------------------------- consultas

export function mapInquiry(raw: unknown, path = "consulta"): Inquiry {
  const item = asObject(raw, path);

  return {
    id: asNumber(item.id, `${path}.id`),
    nombre: asString(item.nombre, `${path}.nombre`),
    apellido: asString(item.apellido, `${path}.apellido`),
    numero: asString(item.numero, `${path}.numero`),
    email: asOptionalString(item.email, `${path}.email`),
    fuente: asEnum(item.fuente, `${path}.fuente`, INQUIRY_SOURCES),
    descripcion: asString(item.descripcion, `${path}.descripcion`),
    status: asString(item.status, `${path}.status`),
    listingId: asOptionalNumber(item.listing_id, `${path}.listing_id`),
    createdAt: asDate(item.created_at, `${path}.created_at`),
  };
}

export { MappingError, asBoolean };
