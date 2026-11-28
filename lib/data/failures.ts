import { ApiError, ValidationError } from "./http/errors";
import { InvalidInquiryError } from "./validate-inquiry";

// La frontera entre "algo salió mal" y la UI.
//
// El objetivo es que la app NO explote nunca: ni con la API caída, ni con un
// payload roto, ni con un timeout, ni con una variable de entorno faltante.
// Para eso todo lo que la UI llama devuelve un DataResult en vez de lanzar, y
// cada falla trae un mensaje en español listo para mostrar.
//
// Lo que NO es una falla: una búsqueda sin resultados y un detalle inexistente.
// Eso son estados válidos del dominio (`items: []`, `data: null`) y los
// resuelve la UI mostrando "no encontramos propiedades" o un 404, no un cartel
// de error. Tratar un listado vacío como error le diría al visitante que el
// sitio está roto cuando lo único que pasa es que filtró demasiado.
//
// IMPORTANTE — por qué se discrimina por `error.name` y no por `instanceof`:
// cuando un error cruza una frontera de `use cache`, React lo reconstruye. Lo
// verificamos: del otro lado `constructor.name` es "Error" y las propiedades
// propias (code, status, requestId, details) DESAPARECEN. Lo único que
// sobrevive es `name`, `message`, `stack` y `cause`. Un `instanceof` acá
// funcionaría solo en los caminos sin caché (el POST de consultas) y
// degradaría todas las lecturas a "error inesperado". Por eso `name` manda, y
// el `instanceof` se usa solo para enriquecer cuando el error llegó entero.

export type DataFailureKind =
  | "sin-conexion"
  | "demorado"
  | "limite-alcanzado"
  | "datos-invalidos"
  | "no-encontrado"
  | "no-disponible"
  | "configuracion";

export interface DataFailure {
  kind: DataFailureKind;
  // Para mostrar. Nunca contiene detalles técnicos ni nombres de campos.
  title: string;
  message: string;
  // Si tiene sentido ofrecerle al visitante un botón de reintentar.
  retryable: boolean;
  // Errores por campo, cuando la API los dio y el error llegó entero.
  details: { field: string; message: string }[];
  // Para citarle a quien mantiene la API. No se muestra. Puede ser null en las
  // lecturas cacheadas: ahí el dato queda en el mensaje del log.
  //
  // Ojo al reportar: el request_id se genera por pedido en el server, así que
  // el de una respuesta servida desde el caché apunta al pedido ORIGINAL, no
  // al momento en que se leyó. El log del server existe igual, pero puede no
  // reflejar el estado actual del sistema.
  requestId: string | null;
  // Para el log del server. No se muestra.
  cause: unknown;
}

export type DataResult<T> = { ok: true; data: T } | { ok: false; failure: DataFailure };

export function ok<T>(data: T): DataResult<T> {
  return { ok: true, data };
}

type Plantilla = Omit<DataFailure, "details" | "requestId" | "cause">;

const GENERICA: Plantilla = {
  kind: "no-disponible",
  title: "Algo no funcionó",
  message: "Tuvimos un problema inesperado. Probá de nuevo en un momento.",
  retryable: true,
};

