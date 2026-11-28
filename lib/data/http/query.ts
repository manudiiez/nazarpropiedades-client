// FastAPI recibe los parámetros multi-valor como params REPETIDOS
// (?condition=sale&condition=rent), no como lista separada por comas.
// Un join(",") acá hace que la API interprete "sale,rent" como un valor único
// y devuelva 0 resultados sin error, que es el peor modo de fallar.

export type QueryValue = string | number | boolean | null | undefined;

export type QueryParams = Record<string, QueryValue | readonly QueryValue[]>;

function append(search: URLSearchParams, key: string, value: QueryValue): void {
  // null y undefined significan "no filtrar por esto": se omiten en vez de
  // viajar como el string "null".
  if (value === null || value === undefined) return;
  search.append(key, typeof value === "boolean" ? String(value) : String(value));
}

export function buildQuery(params: QueryParams): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) append(search, key, item);
    } else {
      append(search, key, value as QueryValue);
    }
  }

  return search.toString();
}

export function buildUrl(baseUrl: string, path: string, params: QueryParams = {}): string {
  // Tolera que la base venga con o sin barra final, y el path con o sin barra
  // inicial: un "//" de más en la URL hace que FastAPI redirija o tire 404.
  const base = baseUrl.replace(/\/+$/, "");
  const ruta = path.replace(/^\/+/, "");
  const query = buildQuery(params);

  return query === "" ? `${base}/${ruta}` : `${base}/${ruta}?${query}`;
}
