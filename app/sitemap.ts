import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { esProduccion, getSiteUrl } from "@/lib/config";
import { getFacets, searchListings } from "@/lib/data/queries";
import { MAX_PAGE_SIZE } from "@/lib/domain";
import { urlDePropiedad } from "@/lib/format";
import { escaparParaXml, urlsDeListados } from "@/lib/seo";

// El sitemap.
//
// El problema de fondo es que la API no tiene un endpoint de "todos los ids":
// hay que paginar el listado hasta el final. Eso choca con el rate limit (60
// pedidos por minuto contra la IP del server), así que:
//
//  - se pide de a `MAX_PAGE_SIZE` (100), el máximo que acepta la API;
//  - hay un tope de pedidos, para que un catálogo que creció de golpe no se
//    coma el límite y deje al sitio sin poder leer nada más;
//  - el resultado se cachea fuerte: esto lo pide un crawler cada tanto, no un
//    visitante en cada página.
//
// Si alguna vez el tope se queda corto de verdad, la solución no es subirlo:
// es pedirle a la sesión `api` un endpoint de ids, que es mucho más barato
// para los dos lados.

// 20 pedidos = 2.000 propiedades. Deja 40 pedidos del minuto libres para el
// tráfico normal del sitio.
const MAX_PEDIDOS = 20;

// Next parte el sitemap solo si pasa las 50.000 URLs (con `generateSitemaps`).
// Con este tope estamos dos órdenes de magnitud abajo.
const LIMITE_DE_NEXT = 50_000;

async function urlsDelSitemap(): Promise<string[]> {
  "use cache";
  // Un crawler pasa cada varias horas; las propiedades nuevas entran igual por
  // el listado, que revalida cada minuto. Cachear fuerte acá es lo que evita
  // que un bot que insista dispare 20 pedidos a la API cada vez.
  cacheLife("hours");
  cacheTag("listings", "sitemap");

  const facets = await getFacets();
  const urls = urlsDeListados(facets.ok ? facets.data : null);

  for (let pagina = 1; pagina <= MAX_PEDIDOS; pagina++) {
    const resultado = await searchListings({}, { page: pagina, limit: MAX_PAGE_SIZE });
    // Una falla no deja el sitemap vacío: se publica lo que se pudo juntar.
    // Un sitemap incompleto es mejor que ninguno, y el crawler vuelve.
    if (!resultado.ok) break;

    for (const listing of resultado.data.items) urls.push(urlDePropiedad(listing));

    if (pagina >= resultado.data.totalPages) return urls;
  }

  console.warn(
    `[sitemap] Se alcanzó el tope de ${MAX_PEDIDOS} pedidos (${MAX_PEDIDOS * MAX_PAGE_SIZE} ` +
      "propiedades). Hay publicaciones que no entraron: conviene pedirle a la API un endpoint de ids.",
  );
  return urls;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Sin esto el sitemap se prerenderiza en el BUILD, que corre sin
  // `DATA_SOURCE`: las lecturas fallan, y el sitemap vacío queda horneado y se
  // sirve siempre. Es el mismo problema que tenía la home. El caché de
  // `urlsDelSitemap` sigue valiendo: lo de acá es por request, lo de adentro
  // se reusa por horas.
  await connection();

  // En staging el robots.txt ya dice `disallow: /`; publicar igual el sitemap
  // sería invitar a rastrear lo que se está pidiendo que no se rastree.
  if (!esProduccion()) return [];

  const siteUrl = getSiteUrl();
  // Las URLs del sitemap tienen que ser absolutas. Sin SITE_URL no hay sitemap
  // posible: mejor vacío que con URLs que no resuelven.
  if (siteUrl === null) return [];

  const urls = await urlsDelSitemap();

  // `lastModified` se omite a propósito: el dominio tiene `createdAt` pero no
  // una fecha de modificación, y mandar la de creación le miente a Google sobre
  // la frescura de una propiedad que cambió de precio hace una semana. Cuando
  // la API exponga `updated_at`, va acá.
  // El escapeo no es cosmético: Next no escapa el `&` de la query string y el
  // XML queda mal formado. Ver `escaparParaXml`.
  return urls.slice(0, LIMITE_DE_NEXT).map((url) => ({ url: escaparParaXml(`${siteUrl}${url}`) }));
}
