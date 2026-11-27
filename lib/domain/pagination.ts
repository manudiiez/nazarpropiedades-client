export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 100;

export interface PageRequest {
  // 1-indexada, como la API.
  page: number;
  limit: number;
}

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
