"use server";

import { redirect } from "next/navigation";
import { getCatalog } from "@/lib/data/queries";
import { filtrosDesdeSearchParams, urlDelListado } from "@/lib/filters";

// El submit del formulario de filtros.
//
// Por qué una Server Action y no un `<form method="get">`, que sería lo obvio:
// un form GET manda TODOS sus campos, incluidos los vacíos, así que buscar sin
// tocar nada deja `?direccion=&precio_min=&precio_max=&...`. El parseo los
// ignora, pero la URL es parte del producto —se comparte por WhatsApp y la
// indexa Google—, y además esa URL y la limpia equivalente son dos URLs para la
// misma lista.
//
// Acá se hace la vuelta completa: FormData → filtros (que descarta lo vacío y
// lo inválido) → URL canónica → redirect. El visitante termina siempre en la
// URL mínima que reproduce su búsqueda, y la misma traducción que lee la URL es
// la que la escribe.
//
// Funciona sin JavaScript: una Server Action en `action` es un POST normal y el
// redirect es un 303 a la URL nueva.
export async function aplicarFiltros(formData: FormData): Promise<void> {
  const enviados = new URLSearchParams();
  for (const [clave, valor] of formData.entries()) {
    // Los archivos no tienen sentido en un filtro; `entries()` los tipa igual.
    if (typeof valor === "string") enviados.append(clave, valor);
  }

  // El catálogo valida los valores respaldados por la API (tipo, ubicaciones,
  // amenities). Si la lectura falla se sigue sin validar: el formulario ya
  // ofreció solo opciones existentes, y perder la búsqueda del visitante por
  // un catálogo caído es peor que mandar un slug que la API va a ignorar.
  const catalogo = await getCatalog();
  const { filtros } = filtrosDesdeSearchParams(enviados, catalogo.ok ? catalogo.data : {});

  // Sin página: cambiar un filtro vuelve a la primera. Quedarse en la página 7
  // de una búsqueda nueva muestra una lista vacía que parece un error.
  redirect(urlDelListado(filtros));
}
