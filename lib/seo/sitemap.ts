import { isCondition, type Facets, type ListingFilters } from "@/lib/domain";
import { urlDelListado } from "@/lib/filters";
import { debeIndexar } from "./listado";

// Qué listados entran en el sitemap.
//
// Solo los que `debeIndexar` considera indexables (ver lib/seo/listado.ts): no
// tiene sentido invitar a Google a rastrear una URL que después le dice
// `noindex`. Y solo los que TIENEN publicaciones, que es lo que dicen los
// facets: un listado vacío en el sitemap es una promesa incumplida.

// Cuántos departamentos se publican. Son 18 en Mendoza y 215 zonas; el sitemap
// no es un índice de combinaciones, es la lista de lo que vale la pena rastrear.
export const MAX_DEPARTAMENTOS = 20;

export function urlsDeListados(facets: Facets | null): string[] {
  const urls: string[] = ["/", urlDelListado({})];
  if (facets === null) return urls;

  const agregar = (filtros: ListingFilters) => {
    // La doble verificación no es redundante: si algún día cambia qué se
    // considera indexable, el sitemap sigue a esa decisión sin tocarse.
    if (!debeIndexar({ filtros, pagina: 1 })) return;
    const url = urlDelListado(filtros);
    if (!urls.includes(url)) urls.push(url);
  };

  for (const condicion of facets.conditions) {
    // `value` viene como string: la API puede agregar una condición que el
    // front todavía no conoce, y esa no se puede poner en un filtro.
    if (condicion.count > 0 && isCondition(condicion.value)) {
      agregar({ condition: [condicion.value] });
    }
  }

  const departamentos = facets.provinces.flatMap((provincia) =>
    provincia.departments
      .filter((departamento) => departamento.count > 0)
      .map((departamento) => ({ provincia: provincia.value, departamento: departamento.value })),
  );

  for (const { provincia, departamento } of departamentos.slice(0, MAX_DEPARTAMENTOS)) {
    agregar({ province: provincia, department: [departamento] });
  }

  return urls;
}

// Next escribe `<loc>{url}</loc>` SIN escapar, así que un `&` de la query
// string rompe el XML: con `?provincia=mendoza&departamento=capital` el
// sitemap no parsea y Google lo rechaza entero. Lo verificamos con un parser.
//
// Por eso se escapa acá antes de dárselo a Next. Si alguna vez Next empieza a
// escapar, esto habría que sacarlo o saldría `&amp;amp;`: el test de
// tests/seo.test.ts es el que lo va a cantar.
const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

export function escaparParaXml(url: string): string {
  return url.replace(/[&<>"']/g, (caracter) => ESCAPES[caracter]);
}
