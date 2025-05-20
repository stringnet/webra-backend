// src/markers/markers.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException, // Importa UnauthorizedException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MarkersService } from './markers.service';
import { CreateMarkerDto } from './dto/create-marker.dto';
import { UpdateMarkerDto } from './dto/update-marker.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service'; // IMPORTA UsersService

@Controller('markers')
@UseGuards(JwtAuthGuard)
export class MarkersController {
  constructor(
    private readonly markersService: MarkersService,
    private readonly usersService: UsersService, // INYECTA UsersService
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('imageFile'))
  async create( // Marca el método como async
    @Body() createMarkerDto: CreateMarkerDto,
    @UploadedFile() imageFile: Express.Multer.File,
    @Req() request: any,
  ) {
    // request.user es el payload devuelto por JwtStrategy.validate
    const authUserPayload = request.user as { userId: string; username: string; role: string; email: string };

    // Obtén la entidad User completa
    const userEntity = await this.usersService.findById(authUserPayload.userId);
    if (!userEntity) {
      // Esto no debería suceder si el token es válido y el usuario existe,
      // pero es una buena verificación.
      throw new UnauthorizedException('User from token not found in database.');
    }

    return this.markersService.create(createMarkerDto, imageFile, userEntity);
  }

  @Get()
  async findAll(@Req() request: any) { // Marcar como async si se hacen llamadas a DB
    const authUserPayload = request.user as { userId: string; username: string; role: string; email: string };
    const userEntity = await this.usersService.findById(authUserPayload.userId);
     if (!userEntity) {
      throw new UnauthorizedException('User from token not found in database.');
    }
    return this.markersService.findAll(userEntity);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Req() request: any) { // Marcar como async
    const authUserPayload = request.user as { userId: string; username: string; role: string; email: string };
    const userEntity = await this.usersService.findById(authUserPayload.userId);
    if (!userEntity) {
      throw new UnauthorizedException('User from token not found in database.');
    }
    return this.markersService.findOne(id, userEntity);
  }

  @Patch(':id')
  async update( // Marcar como async
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMarkerDto: UpdateMarkerDto,
    @Req() request: any,
  ) {
    const authUserPayload = request.user as { userId: string; username: string; role: string; email: string };
    const userEntity = await this.usersService.findById(authUserPayload.userId);
    if (!userEntity) {
      throw new UnauthorizedException('User from token not found in database.');
    }
    return this.markersService.update(id, updateMarkerDto, userEntity);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @Req() request: any) { // Marcar como async
    const authUserPayload = request.user as { userId: string; username: string; role: string; email: string };
    const userEntity = await this.usersService.findById(authUserPayload.userId);
    if (!userEntity) {
      throw new UnauthorizedException('User from token not found in database.');
    }
    return this.markersService.remove(id, userEntity);
  }

  @Post(':id/reprocess')
  async reprocessMarker(@Param('id', ParseUUIDPipe) id: string) {
    // Aquí podrías añadir lógica de permisos si es necesario,
    // por ejemplo, verificar si el usuario autenticado tiene permiso para este marcador.
    await this.markersService.processMarker(id);
    return { message: `Reprocessing initiated for marker ${id}` };
  }
}
