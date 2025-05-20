# Stage 1: Build the application
FROM node:18-alpine AS builder
WORKDIR /usr/src/app

# No establezcas NODE_ENV=production aquí todavía,
# para asegurar que npm ci instale las devDependencies necesarias para el build.

# Copia package.json y package-lock.json
COPY package*.json ./

# Instala TODAS las dependencias (incluyendo devDependencies) usando package-lock.json
# Esto es necesario porque @nestjs/cli (usado en 'npm run build') es una devDependency.
RUN npm ci

# Copia el resto del código fuente de la aplicación
COPY . .

# Ahora puedes establecer NODE_ENV=production si tu proceso de build lo requiere específicamente,
# aunque 'nest build' generalmente no depende de esto para su propia operación.
# ENV NODE_ENV=production

# Construye la aplicación
# El script "build" (ej. "nest build") se define en tu package.json
RUN npm run build

# Stage 2: Create the production image
FROM node:18-alpine
WORKDIR /usr/src/app

# Establece el entorno a producción para la imagen final
ENV NODE_ENV=production

# Copia solo los artefactos necesarios desde la etapa builder
# 1. Las dependencias de producción (npm ci en la etapa builder ya las instaló,
#    y si necesitas SOLO las de producción, podrías hacer un 'npm prune --production'
#    en la etapa builder después del build, o instalar solo las de producción aquí).
#    Por simplicidad y para asegurar que todo lo que necesita 'dist' esté, copiamos node_modules.
#    Si el tamaño de la imagen es crítico, se puede optimizar copiando solo 'dist' y
#    ejecutando 'npm ci --omit=dev' aquí después de copiar package*.json.
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/dist ./dist

# Expone el puerto en el que corre la aplicación
EXPOSE ${PORT:-3000}

# Comando para correr la aplicación
CMD ["node", "dist/main.js"]
