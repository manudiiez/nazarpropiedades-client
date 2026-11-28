# Imagen de producción del front (Next.js 16, output: "standalone").
# Se construye en CI: :testing al mergear a testing, :vX.Y.Z al publicar un tag.
# Build local: docker build -t nazarpropiedades-client .

# ---- deps: dependencias completas, cacheadas por el lockfile ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: compila la app ----
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# No hay build-args de configuración a propósito: ningún pedido a la API sale
# del browser, así que nada de la API queda horneado en el bundle. La imagen no
# está atada a un entorno — la MISMA vX.Y.Z sirve staging y producción, con
# API_URL y DATA_SOURCE como variables del contenedor.
RUN npm run build

# ---- runner: solo el bundle standalone ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

COPY --from=builder /app/public ./public
# standalone trae su propio server.js y solo los node_modules que usa en runtime
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
