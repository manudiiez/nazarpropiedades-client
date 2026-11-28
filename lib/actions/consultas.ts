"use server";

import { headers } from "next/headers";
import { createInquiry } from "@/lib/data/queries";
import {
  errorAEstado,
  parsearConsulta,
  valoresEnviados,
  type EstadoConsulta,
} from "@/lib/forms/consulta";

// Server Action del formulario de consultas, pensada para `useActionState`.
//
// Por qué va por el server y no con un fetch desde el browser:
//
//  - No necesita CORS ni exponer la URL de la API, así que no hay ninguna
//    variable NEXT_PUBLIC_*: la misma imagen vX.Y.Z sirve staging y producción.
//  - La validación no se puede saltear desde la consola del navegador.
//  - Funciona sin JavaScript, con un form HTML común.
//
// El problema que eso traía era el rate limit: la API limita el POST a 5/min
// por IP, y un pedido hecho por el server se cuenta contra la IP del server,
// así que cinco visitantes en un minuto lo agotaban para todos. Se resuelve
// leyendo la IP del visitante acá y reenviándola en `X-Forwarded-For`, para
// que la API cuente por visitante. Ver el issue de coordinación con la API.
//
// `headers()` se lee acá, fuera de cualquier scope con `use cache`: adentro
// falla con next-request-in-use-cache.
async function ipDelVisitante(): Promise<string | null> {
  const lista = await headers();

  // El primer valor de X-Forwarded-For es el cliente original; el resto son
  // los proxies intermedios.
  const forwarded = lista.get("x-forwarded-for");
  if (forwarded !== null && forwarded.trim() !== "") {
    const primera = forwarded.split(",")[0]?.trim();
    if (primera !== undefined && primera !== "") return primera;
  }

  const real = lista.get("x-real-ip");
  return real !== null && real.trim() !== "" ? real.trim() : null;
}

export async function enviarConsulta(
  _anterior: EstadoConsulta,
  formData: FormData,
): Promise<EstadoConsulta> {
  const valores = valoresEnviados(formData);
  const consulta = parsearConsulta(formData);
  const ip = await ipDelVisitante();

  const resultado = await createInquiry(consulta, ip === null ? undefined : { clientIp: ip });

  return resultado.ok
    ? { estado: "enviada", id: resultado.data.id }
    : errorAEstado(resultado.failure, valores);
}
