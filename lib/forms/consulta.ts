import { INQUIRY_SOURCES, type InquirySource, type NewInquiry } from "@/lib/domain";

// La parte del formulario de consultas que no depende de Next ni de la red:
// leer el FormData y armar el estado que la UI va a renderizar.
//
// Está separado de la Server Action a propósito: así se puede testear sin
// levantar el server, que es donde viven `headers()` y el `"use server"`.

// Nombres de los campos del form. Un objeto en vez de strings sueltos para que
// el componente y la action no puedan desincronizarse por un typo.
export const CAMPOS = {
  nombre: "nombre",
  apellido: "apellido",
  numero: "numero",
  email: "email",
  descripcion: "descripcion",
  fuente: "fuente",
  listingId: "listingId",
} as const;

// El formulario manda además a dónde volver con la confirmación. No es un
// campo de la consulta, así que no entra en CAMPOS: la action lo usa para
// redirigir y nunca llega a la API.
export const CAMPO_VOLVER_A = "volverA";

// El param con el que la página sabe que tiene que mostrar la confirmación.
export const PARAM_CONSULTA = "consulta";
export const CONSULTA_ENVIADA = "enviada";

// Por qué la confirmación es un redirect y no solo el estado del formulario:
//
// con `cacheComponents` el contenido de la página vive en un `<Suspense>`, y la
// respuesta de un POST trae la cáscara en HTML y el estado nuevo SOLO en el
// payload de RSC, para que lo aplique el cliente. Lo verificamos: sin
// JavaScript, un envío correcto creaba la consulta y devolvía el formulario
// igual que antes, sin confirmación y sin los datos. El visitante no tiene
// forma de saber que se envió, así que lo manda de nuevo.
//
// Un POST → 303 → GET lo arregla en los dos caminos, y de paso evita que
// recargar reenvíe la consulta.
//
// El destino viene del formulario, o sea del visitante: se acepta solo una ruta
// interna. Sin este chequeo, `volverA=https://otro-sitio` convierte al
// formulario en un redirector abierto, que es phishing gratis con nuestro
// dominio.
function esRutaInterna(valor: string): boolean {
  if (!valor.startsWith("/")) return false;
  // `//otro-sitio` y `/\otro-sitio` son URLs absolutas para el navegador.
  if (valor.startsWith("//") || valor.startsWith("/\\")) return false;
  // Un salto de línea permitiría inyectar headers si el destino se usara en
  // otro contexto.
  return !/[\r\n]/.test(valor);
}

export function destinoDeConfirmacion(formData: FormData): string | null {
  const valor = texto(formData, CAMPO_VOLVER_A).trim();
  if (valor === "" || !esRutaInterna(valor)) return null;
  const separador = valor.includes("?") ? "&" : "?";
  return `${valor}${separador}${PARAM_CONSULTA}=${CONSULTA_ENVIADA}`;
}

export type EstadoConsulta =
  // Todavía no se envió nada.
  | { estado: "inicial" }
  // Se creó. `id` sirve para no reenviar y para analítica.
  | { estado: "enviada"; id: number }
  // Falló. `mensaje` es para mostrar arriba del form; `campos` marca inputs.
  | {
      estado: "error";
      titulo: string;
      mensaje: string;
      campos: Record<string, string>;
      // Si tiene sentido ofrecer un botón de reintentar.
      reintentable: boolean;
      // Lo que el visitante escribió, para no perderlo al re-renderizar.
      valores: Record<string, string>;
    };

export const ESTADO_INICIAL: EstadoConsulta = { estado: "inicial" };

function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === "string" ? valor : "";
}

// Devuelve lo que el visitante escribió, para repoblar el form si algo falla.
// Sin esto, un error le borra lo que tipeó, que es la forma más rápida de que
// abandone la consulta.
export function valoresEnviados(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    Object.values(CAMPOS).map((campo) => [campo, texto(formData, campo)]),
  );
}

function fuente(formData: FormData): InquirySource {
  const valor = texto(formData, CAMPOS.fuente);
  return (INQUIRY_SOURCES as readonly string[]).includes(valor)
    ? (valor as InquirySource)
    : // Si el form no la manda o manda basura, se asume la consulta general:
      // es el caso más amplio y la validación igual rechaza una fuente
      // inventada si llegara a pasar.
      "consulta_general";
}

function listingId(formData: FormData): number | undefined {
  const valor = texto(formData, CAMPOS.listingId).trim();
  if (valor === "") return undefined;
  const numero = Number(valor);
  // Un id que no es un id se deja pasar como NaN -> la validación lo rechaza
  // con el campo señalado, en vez de descartarlo en silencio y mandar la
  // consulta sin la propiedad asociada.
  return Number.isNaN(numero) ? -1 : numero;
}

export function parsearConsulta(formData: FormData): NewInquiry {
  const email = texto(formData, CAMPOS.email).trim();

  return {
    nombre: texto(formData, CAMPOS.nombre),
    apellido: texto(formData, CAMPOS.apellido),
    numero: texto(formData, CAMPOS.numero),
    // Vacío se omite: la API devuelve 422 con email vacío.
    email: email === "" ? undefined : email,
    fuente: fuente(formData),
    descripcion: texto(formData, CAMPOS.descripcion),
    listingId: listingId(formData),
  };
}

// La API nombra sus campos en snake_case (`listing_id`) y el formulario en
// camelCase (`listingId`). Sin traducir, un error de validación del servidor
// no marcaría ningún input: el mapa quedaría con una clave que el form no
// conoce y el visitante vería un mensaje general sin saber qué corregir.
const CAMPO_DE_LA_API: Record<string, string> = {
  listing_id: CAMPOS.listingId,
};

function campoDelForm(field: string): string {
  return CAMPO_DE_LA_API[field] ?? field;
}

// Convierte una falla de la capa de datos en el estado del formulario.
export function errorAEstado(
  failure: { title: string; message: string; retryable: boolean; details: { field: string; message: string }[] },
  valores: Record<string, string>,
): EstadoConsulta {
  return {
    estado: "error",
    titulo: failure.title,
    mensaje: failure.message,
    campos: Object.fromEntries(failure.details.map((d) => [campoDelForm(d.field), d.message])),
    reintentable: failure.retryable,
    valores,
  };
}
