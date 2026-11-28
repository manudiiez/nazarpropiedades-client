import type { ParametroDescartado } from "@/lib/filters";

// Lo que la URL pedía y no se pudo aplicar.
//
// Un filtro inválido se ignora en vez de fallar (una URL puede ser un link de
// hace un año), pero ignorarlo EN SILENCIO deja al visitante mirando una lista
// que no se parece a lo que pidió sin ninguna explicación. Esto es la mitad que
// falta de esa decisión.
const MOTIVOS: Record<ParametroDescartado["motivo"], string> = {
  desconocido: "ya no existe",
  invalido: "no tiene un valor válido",
  duplicado: "admite un solo valor",
};

export function AvisoDeDescartados({ descartados }: { descartados: ParametroDescartado[] }) {
  if (descartados.length === 0) return null;

  return (
    // `role="status"` y no `role="alert"`: es información, no un problema que
    // interrumpa lo que el visitante está haciendo.
    <section role="status" className="border p-3 text-sm">
      <p>Ignoramos algunos filtros de la dirección:</p>
      <ul className="list-disc pl-5">
        {descartados.map((descartado) => (
          <li key={`${descartado.param}-${descartado.valor}`}>
            {descartado.param}: {descartado.valor} ({MOTIVOS[descartado.motivo]})
          </li>
        ))}
      </ul>
    </section>
  );
}
