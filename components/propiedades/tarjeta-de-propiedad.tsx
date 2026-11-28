import Image from "next/image";
import Link from "next/link";
import type { ListingSummary } from "@/lib/domain";
import {
  formatearExpensas,
  formatearPrecioPorMes,
  formatearPublicacion,
  resumenDeKeyAttributes,
  textoDeUbicacion,
  tituloDePropiedad,
  urlDePropiedad,
} from "@/lib/format";

// Una propiedad en el listado. Server Component: no tiene estado ni
// interacción, y todo el formateo ya está resuelto en lib/format.
//
// Sin diseño a propósito (ver el issue #32): HTML semántico y nada más. La
// jerarquía visual va cuando haya diseño.

// Qué mostrar cuando la propiedad todavía no tiene foto. Pasa de verdad: el
// worker de imágenes corre después de la carga, así que una propiedad recién
// publicada puede ser válida y tener `coverPhoto: null`. La tarjeta tiene que
// mostrar un hueco, no romperse.
function SinFoto() {
  return (
    <div
      className="flex aspect-[4/3] items-center justify-center border text-sm"
      // El texto es decorativo: lo importante del aviso ya está en el título y
      // en los datos de la propiedad.
      aria-hidden="true"
    >
      Sin foto
    </div>
  );
}

// `ahora` llega por prop y no se lee acá con `new Date()`: leer el reloj
// durante el render rompe el prerender con `blocking-prerender-current-time`
// (el valor cambia entre renders), Next descarta el intento y vuelve a
// renderizar la ruta entera. Lo verificamos en el log. La página lee la hora
// una vez, después de declarar que se renderiza por request, y la baja.
export function TarjetaDePropiedad({
  listing,
  ahora,
}: {
  listing: ListingSummary;
  ahora: Date;
}) {
  const { location } = listing;
  // El mismo título y la misma URL canónica que usa la ficha: dos versiones
  // del título de la misma propiedad se desincronizan solas.
  const titulo = tituloDePropiedad(listing);
  const precio = formatearPrecioPorMes(listing.price, listing.condition);
  const expensas = formatearExpensas(listing.expenses);
  const datos = resumenDeKeyAttributes(listing.keyAttributes);
  const ubicacion = textoDeUbicacion(location);

  return (
    <article className="flex flex-col gap-2 border p-4">
      <Link href={urlDePropiedad(listing)} className="flex flex-col gap-2">
        {listing.coverPhoto === null ? (
          <SinFoto />
        ) : (
          <Image
            // Se usa la foto grande y NO `thumbnailUrl`: la miniatura mide
            // 400x300 y 400 no es un ancho permitido por los `imageSizes` de
            // Next, así que pedirla devuelve 400 Bad Request. Con `sizes`, Next
            // elige un ancho de su lista y optimiza la grande.
            src={listing.coverPhoto.url}
            alt={`${titulo}${ubicacion === "" ? "" : ` en ${ubicacion}`}`}
            width={768}
            height={576}
            sizes="(max-width: 640px) 100vw, 384px"
            className="aspect-[4/3] w-full object-cover"
          />
        )}
        <h3 className="font-semibold">{titulo}</h3>
      </Link>

      <p className="font-semibold">{precio}</p>
      {/* `null` cuando no hay expensas: no se dibuja la línea vacía. */}
      {expensas === null ? null : <p className="text-sm">{expensas}</p>}

      {ubicacion === "" ? null : <p className="text-sm">{ubicacion}</p>}
      {/* La dirección completa es lo que cargó el CRM; la etiqueta de la zona
          sale del catálogo. Se muestran las dos porque una propiedad sin zona
          cargada solo tiene la dirección. */}
      <p className="text-sm">{location.fullAddress}</p>

      {datos.length === 0 ? null : (
        <ul className="flex flex-wrap gap-x-3 text-sm">
          {datos.map((dato) => (
            <li key={dato}>{dato}</li>
          ))}
        </ul>
      )}

      <p className="text-sm">
        {/* `dateTime` en ISO: el texto es relativo ("hace 3 días") y sin esto
            no queda en ningún lado cuándo fue. */}
        <time dateTime={listing.createdAt.toISOString()}>
          {formatearPublicacion(listing.createdAt, ahora)}
        </time>
      </p>
    </article>
  );
}
