import type { ReactNode } from "react";

// La cáscara compartida de las pantallas que no son contenido: error, 404 y
// fallas de datos. Existe para que los tres digan lo mismo de la misma forma y
// no se vayan desincronizando.
//
// Sin diseño a propósito (ver issue #31): HTML mínimo con el texto correcto. La
// jerarquía visual va cuando haya diseño.

export function PaginaDeEstado({
  titulo,
  mensaje,
  acciones,
  // Cuando esto va dentro de una página que ya tiene su `<main>` —una falla al
  // leer los resultados del listado, que se muestra al lado de los filtros—,
  // anidar otro `<main>` es HTML inválido y confunde a los lectores de
  // pantalla, que buscan uno solo.
  como: Elemento = "main",
}: {
  titulo: string;
  mensaje: string;
  // Botones o links. Puede no haber ninguno: un error no reintentable con un
  // botón de reintentar frustra más que ayudar.
  acciones?: ReactNode;
  como?: "main" | "section";
}) {
  return (
    <Elemento className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">{titulo}</h1>
      <p className="text-base">{mensaje}</p>
      {acciones ? <div className="flex flex-wrap justify-center gap-3">{acciones}</div> : null}
    </Elemento>
  );
}
