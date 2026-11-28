import Link from "next/link";
import type { Catalog, SiblingListing } from "@/lib/domain";
import { buildLabelIndex, labelFor } from "@/lib/data/http/label-index";
import { formatearPrecioPorMes, urlDePropiedadPorId } from "@/lib/format";

// "También disponible en alquiler": los otros avisos de la MISMA propiedad.
//
// La API los manda en `sibling_listings` con id, condición, estado y precio, y
// nada más: no traen tipo ni ubicación, así que el link va sin slug y la ficha
// redirige al canónico. La etiqueta de la condición tampoco viene —solo el
// valor—, así que se resuelve contra el catálogo, igual que en el resto del
// sitio: el front no tiene su propia lista de nombres de operaciones.
//
// Se muestran solo los activos. Un aviso en `draft` o `archived` existe en el
// CRM pero no tiene ficha pública: el link daría 404.

export function OtrosAvisos({
  siblings,
  catalog,
}: {
  siblings: SiblingListing[];
  catalog: Catalog;
}) {
  const publicados = siblings.filter((sibling) => sibling.status === "active");
  if (publicados.length === 0) return null;

  const labels = buildLabelIndex(catalog);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Esta propiedad también está disponible</h2>
      <ul className="flex flex-col gap-1">
        {publicados.map((sibling) => (
          <li key={sibling.id}>
            <Link href={urlDePropiedadPorId(sibling.id)} className="underline">
              {labelFor(labels.conditions, sibling.condition)}:{" "}
              {/* El precio del otro aviso, con "por mes" si es alquiler: sin
                  eso, un alquiler de 450.000 parece un precio de venta. */}
              {formatearPrecioPorMes(sibling.price, sibling.condition)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
