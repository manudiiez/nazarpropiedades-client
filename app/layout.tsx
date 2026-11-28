import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getSiteUrl } from "@/lib/config";
import { DESCRIPCION_DEL_SITIO, NOMBRE_DEL_SITIO } from "@/lib/seo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// `generateMetadata` y no un `metadata` constante: `SITE_URL` es variable de
// runtime (la imagen Docker se construye sin ninguna variable de la API), así
// que leerla en el módulo la congelaría en el valor del build, que no existe.
export function generateMetadata(): Metadata {
  const siteUrl = getSiteUrl();

  return {
    // Resuelve las URLs relativas de las canónicas y del Open Graph. Sin esto,
    // `og:image` sale relativa y WhatsApp no muestra la foto.
    metadataBase: siteUrl === null ? undefined : new URL(siteUrl),
    title: {
      // Cada página pone lo suyo y el nombre del sitio se agrega acá, una sola
      // vez: así ninguna se olvida y ninguna lo escribe distinto.
      template: `%s | ${NOMBRE_DEL_SITIO}`,
      default: `${NOMBRE_DEL_SITIO} — Propiedades en Mendoza`,
    },
    description: DESCRIPCION_DEL_SITIO,
    applicationName: NOMBRE_DEL_SITIO,
    openGraph: {
      type: "website",
      locale: "es_AR",
      siteName: NOMBRE_DEL_SITIO,
      title: `${NOMBRE_DEL_SITIO} — Propiedades en Mendoza`,
      description: DESCRIPCION_DEL_SITIO,
    },
    // No hay cuenta de Twitter/X: `summary_large_image` igual mejora cómo se
    // ve el link donde se pegue, sin prometer un perfil que no existe.
    twitter: { card: "summary_large_image" },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-AR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
