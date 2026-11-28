import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { esProduccion, getSiteUrl } from "@/lib/config";

// El robots.txt.
//
// Dos decisiones que conviene no revertir sin leer esto:
//
// 1. **Staging no se indexa.** Sirve el mismo contenido que producción, así que
//    indexarlo es competir contra el sitio real con una copia. Con `APP_ENV`
//    distinto de `production` se devuelve `disallow: /` y no se publica el
//    sitemap. Si la variable falta, se asume que NO es producción: eso se ve en
//    /robots.txt y se arregla, mientras que lo contrario indexa staging en
//    silencio.
//
// 2. **Los listados con filtros profundos NO se bloquean acá**, aunque el issue
//    lo proponía. Esas URLs ya salen con `noindex, follow` (ver lib/seo), y un
//    `Disallow` impide que Google LEA ese noindex: la URL queda bloqueada pero
//    puede aparecer igual en los resultados si alguien la linkea, y encima sin
//    poder seguir los links a las fichas. Las dos cosas juntas se estorban;
//    `noindex` es la que hace el trabajo.
export default async function robots(): Promise<MetadataRoute.Robots> {
  // Sin esto el robots.txt se genera en el BUILD, que corre sin variables de
  // entorno: quedaría horneado con `disallow: /` para siempre y producción no
  // se indexaría nunca. Lo verificamos: con `APP_ENV=production` en el
  // contenedor, el robots.txt prerenderizado seguía diciendo `Disallow: /`.
  await connection();

  const siteUrl = getSiteUrl();

  if (!esProduccion()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: { userAgent: "*", allow: "/" },
    // Sin SITE_URL no hay URL absoluta que publicar, y el sitemap se declara
    // con URL absoluta o no sirve.
    sitemap: siteUrl === null ? undefined : `${siteUrl}/sitemap.xml`,
    host: siteUrl ?? undefined,
  };
}
