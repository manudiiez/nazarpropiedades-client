// Formateo de números con la convención de es-AR: punto para los miles y coma
// para los decimales. Las instancias de `Intl.NumberFormat` se crean una sola
// vez: construirlas es caro y acá se llaman una vez por tarjeta.

export const LOCALE = "es-AR";

const ENTERO = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

// Las superficies sí pueden tener decimales (620,5 m²), los precios no.
const CON_DECIMALES = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });

export function esNumeroUtil(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor);
}

export function formatearEntero(valor: number): string {
  return ENTERO.format(valor);
}

export function formatearDecimal(valor: number): string {
  return CON_DECIMALES.format(valor);
}

// "1 dormitorio" / "2 dormitorios". Es el detalle que delata un sitio hecho con
// apuro, y si no vive en un solo lado cada componente lo resuelve distinto.
export function pluralizar(cantidad: number, singular: string, plural?: string): string {
  const palabra =
    Math.abs(cantidad) === 1 ? singular : (plural ?? `${singular}s`);
  return `${formatearEntero(cantidad)} ${palabra}`;
}