// La clave es el `name` del error, que es lo único que sobrevive al caché.
const PLANTILLAS: Record<string, Plantilla> = {
  NetworkError: {
    kind: "sin-conexion",
    title: "No pudimos conectarnos",
    message:
      "No pudimos comunicarnos con el servidor. Revisá tu conexión y volvé a intentar en un momento.",
    retryable: true,
  },
  TimeoutError: {
    kind: "demorado",
    title: "Está tardando demasiado",
    message: "El servidor tardó más de lo esperado en responder. Probá de nuevo en un momento.",
    retryable: true,
  },
  RateLimitedError: {
    kind: "limite-alcanzado",
    title: "Demasiados intentos",
    message: "Hiciste muchas consultas seguidas. Esperá un momento y volvé a intentar.",
    retryable: true,
  },
  // Un payload que no cumple el contrato no se arregla reintentando: el
  // servidor va a devolver lo mismo.
  MappingError: {
    kind: "datos-invalidos",
    title: "No pudimos mostrar esta información",
    message: "La información llegó incompleta. Ya estamos al tanto; probá más tarde.",
    retryable: false,
  },
  ValidationError: {
    kind: "datos-invalidos",
    title: "Hay datos que revisar",
    message: "Revisá los datos ingresados: alguno no es válido.",
    retryable: false,
  },
  // Validación nuestra, antes de salir a la red: trae el detalle por campo
  // para que el formulario marque el input que falta.
  InvalidInquiryError: {
    kind: "datos-invalidos",
    title: "Faltan datos",
    message: "Revisá los campos marcados y volvé a enviar.",
    retryable: false,
  },
  // Un filtro que el catálogo no conoce: una URL vieja con una zona que dejó
  // de existir, o un valor manipulado a mano. El visitante puede resolverlo.
  UnknownFilterValueError: {
    kind: "datos-invalidos",
    title: "Filtro no disponible",
    message: "Alguno de los filtros de la búsqueda ya no está disponible. Quitalo y volvé a buscar.",
    retryable: false,
  },
  // Un 404 que llega acá es un bug de uso: getById devuelve null en vez de
  // lanzar. Se mapea igual para no dejar un hueco.
  NotFoundError: {
    kind: "no-encontrado",
    title: "No encontramos lo que buscabas",
    message: "El contenido que pediste no está disponible.",
    retryable: false,
  },
  ConflictError: { ...GENERICA, retryable: false },
  InternalError: {
    kind: "no-disponible",
    title: "El servidor tuvo un problema",
    message: "No pudimos completar la operación. Probá de nuevo en unos minutos.",
    retryable: true,
  },
  ApiError: {
    kind: "no-disponible",
    title: "El servidor tuvo un problema",
    message: "No pudimos completar la operación. Probá de nuevo en unos minutos.",
    retryable: true,
  },
  // Falta o está mal una variable de entorno: no lo arregla el visitante ni un
  // reintento. Se muestra genérico y se grita en el log.
  DataSourceConfigError: {
    kind: "configuracion",
    title: "El sitio está mal configurado",
    message: "Estamos trabajando para resolverlo. Probá más tarde.",
    retryable: false,
  },
  ConfigError: {
    kind: "configuracion",
    title: "El sitio está mal configurado",
    message: "Estamos trabajando para resolverlo. Probá más tarde.",
    retryable: false,
  },
};

export function toDataFailure(cause: unknown): DataFailure {
  const name = cause instanceof Error ? cause.name : "";
  const plantilla = PLANTILLAS[name] ?? GENERICA;

  return {
    ...plantilla,
    // Solo están cuando el error no cruzó una frontera de caché.
    details:
      cause instanceof ValidationError || cause instanceof InvalidInquiryError
        ? cause.details
        : [],
    requestId: cause instanceof ApiError ? cause.requestId : null,
    cause,
  };
}

function describeCause(cause: unknown): string {
  if (cause instanceof Error) return `${cause.name}: ${cause.message}`;
  return String(cause);
}

// Envuelve una lectura para que no pueda lanzar. Loguea del lado del server con
// el contexto suficiente para rastrear el problema, y devuelve algo que la UI
// puede renderizar.
export async function attempt<T>(
  context: string,
  operation: () => Promise<T>,
): Promise<DataResult<T>> {
  try {
    return ok(await operation());
  } catch (cause) {
    const failure = toDataFailure(cause);
    // El mensaje del error trae el request_id cuando la API lo dio, así que
    // esta línea alcanza para rastrear el pedido incluso en lecturas cacheadas.
    console.error(`[data:${failure.kind}] ${context} — ${describeCause(cause)}`);
    return { ok: false, failure };
  }
}

// Para secciones accesorias: si fallan, la página se muestra igual sin ellas.
// Se usa en "propiedades relacionadas" o "destacadas", donde un cartel de error
// molesta más que la ausencia. La falla se loguea igual: silencio en la UI no
// es silencio en el log.
export async function attemptOr<T>(
  context: string,
  fallback: T,
  operation: () => Promise<T>,
): Promise<T> {
  const result = await attempt(context, operation);
  return result.ok ? result.data : fallback;
}

// Azúcar para la UI: saca el valor o null, sin ramificar.
export function dataOrNull<T>(result: DataResult<T>): T | null {
  return result.ok ? result.data : null;
}
