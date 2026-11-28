# Fixtures de los tests

`respuestas-api.json` son respuestas de `GET /public/listings`, `/listings/{id}` y
`/facets` capturadas de la API corriendo, con la **estructura exacta** que
devuelve: claves en snake_case, números serializados como string
(`"300000.00"`), direcciones en MAYÚSCULAS y timestamps con microsegundos.

Los **valores identificatorios están anonimizados** — dirección, descripción,
precio y URLs de fotos. No son datos reales de la inmobiliaria: el repo es
público y una fixture no debería arrastrar avisos de producción, que además
quedan obsoletos.

Lo que **no** se tocó son los valores del catálogo (`mendoza`, `godoy_cruz`,
`godoy_cruz_centro`, `house`, `sale`): son públicos y son justo lo que ejercita
la resolución de etiquetas contra el catálogo real.

Si el contrato de la API cambia, estos archivos son los que avisan. Para
recapturarlos, con la API levantada:

```bash
curl -s "localhost:8000/api/v1/public/listings?limit=1"
curl -s "localhost:8000/api/v1/public/listings/{id}"
curl -s "localhost:8000/api/v1/public/facets"
```

y volver a anonimizar antes de commitear.
