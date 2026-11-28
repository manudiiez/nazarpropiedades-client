import type { Listing } from "@/lib/domain";
import { isRental } from "@/lib/domain";
import { formatearSuperficie, textoDeUbicacion, tituloDePropiedad } from "@/lib/format";
import { recortar } from "./sitio";

// La metadata de una ficha: la descripción que se ve al compartir por WhatsApp
// y los datos estructurados.

// `description` es nullable y muchas propiedades del CRM no la tienen. El
// fallback se compone con lo que siempre está: qué es, dónde y cuánto mide.
export function descripcionDePropiedad(listing: Listing): string {
  const propia = listing.description?.trim();
  if (propia !== undefined && propia !== "") return recortar(propia);

  const partes = [tituloDePropiedad(listing)];

  const ubicacion = textoDeUbicacion(listing.location);
  if (ubicacion !== "") partes.push(ubicacion);

  const superficie = superficieTotal(listing);
  if (superficie !== null) partes.push(superficie);

  return recortar(`${partes.join(". ")}. Consultá por esta propiedad en Nazar Propiedades.`);
}

function superficieTotal(listing: Listing): string | null {
  const atributo = listing.attributes.find((actual) => actual.key === "total_area");
  if (atributo === undefined || typeof atributo.value !== "number") return null;
  return formatearSuperficie(atributo.value, atributo.suffix ?? "m²");
}

// Las fotos para Open Graph. Pueden no existir: `photos: []` con la propiedad
// publicada es un caso válido (el worker de imágenes todavía no corrió), y ahí
// la página cae a la imagen por defecto del sitio.
export function fotosParaCompartir(listing: Listing): string[] {
  return [...listing.photos]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((photo) => photo.url)
    // Una sola: WhatsApp y Google muestran la primera, y mandar doce no agrega
    // nada al payload que se comparte.
    .slice(0, 1);
}

// Datos estructurados schema.org.
//
// No hay un resultado enriquecido oficial de Google para inmuebles, así que
// esto no "activa" una tarjeta: sirve para que entienda la entidad (qué es,
// dónde, cuánto) en vez de deducirlo del texto.
//
// Ojo con las coordenadas: se incluyen SOLO si `showMap` es true y el modo es
// exacto, igual que el mapa de la página. Publicar el punto acá cuando la
// propiedad se muestra por área sería filtrar por JSON lo que la UI esconde.
export interface JsonLd {
  "@context": "https://schema.org";
  "@type": "RealEstateListing";
  [clave: string]: unknown;
}

const MODO_EXACTO = "exact";

export function jsonLdDePropiedad(listing: Listing, url: string | null): JsonLd {
  const { location, map } = listing;

  const jsonLd: JsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: tituloDePropiedad(listing),
    description: descripcionDePropiedad(listing),
    datePosted: listing.createdAt.toISOString(),
    offers: {
      "@type": "Offer",
      price: listing.price.amount,
      priceCurrency: listing.price.currency,
      availability: "https://schema.org/InStock",
      // Vender y alquilar son ofertas distintas, y el precio de un alquiler es
      // mensual: sin esto, un alquiler de 450.000 se lee como precio de venta.
      businessFunction: isRental(listing.condition)
        ? "http://purl.org/goodrelations/v1#LeaseOut"
        : "http://purl.org/goodrelations/v1#Sell",
    },
    about: {
      "@type": "Accommodation",
      name: listing.propertyTypeLabel,
      address: {
        "@type": "PostalAddress",
        streetAddress: location.neighborhoodOrStreet ?? location.fullAddress,
        addressLocality: location.zoneLabel ?? location.departmentLabel,
        addressRegion: location.provinceLabel,
        addressCountry: "AR",
      },
      ...medidasYAmbientes(listing),
    },
  };

  if (url !== null) jsonLd.url = url;

  const fotos = fotosParaCompartir(listing);
  if (fotos.length > 0) jsonLd.image = fotos;

  if (map.showMap && map.mode === MODO_EXACTO && map.latitude !== null && map.longitude !== null) {
    jsonLd.geo = {
      "@type": "GeoCoordinates",
      latitude: map.latitude,
      longitude: map.longitude,
    };
  }

  return jsonLd;
}

// Los atributos que schema.org nombra y la API manda con su key. Lo demás no se
// traduce: inventar propiedades de schema.org para cada atributo del CRM es
// ruido, no datos estructurados.
function medidasYAmbientes(listing: Listing): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  const numero = (key: string): number | null => {
    const atributo = listing.attributes.find((actual) => actual.key === key);
    return atributo !== undefined && typeof atributo.value === "number" ? atributo.value : null;
  };

  const dormitorios = numero("bedrooms");
  if (dormitorios !== null) salida.numberOfBedrooms = dormitorios;

  const banos = numero("bathrooms");
  if (banos !== null) salida.numberOfBathroomsTotal = banos;

  const superficie = numero("total_area");
  if (superficie !== null) {
    salida.floorSize = {
      "@type": "QuantitativeValue",
      value: superficie,
      // El código UN/CEFACT de metro cuadrado. schema.org espera eso, no "m²".
      unitCode: "MTK",
    };
  }

  return salida;
}

// El JSON-LD va dentro de un `<script>`, así que una descripción que contenga
// "</script>" cerraría la etiqueta y lo que siga se interpretaría como HTML.
// La descripción la escribe el CRM, o sea que es contenido ajeno: escapar "<"
// es lo que separa esto de un XSS almacenado.
export function jsonLdAHtml(jsonLd: JsonLd): string {
  return JSON.stringify(jsonLd).replace(/</g, "\\u003c");
}
