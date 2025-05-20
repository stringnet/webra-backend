    // src/markers/markers.service.ts
    import { Injectable, NotFoundException, InternalServerErrorException, Logger, BadRequestException } from '@nestjs/common';
    import { InjectRepository } from '@nestjs/typeorm';
    import { Repository } from 'typeorm';
    import { Marker, MarkerProcessingStatus } from './entities/marker.entity';
    import { CreateMarkerDto } from './dto/create-marker.dto';
    import { UpdateMarkerDto } from './dto/update-marker.dto';
    import { StorageService } from '../../storage/storage.service'; // Asegúrate que la ruta sea correcta
    import { User } from '../../users/entities/user.entity'; // Asegúrate que la ruta sea correcta
    // Importa aquí las bibliotecas o herramientas necesarias para el procesamiento de marcadores
    // Ejemplo: import * as child_process from 'child_process';
    // Ejemplo: import * as fs from 'fs-extra';
    // Ejemplo: import * as path from 'path';

    @Injectable()
    export class MarkersService {
      private readonly logger = new Logger(MarkersService.name);

      constructor(
        @InjectRepository(Marker)
        private markersRepository: Repository<Marker>,
        private storageService: StorageService,
      ) {}

      async create(
        createMarkerDto: CreateMarkerDto,
        imageFile: Express.Multer.File,
        user: User,
      ): Promise<Marker> {
        if (!imageFile) {
          throw new BadRequestException('Marker image file is required.');
        }

        let uploadedImageInfo;
        try {
          // Sube la imagen original a Cloudinary
          uploadedImageInfo = await this.storageService.uploadFile(
            imageFile,
            'marker_originals', // Carpeta en Cloudinary para imágenes originales
            'image',
          );
        } catch (error) {
          this.logger.error(`Failed to upload original marker image to Cloudinary: ${error.message}`, error.stack);
          throw new InternalServerErrorException('Failed to upload marker image.');
        }

        const marker = this.markersRepository.create({
          ...createMarkerDto,
          originalImageCloudinaryPublicId: uploadedImageInfo.public_id,
          originalImageUrl: uploadedImageInfo.secure_url,
          status: MarkerProcessingStatus.UPLOADED,
          userId: user.id, // Asigna el ID del usuario autenticado
          user: user, // Asigna el objeto User si la relación lo necesita así
        });

        const savedMarker = await this.markersRepository.save(marker);

        // Dispara el procesamiento del marcador de forma asíncrona (recomendado)
        this.processMarker(savedMarker.id).catch(err => {
            this.logger.error(`Error during async marker processing for ${savedMarker.id}: ${err.message}`, err.stack);
            // Podrías tener un mecanismo para reintentar o marcar el error permanentemente
        });


        return savedMarker;
      }

      async processMarker(markerId: string): Promise<void> {
        this.logger.log(`Starting processing for marker ID: ${markerId}`);
        const marker = await this.markersRepository.findOneBy({ id: markerId });

        if (!marker || !marker.originalImageUrl) {
          this.logger.error(`Marker or original image URL not found for ID: ${markerId}`);
          if (marker) {
            marker.status = MarkerProcessingStatus.FAILED;
            marker.processingError = 'Original image URL not found.';
            await this.markersRepository.save(marker);
          }
          return;
        }

        try {
          marker.status = MarkerProcessingStatus.PROCESSING;
          await this.markersRepository.save(marker);

          // --- LÓGICA DE PROCESAMIENTO DEL MARCADOR ---
          // Esta es la parte compleja y depende de la biblioteca de RA que uses (MindAR, AR.js NFT, etc.)
          // 1. Descargar la imagen original de Cloudinary (o usar un buffer si lo pasaste)
          //    Ejemplo (conceptual): const imageBuffer = await downloadImage(marker.originalImageUrl);
          //
          // 2. Ejecutar la herramienta de compilación del marcador
          //    Ejemplo para MindAR (conceptual, necesitarías la herramienta CLI de MindAR):
          //    const mindFilePath = await compileMindARMarker(imageBufferOrPath);
          //
          // 3. Simular un archivo procesado por ahora
          const processedFileName = `processed_marker_${markerId}.mind`; // o .fset3 para AR.js NFT
          const simulatedProcessedFileContent = `dummy content for ${processedFileName}`;
          const tempFilePath = `/tmp/${processedFileName}`; // Usa una ruta temporal adecuada
          // await fs.writeFile(tempFilePath, simulatedProcessedFileContent);

          // Sube el archivo de marcador procesado a Cloudinary
          // Para esto, necesitarías convertir el archivo a un buffer o usar su ruta
          // const processedFileBuffer = await fs.readFile(tempFilePath);
          // const processedFileForUpload: Express.Multer.File = {
          //   fieldname: 'file',
          //   originalname: processedFileName,
          //   encoding: '7bit',
          //   mimetype: 'application/octet-stream', // o el mimetype correcto
          //   buffer: processedFileBuffer,
          //   size: processedFileBuffer.length,
          //   stream: null, // no se usa streamifier aquí si ya tienes buffer
          //   destination: '',
          //   filename: '',
          //   path: ''
          // };

          // const uploadedProcessedMarkerInfo = await this.storageService.uploadFile(
          //   processedFileForUpload,
          //   'marker_processed', // Carpeta en Cloudinary para marcadores procesados
          //   'raw', // Usar 'raw' para archivos que no son imagen/video
          // );

          // await fs.unlink(tempFilePath); // Elimina el archivo temporal

          // --- FIN DE LA LÓGICA DE PROCESAMIENTO (SIMULADA) ---

          // Actualiza la entidad Marker con la información del archivo procesado
          // marker.processedMarkerCloudinaryPublicId = uploadedProcessedMarkerInfo.public_id;
          // marker.processedMarkerUrl = uploadedProcessedMarkerInfo.secure_url;
          marker.status = MarkerProcessingStatus.PROCESSED; // Cambiar a PROCESSED cuando esté implementado
          marker.processingError = null; // Limpia errores previos
          marker.recommendations = "Marcador procesado (simulado). Implementar lógica real."; // Ejemplo

          await this.markersRepository.save(marker);
          this.logger.log(`Successfully processed marker ID: ${markerId}`);

        } catch (error) {
          this.logger.error(`Failed to process marker ID ${markerId}: ${error.message}`, error.stack);
          marker.status = MarkerProcessingStatus.FAILED;
          marker.processingError = error.message.substring(0, 250); // Guarda parte del error
          await this.markersRepository.save(marker);
        }
      }

      async findAll(user: User): Promise<Marker[]> {
        // Modificar para filtrar por usuario si no es superadmin, o mostrar todos si es superadmin
        if (user.role === 'superadmin') {
            return this.markersRepository.find();
        }
        return this.markersRepository.find({ where: { userId: user.id } });
      }

      async findOne(id: string, user: User): Promise<Marker> {
        const marker = await this.markersRepository.findOneBy({ id });
        if (!marker) {
          throw new NotFoundException(`Marker with ID "${id}" not found`);
        }
        // Verificar permisos si no es superadmin
        if (user.role !== 'superadmin' && marker.userId !== user.id) {
            throw new NotFoundException(`Marker with ID "${id}" not found or access denied.`);
        }
        return marker;
      }

      async update(id: string, updateMarkerDto: UpdateMarkerDto, user: User): Promise<Marker> {
        const marker = await this.findOne(id, user); // findOne ya verifica permisos
        
        // Solo permite actualizar el nombre por ahora
        if (updateMarkerDto.name) {
            marker.name = updateMarkerDto.name;
        }
        // Si se permite subir una nueva imagen, se necesitaría lógica similar a create() y re-procesamiento.

        return this.markersRepository.save(marker);
      }

      async remove(id: string, user: User): Promise<void> {
        const marker = await this.findOne(id, user); // findOne ya verifica permisos

        // Eliminar archivos de Cloudinary antes de eliminar de la BD
        try {
          if (marker.originalImageCloudinaryPublicId) {
            await this.storageService.deleteFile(marker.originalImageCloudinaryPublicId, 'image');
          }
          if (marker.processedMarkerCloudinaryPublicId) {
            // Asegúrate de usar el resource_type correcto ('raw' si así lo subiste)
            await this.storageService.deleteFile(marker.processedMarkerCloudinaryPublicId, 'raw');
          }
        } catch (error) {
          this.logger.error(`Failed to delete Cloudinary files for marker ID ${id}: ${error.message}`, error.stack);
          // Decide si continuar con la eliminación de la BD o lanzar un error
          // Por ahora, continuaremos para no dejar registros huérfanos si Cloudinary falla temporalmente
        }

        const result = await this.markersRepository.delete(id);
        if (result.affected === 0) {
          throw new NotFoundException(`Marker with ID "${id}" not found`);
        }
      }
    }
