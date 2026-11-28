"use client";

import { useEffect } from "react";
import { describirError } from "@/lib/ui/errores";

// El único boundary que cubre un error en el layout raíz. Reemplaza al layout,
// así que tiene que traer sus propios `<html>` y `<body>`.
//
// Dos consecuencias de eso, documentadas por Next: no llegan los estilos
// globales —de ahí los estilos inline, no es desprolijidad— y no se puede
// exportar `metadata` porque es un Client Component; el título va con el
// componente `<title>` de React.
//
// Si esto se ve, el layout raíz está roto: no hay nada que reintentar que no
// sea recargar, así que se ofrece recargar y nada más.
export default function GlobalError({ error }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(`[ui:global-error] ${describirError(error)}`);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <title>Algo no funcionó</title>
        <main>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Algo no funcionó</h1>
          <p>Tuvimos un problema inesperado. Probá recargar la página en un momento.</p>
          {/* `<a>` a propósito, no `<Link>`: si el layout raíz falló, lo que
              hace falta es una navegación de verdad que recargue el documento
              entero, no una del router sobre un árbol roto. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" style={{ display: "inline-block", marginTop: "0.5rem" }}>
            Ir al inicio
          </a>
        </main>
      </body>
    </html>
  );
}
