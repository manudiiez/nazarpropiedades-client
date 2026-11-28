"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { enviarConsulta } from "@/lib/actions/consultas";
import type { InquirySource } from "@/lib/domain";
import { CAMPO_VOLVER_A, CAMPOS, ESTADO_INICIAL } from "@/lib/forms/consulta";
import { ConsultaEnviada } from "./consulta-enviada";

// El formulario de consulta. La Server Action y la validación ya existían
// (#10): esto es lo que las usa.
//
// Es un Client Component porque necesita `useActionState` para mostrar los
// errores por campo, pero **funciona sin JavaScript**: es un `<form>` con
// `action`, así que si el bundle no cargó, el navegador postea igual y la
// action devuelve la página con el estado renderizado en el server. En un sitio
// con tráfico mayormente móvil eso no es un detalle.
//
// Dos usos con el mismo componente:
//   - la consulta general (home, contacto): `fuente="consulta_general"`;
//   - la consulta por una propiedad: `fuente="propiedad_individual"` + el
//     `listingId`, que la API EXIGE en ese caso (devuelve 400 sin él).
//
// Los nombres de los inputs salen de `CAMPOS`, no de strings sueltos: es lo que
// evita que el form y la action se desincronicen por un typo.

// Los mismos topes que valida `validateInquiry` del lado del server. Están
// duplicados a propósito: los del navegador avisan antes del POST (lo único
// que marca un error sin JavaScript) y los del server son los que mandan,
// porque el endpoint es público.
const LARGOS = {
  nombre: 100,
  apellido: 100,
  numero: 30,
  descripcion: 5000,
} as const;

interface Props {
  fuente?: InquirySource;
  // Obligatorio en la práctica cuando la fuente es `propiedad_individual`: la
  // validación lo marca como campo faltante si no viene.
  listingId?: number;
  titulo?: string;
  // Para la ficha: "Consultar por Casa en venta en Chacras de Coria".
  descripcion?: string;
  // La URL donde vive este formulario. La action redirige ahí con
  // `?consulta=enviada` después de crear la consulta: es lo que hace que la
  // confirmación se vea también sin JavaScript, y que recargar no reenvíe.
  volverA: string;
}

