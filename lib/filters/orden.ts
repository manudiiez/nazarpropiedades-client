import { CURRENCIES, type Currency, type ListingFilters, type ListingSort } from "@/lib/domain";

// Ordenar por precio sin fijar una moneda no significa nada.
//
// La API ordena por la columna `price` sin convertir (lo dice el contrato), así
// que un alquiler de 180.000 ARS cae entre dos propiedades de 140.000 y 185.000
// USD. El resultado no está "casi ordenado": está mezclado, y el visitante no
// tiene forma de darse cuenta.
//
// La salida es forzar una moneda cuando se ordena por precio y el visitante no
// eligió ninguna. Se hace acá, sobre los filtros ya resueltos, y la moneda
// forzada VIAJA EN LA URL: así el link que se comparte reproduce exactamente la
// lista que se vio, y el control del filtro puede mostrarla seleccionada en vez
// de aplicar algo invisible.

export function esOrdenPorPrecio(sort: ListingSort | undefined): boolean {
  return sort === "menor_precio" || sort === "mayor_precio";
}

// Qué monedas tienen publicaciones hoy, en el orden de preferencia de
// `CURRENCIES` (USD primero). Sale de `facets.priceRange`, que solo trae las
// monedas con publicaciones activas: forzar USD cuando lo único publicado está
// en pesos daría una lista vacía.
export function monedasConPublicaciones(
  priceRange: Partial<Record<Currency, unknown>> | undefined,
): Currency[] {
  return CURRENCIES.filter((currency) => priceRange?.[currency] !== undefined);
}

export interface FiltrosParaOrden {
  filtros: ListingFilters;
  // La moneda que se agregó sin que el visitante la pidiera, para poder
  // explicárselo. `null` si no se tocó nada.
  monedaForzada: Currency | null;
}

export function conMonedaParaOrden(
  filtros: ListingFilters,
  disponibles: readonly Currency[] = CURRENCIES,
): FiltrosParaOrden {
  if (!esOrdenPorPrecio(filtros.sort)) return { filtros, monedaForzada: null };
  if (filtros.currency !== undefined) return { filtros, monedaForzada: null };

  // Sin facets (si la lectura falló) no se sabe qué hay publicado: se cae al
  // primero de `CURRENCIES` antes que dejar el orden mezclado.
  const moneda = disponibles[0] ?? CURRENCIES[0];
  return { filtros: { ...filtros, currency: moneda }, monedaForzada: moneda };
}
