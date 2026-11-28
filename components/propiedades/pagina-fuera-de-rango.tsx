import Link from "next/link";
import type { ListingFilters } from "@/lib/domain";
import { urlDelListado } from "@/lib/filters";

// La búsqueda tiene resultados, pero no en la página pedida: `?pagina=99`, o un
// link viejo a una página que existía cuando había más propiedades publicadas.
//
// No es lo mismo que no encontrar nada, y mostrar "no hay propiedades
// publicadas" acá sería falso: hay, están en la página 1.
export function PaginaFueraDeRango({
  filtros,
  totalPages,
}: {
  filtros: ListingFilters;
  totalPages: number;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Esa página no existe</h2>
      <p>
        {totalPages === 1
          ? "Esta búsqueda tiene una sola página de resultados."
          : `Esta búsqueda tiene ${totalPages} páginas de resultados.`}
      </p>
      <p>
        <Link href={urlDelListado(filtros, 1)} className="underline">
          Volver a la primera página
        </Link>
      </p>
    </section>
  );
}
