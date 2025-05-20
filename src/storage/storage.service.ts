// src/storage/storage.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { UploadApiErrorResponse, UploadApiResponse, v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier'; // npm i streamifier @types/streamifier

export type CloudinaryUploadResponse = UploadApiResponse | UploadApiErrorResponse;

@Injectable()
export class StorageService {
  async uploadFile(
    file: Express.Multer.File,
    folder?: string,
    resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto',
  ): Promise<UploadApiResponse> {
    return new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          resource_type: resourceType,
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary Upload Error:', error);
            return reject(new InternalServerErrorException('Failed to upload file to Cloudinary'));
          }
          if (!result) { // Manejo explícito si result es undefined
            console.error('Cloudinary Upload Error: No result returned.');
            return reject(new InternalServerErrorException('Cloudinary did not return a result.'));
          }
          resolve(result);
        },
      );
      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  async deleteFile(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image'): Promise<any> {
    try {
      return await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    } catch (error) {
      console.error('Cloudinary Delete Error:', error);
      throw new InternalServerErrorException('Failed to delete file from Cloudinary');
    }
  }

  // Podrías añadir métodos para obtener URLs con transformaciones aquí
}
