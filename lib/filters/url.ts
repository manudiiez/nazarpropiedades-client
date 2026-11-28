import {
  DEFAULT_PAGE_SIZE,
  type AgeRange,
  type Catalog,
  type Condition,
  type Currency,
  type GarageCount,
  type ListingFilters,
  type ListingSort,
  type PageRequest,
  type RoomCount,
} from "@/lib/domain";

// La traducción entre la URL del sitio y `ListingFilters`. Las dos funciones
// son inversas y puras: no importan nada de Next.
//
// La URL es parte del producto, no del transporte: se comparte por WhatsApp, la
// indexa Google y queda en el historial. Por eso los params están en español y
// NO se reusan los nombres de la API (`condition`, `property_type`): esa
// traducción vive acá, igual que la de la API vive en lib/data/http.
//
// Ojo con `cacheComponents`: `searchParams` es una API dinámica y no se puede
// leer dentro de un scope con `use cache`. La página la lee y pasa el objeto ya
// resuelto a estas funciones; nada de acá se llama desde una función cacheada.

// Nombres de los params. Un objeto en vez de strings sueltos para que la página,
// los links del paginador y los controles del filtro no se desincronicen por un
// typo (mismo criterio que `CAMPOS` en lib/forms/consulta.ts).
export const PARAMS = {
  operacion: "operacion",
  tipo: "tipo",
  provincia: "provincia",
  departamento: "departamento",
  zona: "zona",
  moneda: "moneda",
  precioMin: "precio_min",
  precioMax: "precio_max",
  superficieMin: "superficie_min",
  superficieMax: "superficie_max",
  dormitorios: "dormitorios",
  banos: "banos",
  cocheras: "cocheras",
  barrioCerrado: "barrio_cerrado",
  antiguedad: "antiguedad",
  amenities: "amenities",
  direccion: "direccion",
  orden: "orden",
  pagina: "pagina",
} as const;

// `searchParams` de una Server Component llega como objeto; los links y los
// tests es más cómodo armarlos con `URLSearchParams`. Se aceptan los dos.
export type SearchParamsInput =
  | URLSearchParams
  | Readonly<Record<string, string | string[] | undefined>>;

export type MotivoDescarte =
  // El valor no está en el catálogo o no es uno de los valores posibles: una
  // zona que dejó de existir, un tipo mal escrito.
  | "desconocido"
  // El valor no tiene la forma esperada: `precio_max=mucho`.
  | "invalido"
  // El param admite un solo valor y vino repetido.
  | "duplicado";

export interface ParametroDescartado {
  param: string;
  valor: string;
  motivo: MotivoDescarte;
}

export interface FiltrosDesdeUrl {
  filtros: ListingFilters;
  // Para poder avisar "ignoramos un filtro que ya no existe" en vez de mostrar
  // resultados que no se parecen a la URL sin explicar por qué.
  descartados: ParametroDescartado[];
}

// Vocabulario de la URL para los conjuntos cerrados. Los valores respaldados
// por el catálogo (tipo de propiedad, ubicaciones, amenities) viajan con su
// slug tal como lo define la API: son 16 tipos, 215 zonas y 44 amenities que
// cambian sin avisar, y un diccionario local para traducirlos es exactamente el
// bug que ya costó caro con las amenities (issue #20). Lo que sí se traduce son
// los enums que el front ya define en su propio código.
const CONDICIONES: readonly [Condition, string][] = [
  ["sale", "venta"],
  ["rent", "alquiler"],
  ["temporary_rent", "alquiler-temporario"],
  ["exchange", "permuta"],
];

const MONEDAS: readonly [Currency, string][] = [
  ["USD", "usd"],
  ["ARS", "ars"],
];

const ANTIGUEDADES: readonly [AgeRange, string][] = [
  ["brand_new", "a-estrenar"],
  ["1-5", "1-5"],
  ["6-10", "6-10"],
  ["11-20", "11-20"],
  ["over-20", "mas-de-20"],
];

// 0 es un valor legítimo ("monoambiente", "sin cochera"), no "no me importa".
const AMBIENTES: readonly [RoomCount, string][] = [
  [0, "0"],
  [1, "1"],
  [2, "2"],
  [3, "3"],
  [4, "4"],
  ["5+", "5-o-mas"],
];

