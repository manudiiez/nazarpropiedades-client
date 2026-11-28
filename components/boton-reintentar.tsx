"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

// Reintentar una falla de DATOS: la página se renderizó bien, pero la lectura
// de la API falló y devolvió un `DataFailure`. No hubo excepción, así que no
// hay boundary ni `retry()`; lo que hace falta es volver a pedir los datos del
// server, que es exactamente `router.refresh()`.
//
// Es el único componente de cliente de la pantalla de falla: el resto se
// renderiza en el server.

export function BotonReintentar({ children = "Reintentar" }: { children?: string }) {
  const router = useRouter();
  const [reintentando, empezar] = useTransition();

  return (
    <button
      type="button"
      // Sin esto, el visitante clickea tres veces porque nada le dice que algo
      // está pasando.
      disabled={reintentando}
      onClick={() => empezar(() => router.refresh())}
      className="rounded border px-4 py-2 disabled:opacity-60"
    >
      {reintentando ? "Reintentando…" : children}
    </button>
  );
}
