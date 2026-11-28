import type { AttributeItem, KeyAttributes } from "@/lib/domain";
import { esNumeroUtil, formatearDecimal } from "./numeros";

// Los valores de los atributos ya vienen parseados por el mapper: número
// cuando son numéricos (dormitorios, superficie) y texto cuando no (una
// orientación). El formateador tiene que distinguir los dos casos: pasar una
// orientación por `Intl.NumberFormat` da "NaN".
//
// Y el sufijo lo manda la API en cada atributo. No se inventa acá: si una
// superficie viene con "m²" y otra con "ha", las dos se muestran como vinieron.

export type ValorDeAtributo = string | number | boolean | null | undefined;

// `undefined` es el caso normal, no un error: las claves de `keyAttributes`
// VARÍAN por propiedad y el tipo es `Partial` justamente para forzar a
// manejarlo. Devuelve null para que el componente no dibuje la línea.
export function formatearValorDeAtributo(
  valor: ValorDeAtributo,
  suffix: string | null = null,
): string | null {
  if (valor === null || valor === undefined) return null;

  // Un booleano es "tiene / no tiene": no lleva sufijo ni número.
  if (typeof valor === "boolean") return valor ? "Sí" : "No";

  if (esNumeroUtil(valor)) {
    const numero = formatearDecimal(valor);
    return suffix === null || suffix === "" ? numero : `${numero} ${suffix}`;
  }

  // Texto: puede venir con espacios de sobra desde el CRM.
  const texto = String(valor).trim();
  if (texto === "") return null;
  return suffix === null || suffix === "" ? texto : `${texto} ${suffix}`;
}

// "620 m²". El sufijo por defecto es "m²" porque es el de las superficies de
// los atributos del listado, donde la API no manda sufijo; cuando el atributo
// SÍ trae el suyo ("ha"), hay que pasarlo. Con `null` se muestra el número
// solo, antes de inventar una unidad.
export function formatearSuperficie(
  valor: number | null | undefined,
  suffix: string | null = "m²",
): string | null {
  return formatearValorDeAtributo(esNumeroUtil(valor) ? valor : null, suffix);
}

export interface AtributoFormateado {
  etiqueta: string;
  valor: string;
}

// La etiqueta sale del atributo, que ya la trae de la API: el front no tiene
// diccionarios de nombres. Devuelve null si el valor no se puede mostrar, para
// que el componente filtre con un `.filter(Boolean)` y no dibuje huecos.
export function formatearAtributo(atributo: AttributeItem): AtributoFormateado | null {
  const valor = formatearValorDeAtributo(atributo.value, atributo.suffix);
  if (valor === null) return null;
  return { etiqueta: atributo.label, valor };
}

export function formatearAtributos(atributos: AttributeItem[]): AtributoFormateado[] {
  return atributos
    .map(formatearAtributo)
    .filter((atributo): atributo is AtributoFormateado => atributo !== null);
}

// Para el resumen del listado, donde las claves son variables y no hay
// etiquetas: el componente decide qué claves muestra y con qué nombre.
export function valorDeKeyAttribute(
  atributos: KeyAttributes,
  clave: string,
  suffix: string | null = null,
): string | null {
  return formatearValorDeAtributo(atributos[clave], suffix);
}
