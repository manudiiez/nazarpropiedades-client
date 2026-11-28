import { toApiError, NetworkError, TimeoutError } from "./errors";
import { buildUrl, type QueryParams } from "./query";

// Envoltorios de la API. Toda respuesta exitosa viene como {success, data},
// y las paginadas agregan `pagination`.
interface SuccessEnvelope<T> {
  success: true;
  data: T;
}

interface PaginationEnvelope {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface RawPage<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface HttpClientOptions {
  baseUrl: string;
  timeoutMs?: number;
}

export interface RequestOptions {
  query?: QueryParams;
  // Permite cortar el pedido desde afuera. Importante: un AbortSignal NO es
  // serializable, así que una función con `use cache` no puede recibirlo. El
  // caché va en la capa de arriba (los métodos del repositorio), no acá.
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 8_000;

export class HttpClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: HttpClientOptions) {
    this.baseUrl = options.baseUrl;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  // Devuelve `data` ya desenvuelto.
  async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const envelope = await this.request<SuccessEnvelope<T>>("GET", path, options);
    return envelope.data;
  }

  // Igual que `get`, pero traduce `pagination` a la forma del dominio. Devuelve
  // los items todavía crudos: mapearlos es tarea de cada repositorio.
  async getPage<T>(path: string, options: RequestOptions = {}): Promise<RawPage<T>> {
    const envelope = await this.request<SuccessEnvelope<T[]> & { pagination: PaginationEnvelope }>(
      "GET",
      path,
      options,
    );
    const { pagination } = envelope;

    return {
      items: envelope.data,
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: pagination.total_pages,
    };
  }

  async post<T>(path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
    const envelope = await this.request<SuccessEnvelope<T>>("POST", path, options, body);
    return envelope.data;
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    options: RequestOptions,
    body?: unknown,
  ): Promise<T> {
    const url = buildUrl(this.baseUrl, path, options.query);
    const timeout = AbortSignal.timeout(this.timeoutMs);
    // Se combinan para que gane el que dispare primero: el timeout nuestro o
    // la cancelación del llamador.
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        signal,
        headers: body === undefined ? { Accept: "application/json" } : {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (cause) {
      if (timeout.aborted) throw new TimeoutError(this.timeoutMs);
      // Si abortó el llamador, se propaga tal cual: no es una falla de red.
      if (options.signal?.aborted) throw cause;
      throw new NetworkError(`No se pudo conectar con la API (${method} ${url}).`, cause);
    }

    // El body puede no ser JSON: un 502 de un proxy devuelve HTML.
    const payload = await response.json().catch(() => null);

    if (!response.ok) throw toApiError(response.status, payload);

    return payload as T;
  }
}
