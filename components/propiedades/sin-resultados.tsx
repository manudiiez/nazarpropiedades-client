import type { Catalog, ListingFilters } from "@/lib/domain";
import { hayFiltrosAplicados } from "@/lib/filters";
import { FiltrosAplicados } from "./filtros-aplicados";

// Cero resultados NO es un error: es una búsqueda que no encontró nada, y
// mostrar un cartel de error le dice al visitante que el sitio está roto cuando
// lo único que pasa es que filtró demasiado.
//
// Lo que sí hace falta es decirle QUÉ pidió: "no encontramos propiedades" sin
// los filtros aplicados lo obliga a leer la URL para saber qué soltar.
export function SinResultados({
  filtros,
  catalog,
}: {
  filtros: ListingFilters;
  catalog: Catalog;
}) {
  // Sin filtros aplicados no hay nada que soltar: o no hay nada publicado, o la
  // API devolvió una lista vacía. Decir "probá quitando filtros" ahí es una
  // instrucción imposible.
  const sinFiltros = !hayFiltrosAplicados(filtros);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">No encontramos propiedades</h2>
      <p>
        {sinFiltros
          ? "Por el momento no hay propiedades publicadas. Volvé a probar en unos días."
          : "Ninguna propiedad publicada coincide con esos filtros. Probá quitando alguno."}
      </p>
      <FiltrosAplicados filtros={filtros} catalog={catalog} />
    </section>
  );
}
