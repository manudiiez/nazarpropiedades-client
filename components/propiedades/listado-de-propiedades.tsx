import type { ListingSummary } from "@/lib/domain";
import { TarjetaDePropiedad } from "./tarjeta-de-propiedad";

// La grilla de resultados. Una `<ul>` de verdad: así un lector de pantalla
// anuncia "lista de 12 elementos" y se puede saltar el bloque entero.
//
// No maneja el caso vacío: una lista vacía no es un listado sin ítems, es otra
// pantalla (ver `SinResultados`), con el texto y los filtros aplicados.
export function ListadoDePropiedades({ listings }: { listings: ListingSummary[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((listing) => (
        <li key={listing.id}>
          <TarjetaDePropiedad listing={listing} />
        </li>
      ))}
    </ul>
  );
}
