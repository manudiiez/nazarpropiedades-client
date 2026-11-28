import Link from "next/link";
import { PaginaDeEstado } from "@/components/pagina-de-estado";

// Sirve para dos cosas: los `notFound()` de un detalle que no existe —una
// propiedad despublicada, un id inventado— y las URLs que no matchean ninguna
// ruta. Next devuelve 404 e inyecta `noindex` solo; no hay que agregarlo.
//
// No se usa `global-not-found.tsx` (experimental): hace falta solo cuando hay
// varios layouts raíz o segmentos dinámicos arriba, y acá hay un layout único.
export default function NotFound() {
  return (
    <PaginaDeEstado
      titulo="No encontramos esta página"
      mensaje="La dirección no existe, o la propiedad que buscabas ya no está publicada."
      acciones={
        // Cuando exista el listado (#32) va también un link a /propiedades: es
        // la salida útil para alguien que llegó desde un aviso viejo.
        <Link href="/" className="rounded border px-4 py-2">
          Ir al inicio
        </Link>
      }
    />
  );
}
