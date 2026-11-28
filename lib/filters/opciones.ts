import {
  AGE_RANGES,
  LISTING_SORTS,
  type AgeRange,
  type AmenitySection,
  type GarageCount,
  type ListingSort,
  type RoomCount,
} from "@/lib/domain";
import { EN_URL } from "./url";

// Las etiquetas de los conjuntos que el FRONT define, y solo esas.
//
// Los valores respaldados por el catálogo (tipo de propiedad, operación,
// ubicaciones, amenities) NO están acá: sus etiquetas vienen de la API, que es
// la única fuente de verdad, y los combos se arman con facets. Lo que la API no
// tiene son los tramos que el front inventó para la URL —antigüedad,
// "5 o más" dormitorios, el orden—, que necesitan un nombre para mostrar y no
// pueden salir de ningún lado más.
//
// El `valor` se calcula con el mismo codificador que usa `searchParamsDesdeFiltros`,
// así que el `value` de cada control es exactamente lo que el parseo sabe leer.

export interface OpcionDeFiltro<T> {
  dominio: T;
  valor: string;
  etiqueta: string;
}

function opciones<T>(
  valores: readonly T[],
  codificar: (valor: T) => string,
  etiqueta: (valor: T) => string,
): OpcionDeFiltro<T>[] {
  return valores.map((dominio) => ({
    dominio,
    valor: codificar(dominio),
    etiqueta: etiqueta(dominio),
  }));
}

const ETIQUETAS_ANTIGUEDAD: Record<AgeRange, string> = {
  brand_new: "A estrenar",
  "1-5": "1 a 5 años",
  "6-10": "6 a 10 años",
  "11-20": "11 a 20 años",
  "over-20": "Más de 20 años",
};

const ETIQUETAS_ORDEN: Record<ListingSort, string> = {
  reciente: "Más recientes",
  menor_precio: "Menor precio",
  mayor_precio: "Mayor precio",
};

// 0 es una opción, no la ausencia de opción: "monoambiente" y "sin cochera"
// son búsquedas reales. Se muestran con su número y no con un rótulo mínimo
// porque el control ya dice de qué habla ("Dormitorios: 0 1 2 3 4 5 o más").
const ETIQUETAS_AMBIENTES = new Map<RoomCount, string>([
  [0, "0"],
  [1, "1"],
  [2, "2"],
  [3, "3"],
  [4, "4"],
  ["5+", "5 o más"],
]);

const ETIQUETAS_COCHERAS = new Map<GarageCount, string>([
  [0, "Sin cochera"],
  [1, "1"],
  [2, "2"],
  ["3+", "3 o más"],
]);

const AMBIENTES: readonly RoomCount[] = [0, 1, 2, 3, 4, "5+"];
const COCHERAS: readonly GarageCount[] = [0, 1, 2, "3+"];

export const OPCIONES_ANTIGUEDAD = opciones(
  AGE_RANGES,
  EN_URL.antiguedad,
  (valor) => ETIQUETAS_ANTIGUEDAD[valor],
);

export const OPCIONES_AMBIENTES = opciones(
  AMBIENTES,
  EN_URL.ambientes,
  (valor) => ETIQUETAS_AMBIENTES.get(valor) ?? String(valor),
);

export const OPCIONES_COCHERAS = opciones(
  COCHERAS,
  EN_URL.cocheras,
  (valor) => ETIQUETAS_COCHERAS.get(valor) ?? String(valor),
);

export const OPCIONES_ORDEN = opciones(
  LISTING_SORTS,
  EN_URL.orden,
  (valor) => ETIQUETAS_ORDEN[valor],
);

// El select de barrio cerrado tiene tres estados y no dos: "indiferente" (no
// filtrar) no es lo mismo que "no" (solo fuera de un barrio cerrado), y un
// checkbox solo puede expresar dos.
export const OPCIONES_BARRIO_CERRADO: OpcionDeFiltro<boolean>[] = [
  { dominio: true, valor: "si", etiqueta: "Solo en barrio cerrado o semiprivado" },
  { dominio: false, valor: "no", etiqueta: "Solo fuera de un barrio cerrado" },
];

// Las amenities vienen agrupadas por sección, pero la API manda la clave de la
// sección, no su nombre. Estos son los únicos nombres que el front pone sobre
// datos del catálogo, porque no hay ningún endpoint que los traiga.
export const ETIQUETAS_DE_SECCION: Record<AmenitySection, string> = {
  utilities: "Servicios",
  security: "Seguridad",
  amenities_rooms: "Ambientes",
  amenities_comfort: "Confort",
  common_areas: "Espacios comunes",
};

// `null` es una sección que la API agregó y el front todavía no conoce: se
// muestra agrupada aparte en vez de perder la amenity.
export function etiquetaDeSeccion(section: AmenitySection | null): string {
  return section === null ? "Otras" : ETIQUETAS_DE_SECCION[section];
}
