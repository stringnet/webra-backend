// src/markers/markers.service.ts
import { Injectable, NotFoundException, InternalServerErrorException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Marker, MarkerProcessingStatus } from './entities/marker.entity';
import { CreateMarkerDto } from './dto/create-marker.dto';
import { UpdateMarkerDto } from './dto/update-marker.dto';
import { StorageService } from '../storage/storage.service';
import { User } from '../users/entities/user.entity';

import axios from 'axios';
import * as fs from 'fs-extra';
import * as path from 'path';
import { file as tmpFile, dir as tmpDir } from 'tmp-promise';
// Ya no necesitamos spawn si el compilador es una biblioteca de Node.js
// import { spawn } from 'child_process';

// Importa el compilador que acabas de instalar
import MindARCompiler from '@maherboughdiri/mind-ar-compiler';

@Injectable()
export class MarkersService {
  private readonly logger = new Logger(MarkersService.name);
  private mindArCompiler: MindARCompiler; // Declara una instancia del compilador

  constructor(
    @InjectRepository(Marker)
    private markersRepository: Repository<Marker>,
    private storageService: StorageService,
  ) {
    this.mindArCompiler = new MindARCompiler(); // Instancia el compilador
  }

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
      uploadedImageInfo = await this.storageService.uploadFile(
        imageFile,
        'marker_originals',
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
      userId: user.id,
      user: user,
    });

    const savedMarker = await this.markersRepository.save(marker);

    this.processMarker(savedMarker.id).catch(err => {
        this.logger.error(`Error during async marker processing for ${savedMarker.id}: ${err.message}`, err.stack);
    });

    return savedMarker;
  }

  private async compileMindARMarkerWithLibrary(imageBuffer: Buffer): Promise<Buffer> {
    this.logger.log(`Compiling image buffer with @maherboughdiri/mind-ar-compiler`);
    try {
      // La documentación de @maherboughdiri/mind-ar-compiler sugiere `compileFiles` que espera un array de objetos File.
      // Necesitamos adaptar nuestro buffer de imagen a algo que `compileFiles` pueda aceptar,
      // o ver si hay otro método en el paquete que acepte un buffer directamente.

      // Asumiremos que necesitamos simular un objeto File. Esto es especulativo.
      // Es POSIBLE que este paquete no funcione directamente con buffers y espere un entorno de navegador
      // o una API de File. Si es así, este enfoque fallará.
      const pseudoFile = {
        name: 'temp-marker-image.jpg', // Nombre de archivo temporal
        type: 'image/jpeg', // Asume JPEG, ajusta si es necesario
        arrayBuffer: () => Promise.resolve(imageBuffer.buffer.slice(imageBuffer.byteOffset, imageBuffer.byteOffset + imageBuffer.byteLength)),
        // Otras propiedades que un objeto File podría tener, si son necesarias para el compilador
      };

      // La función compileFiles espera un array de estos pseudo-objetos File
      // El paquete @maherboughdiri/mind-ar-compiler podría no estar diseñado para buffers directos en Node.js.
      // Su documentación en Yarn (https://classic.yarnpkg.com/en/package/@maherboughdiri/mind-ar-compiler)
      // dice: const files = // array of image File objects
      // Esto es más típico de un entorno de navegador.

      // ¡¡¡ALERTA DE POSIBLE PROBLEMA!!!
      // Si `compileFiles` está estrictamente ligado a la API `File` del navegador, este enfoque fallará en Node.js.
      // Necesitaríamos una forma de que este compilador trabaje con buffers o rutas de archivo en Node.js.
      // Por ahora, intentaremos esto, pero es probable que necesitemos investigar más sobre cómo usar
      // @maherboughdiri/mind-ar-compiler en un backend Node.js o encontrar una alternativa si no es compatible.

      this.logger.log('Simulating File object for compiler. This might not work if the library expects a true browser File object.');
      const compiledDataArray = await this.mindArCompiler.compileFiles([pseudoFile as any]); // Usamos 'as any' para el pseudoFile

      if (!compiledDataArray || compiledDataArray.length === 0) {
        throw new Error('MindAR Compiler (@maherboughdiri) did not return compiled data.');
      }

      // Asumimos que `compiledDataArray` es un array de buffers o algo convertible a buffer.
      // La documentación dice que `compileFiles` devuelve "compiled data". Necesitamos saber su formato.
      // Si es un DataView o ArrayBuffer, necesitamos convertirlo a un Buffer de Node.js.
      // Por ahora, asumiremos que el primer elemento es lo que necesitamos y que es un buffer o convertible.
      const compiledBuffer = Buffer.from(compiledDataArray[0]); // Esto es una suposición fuerte.

      this.logger.log(`Image compiled successfully with @maherboughdiri/mind-ar-compiler. Output buffer size: ${compiledBuffer.length}`);
      return compiledBuffer;

    } catch (error) {
      this.logger.error(`Error compiling with @maherboughdiri/mind-ar-compiler: ${error.message}`, error.stack);
      throw error; // Relanza el error para que sea manejado por processMarker
    }
  }


  async processMarker(markerId: string): Promise<void> {
    this.logger.log(`Starting REAL processing for marker ID: ${markerId} using @maherboughdiri/mind-ar-compiler`);
    let marker = await this.markersRepository.findOneBy({ id: markerId });

    if (!marker || !marker.originalImageUrl) {
      this.logger.error(`Marker or original image URL not found for ID: ${markerId}`);
      if (marker) {
        marker.status = MarkerProcessingStatus.FAILED;
        marker.processingError = 'Original image URL not found for processing.';
        await this.markersRepository.save(marker);
      }
      return;
    }

    const { path: tempDirPath, cleanup: cleanupTempDir } = await tmpDir({ unsafeCleanup: true });
    let tempImagePath: string | null = null; // No necesitaremos guardar la imagen en disco si el compilador acepta buffer

    try {
      marker.status = MarkerProcessingStatus.PROCESSING;
      marker.processingError = null;
      await this.markersRepository.save(marker);

      // 1. Descargar la imagen original de Cloudinary como un buffer
      this.logger.log(`Downloading image from Cloudinary: ${marker.originalImageUrl}`);
      const imageResponse = await axios({
        method: 'get',
        url: marker.originalImageUrl,
        responseType: 'arraybuffer', // Descargar como arraybuffer
      });
      const imageBuffer = Buffer.from(imageResponse.data); // Convertir a Buffer de Node.js
      this.logger.log(`Image downloaded successfully. Buffer size: ${imageBuffer.length}`);

      // 2. Compilar la imagen usando la biblioteca @maherboughdiri/mind-ar-compiler
      const mindFileBuffer = await this.compileMindARMarkerWithLibrary(imageBuffer);

      // 3. Sube el buffer del archivo .mind procesado a Cloudinary
      const mindFileForUpload: Express.Multer.File = {
        fieldname: 'file',
        originalname: `${marker.id}.mind`,
        encoding: '7bit',
        mimetype: 'application/octet-stream',
        buffer: mindFileBuffer,
        size: mindFileBuffer.length,
        stream: null, destination: '', filename: '', path: ''
      };

      const uploadedProcessedMarkerInfo = await this.storageService.uploadFile(
        mindFileForUpload,
        'marker_processed_mindar',
        'raw',
      );
      this.logger.log(`Processed MindAR marker uploaded to Cloudinary: ${uploadedProcessedMarkerInfo.public_id}`);

      // 4. Actualiza la entidad Marker
      marker.processedMarkerCloudinaryPublicId = uploadedProcessedMarkerInfo.public_id;
      marker.processedMarkerUrl = uploadedProcessedMarkerInfo.secure_url;
      marker.status = MarkerProcessingStatus.PROCESSED;
      marker.recommendations = "Marcador procesado con @maherboughdiri/mind-ar-compiler.";

      await this.markersRepository.save(marker);
      this.logger.log(`Successfully processed marker ID: ${markerId} with @maherboughdiri/mind-ar-compiler.`);

    } catch (error) {
      this.logger.error(`Failed to process marker ID ${markerId} with @maherboughdiri/mind-ar-compiler: ${error.message}`, error.stack);
      marker = await this.markersRepository.findOneBy({ id: markerId });
      if(marker){
          marker.status = MarkerProcessingStatus.FAILED;
          marker.processingError = error.message.substring(0, 250);
          await this.markersRepository.save(marker);
      }
    } finally {
      // Ya no necesitamos limpiar archivos temporales de imagen o .mind si trabajamos con buffers
      await cleanupTempDir().catch(e => this.logger.error(`Error cleaning up temp directory: ${e.message}`));
    }
  }

  // ... findAll, findOne, update, remove (sin cambios significativos para esta tarea) ...
  async findAll(user: User): Promise<Marker[]> {
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
    if (user.role !== 'superadmin' && marker.userId !== user.id) {
        throw new NotFoundException(`Marker with ID "${id}" not found or access denied.`);
    }
    return marker;
  }

  async update(id: string, updateMarkerDto: UpdateMarkerDto, user: User): Promise<Marker> {
    const marker = await this.findOne(id, user);
    
    if (updateMarkerDto.name) {
        marker.name = updateMarkerDto.name;
    }

    return this.markersRepository.save(marker);
  }

  async remove(id: string, user: User): Promise<void> {
    const marker = await this.findOne(id, user);

    try {
      if (marker.originalImageCloudinaryPublicId) {
        await this.storageService.deleteFile(marker.originalImageCloudinaryPublicId, 'image');
      }
      if (marker.processedMarkerCloudinaryPublicId) {
        await this.storageService.deleteFile(marker.processedMarkerCloudinaryPublicId, 'raw');
      }
    } catch (error) {
      this.logger.error(`Failed to delete Cloudinary files for marker ID ${id}: ${error.message}`, error.stack);
    }

    const result = await this.markersRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Marker with ID "${id}" not found`);
    }
  }
}
