# Stage 1: Build the application
FROM node:18-alpine AS builder
WORKDIR /usr/src/app

# Instalar dependencias necesarias para compilar 'canvas' y otras dependencias nativas en Alpine
# python3, make, g++ son herramientas de compilación.
# pkgconfig ayuda a encontrar otras bibliotecas.
# cairo-dev, jpeg-dev, pango-dev, giflib-dev, librsvg-dev son bibliotecas de desarrollo de las que 'canvas' depende.
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    pkgconfig \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    librsvg-dev

# Copia package.json y package-lock.json
COPY package*.json ./

# Instala TODAS las dependencias (incluyendo devDependencies) usando package-lock.json
RUN npm ci

# Copia el resto del código fuente de la aplicación
COPY . .

# Construye la aplicación
RUN npm run build

# Stage 2: Create the production image
FROM node:18-alpine
WORKDIR /usr/src/app

# Establece el entorno a producción para la imagen final
ENV NODE_ENV=production

# Instalar solo las dependencias de runtime de 'canvas' (las bibliotecas, no las -dev)
# Esto es para que la imagen final siga siendo lo más pequeña posible,
# pero tenga lo necesario para que 'canvas' (si se usa en runtime) funcione.
# Si 'canvas' solo se usa en build time (raro), podrías omitir esto.
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    giflib \
    librsvg

# Copia solo los artefactos necesarios desde la etapa builder
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/dist ./dist

# Expone el puerto en el que corre la aplicación
EXPOSE ${PORT:-3000}

# Comando para correr la aplicación
CMD ["node", "dist/main.js"]
