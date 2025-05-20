    // src/app.module.ts
    import { Module } from '@nestjs/common';
    import { ConfigModule, ConfigService } from '@nestjs/config';
    import { TypeOrmModule } from '@nestjs/typeorm';
    import { AppController } from './app.controller';
    import { AppService } from './app.service';
    import { UsersModule } from './users/users.module';
    import { AuthModule } from './auth/auth.module';
    import { StorageModule } from './storage/storage.module';
    import { MarkersModule } from './markers/markers.module'; // IMPORTA MarkersModule

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
            synchronize: configService.get<string>('NODE_ENV') !== 'production',
            autoLoadEntities: true,
          }),
        }),
        UsersModule,
        AuthModule,
        StorageModule,
        MarkersModule, // AÑADE MarkersModule aquí
      ],
      controllers: [AppController],
      providers: [AppService],
    })
    export class AppModule {}
