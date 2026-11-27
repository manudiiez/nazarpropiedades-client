// De dónde salen los datos. Se resuelve una sola vez al arrancar, no por
// llamada: no existe "cambiar de implementación en runtime".
export const DATA_SOURCES = ["api", "mock"] as const;

export type DataSource = (typeof DATA_SOURCES)[number];

export class DataSourceConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataSourceConfigError";
  }
}

// Valida el valor crudo de la variable de entorno. Falla en vez de caer en un
// default silencioso: arrancar contra la API real creyendo que estás en mocks
// (o al revés) es más caro que no arrancar.
export function parseDataSource(raw: string | undefined): DataSource {
  const valores = DATA_SOURCES.join(" | ");

  if (raw === undefined || raw.trim() === "") {
    throw new DataSourceConfigError(
      `Falta la variable de entorno DATA_SOURCE. Valores válidos: ${valores}.`,
    );
  }

  const valor = raw.trim();

  if (!(DATA_SOURCES as readonly string[]).includes(valor)) {
    throw new DataSourceConfigError(
      `DATA_SOURCE tiene el valor inválido "${valor}". Valores válidos: ${valores}.`,
    );
  }

  return valor as DataSource;
}
