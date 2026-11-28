import Link from "next/link";

// La confirmación de una consulta enviada.
//
// Está aparte del formulario porque la muestran dos cosas: la página cuando
// vuelve del redirect con `?consulta=enviada` (el camino que funciona sin
// JavaScript) y el formulario mismo si llegara a quedarse con el estado
// "enviada" sin redirigir.
export function ConsultaEnviada({ volverA }: { volverA?: string }) {
  return (
    // `role="status"` para que un lector de pantalla lo anuncie: reemplaza al
    // formulario y sin esto el cambio pasa desapercibido.
    <section role="status" className="flex flex-col gap-2 border p-4">
      <h2 className="text-lg font-semibold">Recibimos tu consulta</h2>
      <p>Te vamos a contactar a la brevedad por el teléfono que dejaste.</p>
      {/* La confirmación llega por `?consulta=enviada`, así que el formulario
          no vuelve hasta que la URL se limpie. Sin este link, mandar una
          segunda consulta obliga a editar la dirección a mano. */}
      {volverA === undefined ? null : (
        <p>
          <Link href={volverA} className="underline">
            Hacer otra consulta
          </Link>
        </p>
      )}
    </section>
  );
}
