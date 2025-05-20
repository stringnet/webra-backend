// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service'; // Ajusta la ruta si es necesario

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const user = await this.usersService.findById(payload.sub); // Asume que findById existe y es público
    if (!user) {
      throw new UnauthorizedException('User not found or token invalid');
    }
    // Lo que devuelvas aquí se adjuntará a request.user en las rutas protegidas
    return { userId: payload.sub, username: payload.username, role: payload.role, email: payload.email };
  }
}
// Asegúrate de que no haya caracteres extraños o template literals sin cerrar al final de este archivo.
// Elimina cualquier ``` o similar que pueda estar aquí por error.
