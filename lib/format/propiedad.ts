import type { Listing, ListingBase, ListingSummary, Location } from "@/lib/domain";

// El texto y la URL de una propiedad: el título, la ubicación legible y el link
// canónico. Vive en un solo lugar porque lo usan la tarjeta del listado, el
// encabezado de la ficha, el redirect del slug y —cuando exista— la metadata.
// Tres versiones distintas del título de la misma propiedad es exactamente el
// tipo de detalle que delata un sitio hecho a pedazos.

// `title` es nullable en la API: la mayoría de las propiedades que carga el CRM
// no tiene título. Sin él se compone con lo que sí está siempre: tipo,
// operación y la ubicación más precisa que haya.
export function tituloDePropiedad(listing: Listing | ListingSummary): string {
  const propio = "title" in listing ? listing.title?.trim() : undefined;
  if (propio !== undefined && propio !== "") return propio;
  return tituloCompuesto(listing);
}

// El título compuesto se usa también para el slug, así que no puede depender
// del título del CRM: si lo hiciera, editar el título cambiaría la URL.
export function tituloCompuesto(listing: ListingBase): string {
  const { location } = listing;
  // La operación en minúscula: la etiqueta de la API viene capitalizada
  // ("Venta") y "Casa en Venta" se lee mal en medio de una oración.
  const base = `${listing.propertyTypeLabel} en ${listing.conditionLabel.toLowerCase()}`;
  const donde = location.zoneLabel ?? location.departmentLabel;
  return donde === "" ? base : `${base} en ${donde}`;
}

// De lo más preciso a lo más general, salteando lo que falta. Una propiedad sin
// zona cargada tiene solo el departamento, y eso no es un hueco que haya que
// dibujar.
export function textoDeUbicacion(location: Location): string {
  return [location.neighborhoodOrStreet, location.zoneLabel, location.departmentLabel]
    .map((parte) => parte?.trim())
    .filter((parte): parte is string => parte !== undefined && parte !== null && parte !== "")
    .join(", ");
}

const SEPARADORES = /[^a-z0-9]+/g;

// Acentos fuera: un slug con "ñ" o "á" viaja percent-encodeado y se ve horrible
// cuando el link se pega en WhatsApp.
export function aSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(SEPARADORES, "-")
    .replace(/^-+|-+$/g, "");
}

// El slug es DECORATIVO: la URL canónica es `/propiedad/{id}/{slug}` y lo único
// que identifica la propiedad es el id.
//
// La API no tiene slug y no lo va a tener: se arma acá, con el título
// compuesto. Por eso no usa `title` —que el CRM edita— sino tipo, operación y
// zona: el slug cambia solo si cambia alguno de esos, y cuando cambia la ficha
// redirige al canónico en vez de servir el mismo contenido en dos URLs.
export function slugDePropiedad(listing: Listing | ListingSummary): string {
  return aSlug(tituloCompuesto(listing));
}

export const RUTA_DE_PROPIEDAD = "/propiedad";

export function urlDePropiedad(listing: Listing | ListingSummary): string {
  const slug = slugDePropiedad(listing);
  return slug === ""
    ? `${RUTA_DE_PROPIEDAD}/${listing.id}`
    : `${RUTA_DE_PROPIEDAD}/${listing.id}/${slug}`;
}

// Para los links donde solo se tiene el id (los otros avisos de la misma
// propiedad, que llegan sin tipo ni ubicación): la ficha redirige al canónico.
export function urlDePropiedadPorId(id: number): string {
  return `${RUTA_DE_PROPIEDAD}/${id}`;
}
