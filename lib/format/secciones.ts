import type { AttributeItem } from "@/lib/domain";
import { humanize } from "@/lib/data/http/label-index";

// Los nombres de las secciones con las que la API agrupa atributos y amenities.
//
// Esto es lo ÚNICO que el front nombra sobre datos de la API, y no por gusto:
// los atributos traen `label` y `suffix` listos, pero la sección viene como
// clave (`dimensions`, `amenities_comfort`) y no hay ningún endpoint que
// devuelva su nombre. Si alguna vez la API las manda con etiqueta, esto se
// borra.
//
// Una sección que no está en la lista NO es un error: la API agrega secciones
// cuando agrega strategies. Se degrada con `humanize`, igual que las etiquetas
// que faltan en el catálogo: así se ve que falta y se corrige en la API, en vez
// de esconder el problema con un fallback perfecto.
const ETIQUETAS: Record<string, string> = {
  // Atributos.
  general: "Características generales",
  dimensions: "Dimensiones",
  rooms: "Ambientes",
  features: "Detalles",
  nearby: "Cerca de",
  // Amenities.
  utilities: "Servicios",
  security: "Seguridad",
  amenities_rooms: "Ambientes y espacios",
  amenities_comfort: "Confort",
  common_areas: "Espacios comunes",
};

// `null` es una sección que la API no mandó: el atributo existe y se muestra,
// agrupado aparte.
export function etiquetaDeSeccion(section: string | null): string {
  if (section === null) return "Otros datos";
  return ETIQUETAS[section] ?? humanize(section);
}

export interface SeccionDeAtributos {
  section: string | null;
  etiqueta: string;
  atributos: AttributeItem[];
}

// Agrupa respetando el orden en que las secciones APARECEN en la respuesta.
//
// No hay un orden propio del front a propósito: la API ya ordena los atributos
// por prioridad dentro de cada strategy, y reordenarlos acá sería pelearle a
// ese criterio con uno peor (el front no sabe qué importa en un galpón).
export function agruparPorSeccion(atributos: AttributeItem[]): SeccionDeAtributos[] {
  const grupos = new Map<string, SeccionDeAtributos>();

  for (const atributo of atributos) {
    // La clave del Map lleva prefijo para que `null` no se confunda con una
    // sección que se llame "null".
    const clave = atributo.section === null ? "sin-seccion" : `seccion:${atributo.section}`;
    const grupo = grupos.get(clave);
    if (grupo === undefined) {
      grupos.set(clave, {
        section: atributo.section,
        etiqueta: etiquetaDeSeccion(atributo.section),
        atributos: [atributo],
      });
    } else {
      grupo.atributos.push(atributo);
    }
  }

  return [...grupos.values()];
}
