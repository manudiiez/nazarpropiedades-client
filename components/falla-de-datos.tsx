import Link from "next/link";
import type { DataFailure } from "@/lib/data/failures";
import { BotonReintentar } from "./boton-reintentar";
import { PaginaDeEstado } from "./pagina-de-estado";

// Lo que la UI muestra cuando una función de `lib/data/queries` devuelve
// `{ok: false, failure}`. La capa de datos ya hizo el trabajo difícil: la
// `failure` trae `title` y `message` en español, sin detalles técnicos, y
// `retryable` dice si reintentar sirve de algo.
//
// Importante: esto NO es para un listado vacío ni para un detalle inexistente.
// Eso son estados válidos (`items: []`, `data: null`) y se resuelven con "no
// encontramos propiedades" o `notFound()`. Mostrar un cartel de error ahí le
// dice al visitante que el sitio está roto cuando solo filtró demasiado.

export function FallaDeDatos({ failure }: { failure: DataFailure }) {
  return (
    <PaginaDeEstado
      titulo={failure.title}
      mensaje={failure.message}
      acciones={
        <>
          {/* La API caída se arregla reintentando; un payload roto devuelve lo
              mismo, y ofrecer el botón solo frustra. */}
          {failure.retryable ? <BotonReintentar /> : null}
          <Link href="/" className="rounded border px-4 py-2">
            Ir al inicio
          </Link>
        </>
      }
    />
  );
}
