import type { Catalog } from "@/lib/domain";

// Índice plano del catálogo para resolver etiquetas en O(1) al mapear.
//
// Los listings devuelven solo el valor (`godoy_cruz`), nunca la etiqueta, así
// que la ubicación y el tipo de propiedad se resuelven acá. Se hace en el
// server al mapear y no en un componente: una sola fuente de verdad, y si
// falta una etiqueta se decide una vez qué mostrar en lugar de que cada
// componente improvise.
export interface LabelIndex {
  propertyTypes: Map<string, string>;
  conditions: Map<string, string>;
  currencies: Map<string, string>;
  provinces: Map<string, string>;
  departments: Map<string, string>;
  zones: Map<string, string>;
  amenities: Map<string, string>;
}

function indexEntries(entries: readonly { value: string; label: string }[] | undefined): Map<string, string> {
  return new Map((entries ?? []).map((entry) => [entry.value, entry.label]));
}

export function buildLabelIndex(catalog: Catalog): LabelIndex {
  const provinces = new Map<string, string>();
  const departments = new Map<string, string>();
  const zones = new Map<string, string>();

  for (const province of catalog.provinces ?? []) {
    provinces.set(province.value, province.label);
    for (const department of province.departments) {
      departments.set(department.value, department.label);
      for (const zone of department.zones) zones.set(zone.value, zone.label);
    }
  }

  return {
    propertyTypes: indexEntries(catalog.propertyTypes),
    conditions: indexEntries(catalog.conditions),
    currencies: indexEntries(catalog.currencies),
    provinces,
    departments,
    zones,
    amenities: indexEntries(catalog.amenities),
  };
}

// Un valor sin etiqueta en el catálogo NO es un error: puede ser una zona nueva
// cargada en el CRM antes de que el catálogo de la API la incluya. Se degrada
// a algo legible en vez de romper la página o mostrar el slug crudo.
//
//   "chacras_de_coria" → "Chacras De Coria"
//
// No queda perfecto (pierde acentos y preposiciones: "lujan_de_cuyo" → "Lujan
// De Cuyo"), y es a propósito: si se ve así, falta en el catálogo y hay que
// corregirlo en la API, no acá. Un fallback demasiado bueno esconde el problema.
export function humanize(value: string): string {
  return value
    .split(/[_-]+/)
    .filter((part) => part !== "")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function labelFor(index: Map<string, string>, value: string): string {
  return index.get(value) ?? humanize(value);
}

export const EMPTY_LABEL_INDEX: LabelIndex = buildLabelIndex({});
