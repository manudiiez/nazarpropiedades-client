import type { InquirySource } from "./enums";

// Lo que el visitante manda por el formulario de contacto.
export interface NewInquiry {
  nombre: string;
  apellido: string;
  numero: string;
  email?: string;
  fuente: InquirySource;
  descripcion: string;
  // Presente cuando la consulta es por una propiedad concreta.
  listingId?: number;
}

// Lo que devuelve la API al crearla.
export interface Inquiry {
  id: number;
  nombre: string;
  apellido: string;
  numero: string;
  email: string | null;
  fuente: InquirySource;
  descripcion: string;
  status: string;
  listingId: number | null;
  createdAt: Date;
}
