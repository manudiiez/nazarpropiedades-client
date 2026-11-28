import type { Catalog, Currency, Facets, ListingFilters, PageRequest } from "@/lib/domain";
import { getCatalog, getFacets } from "@/lib/data/queries";
import {
  conMonedaParaOrden,
  filtrosDesdeSearchParams,
  monedasConPublicaciones,
  paginaDesdeSearchParams,
  type ParametroDescartado,
  type SearchParamsInput,
} from "@/lib/filters";

// Lo que la URL significa, resuelto una sola vez para toda la página.
//
// El bloque de filtros y el de resultados necesitan lo mismo (los filtros
// parseados, el catálogo para las etiquetas, los facets para las opciones), y
// se renderizan en dos `<Suspense>` distintos. Así que la página llama a esto
// UNA vez, sin `await`, y le pasa la misma promesa a los dos: el trabajo se
// hace una sola vez y la cáscara estática no se bloquea esperando nada.
//
// `searchParams` es una API dinámica: se resuelve acá, fuera de cualquier scope
// con `use cache`. Las funciones de lib/filters son puras y reciben el objeto
// ya resuelto.

export interface Consulta {
  filtros: ListingFilters;
  pagina: PageRequest;
  catalog: Catalog;
  // `null` si la lectura falló. El filtro se arma con el catálogo y sin
  // conteos: mejor un filtro sin conteos que ningún filtro.
  facets: Facets | null;
  // La moneda que se agregó sola para que ordenar por precio signifique algo.
  monedaForzada: Currency | null;
  descartados: ParametroDescartado[];
}

export async function resolverConsulta(
  searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>,
): Promise<Consulta> {
  const params: SearchParamsInput = await searchParams;

  // Las dos lecturas están cacheadas (`use cache` en los repositorios) y son
  // independientes: en paralelo, porque en serie suman dos viajes a la API en
  // el primer render de cada minuto.
  const [catalogo, facets] = await Promise.all([getCatalog(), getFacets()]);
  const catalog = catalogo.ok ? catalogo.data : {};

  const { filtros, descartados } = filtrosDesdeSearchParams(params, catalog);
  const { filtros: conMoneda, monedaForzada } = conMonedaParaOrden(
    filtros,
    monedasConPublicaciones(facets.ok ? facets.data.priceRange : undefined),
  );

  return {
    filtros: conMoneda,
    pagina: paginaDesdeSearchParams(params),
    catalog,
    facets: facets.ok ? facets.data : null,
    monedaForzada,
    descartados,
  };
}
