// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt'; // IMPORTADO
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  // validateUser ya no es necesario si el login hace la validación directamente
  // async validateUser(username: string, pass: string): Promise<any> {
  //   const user = await this.usersService.findByUsername(username); // Asume que findByUsername existe y es público
  //   if (user && await bcrypt.compare(pass, user.passwordHash)) {
  //     const { passwordHash, ...result } = user;
  //     return result;
  //   }
  //   return null;
  // }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByUsername(loginDto.username); // Asume que findByUsername existe y es público

    if (!user || !(await bcrypt.compare(loginDto.password, user.passwordHash))) {
        throw new UnauthorizedException('Invalid credentials');
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...userDetails } = user;
    const payload = { username: user.username, sub: user.id, role: user.role, email: user.email };
    return {
      access_token: this.jwtService.sign(payload),
      user: userDetails,
    };
  }
}
