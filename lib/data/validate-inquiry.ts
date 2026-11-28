import { INQUIRY_SOURCES, type NewInquiry } from "@/lib/domain";

// Validación del formulario de contacto, del lado del front.
//
// Existe porque la API no valida: verificado contra la API real, un POST con
// nombre, apellido, número y descripción VACÍOS devuelve 201 y crea la
// consulta. O sea que sin esto, el formulario le mete consultas en blanco al
// CRM y el visitante recibe un "listo" por algo que no sirve para contactarlo.
//
// Ya está arreglado del lado de la API, que ahora devuelve 422 con el detalle
// por campo. La validación va igual acá: el front tiene que marcar el campo
// que falta antes de hacer el pedido, no esperar que el servidor diga qué
// está mal. Las dos cosas, no una o la otra — y la del server es la que
// cuenta, porque el endpoint es público y nadie garantiza que el cliente
// sea este front.

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

// Topes de las columnas de la base de la API. Se validan acá para que el
// formulario marque el campo sin ir y volver por la red: un nombre de 500
// caracteres antes pasaba la validación de la API y explotaba contra la
// columna, devolviendo un 500 en vez de decir qué campo estaba mal.
const MAX_LARGO: Record<string, number> = {
  nombre: 100,
  apellido: 100,
  numero: 30,
  descripcion: 5000,
};

export function validateInquiry(input: NewInquiry): void {
  const details: FieldIssue[] = [];
  const texto = (value: string | undefined): string => (value ?? "").trim();

  if (texto(input.nombre) === "") {
    details.push({ field: "nombre", message: "Ingresá tu nombre." });
  } else if (texto(input.nombre).length > MAX_LARGO.nombre) {
    details.push({ field: "nombre", message: `El nombre no puede superar los ${MAX_LARGO.nombre} caracteres.` });
  }

  if (texto(input.apellido) === "") {
    details.push({ field: "apellido", message: "Ingresá tu apellido." });
  } else if (texto(input.apellido).length > MAX_LARGO.apellido) {
    details.push({ field: "apellido", message: `El apellido no puede superar los ${MAX_LARGO.apellido} caracteres.` });
  }

  const digitos = texto(input.numero).replace(/\D/g, "");
  if (digitos.length < MIN_DIGITOS_TELEFONO) {
    details.push({
      field: "numero",
      message: "Ingresá un teléfono de contacto válido.",
    });
  } else if (texto(input.numero).length > MAX_LARGO.numero) {
    details.push({
      field: "numero",
      message: `El teléfono no puede superar los ${MAX_LARGO.numero} caracteres.`,
    });
  }

  if (texto(input.descripcion) === "") {
    details.push({ field: "descripcion", message: "Contanos brevemente tu consulta." });
  } else if (texto(input.descripcion).length > MAX_LARGO.descripcion) {
    details.push({
      field: "descripcion",
      message: `La consulta no puede superar los ${MAX_LARGO.descripcion} caracteres.`,
    });
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
