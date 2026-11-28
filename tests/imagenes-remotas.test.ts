import { describe, expect, it } from "vitest";
import { hasRemoteMatch } from "next/dist/shared/lib/match-remote-pattern";
import nextConfig from "@/next.config";
import listingsFixture from "@/lib/data/mock/fixtures/listings.json";

// `next/image` responde 400 a cualquier host que no esté en
// `images.remotePatterns`, y el error apunta al componente, no a la
// configuración: es de los que cuesta diagnosticar. Estos tests usan el MISMO
// matcher que usa Next en runtime, así que no hay una reimplementación del
// glob que pueda divergir.

const patrones = nextConfig.images?.remotePatterns ?? [];

const permitida = (url: string): boolean => hasRemoteMatch([], patrones, new URL(url));

// Todas las URLs http(s) de las fixtures, que están en el formato crudo de la
// API: son las mismas que va a recibir `next/image`.
function urlsDeLasFixtures(): string[] {
  return [...JSON.stringify(listingsFixture).matchAll(/https?:\/\/[^"\\]+/g)].map(
    ([url]) => url,
  );
}

describe("fotos de las propiedades", () => {
  it("hay URLs de fotos en las fixtures para probar", () => {
    expect(urlsDeLasFixtures().length).toBeGreaterThan(0);
  });

  it("todas las fotos de las fixtures están permitidas", () => {
    for (const url of urlsDeLasFixtures()) {
      expect(permitida(url), url).toBe(true);
    }
  });

  // El key lleva el prefijo del entorno (`APP_ENV` en la API): production en
  // producción, development en staging, local en una máquina.
  it("los tres prefijos de entorno están cubiertos", () => {
    const foto = (entorno: string) =>
      `https://pub-e1d8737c1ea34b73bd2fa3a6728b0423.r2.dev/${entorno}/properties/42/abc_1400w_display.webp`;
    for (const entorno of ["production", "development", "local"]) {
      expect(permitida(foto(entorno)), entorno).toBe(true);
    }
  });

  it("las tres variantes que expone la API están permitidas", () => {
    const base = "https://pub-e1d8737c1ea34b73bd2fa3a6728b0423.r2.dev/development/properties/7/uuid";
    for (const variante of ["_1400w_display.webp", "_400w_thumb.webp", "_1200w_wm.jpg"]) {
      expect(permitida(`${base}${variante}`), variante).toBe(true);
    }
  });
});

describe("el optimizador no queda abierto", () => {
  it("otro host no pasa, ni siquiera con el path correcto", () => {
    expect(permitida("https://ejemplo.com/development/properties/1/foto.webp")).toBe(false);
    expect(permitida("https://pub-otracuenta.r2.dev/development/properties/1/foto.webp")).toBe(
      false,
    );
  });

  it("otro path del mismo bucket no pasa: los documentos no son fotos", () => {
    expect(
      permitida("https://pub-e1d8737c1ea34b73bd2fa3a6728b0423.r2.dev/development/documents/1/x.pdf"),
    ).toBe(false);
    expect(permitida("https://pub-e1d8737c1ea34b73bd2fa3a6728b0423.r2.dev/favicon.ico")).toBe(
      false,
    );
  });

  it("http no pasa", () => {
    expect(
      permitida("http://pub-e1d8737c1ea34b73bd2fa3a6728b0423.r2.dev/development/properties/1/f.webp"),
    ).toBe(false);
  });

  it("una query string no pasa", () => {
    expect(
      permitida(
        "https://pub-e1d8737c1ea34b73bd2fa3a6728b0423.r2.dev/development/properties/1/f.webp?x=1",
      ),
    ).toBe(false);
  });
});
