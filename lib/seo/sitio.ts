// Los textos del sitio que viven en la metadata. Están acá y no sueltos en
// cada `generateMetadata` para que el nombre y la descripción no se escriban
// distinto en cada página.

export const NOMBRE_DEL_SITIO = "Nazar Propiedades";

export const DESCRIPCION_DEL_SITIO =
  "Casas, departamentos, terrenos y locales en venta y en alquiler en Mendoza. " +
  "Mirá las propiedades publicadas, con fotos, precios y ubicación.";

// Los topes de lo que muestran Google y WhatsApp. No son límites técnicos:
// recortar nosotros es mejor que que lo corten ellos en la mitad de una
// palabra.
export const MAX_DESCRIPCION = 160;

export function recortar(texto: string, maximo = MAX_DESCRIPCION): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  if (limpio.length <= maximo) return limpio;

  // Se corta en el último espacio para no dejar una palabra partida, y el "…"
  // entra dentro del tope.
  const recortado = limpio.slice(0, maximo - 1);
  const corte = recortado.lastIndexOf(" ");
  return `${(corte > maximo / 2 ? recortado.slice(0, corte) : recortado).trimEnd()}…`;
}
