// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module'; // Importa UsersModule para acceder a UsersService
import { JwtStrategy } from './strategies/jwt.strategy'; // Estrategia para validar JWT
// import { LocalStrategy } from './strategies/local.strategy'; // Descomenta si implementas una estrategia local para username/password

@Module({
  imports: [
    UsersModule, // Hace que UsersService esté disponible para inyección en AuthService
    PassportModule.register({ defaultStrategy: 'jwt' }), // Configura Passport, 'jwt' como estrategia por defecto
    JwtModule.registerAsync({
      // Configura el módulo JWT de forma asíncrona para poder usar ConfigService
      imports: [ConfigModule], // Importa ConfigModule para acceder a variables de entorno
      inject: [ConfigService], // Inyecta ConfigService para leer la configuración
      useFactory: async (configService: ConfigService) => ({
        // useFactory permite configurar dinámicamente el módulo JWT
        secret: configService.get<string>('JWT_SECRET'), // Lee el secreto JWT desde las variables de entorno
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION_TIME'), // Lee el tiempo de expiración del token
        },
      }),
    }),
  ],
  providers: [
    AuthService, // Servicio que contiene la lógica de autenticación (login, validación)
    JwtStrategy, // Proveedor de la estrategia JWT para que Passport la pueda usar
    // LocalStrategy, // Descomenta si la implementas
  ],
  controllers: [AuthController], // Controlador para los endpoints de autenticación (ej. /auth/login)
  exports: [AuthService, JwtModule], // Exporta AuthService y JwtModule si otros módulos necesitan usarlos directamente
})
export class AuthModule {}
