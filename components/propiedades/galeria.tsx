import Image from "next/image";
import type { Photo } from "@/lib/domain";

// Las fotos de la ficha. Sin diseño y sin JavaScript: una lista de imágenes.
// El carrusel va cuando haya diseño; mientras tanto se ven todas, que es peor
// estéticamente y mejor funcionalmente que un carrusel a medias.
//
// `photos: []` es un caso VÁLIDO, no un error: el worker de imágenes corre
// después de la carga, así que una propiedad recién publicada puede no tener
// ninguna. Por eso hay placeholder.

export function Galeria({ photos, titulo }: { photos: Photo[]; titulo: string }) {
  // El orden lo manda la API en `sortOrder`; no se confía en el orden del
  // array, que es el de la base.
  const ordenadas = [...photos].sort((a, b) => a.sortOrder - b.sortOrder);

  if (ordenadas.length === 0) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center border">
        <p>Esta propiedad todavía no tiene fotos publicadas.</p>
      </div>
    );
  }

  const [principal, ...resto] = ordenadas;

  return (
    <section aria-label="Fotos de la propiedad" className="flex flex-col gap-2">
      <Image
        // Se pide la foto grande y NO `thumbnailUrl`: la miniatura mide 400x300
        // y 400 no es un ancho permitido por los `imageSizes` de Next, así que
        // pedirla devuelve 400 Bad Request.
        src={principal.url}
        alt={`${titulo} — foto 1 de ${ordenadas.length}`}
        width={1400}
        height={1050}
        sizes="(max-width: 1024px) 100vw, 1024px"
        // La primera foto es lo primero que se ve: sin `priority` compite con
        // el resto de la página y entra tarde.
        priority
        className="w-full object-cover"
      />

      {resto.length === 0 ? null : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {resto.map((photo, i) => (
            <li key={photo.url}>
              <Image
                src={photo.url}
                // El número de foto, no el título repetido: un lector de
                // pantalla que lee doce veces "Casa en venta en Chacras de
                // Coria" no informa nada.
                alt={`Foto ${i + 2} de ${ordenadas.length}`}
                width={700}
                height={525}
                sizes="(max-width: 640px) 50vw, 320px"
                className="w-full object-cover"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
