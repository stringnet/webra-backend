// src/markers/markers.service.ts
import { Injectable, NotFoundException, InternalServerErrorException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Marker, MarkerProcessingStatus } from './entities/marker.entity';
import { CreateMarkerDto } from './dto/create-marker.dto';
import { UpdateMarkerDto } from './dto/update-marker.dto';
import { StorageService } from '../storage/storage.service';
import { User } from '../users/entities/user.entity';

import axios, { AxiosResponse } from 'axios'; // Importar AxiosResponse para tipado
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
      const pseudoFile = {
        name: 'temp-marker-image.jpg', 
        type: 'image/jpeg', 
        arrayBuffer: () => Promise.resolve(imageBuffer.buffer.slice(imageBuffer.byteOffset, imageBuffer.byteOffset + imageBuffer.byteLength)),
      };

      this.logger.log('Simulating File object for compiler. This might not work if the library expects a true browser File object.');
      // El tipo de retorno de compileFiles es `Promise<any[] | ArrayBuffer[]>` según su d.ts,
      // así que necesitamos manejarlo apropiadamente.
      const compiledDataArray: any[] | ArrayBuffer[] = await this.mindArCompiler.compileFiles([pseudoFile as any]); 

      if (!compiledDataArray || compiledDataArray.length === 0) {
        throw new Error('MindAR Compiler (@maherboughdiri) did not return compiled data.');
      }
      
      // Asumimos que el primer elemento es un ArrayBuffer o algo que Buffer.from puede manejar.
      // Si es un ArrayBuffer, Buffer.from(arrayBuffer) es correcto.
      const firstElement = compiledDataArray[0];
      let compiledBuffer: Buffer;

      if (firstElement instanceof ArrayBuffer) {
        compiledBuffer = Buffer.from(firstElement);
      } else if (Buffer.isBuffer(firstElement)) {
        compiledBuffer = firstElement;
      } else if (typeof firstElement === 'object' && firstElement !== null && firstElement.type === 'Buffer' && Array.isArray(firstElement.data)) {
        // Manejar el caso donde podría ser un objeto Buffer serializado
        compiledBuffer = Buffer.from(firstElement.data);
      }
      else {
        // Intenta convertirlo directamente, esto podría fallar si el tipo no es compatible
        this.logger.warn(`Compiled data type is unexpected: ${typeof firstElement}. Attempting direct Buffer.from().`);
        compiledBuffer = Buffer.from(firstElement as any); 
      }


      this.logger.log(`Image compiled successfully with @maherboughdiri/mind-ar-compiler. Output buffer size: ${compiledBuffer.length}`);
      return compiledBuffer;

    } catch (error) {
      this.logger.error(`Error compiling with @maherboughdiri/mind-ar-compiler: ${error.message}`, error.stack);
      throw error;
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
    
    try {
      marker.status = MarkerProcessingStatus.PROCESSING;
      marker.processingError = null;
      await this.markersRepository.save(marker);

      this.logger.log(`Downloading image from Cloudinary: ${marker.originalImageUrl}`);
      const imageResponse: AxiosResponse<ArrayBuffer> = await axios({ // Tipar la respuesta de Axios
        method: 'get',
        url: marker.originalImageUrl,
        responseType: 'arraybuffer',
      });
      // CORRECCIÓN: Asegurar que imageResponse.data es tratado como ArrayBuffer
      const imageBuffer = Buffer.from(imageResponse.data as ArrayBuffer);
      this.logger.log(`Image downloaded successfully. Buffer size: ${imageBuffer.length}`);

      const mindFileBuffer = await this.compileMindARMarkerWithLibrary(imageBuffer);

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
      await cleanupTempDir().catch(e => this.logger.error(`Error cleaning up temp directory: ${e.message}`));
    }
  }

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
