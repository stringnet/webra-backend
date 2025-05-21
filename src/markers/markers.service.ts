// src/markers/markers.service.ts
import { Injectable, NotFoundException, InternalServerErrorException, Logger, BadRequestException, OnModuleInit } from '@nestjs/common'; // Importar OnModuleInit
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Marker, MarkerProcessingStatus } from './entities/marker.entity';
import { CreateMarkerDto } from './dto/create-marker.dto';
import { UpdateMarkerDto } from './dto/update-marker.dto';
import { StorageService } from '../storage/storage.service';
import { User } from '../users/entities/user.entity';

import axios, { AxiosResponse } from 'axios';
import * as fs from 'fs-extra';
import * as path from 'path';
import { file as tmpFilePromise, dir as tmpDirPromise } from 'tmp-promise';

// Definimos un tipo para la función del compilador
type CompileImageTargetsFunction = (
  imagePaths: string[],
  outputMindPath: string,
  options?: {
    maxTrackingTargets?: number;
    weightScale?: number;
    targetWidth?: number;
    // Añade otras opciones si el compilador las soporta
  }
) => Promise<void>; // Asumimos que devuelve una promesa que se resuelve cuando termina

@Injectable()
export class MarkersService implements OnModuleInit {
  private readonly logger = new Logger(MarkersService.name);
  private mindArCompileFunction: CompileImageTargetsFunction | null = null;

  constructor(
    @InjectRepository(Marker)
    private markersRepository: Repository<Marker>,
    private storageService: StorageService,
  ) {}

  async onModuleInit() {
    try {
      this.logger.log('Attempting to load compileImageTargets from @maherboughdiri/mind-ar-compiler using require()...');
      // Basado en el ejemplo del usuario, intentamos con require() primero
      const MindARCompilerModule = require('@maherboughdiri/mind-ar-compiler');

      if (MindARCompilerModule && typeof MindARCompilerModule.compileImageTargets === 'function') {
        this.mindArCompileFunction = MindARCompilerModule.compileImageTargets;
        this.logger.log('@maherboughdiri/mind-ar-compiler.compileImageTargets loaded successfully using require().');
      } else {
        this.logger.error('Failed to load compileImageTargets function from @maherboughdiri/mind-ar-compiler using require(). Trying dynamic import...');
        // Fallback a importación dinámica si require falla o no encuentra la función
        const DynamicImportModule = await import('@maherboughdiri/mind-ar-compiler') as any; // Usamos 'any' para flexibilidad
        if (DynamicImportModule && typeof DynamicImportModule.compileImageTargets === 'function') {
            this.mindArCompileFunction = DynamicImportModule.compileImageTargets;
            this.logger.log('@maherboughdiri/mind-ar-compiler.compileImageTargets loaded successfully using dynamic import.');
        } else if (DynamicImportModule && DynamicImportModule.default && typeof DynamicImportModule.default.compileImageTargets === 'function') {
            // A veces la función podría estar en el export default si el paquete está mal estructurado para import dinámico
            this.mindArCompileFunction = DynamicImportModule.default.compileImageTargets;
            this.logger.log('@maherboughdiri/mind-ar-compiler.compileImageTargets loaded successfully from default export of dynamic import.');
        }
         else {
          throw new Error('Failed to load compileImageTargets function using both require() and dynamic import.');
        }
      }
    } catch (error) {
      this.logger.error('Failed to load or instantiate @maherboughdiri/mind-ar-compiler', error.stack);
      // this.mindArCompileFunction permanecerá null
    }
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

  private async compileMarkerWithFilePaths(imagePath: string, outputMindFilePath: string): Promise<void> {
    if (!this.mindArCompileFunction) {
      this.logger.error('MindAR compileImageTargets function not initialized. Cannot compile marker.');
      throw new InternalServerErrorException('MindARCompiler function not available.');
    }
    this.logger.log(`Compiling image from path: ${imagePath} to ${outputMindFilePath} using @maherboughdiri/mind-ar-compiler`);
    try {
      const compileOptions = {
        // Opciones que el ejemplo del usuario mostró:
        // maxTrackingTargets: 1,
        // weightScale: 10,
        // targetWidth: 1.0
        // Puedes obtener estos valores de la solicitud si el usuario los puede configurar,
        // o usar valores por defecto. Por ahora, los dejamos comentados (usará los defaults del compilador).
      };
      
      await this.mindArCompileFunction([imagePath], outputMindFilePath, compileOptions);
      this.logger.log(`Image compiled successfully. Output .mind file should be at: ${outputMindFilePath}`);

    } catch (error) {
      this.logger.error(`Error compiling with @maherboughdiri/mind-ar-compiler: ${error.message}`, error.stack);
      throw error;
    }
  }

  async processMarker(markerId: string): Promise<void> {
    if (!this.mindArCompileFunction) {
      this.logger.error(`MindAR compileImageTargets function not initialized for marker ID: ${markerId}. Skipping processing.`);
      const markerToFail = await this.markersRepository.findOneBy({ id: markerId });
      if (markerToFail) {
        markerToFail.status = MarkerProcessingStatus.FAILED;
        markerToFail.processingError = 'MindARCompiler function not available.';
        await this.markersRepository.save(markerToFail);
      }
      return;
    }

    this.logger.log(`Starting REAL processing for marker ID: ${markerId} using @maherboughdiri/mind-ar-compiler (file path method)`);
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

    const { path: tempDirPath, cleanup: cleanupTempDir } = await tmpDirPromise({ unsafeCleanup: true });
    let tempImagePath: string | null = null;
    let tempMindFilePath: string | null = null;
    
    try {
      marker.status = MarkerProcessingStatus.PROCESSING;
      marker.processingError = null;
      await this.markersRepository.save(marker);

      const imageExt = path.extname(new URL(marker.originalImageUrl).pathname) || '.jpg';
      const { path: tempImageFilePathLocal } = await tmpFilePromise({ // No necesitamos cleanup aquí, lo hacemos en finally
        tmpdir: tempDirPath,
        prefix: `markerimg_${markerId}_`,
        postfix: imageExt,
      });
      tempImagePath = tempImageFilePathLocal;

      this.logger.log(`Downloading image from Cloudinary: ${marker.originalImageUrl} to ${tempImagePath}`);
      const imageResponse: AxiosResponse<NodeJS.ReadableStream> = await axios({
        method: 'get',
        url: marker.originalImageUrl,
        responseType: 'stream',
      });
      
      const writer = fs.createWriteStream(tempImagePath);
      imageResponse.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve());
        writer.on('error', (err) => {
            this.logger.error(`Error writing downloaded image to temp file ${tempImagePath}: ${err.message}`);
            reject(err);
        });
      });
      this.logger.log(`Image downloaded successfully to: ${tempImagePath}`);

