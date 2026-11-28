import type { AttributeItem } from "@/lib/domain";
import { agruparPorSeccion, formatearAtributos } from "@/lib/format";

// Los atributos de la ficha, agrupados por la sección que manda la API.
//
// Las etiquetas y los sufijos vienen listos en cada atributo: acá no hay
// diccionario de nombres. Si una etiqueta está mal escrita, se corrige en la
// API.
//
// Los tres bloques (`attributes`, `amenities`, `nearbyZones`) pueden venir
// VACÍOS si la API no tiene strategy para ese par (tipo, condición). Un bloque
// vacío no se dibuja: ni el título, ni la lista, ni un "no hay datos" que no le
// sirve a nadie.

export function BloqueDeAtributos({
  titulo,
  atributos,
}: {
  titulo: string;
  atributos: AttributeItem[];
}) {
  const secciones = agruparPorSeccion(atributos)
    .map((seccion) => ({ ...seccion, formateados: formatearAtributos(seccion.atributos) }))
    // Una sección puede quedar vacía después de formatear: un atributo cuyo
    // valor no se puede mostrar devuelve null y se filtra.
    .filter((seccion) => seccion.formateados.length > 0);

  if (secciones.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      {secciones.map((seccion) => (
        <div key={seccion.section ?? "sin-seccion"} className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold">{seccion.etiqueta}</h3>
          {/* `<dl>` y no `<ul>`: son pares nombre/valor, y así un lector de
              pantalla anuncia "Dormitorios, 3" en vez de leer dos listas
              paralelas. */}
          <dl className="grid gap-x-4 sm:grid-cols-2">
            {seccion.formateados.map((atributo) => (
              <div key={atributo.etiqueta} className="flex gap-2">
                <dt>{atributo.etiqueta}:</dt>
                <dd className="font-semibold">{atributo.valor}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  );
}
