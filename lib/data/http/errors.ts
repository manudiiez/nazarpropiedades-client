// Errores de la API traducidos a tipos que el dominio puede distinguir.
// La API responde siempre con la misma forma:
//   {"success": false, "error": {code, message, details, request_id}}
// El `code` es el contrato; el `message` está en español y es mostrable, pero
// es texto libre y puede cambiar, así que nunca se ramifica sobre él.

export const API_ERROR_CODES = [
  "NOT_FOUND",
  "VALIDATION_ERROR",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly code: ApiErrorCode | "UNKNOWN";
  readonly status: number;
  // Lo que hay que citarle a la sesión `api` para que pueda rastrear el pedido.
  readonly requestId: string | null;

  constructor(options: {
    code: ApiErrorCode | "UNKNOWN";
    status: number;
    message: string;
    requestId: string | null;
  }) {
    // El request_id se mete en el MENSAJE, no solo en la propiedad: al cruzar
    // una frontera de `use cache` las propiedades propias del error se pierden
    // y el mensaje sobrevive. Es el único dato que sirve para que la sesión que
    // mantiene la API rastree el pedido, así que vale la redundancia.
    // Este mensaje es para el log, nunca se le muestra al visitante.
    super(
      options.requestId === null
        ? options.message
        : `${options.message} [request_id: ${options.requestId}]`,
    );
    this.name = new.target.name;
    this.code = options.code;
    this.status = options.status;
    this.requestId = options.requestId;
  }
}

export class NotFoundError extends ApiError {}
export class ConflictError extends ApiError {}
export class InternalError extends ApiError {}

export class ValidationError extends ApiError {
  readonly details: FieldError[];

  constructor(options: {
    status: number;
    message: string;
    requestId: string | null;
    details: FieldError[];
  }) {
    super({ ...options, code: "VALIDATION_ERROR" });
    this.details = options.details;
  }
}

// 60/min por IP en las lecturas, 5/min en el POST de consultas. Nunca se
// reintenta solo: un retry inmediato empeora exactamente el problema.
export class RateLimitedError extends ApiError {}

// La API no contestó: DNS, conexión rechazada, cable cortado.
export class NetworkError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "NetworkError";
    this.cause = cause;
  }
}

// Se cortó por timeout nuestro, no por la API.
export class TimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`La API no respondió en ${timeoutMs} ms.`);
    this.name = "TimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === "string" && (API_ERROR_CODES as readonly string[]).includes(value);
}

function parseDetails(raw: unknown): FieldError[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const { field, message } = item as Record<string, unknown>;
    if (typeof field !== "string" || typeof message !== "string") return [];
    return [{ field, message }];
  });
}

// Traduce una respuesta de error a su clase. Tolera que el body no tenga la
// forma esperada: un 500 con HTML de un proxy no debería romper el parseo y
// perder el status, que es la única información útil que queda.
export function toApiError(status: number, body: unknown): ApiError {
  const error =
    typeof body === "object" && body !== null
      ? ((body as Record<string, unknown>).error as Record<string, unknown> | undefined)
      : undefined;

  const code = isApiErrorCode(error?.code) ? error.code : "UNKNOWN";
  const message =
    typeof error?.message === "string" && error.message.trim() !== ""
      ? error.message
      : `La API respondió ${status} sin un mensaje reconocible.`;
  // El handler de la API agrega request_id aunque el schema no lo declare.
  const requestId = typeof error?.request_id === "string" ? error.request_id : null;

  switch (code) {
    case "NOT_FOUND":
      return new NotFoundError({ code, status, message, requestId });
    case "VALIDATION_ERROR":
      return new ValidationError({ status, message, requestId, details: parseDetails(error?.details) });
    case "CONFLICT":
      return new ConflictError({ code, status, message, requestId });
    case "RATE_LIMITED":
      return new RateLimitedError({ code, status, message, requestId });
    case "INTERNAL_ERROR":
      return new InternalError({ code, status, message, requestId });
    default:
      // Sin `code` reconocible, el status es lo único confiable.
      if (status === 404) return new NotFoundError({ code, status, message, requestId });
      if (status === 429) return new RateLimitedError({ code, status, message, requestId });
      return new ApiError({ code, status, message, requestId });
  }
}
