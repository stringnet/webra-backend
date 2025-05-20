// src/markers/markers.service.ts
import { Injectable, NotFoundException, InternalServerErrorException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Marker, MarkerProcessingStatus } from './entities/marker.entity';
import { CreateMarkerDto } from './dto/create-marker.dto';
import { UpdateMarkerDto } from './dto/update-marker.dto';
// Rutas corregidas: ../ en lugar de ../../
import { StorageService } from '../storage/storage.service';
import { User } from '../users/entities/user.entity';
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

      // --- LÓGICA DE PROCESAMIENTO DEL MARCADOR (SIMULADA) ---
      this.logger.log(`Simulating marker processing for ID: ${markerId}. Implement actual logic here.`);
      // Aquí iría la lógica real para descargar la imagen de Cloudinary,
      // ejecutar la herramienta de compilación del marcador (MindAR, AR.js NFT, etc.),
      // y luego subir el archivo procesado a Cloudinary.

      // Simulación:
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simula trabajo

      marker.processedMarkerCloudinaryPublicId = `processed_marker_originals/simulated_${markerId}`; // Ejemplo
      marker.processedMarkerUrl = `https://res.cloudinary.com/your_cloud_name/raw/upload/v12345/processed_marker_originals/simulated_${markerId}.mind`; // Ejemplo
      marker.status = MarkerProcessingStatus.PROCESSED;
      marker.processingError = null;
      marker.recommendations = "Marcador procesado (simulado). Implementar lógica real.";
      // --- FIN DE LA LÓGICA DE PROCESAMIENTO (SIMULADA) ---

      await this.markersRepository.save(marker);
      this.logger.log(`Successfully processed marker ID: ${markerId}`);

    } catch (error) {
      this.logger.error(`Failed to process marker ID ${markerId}: ${error.message}`, error.stack);
      if (marker) { // Asegurarse que marker existe antes de intentar guardarlo
        marker.status = MarkerProcessingStatus.FAILED;
        marker.processingError = error.message.substring(0, 250);
        await this.markersRepository.save(marker);
      }
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
