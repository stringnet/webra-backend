// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
// import helmet from 'helmet'; // Descomenta si quieres usar Helmet para seguridad básica de cabeceras HTTP

async function bootstrap() {
  // Crea la instancia de la aplicación NestJS, pasando el módulo raíz (AppModule)
  const app = await NestFactory.create(AppModule);

  // Obtiene el servicio de configuración para acceder a las variables de entorno
  const configService = app.get(ConfigService);

  // Obtiene el puerto desde las variables de entorno, o usa 3000 por defecto
  const port = configService.get<number>('PORT') || 3000;

  // Crea una instancia del Logger para mostrar mensajes en la consola
  const logger = new Logger('Bootstrap');

  // Habilita CORS (Cross-Origin Resource Sharing)
  // Es crucial para permitir que tu frontend (que se ejecutará en un dominio diferente)
  // pueda hacer peticiones a este backend.
  // Puedes configurarlo de forma más restrictiva en producción.
  app.enableCors({
    origin: '*', // En producción, especifica los dominios permitidos: ['http://localhost:3001', 'https://webra.scanmee.io']
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // (Opcional) Habilita Helmet para añadir cabeceras de seguridad básicas.
  // Instala helmet: npm install helmet
  // app.use(helmet());

  // Establece un prefijo global para todas las rutas de la API.
  // Por ejemplo, todas las rutas comenzarán con /api/v1 (ej. /api/v1/users, /api/v1/auth)
  app.setGlobalPrefix('api/v1');

  // Habilita un ValidationPipe global para validar automáticamente los DTOs (Data Transfer Objects)
  // que llegan en las solicitudes.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Elimina propiedades que no están definidas en el DTO
      forbidNonWhitelisted: true, // Lanza un error si se envían propiedades no definidas en el DTO
      transform: true, // Transforma el payload a una instancia del DTO (ej. string a number si está tipado)
      transformOptions: {
        enableImplicitConversion: true, // Permite la conversión implícita de tipos
      },
    }),
  );

  // Inicia el servidor para que escuche en el puerto especificado
  await app.listen(port);

  // Muestra un mensaje en la consola indicando que el servidor se ha iniciado y en qué puerto
  logger.log(`🚀 Application is running on: http://localhost:${port}/${app.getGlobalPrefix()}`);
  logger.log(`📚 Swagger (API Docs) available at http://localhost:${port}/${app.getGlobalPrefix()}-docs (if configured)`);
}

// Ejecuta la función bootstrap para iniciar la aplicación
bootstrap();
