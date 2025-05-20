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
      Req, // Para obtener el usuario de la solicitud
      HttpCode,
      HttpStatus,
    } from '@nestjs/common';
    import { FileInterceptor } from '@nestjs/platform-express'; // Para subida de archivos
    import { MarkersService } from './markers.service';
    import { CreateMarkerDto } from './dto/create-marker.dto';
    import { UpdateMarkerDto } from './dto/update-marker.dto';
    import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Asegúrate que la ruta sea correcta
    import { User } from '../users/entities/user.entity'; // Para tipar el usuario
    // import { RolesGuard } from '../auth/guards/roles.guard'; // Si implementas roles
    // import { Roles } from '../auth/decorators/roles.decorator'; // Si implementas roles
    // import { UserRole } from '../users/entities/user.entity'; // Si implementas roles

    @Controller('markers')
    @UseGuards(JwtAuthGuard) // Protege todos los endpoints de este controlador
    export class MarkersController {
      constructor(private readonly markersService: MarkersService) {}

      @Post()
      @UseInterceptors(FileInterceptor('imageFile')) // 'imageFile' debe ser el nombre del campo en el form-data
      create(
        @Body() createMarkerDto: CreateMarkerDto,
        @UploadedFile() imageFile: Express.Multer.File,
        @Req() request: any, // Usamos 'any' temporalmente, mejor crear un tipo para el request con user
      ) {
        const user = request.user as User; // Obtiene el usuario del token JWT (adjuntado por JwtStrategy)
        return this.markersService.create(createMarkerDto, imageFile, user);
      }

      @Get()
      findAll(@Req() request: any) {
        const user = request.user as User;
        return this.markersService.findAll(user);
      }

      @Get(':id')
      findOne(@Param('id', ParseUUIDPipe) id: string, @Req() request: any) {
        const user = request.user as User;
        return this.markersService.findOne(id, user);
      }

      @Patch(':id')
      // Podrías necesitar un interceptor de archivos aquí también si permites actualizar la imagen
      update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateMarkerDto: UpdateMarkerDto,
        @Req() request: any,
      ) {
        const user = request.user as User;
        return this.markersService.update(id, updateMarkerDto, user);
      }

      @Delete(':id')
      @HttpCode(HttpStatus.NO_CONTENT) // Devuelve 204 No Content en eliminación exitosa
      remove(@Param('id', ParseUUIDPipe) id: string, @Req() request: any) {
        const user = request.user as User;
        return this.markersService.remove(id, user);
      }

      // Endpoint para re-disparar el procesamiento de un marcador (opcional)
      @Post(':id/reprocess')
      async reprocessMarker(@Param('id', ParseUUIDPipe) id: string) {
        // Aquí podrías añadir lógica de permisos si es necesario
        await this.markersService.processMarker(id);
        return { message: `Reprocessing initiated for marker ${id}` };
      }
    }
