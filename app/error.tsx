"use client";

import Link from "next/link";
import { useEffect } from "react";
import { PaginaDeEstado } from "@/components/pagina-de-estado";
import { describirError } from "@/lib/ui/errores";

// Boundary de las rutas. Cubre los BUGS, no las fallas de datos: `queries.ts`
// no lanza nunca, así que una API caída no llega acá — llega como
// `DataFailure` y la página la muestra con `<FallaDeDatos>`. Lo que llega acá
// es un `undefined.map()` o algo igual de inesperado.
//
// En Next 16 el prop para recuperarse es `retry` (vuelve a pedir y renderizar
// los children), no `reset` —que solo limpia el estado sin volver a pedir—, y
// `error` viene tipado `unknown`. Ver node_modules/next/dist/docs/01-app/
// 03-api-reference/03-file-conventions/error.md.
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  // El digest es lo único que correlaciona lo que vio el visitante con el log
  // del server. El `message` no se loguea: en producción es genérico y en
  // desarrollo trae el original, que no es nuestro para andar repartiendo.
  useEffect(() => {
    console.error(`[ui:error] ${describirError(error)}`);
  }, [error]);

  return (
    <PaginaDeEstado
      titulo="Algo no funcionó"
      mensaje="Tuvimos un problema inesperado al mostrar esta página. Probá de nuevo; si sigue pasando, volvé en un rato."
      acciones={
        <>
          <button type="button" onClick={() => retry()} className="rounded border px-4 py-2">
            Reintentar
          </button>
          <Link href="/" className="rounded border px-4 py-2">
            Ir al inicio
          </Link>
        </>
      }
    />
  );
}
