   // src/markers/markers.module.ts
   import { Module } from '@nestjs/common';
   import { TypeOrmModule } from '@nestjs/typeorm';
   import { MarkersService } from './markers.service';
   import { MarkersController } from './markers.controller'; // Importación del controlador
   import { Marker } from './entities/marker.entity';
   import { StorageModule } from '../../storage/storage.module';
   import { AuthModule } from '../../auth/auth.module';
   import { UsersModule } from '../../users/users.module';

   @Module({
     imports: [
       TypeOrmModule.forFeature([Marker]),
       StorageModule,
       AuthModule,
       UsersModule,
     ],
     controllers: [MarkersController], // MarkersController debe estar aquí
     providers: [MarkersService],
     exports: [MarkersService],
   })
   export class MarkersModule {}