      const { path: tempOutputMindPathLocal } = await tmpFilePromise({ // No necesitamos cleanup aquí
        tmpdir: tempDirPath,
        prefix: `markermind_${markerId}_`,
        postfix: '.mind',
      });
      tempMindFilePath = tempOutputMindPathLocal;
      
      await this.compileMarkerWithFilePaths(tempImagePath, tempMindFilePath);

      if (!await fs.pathExists(tempMindFilePath) || (await fs.stat(tempMindFilePath)).size === 0) {
          throw new Error('MindAR compiled file (.mind) was not generated by the compiler or is empty.');
      }

      const mindFileBuffer = await fs.readFile(tempMindFilePath);
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
      marker.recommendations = "Marcador procesado con @maherboughdiri/mind-ar-compiler (file path).";

      await this.markersRepository.save(marker);
      this.logger.log(`Successfully processed marker ID: ${markerId} with @maherboughdiri/mind-ar-compiler (file path).`);

    } catch (error) {
      this.logger.error(`Failed to process marker ID ${markerId} with @maherboughdiri/mind-ar-compiler: ${error.message}`, error.stack);
      marker = await this.markersRepository.findOneBy({ id: markerId }); // Re-fetch
      if(marker){
          marker.status = MarkerProcessingStatus.FAILED;
          marker.processingError = error.message.substring(0, 250);
          await this.markersRepository.save(marker);
      }
    } finally {
      if (tempImagePath) await fs.remove(tempImagePath).catch(e => this.logger.error(`Error cleaning up temp image file: ${e.message}`));
      if (tempMindFilePath) await fs.remove(tempMindFilePath).catch(e => this.logger.error(`Error cleaning up temp .mind file: ${e.message}`));
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
