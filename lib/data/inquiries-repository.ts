import type { Inquiry, NewInquiry } from "@/lib/domain";

// Separado de las lecturas: es una mutación, no se cachea, y mezclarla
// obligaría a invalidar caché de lecturas que no tienen nada que ver.
export interface InquiriesRepository {
  create(input: NewInquiry): Promise<Inquiry>;
}
