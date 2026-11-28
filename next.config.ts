import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build autocontenido para la imagen Docker (ver Dockerfile).
  output: "standalone",
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  images: {
    // Las fotos viven en el bucket de Cloudflare R2 de la API. `next/image`
    // rechaza con 400 cualquier host que no esté declarado acá, así que sin
    // esto no se ve NINGUNA foto.
    //
    // El host es el mismo en los tres entornos (`R2_PUBLIC_URL` en el repo
    // `api`): lo que cambia es el prefijo del key, que sale de `APP_ENV`
    // (`app/config.py`: production | development | local). Se declaran los tres
    // por separado en vez de un comodín: `remotePatterns` abierto convierte al
    // sitio en un optimizador de imágenes gratis para cualquiera.
    //
    // Ojo: esto se evalúa en build, no en runtime. Si algún día el bucket
    // cambia por entorno, la misma imagen Docker deja de servir para los dos y
    // hay que resolverlo con un dominio custom único.
    remotePatterns: ["production", "development", "local"].map((entorno) => ({
      protocol: "https" as const,
      hostname: "pub-e1d8737c1ea34b73bd2fa3a6728b0423.r2.dev",
      port: "",
      // `{env}/properties/{propiedadId}/{uuid}_1400w_display.webp`, y las
      // variantes `_400w_thumb.webp` y `_1200w_wm.jpg`.
      pathname: `/${entorno}/properties/**`,
      // Las URLs de R2 no llevan query string. Restringirla evita que se use
      // el optimizador con URLs que no son las nuestras.
      search: "",
    })),
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
