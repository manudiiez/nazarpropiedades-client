import { parseDataSource, type DataSource } from "./data/data-source";

// Configuración leída una sola vez. Falla con un mensaje que nombra la variable
// que falta, en vez de dejar que un `fetch("undefined/api/v1/...")` explote
// lejos de la causa.
//
// No hay ninguna variable NEXT_PUBLIC_*: TODO pedido a la API sale del server,
// incluido el POST del formulario de consultas, que va por Server Action
// reenviando la IP del visitante. Eso tiene una consecuencia que importa: nada
// de la API queda horneado en el bundle, así que la MISMA imagen vX.Y.Z sirve
// staging y producción cambiando una variable de entorno del contenedor.

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export interface Config {
  // URL de la API para las lecturas, usada SOLO desde el server. Es variable de
  // runtime, no build-arg: así la misma imagen sirve staging y producción.
  apiUrl: string;
  dataSource: DataSource;
}

function requireUrl(raw: string | undefined, name: string): string {
  if (raw === undefined || raw.trim() === "") {
    throw new ConfigError(`Falta la variable de entorno ${name}.`);
  }
  const value = raw.trim();
  try {
    new URL(value);
  } catch {
    throw new ConfigError(`${name} no es una URL válida: "${value}".`);
  }
  return value.replace(/\/+$/, "");
}

let cached: Config | null = null;

export function getConfig(): Config {
  if (cached !== null) return cached;

  const dataSource = parseDataSource(process.env.DATA_SOURCE);

  // Con mocks no hay API a la que apuntar: exigir las URLs obligaría a inventar
  // valores falsos en el .env solo para poder levantar sin backend.
  if (dataSource === "mock") {
    cached = { apiUrl: "http://mock.local", dataSource };
    return cached;
  }

  cached = { apiUrl: requireUrl(process.env.API_URL, "API_URL"), dataSource };

  return cached;
}

// Solo para los tests: permite releer el entorno.
export function resetConfigCache(): void {
  cached = null;
}
