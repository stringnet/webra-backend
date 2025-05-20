    // src/markers/dto/create-marker.dto.ts
    import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';

    export class CreateMarkerDto {
      @IsString()
      @IsNotEmpty()
      @MaxLength(100)
      name: string;

      // La imagen se manejará a través de la subida de archivos (Multer), no directamente en el DTO.
      // El userId se obtendrá del usuario autenticado.
    }
