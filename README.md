# NazarPropiedades — sitio público

Front-end del sitio de la inmobiliaria. Next.js 16 (App Router) + Tailwind v4.

La API es un repo aparte (FastAPI). Este proyecto solo la consume.

## Levantarlo

```bash
npm install
cp .env.example .env.local
npm run dev            # http://localhost:3000
```

### Sin backend

No hace falta tener la API levantada: hay una implementación con fixtures en disco.

```bash
# en .env.local
DATA_SOURCE=mock
```

Trae 10 propiedades de Mendoza y el catálogo completo (18 departamentos, 215 zonas, 44 amenities), con casos borde a propósito: sin fotos procesadas, sin título, sin zona, con y sin expensas, la misma propiedad en venta y alquiler.

### Contra la API local

```bash
# en .env.local
DATA_SOURCE=api
API_URL=http://localhost:8000/api/v1
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | servidor de desarrollo (Turbopack) |
| `npm test` | tests (Vitest) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | chequeo de tipos |
| `npm run build` | build de producción |

Los tests de la suite de contrato que pegan a la API se saltean si no hay una respondiendo. Para correrlos contra otra: `TEST_API_URL=... npm test`.

## Cómo se accede a los datos

Todo pasa por `lib/data/queries`. **Los componentes no hacen `fetch` ni conocen la URL de la API.**

```ts
import { searchListings, getListing } from "@/lib/data/queries";

const resultado = await searchListings({ condition: ["sale"] }, { page: 1, limit: 12 });

if (!resultado.ok) {
  // resultado.failure.title y .message vienen en español, listos para mostrar
  return <Error failure={resultado.failure} />;
}

// resultado.data.items — y si está vacío, no es un error: filtró demasiado
```

Ninguna de esas funciones lanza: devuelven `DataResult`, así que un problema de datos no puede tirar abajo la página. El detalle está en `CLAUDE.md`, sección "Capa de datos", incluidas las trampas del contrato de la API.

## Variables de entorno

| Variable | Obligatoria | Para qué |
|---|---|---|
| `DATA_SOURCE` | sí | `api` o `mock` |
| `API_URL` | con `api` | URL de la API, **de runtime** |

No hay ninguna `NEXT_PUBLIC_*`: ningún pedido sale del browser. Por eso la misma imagen de Docker sirve staging y producción.

## Imagen Docker

```bash
docker build -t nazarpropiedades-client .
docker run --rm -p 3000:3000 -e DATA_SOURCE=mock nazarpropiedades-client
```

Multi-stage sobre `node:22-alpine` con `output: "standalone"`, usuario no root, ~211 MB. La publica el CI: `:testing` al mergear a `testing`, `:vX.Y.Z` al publicar un tag.

## Flujo de trabajo

`develop` → `testing` → `main`, todo por Pull Request, con Conventional Commits. Está documentado en `CLAUDE.md` y en `.claude/skills/flujo-github/`.
