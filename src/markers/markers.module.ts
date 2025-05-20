    // src/markers/markers.module.ts
    import { Module } from '@nestjs/common';
    import { TypeOrmModule } from '@nestjs/typeorm';
    import { MarkersService } from './markers.service';
    import { MarkersController } from './markers.controller';
    import { Marker } from './entities/marker.entity';
    import { StorageModule } from '../../storage/storage.module'; // Importa StorageModule para usar StorageService
    import { AuthModule } from '../../auth/auth.module'; // Para JwtAuthGuard y obtener el usuario
    import { UsersModule } from '../../users/users.module'; // Para la entidad User

    @Module({
      imports: [
        TypeOrmModule.forFeature([Marker]), // Registra la entidad Marker
        StorageModule, // Hace StorageService disponible
        AuthModule, // Para la protección de rutas y acceso a req.user
        UsersModule, // Para poder usar la entidad User si es necesario en relaciones
      ],
      controllers: [MarkersController],
      providers: [MarkersService],
      exports: [MarkersService], // Exporta el servicio si otros módulos lo necesitan
    })
    export class MarkersModule {}
