// src/storage/storage.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { StorageService } from './storage.service';

export const CLOUDINARY = 'Cloudinary'; // Constante para el token de inyección

@Module({
  imports: [ConfigModule], // Asegúrate de que ConfigModule esté disponible
  providers: [
    {
      provide: CLOUDINARY,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return cloudinary.config({
          cloud_name: configService.get<string>('CLOUDINARY_CLOUD_NAME'),
          api_key: configService.get<string>('CLOUDINARY_API_KEY'),
          api_secret: configService.get<string>('CLOUDINARY_API_SECRET'),
          secure: true,
        });
      },
    },
    StorageService,
  ],
  exports: [StorageService], // Exporta el servicio para que otros módulos lo usen
})
export class StorageModule {}
