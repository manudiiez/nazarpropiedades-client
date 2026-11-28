import type { Listing } from "@/lib/domain";
import { formatearEntero, textoDeUbicacion } from "@/lib/format";

// La ubicación en el mapa, con las tres reglas del contrato:
//
//  1. `showMap` MANDA sobre las coordenadas. Puede haber lat/lng cargadas y
//     `showMap: false`: ahí no se muestra nada. Es una decisión de quien cargó
//     la propiedad, no un dato faltante.
//  2. `mode: "radius"` significa "mostrar el área, no el punto". Con esas
//     propiedades NO se publican las coordenadas ni un link que lleve al punto
//     exacto: filtrarlas por la ventana del mapa y publicarlas en el HTML es
//     lo mismo, y el propietario pidió lo contrario.
//  3. `range` es el radio en metros de ese área.
//
// Todavía no hay mapa embebido: elegir proveedor (y pagarlo) es una decisión
// aparte, y un iframe de un tercero en la página que más se comparte no se
// agrega al pasar. Mientras tanto, el modo exacto ofrece un link a un mapa
// externo y el modo área describe la zona.

const EXACTO = "exact";

export function MapaDePropiedad({ listing }: { listing: Listing }) {
  const { map, location } = listing;

  if (!map.showMap) return null;
  if (map.latitude === null || map.longitude === null) return null;

  const zona = textoDeUbicacion(location);

  if (map.mode !== EXACTO) {
    // El radio puede no venir: se describe el área sin inventar una distancia.
    const radio = map.range === null ? null : `${formatearEntero(map.range)} m`;
    return (
      <section className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Ubicación aproximada</h2>
        <p>
          {zona === ""
            ? "La propiedad se muestra por zona, sin la dirección exacta."
            : `La propiedad está en ${zona}. Se muestra por zona, sin la dirección exacta.`}
        </p>
        {radio === null ? null : <p>Radio aproximado: {radio}.</p>}
      </section>
    );
  }

  const coordenadas = `${map.latitude},${map.longitude}`;

  return (
    <section className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">Ubicación</h2>
      <p>{location.fullAddress}</p>
      <p>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordenadas)}`}
          // Se abre afuera y sin pasarle el referrer a Google.
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Ver en el mapa
        </a>
      </p>
    </section>
  );
}
