import Link from "next/link";
import type { ListingFilters } from "@/lib/domain";
import { urlDelListado } from "@/lib/filters";

// Paginación con links de verdad (`<a href>`), no con botones que empujan el
// historial: cada página del listado es una URL propia, compartible e
// indexable, y así funciona con el clic del medio y sin JavaScript.
//
// Ojo con `totalPages`: sin resultados la API devuelve 0, NO 1. Dibujar un
// paginador de "página 1 de 0" es el bug clásico de este endpoint.

const A_CADA_LADO = 2;

// Primera, última, y una ventana alrededor de la actual. `null` donde va un
// "…": con 40 páginas, listarlas todas tapa los resultados.
function paginasAMostrar(actual: number, total: number): (number | null)[] {
  const numeros = new Set<number>([1, total]);
  for (let n = actual - A_CADA_LADO; n <= actual + A_CADA_LADO; n++) {
    if (n >= 1 && n <= total) numeros.add(n);
  }

  const ordenadas = [...numeros].sort((a, b) => a - b);
  const salida: (number | null)[] = [];
  let anterior: number | null = null;
  for (const numero of ordenadas) {
    if (anterior !== null && numero - anterior > 1) salida.push(null);
    salida.push(numero);
    anterior = numero;
  }
  return salida;
}

export function Paginador({
  filtros,
  pagina,
  totalPages,
}: {
  filtros: ListingFilters;
  pagina: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const actual = Math.min(Math.max(pagina, 1), totalPages);
  const paginas = paginasAMostrar(actual, totalPages);

  return (
    <nav aria-label="Paginación" className="flex flex-col gap-2">
      <ul className="flex flex-wrap items-center gap-2">
        <li>
          {actual > 1 ? (
            // `rel` para que el navegador y los buscadores sepan que es la
            // misma lista y no otra sección.
            <Link rel="prev" href={urlDelListado(filtros, actual - 1)} className="border px-3 py-1">
              Anterior
            </Link>
          ) : (
            <span aria-hidden="true" className="border px-3 py-1 opacity-50">
              Anterior
            </span>
          )}
        </li>

        {paginas.map((numero, i) =>
          numero === null ? (
            // El "…" no es un control: no se anuncia ni se tabula.
            <li key={`salto-${i}`} aria-hidden="true" className="px-1">
              …
            </li>
          ) : (
            <li key={numero}>
              {numero === actual ? (
                <span aria-current="page" className="border px-3 py-1 font-semibold">
                  {numero}
                </span>
              ) : (
                <Link
                  href={urlDelListado(filtros, numero)}
                  aria-label={`Página ${numero}`}
                  className="border px-3 py-1"
                >
                  {numero}
                </Link>
              )}
            </li>
          ),
        )}

        <li>
          {actual < totalPages ? (
            <Link rel="next" href={urlDelListado(filtros, actual + 1)} className="border px-3 py-1">
              Siguiente
            </Link>
          ) : (
            <span aria-hidden="true" className="border px-3 py-1 opacity-50">
              Siguiente
            </span>
          )}
        </li>
      </ul>

      <p className="text-sm">
        Página {actual} de {totalPages}
      </p>
    </nav>
  );
}
