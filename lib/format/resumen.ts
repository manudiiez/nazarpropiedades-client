import type { KeyAttributes } from "@/lib/domain";
import { esNumeroUtil, pluralizar } from "./numeros";
import { formatearSuperficie } from "./atributos";

// El renglón de datos de una tarjeta del listado: "3 dormitorios · 2 baños ·
// 620 m²".
//
// `keyAttributes` es lo único que trae el listado (el detalle lo reemplaza por
// `attributes` enriquecido), y viene SIN etiquetas: son pares clave/valor que
// la API elige por prioridad y que VARÍAN por propiedad. Así que acá sí hace
// falta nombrar las claves, al contrario que en el detalle.
//
// Se nombra solo un conjunto conocido y en un orden fijo:
//
//  - el orden fijo evita que dos tarjetas de la misma grilla pongan los datos
//    en distinto lugar según lo que la API priorizó para cada propiedad;
//  - las claves que no están en la lista se omiten en la TARJETA, porque sin
//    etiqueta la única opción sería mostrar el slug crudo ("floors: 2"). No se
//    pierde el dato: el detalle muestra todos los atributos con la etiqueta
//    que manda la API.
//
// Si la API agrega una clave que merece estar en la tarjeta, se agrega acá y en
// ningún otro lado.

interface ClaveConocida {
  clave: string;
  // `null` cuando el valor se muestra con unidad y no pluralizado.
  singular: string | null;
  suffix: string | null;
}

const CLAVES: readonly ClaveConocida[] = [
  { clave: "bedrooms", singular: "dormitorio", suffix: null },
  { clave: "bathrooms", singular: "baño", suffix: null },
  { clave: "garage_capacity", singular: "cochera", suffix: null },
  // La API no manda sufijo en los key_attributes: las superficies del listado
  // son metros cuadrados.
  { clave: "covered_area", singular: null, suffix: "m² cubiertos" },
  { clave: "total_area", singular: null, suffix: "m² totales" },
];

export function resumenDeKeyAttributes(atributos: KeyAttributes): string[] {
  const salida: string[] = [];

  for (const { clave, singular, suffix } of CLAVES) {
    const valor = atributos[clave];

    // Todas estas claves son numéricas. Un valor de texto acá sería un dato
    // raro del CRM y no hay forma de mostrarlo sin su etiqueta ("planta baja"
    // suelto entre los dormitorios y los baños no se entiende), así que se
    // saltea. `undefined` es el caso normal: las claves varían por propiedad.
    if (!esNumeroUtil(valor)) continue;

    // Un 0 SÍ se muestra: "sin cochera" es un dato, no ausencia de dato.
    const texto = singular === null
      ? formatearSuperficie(valor, suffix)
      : pluralizar(valor, singular);
    if (texto !== null) salida.push(texto);
  }

  return salida;
}
