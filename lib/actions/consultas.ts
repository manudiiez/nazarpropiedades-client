"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getConfig } from "@/lib/config";
import { createInquiry } from "@/lib/data/queries";
import { ipDesdeForwardedFor } from "@/lib/forms/client-ip";
import {
  destinoDeConfirmacion,
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
//
// Se manda UNA sola IP, no la cadena que nos llegó: la API toma la última
// entrada no confiable de lo que recibe, así que reenviar la cadena completa
// le haría elegir mal si nuestra infra agrega saltos.
async function ipDelVisitante(): Promise<string | null> {
  const lista = await headers();
  return ipDesdeForwardedFor(lista.get("x-forwarded-for"), getConfig().trustedProxyHops);
}

export async function enviarConsulta(
  _anterior: EstadoConsulta,
  formData: FormData,
): Promise<EstadoConsulta> {
  const valores = valoresEnviados(formData);
  const consulta = parsearConsulta(formData);
  const ip = await ipDelVisitante();

  const resultado = await createInquiry(consulta, ip === null ? undefined : { clientIp: ip });

  if (!resultado.ok) return errorAEstado(resultado.failure, valores);

  // POST → 303 → GET con `?consulta=enviada`. Es lo que hace que la
  // confirmación se vea también sin JavaScript (ver el comentario en
  // lib/forms/consulta.ts) y que recargar no reenvíe la consulta.
  //
  // Si el formulario no mandó un destino válido se devuelve el estado, que es
  // lo que el camino con JavaScript sabe renderizar.
  const destino = destinoDeConfirmacion(formData);
  if (destino !== null) redirect(destino);

  return { estado: "enviada", id: resultado.data.id };
}
