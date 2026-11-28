import type { Inquiry, NewInquiry } from "@/lib/domain";
import type { InquiriesRepository } from "../inquiries-repository";
import { HttpClient } from "./client";
import { mapInquiry } from "./mappers";

// Sin `use cache`: es una mutación. Y a diferencia de las lecturas, este pedido
// sale del BROWSER del visitante, no del server: el rate limit de la API es
// 5/min por IP, y proxearlo por el server lo contaría contra la IP del server,
// agotándolo con cinco visitantes en un minuto.
export function createHttpInquiriesRepository(baseUrl: string): InquiriesRepository {
  return {
    async create(input: NewInquiry): Promise<Inquiry> {
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

      return mapInquiry(await new HttpClient({ baseUrl }).post<unknown>("/public/consultas", payload));
    },
  };
}
