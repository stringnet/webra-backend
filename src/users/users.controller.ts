// src/users/users.controller.ts
import { Controller, Post, Body, UsePipes, ValidationPipe, Get, UseGuards, Param, Patch, Delete } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Asegúrate que la ruta sea correcta
// import { RolesGuard } from '../auth/guards/roles.guard';
// import { Roles } from '../auth/decorators/roles.decorator';
// import { UserRole } from './entities/user.entity';

@Controller('users')
// @UseGuards(JwtAuthGuard) // Podrías aplicar el guard a todo el controlador
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  // @Roles(UserRole.SUPERADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard) // Proteger la creación de usuarios
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard) // Proteger este endpoint
  async getUser(@Param('id') id: string) {
      return this.usersService.findById(id); // Asume que findById existe y es público
  }

  // Aquí podrías añadir más endpoints, por ejemplo:
  // @Get()
  // @UseGuards(JwtAuthGuard)
  // async getAllUsers() {
  //   return this.usersService.findAll(); // Necesitarías implementar findAll en UsersService
  // }

  // @Patch(':id')
  // @UseGuards(JwtAuthGuard)
  // @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  // async updateUser(@Param('id') id: string, @Body() updateUserDto: Partial<CreateUserDto>) {
  //   return this.usersService.update(id, updateUserDto); // Necesitarías implementar update
  // }

  // @Delete(':id')
  // @UseGuards(JwtAuthGuard)
  // // @Roles(UserRole.SUPERADMIN)
  // // @UseGuards(RolesGuard)
  // async deleteUser(@Param('id') id: string) {
  //   return this.usersService.remove(id); // Necesitarías implementar remove
  // }
}
