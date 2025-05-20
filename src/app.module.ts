// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module'; // Asegúrate que AuthModule esté importado
import { StorageModule } from './storage/storage.module'; // Asumiendo que tienes este módulo

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
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        synchronize: configService.get<string>('NODE_ENV') !== 'production', // Debería ser false en producción y usar migraciones
        autoLoadEntities: true,
      }),
    }),
    UsersModule,
    AuthModule, // AuthModule DEBE estar listado aquí en el array de imports
    StorageModule, // Si no tienes StorageModule aún, puedes comentarlo o quitarlo temporalmente
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
