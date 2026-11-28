import type { Catalog, ListingFilters } from "@/lib/domain";

// Los valores respaldados por el catálogo se validan contra el catálogo, no
// contra una lista en el front.
//
// Esto existe por un bug concreto: la API aceptaba 9 amenities de 44 y las
// otras 35 las IGNORABA EN SILENCIO — `?amenities=sauna` devolvía todo, sin
// filtrar y sin error. Un filtro que silenciosamente no filtra es peor que uno
// que falla, porque el visitante ve resultados que no pidió y nadie se entera.
//
// Ya está arreglado del lado de la API, pero la lección queda: lo que se manda
// se valida antes, y si no es válido se avisa.

export class UnknownFilterValueError extends Error {
  readonly field: string;
  readonly values: string[];

  constructor(field: string, values: string[]) {
    super(
      `El filtro "${field}" tiene ${values.length === 1 ? "un valor" : "valores"} que no está` +
        `${values.length === 1 ? "" : "n"} en el catálogo: ${values.join(", ")}.`,
    );
    this.name = "UnknownFilterValueError";
    this.field = field;
    this.values = values;
  }
}

function unknownValues(
  values: string[] | undefined,
  allowed: ReadonlySet<string>,
): string[] {
  if (values === undefined) return [];
  return values.filter((value) => !allowed.has(value));
}

function valueSet(entries: readonly { value: string }[] | undefined): ReadonlySet<string> {
  return new Set((entries ?? []).map((entry) => entry.value));
}

function locationSets(catalog: Catalog) {
  const provinces = new Set<string>();
  const departments = new Set<string>();
  const zones = new Set<string>();

  for (const province of catalog.provinces ?? []) {
    provinces.add(province.value);
    for (const department of province.departments) {
      departments.add(department.value);
      for (const zone of department.zones) zones.add(zone.value);
    }
  }

  return { provinces, departments, zones };
}

// Lanza al primer campo inválido. Se valida solo lo que el catálogo conoce: si
// una sección no vino (por `?include=`), ese campo no se valida en vez de
// rechazar todo por falta de datos.
export function validateFilters(filters: ListingFilters, catalog: Catalog): void {
  const { provinces, departments, zones } = locationSets(catalog);

  const checks: [string, string[] | undefined, ReadonlySet<string> | null][] = [
    ["propertyType", filters.propertyType, catalog.propertyTypes ? valueSet(catalog.propertyTypes) : null],
    ["amenities", filters.amenities, catalog.amenities ? valueSet(catalog.amenities) : null],
    ["province", filters.province === undefined ? undefined : [filters.province], catalog.provinces ? provinces : null],
    ["department", filters.department, catalog.provinces ? departments : null],
    ["zone", filters.zone, catalog.provinces ? zones : null],
  ];

  for (const [field, values, allowed] of checks) {
    if (allowed === null) continue;
    const unknown = unknownValues(values, allowed);
    if (unknown.length > 0) throw new UnknownFilterValueError(field, unknown);
  }
}
