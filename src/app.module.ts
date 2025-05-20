// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
// Importa tus entidades aquí a medida que las crees, ej:
// import { User } from './users/entities/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DATABASE_HOST'),
        port: parseInt(configService.get<string>('DATABASE_PORT'), 10),
        username: configService.get<string>('DATABASE_USER'),
        password: configService.get<string>('DATABASE_PASSWORD'),
        database: configService.get<string>('DATABASE_NAME'),
        // entities: [User], // Lista de todas tus entidades
        entities: [__dirname + '/../**/*.entity{.ts,.js}'], // Alternativa para cargar entidades automáticamente
        synchronize: configService.get<string>('NODE_ENV') !== 'production', // true en dev, false en prod
        autoLoadEntities: true, // Recomendado
      }),
    }),
    // ... otros módulos
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
