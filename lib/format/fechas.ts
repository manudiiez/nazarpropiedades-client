import { LOCALE } from "./numeros";

// "hace 3 días" para lo reciente y "12 de marzo de 2026" para lo viejo.
//
// El corte existe porque las dos formas sirven para cosas distintas: en una
// publicación nueva lo importante es que es nueva, y en una de hace meses lo
// importante es cuándo fue, no cuántos días pasaron (nadie lee "hace 237 días").

const ABSOLUTA = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const RELATIVA = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

// A partir de acá se muestra la fecha absoluta.
export const DIAS_PARA_FECHA_ABSOLUTA = 30;

export function formatearFechaAbsoluta(fecha: Date): string {
  return ABSOLUTA.format(fecha);
}

// Si el texto es relativo o absoluto no se puede deducir mirándolo: con
// `numeric: "auto"` el español devuelve "ayer" y "anteayer", no solo "hace N".
// Por eso la decisión viaja junto al texto en vez de adivinarse con un
// `startsWith("hace")`.
type FechaFormateada = { texto: string; relativa: boolean };

// `ahora` es un parámetro para poder testearlo sin congelar el reloj del
// proceso.
function formatear(fecha: Date, ahora: Date): FechaFormateada {
  if (Number.isNaN(fecha.getTime())) return { texto: "", relativa: false };

  const transcurrido = ahora.getTime() - fecha.getTime();
  const absoluta = { texto: formatearFechaAbsoluta(fecha), relativa: false };

  // Una fecha futura es un dato raro (un reloj desfasado entre el server y la
  // API): se muestra absoluta en vez de "en 2 horas", que parecería un error.
  if (transcurrido < 0) return absoluta;

  const relativa = (valor: number, unidad: Intl.RelativeTimeFormatUnit) => ({
    texto: RELATIVA.format(-valor, unidad),
    relativa: true,
  });

  if (transcurrido < MINUTO) return { texto: "hace instantes", relativa: true };
  if (transcurrido < HORA) return relativa(Math.floor(transcurrido / MINUTO), "minute");
  if (transcurrido < DIA) return relativa(Math.floor(transcurrido / HORA), "hour");

  const dias = Math.floor(transcurrido / DIA);
  if (dias < DIAS_PARA_FECHA_ABSOLUTA) return relativa(dias, "day");

  return absoluta;
}

export function formatearFecha(fecha: Date, ahora: Date = new Date()): string {
  return formatear(fecha, ahora).texto;
}

// Para "Publicado hace 3 días" / "Publicado el 12 de marzo de 2026": la
// preposición cambia según la forma, y resolverlo en el componente termina en
// "Publicado 12 de marzo de 2026".
export function formatearPublicacion(fecha: Date, ahora: Date = new Date()): string {
  const { texto, relativa } = formatear(fecha, ahora);
  if (texto === "") return "";
  return relativa ? `Publicado ${texto}` : `Publicado el ${texto}`;
}
