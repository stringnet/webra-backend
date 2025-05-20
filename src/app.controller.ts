// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Hace que ConfigModule esté disponible globalmente
      envFilePath: '.env', // Especifica el archivo de entorno
    }),
    // ... otros módulos se añadirán aquí
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
