// src/users/users.controller.ts
import { Controller, Post, Body, UsePipes, ValidationPipe, Get, UseGuards, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Para proteger rutas
// import { RolesGuard } from '../auth/guards/roles.guard'; // Para roles
// import { Roles } from '../auth/decorators/roles.decorator'; // Para roles
import { UserRole } from './entities/user.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Ejemplo de endpoint para crear un usuario (protegerlo adecuadamente después)
  @Post()
  // @Roles(UserRole.SUPERADMIN) // Ejemplo de cómo se protegería por rol
  // @UseGuards(JwtAuthGuard, RolesGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  // Ejemplo para obtener un usuario por ID (protegerlo)
  @Get(':id')
  // @UseGuards(JwtAuthGuard)
  async getUser(@Param('id') id: string) {
      return this.usersService.findById(id);
  }
}
