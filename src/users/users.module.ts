// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])], // Importa la entidad User
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService], // Exporta UsersService para que AuthModule pueda usarlo
})
export class UsersModule {}
