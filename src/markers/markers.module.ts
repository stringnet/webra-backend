// src/markers/markers.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarkersService } from './markers.service';
import { MarkersController } from './markers.controller';
import { Marker } from './entities/marker.entity';
// Rutas corregidas: ../ en lugar de ../../
import { StorageModule } from '../storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Marker]),
    StorageModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [MarkersController],
  providers: [MarkersService],
  exports: [MarkersService],
})
export class MarkersModule {}
