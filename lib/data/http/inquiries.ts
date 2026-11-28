import type { Inquiry, NewInquiry } from "@/lib/domain";
import type { ContextoPedido, InquiriesRepository } from "../inquiries-repository";
import { HttpClient } from "./client";
import { mapInquiry } from "./mappers";

// Sin `use cache`: es una mutación, y además recibe la IP del visitante, que
// no es serializable como parte de una clave de caché razonable.
//
// Sale del server (por Server Action), reenviando la IP del visitante en
// `X-Forwarded-For` para que la API cuente su rate limit de 5/min por
// visitante y no por servidor.
export function createHttpInquiriesRepository(baseUrl: string): InquiriesRepository {
  return {
    async create(input: NewInquiry, contexto?: ContextoPedido): Promise<Inquiry> {
      const payload = {
        nombre: input.nombre.trim(),
        apellido: input.apellido.trim(),
        numero: input.numero.trim(),
        // La API valida el formato si viene; se omite en vez de mandar "".
        email: input.email?.trim() === "" ? undefined : input.email?.trim(),
        fuente: input.fuente,
        descripcion: input.descripcion.trim(),
        listing_id: input.listingId,
      };

      const headers =
        contexto?.clientIp === undefined ? undefined : { "X-Forwarded-For": contexto.clientIp };

      return mapInquiry(
        await new HttpClient({ baseUrl }).post<unknown>("/public/consultas", payload, { headers }),
      );
    },
  };
}
