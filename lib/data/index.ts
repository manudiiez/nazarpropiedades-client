import { getConfig } from "@/lib/config";
import type { CatalogsRepository } from "./catalogs-repository";
import type { InquiriesRepository } from "./inquiries-repository";
import type { ListingsRepository } from "./listings-repository";
import { createHttpCatalogsRepository } from "./http/catalogs";
import { createHttpInquiriesRepository } from "./http/inquiries";
import { createHttpListingsRepository } from "./http/listings";
import {
  createMockCatalogsRepository,
  createMockInquiriesRepository,
  createMockListingsRepository,
} from "./mock/repositories";

// Único punto de entrada. Quien consume importa de acá y no se entera nunca de
// cuál implementación está activa.
//
// La selección se resuelve una sola vez, al primer uso: no existe cambiar de
// implementación en runtime.

interface Repositories {
  listings: ListingsRepository;
  catalogs: CatalogsRepository;
  inquiries: InquiriesRepository;
}

let repositories: Repositories | null = null;

function build(): Repositories {
  const config = getConfig();

  if (config.dataSource === "mock") {
    return {
      listings: createMockListingsRepository(),
      catalogs: createMockCatalogsRepository(),
      inquiries: createMockInquiriesRepository(),
    };
  }

  return {
    listings: createHttpListingsRepository(config.apiUrl),
    catalogs: createHttpCatalogsRepository(config.apiUrl),
    // Este sale del browser, así que usa la URL pública.
    inquiries: createHttpInquiriesRepository(config.publicApiUrl),
  };
}

function get(): Repositories {
  if (repositories === null) repositories = build();
  return repositories;
}

export function listingsRepository(): ListingsRepository {
  return get().listings;
}

export function catalogsRepository(): CatalogsRepository {
  return get().catalogs;
}

export function inquiriesRepository(): InquiriesRepository {
  return get().inquiries;
}

// Solo para los tests.
export function resetRepositories(): void {
  repositories = null;
}

export type { CatalogsRepository, InquiriesRepository, ListingsRepository };
export * from "./failures";
export { UnknownFilterValueError, validateFilters } from "./validate-filters";
export { InvalidInquiryError, validateInquiry } from "./validate-inquiry";
