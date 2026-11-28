// Lo que se puede contar sobre un error sin filtrar nada.
//
// Un error que llega a un boundary puede ser cualquier cosa: en Next 16 el prop
// `error` está tipado `unknown` a propósito, porque lo que se lanza en un Client
// Component viaja tal cual y puede no ser un `Error`.
//
// El `message` NO se usa nunca para mostrar. Los errores del server llegan al
// cliente con un mensaje genérico en producción, pero en desarrollo llegan con
// el mensaje original, así que un boundary que muestre `error.message` filtra
// rutas, URLs internas o datos en cuanto algo se despliegue mal configurado.
// Lo que sí sirve es el `digest`: es un hash del error que aparece también en
// el log del server, y es lo único que permite correlacionar lo que vio el
// visitante con lo que pasó realmente.

export function digestDeError(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest !== "" ? digest : null;
}

// Para el `console.error` del cliente. Sin `message`: si el digest no está, es
// más honesto decirlo que pegar un texto que no se puede rastrear.
export function describirError(error: unknown): string {
  const nombre = error instanceof Error && error.name !== "" ? error.name : "Error desconocido";
  const digest = digestDeError(error);
  return digest === null ? `${nombre} (sin digest)` : `${nombre} (digest ${digest})`;
}
