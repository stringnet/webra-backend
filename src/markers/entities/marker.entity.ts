    // src/markers/entities/marker.entity.ts
    import { User } from '../../users/entities/user.entity'; // Asegúrate que la ruta sea correcta
    import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

    export enum MarkerProcessingStatus {
      UPLOADED = 'uploaded', // Imagen original subida
      PROCESSING = 'processing', // Compilación del marcador en curso
      PROCESSED = 'processed', // Marcador compilado y listo
      FAILED = 'failed', // Falló la compilación
    }

    @Entity('markers')
    export class Marker {
      @PrimaryGeneratedColumn('uuid')
      id: string;

      @Column()
      name: string;

      // Cloudinary info para la imagen original del marcador
      @Column({ nullable: true })
      originalImageCloudinaryPublicId?: string;

      @Column({ nullable: true })
      originalImageUrl?: string;

      // Cloudinary info para el archivo de marcador procesado (ej. .mind, descriptores NFT)
      @Column({ nullable: true })
      processedMarkerCloudinaryPublicId?: string;

      @Column({ nullable: true })
      processedMarkerUrl?: string;

      @Column({
        type: 'enum',
        enum: MarkerProcessingStatus,
        default: MarkerProcessingStatus.UPLOADED,
      })
      status: MarkerProcessingStatus;

      @Column({ type: 'text', nullable: true })
      recommendations?: string; // Recomendaciones para mejorar el marcador si es necesario

      @Column({ type: 'text', nullable: true })
      processingError?: string; // Mensaje de error si falla el procesamiento

      @CreateDateColumn()
      createdAt: Date;

      @UpdateDateColumn()
      updatedAt: Date;

      @ManyToOne(() => User, { eager: false }) // No cargar el usuario por defecto en cada consulta de marcador
      @JoinColumn({ name: 'userId' }) // Especifica el nombre de la columna para la clave foránea
      user: User;

      @Column() // Columna para almacenar el ID del usuario
      userId: string;
    }
