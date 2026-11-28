// Lectura defensiva de los payloads de la API.
//
// La regla: si un campo obligatorio falta o no se puede interpretar, se lanza
// MappingError. NUNCA se devuelve un objeto a medias con NaN, undefined o ""
// adentro. Un dato roto que llega hasta un componente produce un error lejos
// de su causa ("Cannot read properties of null") y es carísimo de rastrear;
// uno que falla en el mapper dice exactamente qué campo y qué llegó.

export class MappingError extends Error {
  readonly path: string;
  readonly received: unknown;

  constructor(path: string, expected: string, received: unknown) {
    super(`La API devolvió algo inesperado en "${path}": se esperaba ${expected}, llegó ${describe(received)}.`);
    this.name = "MappingError";
    this.path = path;
    this.received = received;
  }
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return `un array de ${value.length}`;
  if (typeof value === "object") return "un objeto";
  if (typeof value === "string") return `el string ${JSON.stringify(value)}`;
  return `${typeof value} ${String(value)}`;
}

export function asObject(raw: unknown, path: string): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new MappingError(path, "un objeto", raw);
  }
  return raw as Record<string, unknown>;
}

export function asArray(raw: unknown, path: string): unknown[] {
  if (!Array.isArray(raw)) throw new MappingError(path, "un array", raw);
  return raw;
}

// Un array ausente o null se trata como vacío: la API omite las secciones que
// no pediste y devuelve [] cuando no hay strategy para una propiedad. Eso es
// un caso normal, no un error.
export function asArrayOrEmpty(raw: unknown, path: string): unknown[] {
  if (raw === null || raw === undefined) return [];
  return asArray(raw, path);
}

export function asString(raw: unknown, path: string): string {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new MappingError(path, "un string no vacío", raw);
  }
  return raw;
}

export function asOptionalString(raw: unknown, path: string): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string") throw new MappingError(path, "un string o null", raw);
  return raw;
}

// La API serializa los Decimal y los valores del JSONB como STRING: el precio
// llega "845000.00" y los dormitorios "3". Se aceptan las dos formas y se
// rechaza lo que no sea un número finito, en vez de dejar pasar un NaN que
// después rompe una comparación o se renderiza como "NaN".
export function asNumber(raw: unknown, path: string): number {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) throw new MappingError(path, "un número finito", raw);
    return raw;
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  throw new MappingError(path, "un número", raw);
}

export function asOptionalNumber(raw: unknown, path: string): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  return asNumber(raw, path);
}

export function asBoolean(raw: unknown, path: string): boolean {
  if (typeof raw === "boolean") return raw;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new MappingError(path, "un booleano", raw);
}

export function asOptionalBoolean(raw: unknown, path: string, fallback: boolean): boolean {
  if (raw === null || raw === undefined) return fallback;
  return asBoolean(raw, path);
}

export function asDate(raw: unknown, path: string): Date {
  const text = asString(raw, path);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new MappingError(path, "una fecha ISO válida", raw);
  return date;
}

// Valida contra un conjunto cerrado. Se usa solo donde el front tiene lógica
// que depende del valor (condición y moneda), no para los valores del catálogo.
export function asEnum<T extends string>(
  raw: unknown,
  path: string,
  allowed: readonly T[],
): T {
  const text = asString(raw, path);
  if (!(allowed as readonly string[]).includes(text)) {
    throw new MappingError(path, `uno de: ${allowed.join(", ")}`, raw);
  }
  return text as T;
}
