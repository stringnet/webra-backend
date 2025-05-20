// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
  import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module'; // Importa UsersModule
import { JwtStrategy } from './strategies/jwt.strategy'; // Crea este archivo después
// import { LocalStrategy } from './strategies/local.strategy'; // Si usas passport-local

@Module({
  imports: [
    UsersModule, // Para acceder a UsersService
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: configService.get<string>('JWT_EXPIRATION_TIME') },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy], // LocalStrategy si la usas
  controllers: [AuthController],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
```
Importa `AuthModule` en `AppModule`.
