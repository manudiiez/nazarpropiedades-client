import type { Inquiry, NewInquiry } from "@/lib/domain";

// Datos del pedido original que no son parte de la consulta pero la API
// necesita. Hoy solo la IP del visitante: el POST sale del server de Next, y
// sin reenviarla la API contaría su rate limit contra la IP del server.
export interface ContextoPedido {
  clientIp?: string;
}

// Separado de las lecturas: es una mutación, no se cachea, y mezclarla
// obligaría a invalidar caché de lecturas que no tienen nada que ver.
export interface InquiriesRepository {
  create(input: NewInquiry, contexto?: ContextoPedido): Promise<Inquiry>;
}
