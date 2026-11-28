// Stub de `next/cache` para los tests.
//
// Las funciones de los repositorios HTTP usan `use cache` con `cacheLife` y
// `cacheTag`, que solo existen dentro del runtime de Next. En los tests no hay
// runtime, así que se reemplazan por no-ops.
//
// Esto NO prueba el comportamiento del caché — eso solo se puede verificar
// corriendo Next. Lo que permite es testear el resto de la implementación HTTP
// (traducción de filtros, desenvoltura, mapeo, errores) sin levantar el server.

export function cacheLife(): void {}
export function cacheTag(): void {}
export function revalidateTag(): void {}
