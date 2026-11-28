import Link from "next/link";
import type { Catalog, ListingFilters } from "@/lib/domain";
import { filtrosAplicados, urlDelListado } from "@/lib/filters";

// Qué se está filtrando, con un link para quitar cada cosa.
//
// Es lo que hace usable la lista vacía: "no encontramos propiedades" sin decir
// qué se buscó obliga al visitante a leer la URL para entender qué soltar. Y
// sirve igual con resultados, como resumen de lo aplicado.
//
// Cada link se arma con `urlDelListado` sobre los filtros SIN ese valor: la
// misma traducción que lee la URL es la que la escribe, así que quitar un
// filtro no puede producir una URL que el parseo no entienda.

export function FiltrosAplicados({
  filtros,
  catalog,
}: {
  filtros: ListingFilters;
  catalog: Catalog;
}) {
  const aplicados = filtrosAplicados(filtros, catalog);
  if (aplicados.length === 0) return null;

  // El orden se conserva al quitar un filtro, así que no se mueve todo de
  // lugar: `filtrosAplicados` recorre los filtros siempre en el mismo orden.
  return (
    <section aria-labelledby="filtros-aplicados" className="flex flex-col gap-2">
      <h2 id="filtros-aplicados" className="text-sm font-semibold">
        Filtros aplicados
      </h2>
      <ul className="flex flex-wrap gap-2">
        {aplicados.map((aplicado) => (
          <li key={`${aplicado.param}-${aplicado.valor}`}>
            <Link
              href={urlDelListado(aplicado.filtrosSin)}
              // El texto visible es corto ("Venta"); el nombre accesible dice
              // qué hace el link, que es lo que necesita quien no ve el chip.
              aria-label={`Quitar el filtro ${aplicado.etiqueta}: ${aplicado.valor}`}
              className="border px-2 py-1 text-sm"
            >
              {aplicado.etiqueta}: {aplicado.valor} <span aria-hidden="true">✕</span>
            </Link>
          </li>
        ))}
      </ul>
      {/* Soltar todo de una. Sin esto, una búsqueda con ocho filtros se limpia
          con ocho clics. */}
      <p>
        {/* Se conserva el orden: no es un filtro, no reduce resultados, y
            resetearlo de prepo cambia la lista por algo que nadie pidió. */}
        <Link href={urlDelListado({ sort: filtros.sort })} className="text-sm underline">
          Quitar todos los filtros
        </Link>
      </p>
    </section>
  );
}