const COCHERAS: readonly [GarageCount, string][] = [
  [0, "0"],
  [1, "1"],
  [2, "2"],
  ["3+", "3-o-mas"],
];

// Ya están en español en el dominio, así que viajan igual. Se declaran acá de
// todas formas para que el vocabulario de la URL se lea en un solo lugar.
const ORDENES: readonly [ListingSort, string][] = [
  ["reciente", "reciente"],
  ["menor_precio", "menor_precio"],
  ["mayor_precio", "mayor_precio"],
];

// El orden por defecto no se serializa: una sola URL por contenido.
const ORDEN_POR_DEFECTO: ListingSort = "reciente";

function codificar<T>(pares: readonly [T, string][]): (valor: T) => string {
  const mapa = new Map(pares);
  return (valor) => mapa.get(valor) ?? String(valor);
}

function decodificar<T>(pares: readonly [T, string][]): (texto: string) => T | undefined {
  const mapa = new Map(pares.map(([dominio, url]) => [url, dominio]));
  return (texto) => mapa.get(texto);
}

const operacionAUrl = codificar(CONDICIONES);
const operacionDesdeUrl = decodificar(CONDICIONES);
const monedaAUrl = codificar(MONEDAS);
const monedaDesdeUrl = decodificar(MONEDAS);
const antiguedadAUrl = codificar(ANTIGUEDADES);
const antiguedadDesdeUrl = decodificar(ANTIGUEDADES);
const ambientesAUrl = codificar(AMBIENTES);
const ambientesDesdeUrl = decodificar(AMBIENTES);
const cocherasAUrl = codificar(COCHERAS);
const cocherasDesdeUrl = decodificar(COCHERAS);
const ordenAUrl = codificar(ORDENES);
const ordenDesdeUrl = decodificar(ORDENES);

function crudos(params: SearchParamsInput, param: string): string[] {
  if (params instanceof URLSearchParams) return params.getAll(param);
  const valor = params[param];
  if (valor === undefined || valor === null) return [];
  return Array.isArray(valor) ? valor : [valor];
}

// Los valores se recortan, se descartan los vacíos y se deduplican: `?zona=a&zona=a`
// y `?zona=a&zona=` tienen que dar lo mismo que `?zona=a`, o la ida y vuelta no
// cierra y el historial se vuelve impredecible.
function leer(params: SearchParamsInput, param: string): string[] {
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const crudo of crudos(params, param)) {
    if (typeof crudo !== "string") continue;
    const valor = crudo.trim();
    if (valor === "" || vistos.has(valor)) continue;
    vistos.add(valor);
    salida.push(valor);
  }
  return salida;
}

// Juntar los valores del catálogo por nivel, igual que lo hace
// lib/data/validate-filters.ts. Una sección que el catálogo no trajo (porque no
// se pidió con `?include=`) no se valida, en vez de descartar todo por falta de
// datos.
function conjuntosDelCatalogo(catalog: Catalog) {
  const provincias = new Set<string>();
  const departamentos = new Set<string>();
  const zonas = new Set<string>();

  for (const provincia of catalog.provinces ?? []) {
    provincias.add(provincia.value);
    for (const departamento of provincia.departments) {
      departamentos.add(departamento.value);
      for (const zona of departamento.zones) zonas.add(zona.value);
    }
  }

  const ubicacionesConocidas = catalog.provinces !== undefined;

  return {
    provincias: ubicacionesConocidas ? provincias : null,
    departamentos: ubicacionesConocidas ? departamentos : null,
    zonas: ubicacionesConocidas ? zonas : null,
    tipos: catalog.propertyTypes ? new Set(catalog.propertyTypes.map((t) => t.value)) : null,
    amenities: catalog.amenities ? new Set(catalog.amenities.map((a) => a.value)) : null,
  };
}

class Descartes {
  readonly lista: ParametroDescartado[] = [];

  descartar(param: string, valor: string, motivo: MotivoDescarte): undefined {
    this.lista.push({ param, valor, motivo });
    return undefined;
  }
}

// Un valor inválido se ignora, no falla. Es lo contrario de lo que hace
// `validateFilters` con lo que se manda a la API, y es a propósito: lo que
// viene de una URL puede ser un link de hace un año, no una intención actual.
function multiple<T>(
  params: SearchParamsInput,
  param: string,
  decodificar: (texto: string) => T | undefined,
  descartes: Descartes,
): T[] | undefined {
  const salida: T[] = [];
  for (const texto of leer(params, param)) {
    const valor = decodificar(texto);
    if (valor === undefined) {
      descartes.descartar(param, texto, "desconocido");
      continue;
    }
    salida.push(valor);
  }
  return salida.length > 0 ? salida : undefined;
}

