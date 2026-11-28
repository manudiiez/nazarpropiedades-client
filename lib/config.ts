import { parseDataSource, type DataSource } from "./data/data-source";

// Configuración leída una sola vez. Falla con un mensaje que nombra la variable
// que falta, en vez de dejar que un `fetch("undefined/api/v1/...")` explote
// lejos de la causa.

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
  // URL de la API accesible desde el browser, para el POST de consultas, que no
  // puede proxearse por el server (el rate limit de 5/min se contaría contra la
  // IP del server y se agotaría con cinco visitantes por minuto).
  publicApiUrl: string;
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
    cached = { apiUrl: "http://mock.local", publicApiUrl: "http://mock.local", dataSource };
    return cached;
  }

  cached = {
    apiUrl: requireUrl(process.env.API_URL, "API_URL"),
    publicApiUrl: requireUrl(
      process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL,
      "NEXT_PUBLIC_API_URL",
    ),
    dataSource,
  };

  return cached;
}

// Solo para los tests: permite releer el entorno.
export function resetConfigCache(): void {
  cached = null;
}