export function FormularioDeConsulta({
  fuente = "consulta_general",
  listingId,
  titulo = "Consultar",
  descripcion,
  volverA,
}: Props) {
  const [estado, accion, enviando] = useActionState(enviarConsulta, ESTADO_INICIAL, volverA);
  const formulario = useRef<HTMLFormElement>(null);

  // `useId` y no ids fijos: el formulario de una propiedad y el general pueden
  // convivir en la misma página (la ficha y el footer, más adelante), y dos
  // inputs con el mismo id rompen la asociación del `<label>`.
  const prefijo = useId();
  const idDe = (campo: string) => `${prefijo}-${campo}`;
  const idDeError = (campo: string) => `${prefijo}-${campo}-error`;

  const error = estado.estado === "error" ? estado : null;
  const errorDe = (campo: string): string | undefined => error?.campos[campo];
  // Lo que el visitante escribió. Importa en el camino sin JavaScript: ahí la
  // página se re-renderiza desde cero y sin esto los campos vuelven vacíos,
  // que es la forma más rápida de perder la consulta.
  const valorDe = (campo: string): string => error?.valores[campo] ?? "";

  // El foco va al primer campo con error. Sin esto, en un formulario largo el
  // visitante ve un cartel arriba y tiene que buscar a mano qué campo marcó.
  useEffect(() => {
    if (error === null) return;
    const primero = Object.keys(error.campos)[0];
    if (primero === undefined) return;
    const control = formulario.current?.elements.namedItem(primero);
    if (control instanceof HTMLElement) control.focus();
  }, [error]);

  // Normalmente no se llega acá: la action redirige al crear la consulta. Queda
  // por si el destino no era una ruta interna válida.
  if (estado.estado === "enviada") return <ConsultaEnviada volverA={volverA} />;

  return (
    <section className="flex flex-col gap-3 border p-4">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      {descripcion === undefined ? null : <p>{descripcion}</p>}

      <form ref={formulario} action={accion} className="flex flex-col gap-3">
        {/* La fuente y la propiedad viajan ocultas: la validación las revisa
            igual, así que un visitante que las edite no puede meter una
            consulta con una fuente inventada. */}
        <input type="hidden" name={CAMPOS.fuente} value={fuente} />
        <input type="hidden" name={CAMPO_VOLVER_A} value={volverA} />
        {listingId === undefined ? null : (
          <input type="hidden" name={CAMPOS.listingId} value={listingId} />
        )}

        {/* El error general va arriba y con `role="alert"`: es lo primero que
            tiene que escucharse después de un envío fallido. El `message` de la
            falla ya viene en español y sin detalles técnicos — incluido el 429,
            que acá es un caso esperado y no un error raro. */}
        {error === null ? null : (
          <div role="alert" className="border p-3">
            <p className="font-semibold">{error.titulo}</p>
            <p>{error.mensaje}</p>
          </div>
        )}

        <Campo
          campo={CAMPOS.nombre}
          etiqueta="Nombre"
          id={idDe(CAMPOS.nombre)}
          idDeError={idDeError(CAMPOS.nombre)}
          error={errorDe(CAMPOS.nombre)}
          valor={valorDe(CAMPOS.nombre)}
          autoComplete="given-name"
          maxLength={LARGOS.nombre}
          requerido
        />
        <Campo
          campo={CAMPOS.apellido}
          etiqueta="Apellido"
          id={idDe(CAMPOS.apellido)}
          idDeError={idDeError(CAMPOS.apellido)}
          error={errorDe(CAMPOS.apellido)}
          valor={valorDe(CAMPOS.apellido)}
          autoComplete="family-name"
          maxLength={LARGOS.apellido}
          requerido
        />
        <Campo
          campo={CAMPOS.numero}
          etiqueta="Teléfono"
          tipo="tel"
          id={idDe(CAMPOS.numero)}
          idDeError={idDeError(CAMPOS.numero)}
          error={errorDe(CAMPOS.numero)}
          valor={valorDe(CAMPOS.numero)}
          autoComplete="tel"
          maxLength={LARGOS.numero}
          // Las mismas reglas que valida el server: al menos 6 dígitos, con o
          // sin característica, guiones o espacios. Acá son para que el
          // navegador las marque ANTES del POST, que es lo único que avisa de
          // un campo mal cargado cuando no hay JavaScript.
          pattern="(?:[^0-9]*[0-9]){6,}[^0-9]*"
          ayuda="Ingresá al menos 6 dígitos. Podés usar espacios o guiones."
          requerido
        />
        {/* El email es opcional y se dice: un asterisco de más hace que la
            gente lo complete mal o abandone. Con el teléfono alcanza para
            responder. */}
        <Campo
          campo={CAMPOS.email}
          etiqueta="Email (opcional)"
          tipo="email"
          id={idDe(CAMPOS.email)}
          idDeError={idDeError(CAMPOS.email)}
          error={errorDe(CAMPOS.email)}
          valor={valorDe(CAMPOS.email)}
          autoComplete="email"
        />

        <div className="flex flex-col gap-1">
          <label htmlFor={idDe(CAMPOS.descripcion)}>Tu consulta</label>
          <textarea
            id={idDe(CAMPOS.descripcion)}
            name={CAMPOS.descripcion}
            defaultValue={valorDe(CAMPOS.descripcion)}
            rows={4}
            maxLength={LARGOS.descripcion}
            required
            aria-invalid={errorDe(CAMPOS.descripcion) === undefined ? undefined : true}
            aria-describedby={
              errorDe(CAMPOS.descripcion) === undefined ? undefined : idDeError(CAMPOS.descripcion)
            }
            className="border px-2 py-1"
          />
          <MensajeDeError id={idDeError(CAMPOS.descripcion)} error={errorDe(CAMPOS.descripcion)} />
        </div>

        {/* Un error en un campo oculto no tiene dónde mostrarse: pasa si la
            fuente es `propiedad_individual` y falta el `listingId`. Es un bug
            nuestro, no del visitante, pero callarlo deja un formulario que no
            se puede enviar sin ninguna explicación. */}
        <MensajeDeError id={idDeError(CAMPOS.listingId)} error={errorDe(CAMPOS.listingId)} />
        <MensajeDeError id={idDeError(CAMPOS.fuente)} error={errorDe(CAMPOS.fuente)} />

        <div>
          <button type="submit" disabled={enviando} className="border px-4 py-2 disabled:opacity-60">
            {enviando ? "Enviando…" : "Enviar consulta"}
          </button>
        </div>
      </form>
    </section>
  );
}

function MensajeDeError({ id, error }: { id: string; error: string | undefined }) {
  if (error === undefined) return null;
  return (
    <p id={id} className="text-sm">
      {error}
    </p>
  );
}

function Campo({
  campo,
  etiqueta,
  tipo = "text",
  id,
  idDeError,
  error,
  valor,
  autoComplete,
  requerido = false,
  maxLength,
  pattern,
  ayuda,
}: {
  campo: string;
  etiqueta: string;
  tipo?: "text" | "tel" | "email";
  id: string;
  idDeError: string;
  error: string | undefined;
  valor: string;
  autoComplete?: string;
  requerido?: boolean;
  maxLength?: number;
  pattern?: string;
  // El mensaje que muestra el navegador cuando el `pattern` no matchea. Sin
  // esto dice "Coincidí con el formato solicitado", que no explica nada.
  ayuda?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id}>{etiqueta}</label>
      <input
        id={id}
        name={campo}
        type={tipo}
        defaultValue={valor}
        // `required` es ayuda del navegador, no validación: la de verdad está
        // en `validateInquiry`, del lado del server, porque el endpoint es
        // público y nadie garantiza que el cliente sea este formulario.
        required={requerido}
        maxLength={maxLength}
        pattern={pattern}
        title={ayuda}
        autoComplete={autoComplete}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={error === undefined ? undefined : idDeError}
        className="border px-2 py-1"
      />
      <MensajeDeError id={idDeError} error={error} />
    </div>
  );
}
