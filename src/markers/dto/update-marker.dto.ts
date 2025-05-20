    // src/markers/dto/update-marker.dto.ts
    import { IsString, IsOptional, MaxLength } from 'class-validator';

    export class UpdateMarkerDto {
      @IsOptional()
      @IsString()
      @MaxLength(100)
      name?: string;

      // Otros campos que puedan ser actualizables.
      // El estado y las URLs de Cloudinary se actualizarán internamente por el servicio.
    }
