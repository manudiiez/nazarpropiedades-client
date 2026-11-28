import { cacheLife, cacheTag } from "next/cache";
import type { Catalog, CatalogSection, Facets } from "@/lib/domain";
import type { CatalogsRepository } from "../catalogs-repository";
import { HttpClient } from "./client";
import { mapCatalog, mapFacets } from "./mappers";

async function fetchRawCatalog(baseUrl: string, sections: string[]): Promise<unknown> {
  "use cache";
  cacheLife("days");
  cacheTag("catalogs");
  return new HttpClient({ baseUrl }).get<unknown>("/public/catalogs", {
    // Sin `include` la API devuelve todo; con él, omite las secciones no
    // pedidas (distinto de devolverlas vacías).
    query: sections.length === 0 ? {} : { include: sections },
  });
}

async function fetchRawFacets(baseUrl: string): Promise<unknown> {
  "use cache";
  // Más corto que el catálogo: los conteos cambian cada vez que publican algo.
  cacheLife("minutes");
  cacheTag("facets", "listings");
  return new HttpClient({ baseUrl }).get<unknown>("/public/facets", {});
}

export function createHttpCatalogsRepository(baseUrl: string): CatalogsRepository {
  return {
    async getCatalog(sections?: CatalogSection[]): Promise<Catalog> {
      // Se ordenan para que pedir las mismas secciones en otro orden dé la
      // misma clave de caché.
      const pedidas = [...(sections ?? [])].sort();
      return mapCatalog(await fetchRawCatalog(baseUrl, pedidas));
    },

    async getFacets(): Promise<Facets> {
      return mapFacets(await fetchRawFacets(baseUrl));
    },
  };
}
