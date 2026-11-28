import { INQUIRY_SOURCES, type NewInquiry } from "@/lib/domain";

// Validación del formulario de contacto, del lado del front.
//
// Existe porque la API no valida: verificado contra la API real, un POST con
// nombre, apellido, número y descripción VACÍOS devuelve 201 y crea la
// consulta. O sea que sin esto, el formulario le mete consultas en blanco al
// CRM y el visitante recibe un "listo" por algo que no sirve para contactarlo.
//
// Se reportó del lado de la API, pero la validación va igual acá: el front
// tiene que marcar el campo que falta antes de hacer el pedido, y no puede
// delegar en que el servidor diga qué está mal.

export interface FieldIssue {
  field: string;
  message: string;
}

export class InvalidInquiryError extends Error {
  readonly details: FieldIssue[];

  constructor(details: FieldIssue[]) {
    super(`La consulta tiene ${details.length} campo(s) inválido(s).`);
    this.name = "InvalidInquiryError";
    this.details = details;
  }
}

// Al menos 6 dígitos: alcanza para descartar un campo vacío o un "123" sin
// rechazar formatos reales (con o sin característica, guiones o espacios).
const MIN_DIGITOS_TELEFONO = 6;

export function validateInquiry(input: NewInquiry): void {
  const details: FieldIssue[] = [];
  const texto = (value: string | undefined): string => (value ?? "").trim();

  if (texto(input.nombre) === "") {
    details.push({ field: "nombre", message: "Ingresá tu nombre." });
  }
  if (texto(input.apellido) === "") {
    details.push({ field: "apellido", message: "Ingresá tu apellido." });
  }

  const digitos = texto(input.numero).replace(/\D/g, "");
  if (digitos.length < MIN_DIGITOS_TELEFONO) {
    details.push({
      field: "numero",
      message: "Ingresá un teléfono de contacto válido.",
    });
  }

  if (texto(input.descripcion) === "") {
    details.push({ field: "descripcion", message: "Contanos brevemente tu consulta." });
  }

  // El email es opcional, pero si lo escribió tiene que servir para responderle.
  const email = texto(input.email);
  if (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    details.push({ field: "email", message: "Revisá el email: no parece válido." });
  }

  if (!(INQUIRY_SOURCES as readonly string[]).includes(input.fuente)) {
    details.push({ field: "fuente", message: "El origen de la consulta no es válido." });
  }

  if (input.listingId !== undefined && (!Number.isInteger(input.listingId) || input.listingId <= 0)) {
    details.push({ field: "listingId", message: "La propiedad asociada no es válida." });
  }

  if (details.length > 0) throw new InvalidInquiryError(details);
}
