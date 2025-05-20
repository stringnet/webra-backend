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
private usersService: UsersService, // Para validar que el usuario aún existe o no está bloqueado
) {
super({
jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
ignoreExpiration: false,
secretOrKey: configService.get<string>('JWT_SECRET'),
});
}

  async validate(payload: any) {
    // Aquí puedes añadir lógica adicional, como verificar si el usuario existe en la BD
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    // Lo que devuelvas aquí se adjuntará a request.user en las rutas protegidas
    return { userId: payload.sub, username: payload.username, role: payload.role, email: payload.email };
  }
}
```
