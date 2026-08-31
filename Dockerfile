# Etapa 1: Construcción (Builder)
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias necesarias para compilar módulos nativos si se requieren
RUN apk add --no-cache python3 make g++

# Copiar archivos de dependencias
COPY package.json package-lock.json ./

# Instalar todas las dependencias (incluyendo devDependencies para compilar)
RUN npm ci

# Copiar código fuente
COPY . .

# Compilar Frontend (Vite) y Backend (esbuild server.ts -> dist/server.cjs)
RUN npm run build

# Etapa 2: Imagen de Producción (Runner)
FROM node:20-alpine AS runner

WORKDIR /app

# Establecer entorno de producción
ENV NODE_ENV=production
ENV PORT=3000

# Copiar package.json y package-lock.json para instalar solo dependencias de producción
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copiar artefactos compilados desde la etapa builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/index.html ./index.html

# Copiar archivos JSON locales de respaldo / configuración si existen
COPY --from=builder /app/clients_local.json ./clients_local.json
COPY --from=builder /app/client_visits_local.json ./client_visits_local.json
COPY --from=builder /app/warehouse_config.json ./warehouse_config.json
COPY --from=builder /app/folio_config.json ./folio_config.json

# Puerto expuesto por Express
EXPOSE 3000

# Comando de inicio del servidor optimizado
CMD ["node", "dist/server.cjs"]
