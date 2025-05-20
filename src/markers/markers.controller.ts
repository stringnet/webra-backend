   // src/markers/markers.controller.ts
   import {
     Controller,
     Get,
     Post, // Asegúrate que Post esté importado y usado
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
   } from '@nestjs/common';
   import { FileInterceptor } from '@nestjs/platform-express';
   import { MarkersService } from './markers.service';
   import { CreateMarkerDto } from './dto/create-marker.dto';
   import { UpdateMarkerDto } from './dto/update-marker.dto';
   import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
   import { User } from '../users/entities/user.entity';

   @Controller('markers') // Define el prefijo de ruta '/markers' para este controlador
   @UseGuards(JwtAuthGuard)
   export class MarkersController {
     constructor(private readonly markersService: MarkersService) {}

     @Post() // Define la sub-ruta raíz (POST /api/v1/markers)
     @UseInterceptors(FileInterceptor('imageFile'))
     create(
       @Body() createMarkerDto: CreateMarkerDto,
       @UploadedFile() imageFile: Express.Multer.File,
       @Req() request: any,
     ) {
       const user = request.user as User;
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
     update(
       @Param('id', ParseUUIDPipe) id: string,
       @Body() updateMarkerDto: UpdateMarkerDto,
       @Req() request: any,
     ) {
       const user = request.user as User;
       return this.markersService.update(id, updateMarkerDto, user);
     }

     @Delete(':id')
     @HttpCode(HttpStatus.NO_CONTENT)
     remove(@Param('id', ParseUUIDPipe) id: string, @Req() request: any) {
       const user = request.user as User;
       return this.markersService.remove(id, user);
     }

     @Post(':id/reprocess')
     async reprocessMarker(@Param('id', ParseUUIDPipe) id: string) {
       await this.markersService.processMarker(id);
       return { message: `Reprocessing initiated for marker ${id}` };
     }
   }