// Params de un solo valor: el primero válido gana y el resto se reporta como
// duplicado, en vez de quedarse callado con el último.
function unico<T>(
  params: SearchParamsInput,
  param: string,
  decodificar: (texto: string) => T | undefined,
  descartes: Descartes,
): T | undefined {
  let elegido: T | undefined;
  for (const texto of leer(params, param)) {
    const valor = decodificar(texto);
    if (valor === undefined) descartes.descartar(param, texto, "desconocido");
    else if (elegido === undefined) elegido = valor;
    else descartes.descartar(param, texto, "duplicado");
  }
  return elegido;
}

function delConjunto(permitidos: ReadonlySet<string> | null): (texto: string) => string | undefined {
  // Sin catálogo para comparar, se deja pasar: la API igual no filtra por algo
  // que no conoce, y rechazar acá sería inventar una verdad que no tenemos.
  if (permitidos === null) return (texto) => texto;
  return (texto) => (permitidos.has(texto) ? texto : undefined);
}

// Enteros no negativos. Un precio con decimales se trunca; lo que no es número
// o es negativo se descarta.
function entero(texto: string): number | undefined {
  if (!/^-?\d+(\.\d+)?$/.test(texto)) return undefined;
  const numero = Math.trunc(Number(texto));
  if (!Number.isFinite(numero) || numero < 0) return undefined;
  return numero;
}

function numeroUnico(
  params: SearchParamsInput,
  param: string,
  descartes: Descartes,
): number | undefined {
  let elegido: number | undefined;
  for (const texto of leer(params, param)) {
    const numero = entero(texto);
    if (numero === undefined) descartes.descartar(param, texto, "invalido");
    else if (elegido === undefined) elegido = numero;
    else descartes.descartar(param, texto, "duplicado");
  }
  return elegido;
}

const BOOLEANOS: Record<string, boolean> = {
  si: true,
  "1": true,
  true: true,
  no: false,
  "0": false,
  false: false,
};

function booleano(texto: string): boolean | undefined {
  return BOOLEANOS[texto.toLowerCase()];
}

export function filtrosDesdeSearchParams(
  params: SearchParamsInput,
  catalog: Catalog = {},
): FiltrosDesdeUrl {
  const descartes = new Descartes();
  const conjuntos = conjuntosDelCatalogo(catalog);

  const filtros: ListingFilters = {
    condition: multiple(params, PARAMS.operacion, operacionDesdeUrl, descartes),
    propertyType: multiple(params, PARAMS.tipo, delConjunto(conjuntos.tipos), descartes),
    province: unico(params, PARAMS.provincia, delConjunto(conjuntos.provincias), descartes),
    department: multiple(
      params,
      PARAMS.departamento,
      delConjunto(conjuntos.departamentos),
      descartes,
    ),
    zone: multiple(params, PARAMS.zona, delConjunto(conjuntos.zonas), descartes),
    currency: unico(params, PARAMS.moneda, (texto) => monedaDesdeUrl(texto.toLowerCase()), descartes),
    priceMin: numeroUnico(params, PARAMS.precioMin, descartes),
    priceMax: numeroUnico(params, PARAMS.precioMax, descartes),
    totalAreaMin: numeroUnico(params, PARAMS.superficieMin, descartes),
    totalAreaMax: numeroUnico(params, PARAMS.superficieMax, descartes),
    bedrooms: multiple(params, PARAMS.dormitorios, ambientesDesdeUrl, descartes),
    bathrooms: multiple(params, PARAMS.banos, ambientesDesdeUrl, descartes),
    garageCapacity: multiple(params, PARAMS.cocheras, cocherasDesdeUrl, descartes),
    gatedCommunity: unico(params, PARAMS.barrioCerrado, booleano, descartes),
    age: multiple(params, PARAMS.antiguedad, antiguedadDesdeUrl, descartes),
    amenities: multiple(params, PARAMS.amenities, delConjunto(conjuntos.amenities), descartes),
    addressQuery: unico(params, PARAMS.direccion, (texto) => texto, descartes),
    // El orden siempre queda definido: así una URL sin `orden` y otra con
    // `orden=reciente` dan el mismo objeto, y el control del filtro tiene algo
    // que marcar como seleccionado.
    sort: unico(params, PARAMS.orden, ordenDesdeUrl, descartes) ?? ORDEN_POR_DEFECTO,
  };

  // Las claves con `undefined` se sacan: así dos URLs equivalentes dan objetos
  // iguales y los tests de ida y vuelta pueden comparar con `toEqual`.
  for (const clave of Object.keys(filtros) as (keyof ListingFilters)[]) {
    if (filtros[clave] === undefined) delete filtros[clave];
  }

  return { filtros, descartados: descartes.lista };
}

