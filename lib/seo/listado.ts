import { buildLabelIndex, labelFor } from "@/lib/data/http/label-index";
import type { Catalog, ListingFilters } from "@/lib/domain";
import { recortar } from "./sitio";

// El título y la indexación del listado.
//
// Las dos cosas van juntas porque dependen de lo mismo: qué tan específica es
// la búsqueda. Una búsqueda que se puede nombrar en un título ("Casa en venta
// en Chacras de Coria") es una página que vale indexar; una con cinco filtros
// no se puede nombrar y tampoco conviene que compita con las otras.

// Por qué el tipo NO se pluraliza, aunque "Casas en venta" se lea mejor: las
// etiquetas vienen del catálogo de la API y el plural en español no es agregar
// una "s" ("Local comercial" → "Local comerciales", "PH" → "PHs"). Antes de
// armar un diccionario de plurales que se desincronice con el catálogo, se usa
// "Propiedades" cuando no hay un tipo único.
export function tituloDeListado(
  filtros: ListingFilters,
  catalog: Catalog = {},
  pagina = 1,
): string {
  const labels = buildLabelIndex(catalog);

  const tipo =
    filtros.propertyType?.length === 1
      ? labelFor(labels.propertyTypes, filtros.propertyType[0])
      : "Propiedades";

  const operacion =
    filtros.condition?.length === 1
      ? ` en ${labelFor(labels.conditions, filtros.condition[0]).toLowerCase()}`
      : "";

  const lugar = nombreDelLugar(filtros, labels);
  const direccion = filtros.addressQuery?.trim();

  let titulo = `${tipo}${operacion}`;
  if (lugar !== null) titulo += ` en ${lugar}`;
  else if (direccion !== undefined && direccion !== "") titulo += ` en ${direccion}`;

  // La página se nombra para que las dos no compitan con el mismo título en los
  // resultados de búsqueda.
  return pagina > 1 ? `${titulo} — Página ${pagina}` : titulo;
}

export function descripcionDeListado(filtros: ListingFilters, catalog: Catalog = {}): string {
  // Solo la primera letra en minúscula: pasar el título entero por
  // `toLowerCase()` arruina los nombres propios ("en chacras de coria").
  const titulo = enMinusculaInicial(tituloDeListado(filtros, catalog));
  return recortar(
    `Mirá ${titulo} publicadas por Nazar Propiedades: fotos, precios, ubicación y los datos de cada propiedad.`,
  );
}

function enMinusculaInicial(texto: string): string {
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}

function nombreDelLugar(
  filtros: ListingFilters,
  labels: ReturnType<typeof buildLabelIndex>,
): string | null {
  // De lo más preciso a lo más general, y solo cuando hay UNO: "Casa en venta
  // en Chacras de Coria y Vistalba" no es un título, es una enumeración.
  if (filtros.zone?.length === 1) return labelFor(labels.zones, filtros.zone[0]);
  if (filtros.department?.length === 1) return labelFor(labels.departments, filtros.department[0]);
  if (filtros.province !== undefined) return labelFor(labels.provinces, filtros.province);
  return null;
}

// Los filtros que hacen que una URL NO valga la pena indexar. No es que estén
// mal: es que generan miles de combinaciones casi iguales que compiten entre
// sí, y Google reparte la autoridad del sitio entre todas.
const FILTROS_PROFUNDOS: (keyof ListingFilters)[] = [
  "currency",
  "priceMin",
  "priceMax",
  "totalAreaMin",
  "totalAreaMax",
  "bedrooms",
  "bathrooms",
  "garageCapacity",
  "gatedCommunity",
  "age",
  "amenities",
  "addressQuery",
];

export interface ConsultaIndexable {
  filtros: ListingFilters;
  pagina: number;
}

// Qué se indexa: la portada del listado y las combinaciones que un visitante
// buscaría en Google — una operación, un tipo, un lugar. Todo lo demás va con
// `noindex, follow`: no se indexa la URL, pero sí se siguen los links, así que
// las fichas se descubren igual.
export function debeIndexar({ filtros, pagina }: ConsultaIndexable): boolean {
  if (pagina > 1) return false;

  // Un orden distinto del default es la MISMA lista en otro orden: contenido
  // duplicado puro.
  if (filtros.sort !== undefined && filtros.sort !== "reciente") return false;

  for (const clave of FILTROS_PROFUNDOS) {
    if (filtros[clave] !== undefined) return false;
  }

  // Multi-valor: `?tipo=house&tipo=ph` tampoco se puede nombrar en un título.
  if ((filtros.condition?.length ?? 0) > 1) return false;
  if ((filtros.propertyType?.length ?? 0) > 1) return false;
  if ((filtros.department?.length ?? 0) > 1) return false;
  if ((filtros.zone?.length ?? 0) > 1) return false;

  return true;
}
