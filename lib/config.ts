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
  // Cuántos proxies hay entre el visitante y este server. Define cuál entrada
  // de X-Forwarded-For es la IP real del visitante: se cuenta desde la
  // derecha, porque las de la izquierda las puede escribir el visitante.
  // Con Dokploy adelante es 1. Si se agrega otro proxy, hay que subirlo.
  trustedProxyHops: number;
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

// Un valor inválido no tumba la app: se cae al default seguro de 1 proxy, que
// es la topología real, y se avisa. Quedarse sin formulario por un typo en una
// variable opcional sería peor que el problema.
function proxyHops(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return 1;

  const valor = Number(raw);
  if (!Number.isInteger(valor) || valor < 1) {
    console.warn(
      `[config] TRUSTED_PROXY_HOPS tiene el valor inválido "${raw}"; se usa 1. ` +
        "Tiene que ser un entero >= 1.",
    );
    return 1;
  }

  return valor;
}

let cached: Config | null = null;

export function getConfig(): Config {
  if (cached !== null) return cached;

  const dataSource = parseDataSource(process.env.DATA_SOURCE);

  // Con mocks no hay API a la que apuntar: exigir las URLs obligaría a inventar
  // valores falsos en el .env solo para poder levantar sin backend.
  const trustedProxyHops = proxyHops(process.env.TRUSTED_PROXY_HOPS);

  if (dataSource === "mock") {
    cached = { apiUrl: "http://mock.local", dataSource, trustedProxyHops };
    return cached;
  }

  cached = {
    apiUrl: requireUrl(process.env.API_URL, "API_URL"),
    dataSource,
    trustedProxyHops,
  };

  return cached;
}

// Solo para los tests: permite releer el entorno.
export function resetConfigCache(): void {
  cached = null;
}