// La página vive en la URL pero el tamaño de página no: exponerlo invita a
// `?limit=100` y a tener la misma lista en N URLs distintas.
export function paginaDesdeSearchParams(params: SearchParamsInput): PageRequest {
  const descartes = new Descartes();
  const pagina = numeroUnico(params, PARAMS.pagina, descartes);
  return {
    page: pagina === undefined || pagina < 1 ? 1 : pagina,
    limit: DEFAULT_PAGE_SIZE,
  };
}

function agregar(salida: URLSearchParams, param: string, valores: string[] | undefined): void {
  for (const valor of valores ?? []) salida.append(param, valor);
}

function lista<T>(valores: T[] | undefined, codificar: (valor: T) => string): string[] | undefined {
  if (valores === undefined) return undefined;
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const valor of valores) {
    const texto = codificar(valor);
    if (vistos.has(texto)) continue;
    vistos.add(texto);
    salida.push(texto);
  }
  return salida;
}

// Los defaults no se serializan: la página 1 y el orden por defecto se omiten
// para que haya una sola URL por contenido. Dos URLs para la misma lista es
// contenido duplicado para Google y ruido en el historial.
export function searchParamsDesdeFiltros(
  filtros: ListingFilters,
  pagina = 1,
): URLSearchParams {
  const salida = new URLSearchParams();

  agregar(salida, PARAMS.operacion, lista(filtros.condition, operacionAUrl));
  agregar(salida, PARAMS.tipo, lista(filtros.propertyType, (valor) => valor));
  if (filtros.province !== undefined) salida.append(PARAMS.provincia, filtros.province);
  agregar(salida, PARAMS.departamento, lista(filtros.department, (valor) => valor));
  agregar(salida, PARAMS.zona, lista(filtros.zone, (valor) => valor));
  if (filtros.currency !== undefined) salida.append(PARAMS.moneda, monedaAUrl(filtros.currency));
  if (filtros.priceMin !== undefined) salida.append(PARAMS.precioMin, String(filtros.priceMin));
  if (filtros.priceMax !== undefined) salida.append(PARAMS.precioMax, String(filtros.priceMax));
  if (filtros.totalAreaMin !== undefined) {
    salida.append(PARAMS.superficieMin, String(filtros.totalAreaMin));
  }
  if (filtros.totalAreaMax !== undefined) {
    salida.append(PARAMS.superficieMax, String(filtros.totalAreaMax));
  }
  agregar(salida, PARAMS.dormitorios, lista(filtros.bedrooms, ambientesAUrl));
  agregar(salida, PARAMS.banos, lista(filtros.bathrooms, ambientesAUrl));
  agregar(salida, PARAMS.cocheras, lista(filtros.garageCapacity, cocherasAUrl));
  if (filtros.gatedCommunity !== undefined) {
    salida.append(PARAMS.barrioCerrado, filtros.gatedCommunity ? "si" : "no");
  }
  agregar(salida, PARAMS.antiguedad, lista(filtros.age, antiguedadAUrl));
  agregar(salida, PARAMS.amenities, lista(filtros.amenities, (valor) => valor));

  const direccion = filtros.addressQuery?.trim();
  if (direccion !== undefined && direccion !== "") salida.append(PARAMS.direccion, direccion);

  if (filtros.sort !== undefined && filtros.sort !== ORDEN_POR_DEFECTO) {
    salida.append(PARAMS.orden, ordenAUrl(filtros.sort));
  }

  const numero = Math.trunc(pagina);
  if (Number.isFinite(numero) && numero > 1) salida.append(PARAMS.pagina, String(numero));

  return salida;
}
