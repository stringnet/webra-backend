// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto'; // Crea este DTO

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}
    async validateUser(username: string, pass: string): Promise<any> {
const user = await this.usersService.findByUsername(username);
if (user && await bcrypt.compare(pass, user.passwordHash)) {
const { passwordHash, ...result } = user; // No devolver el hash
return result;
}
return null;
}
  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByUsername(loginDto.username);
    if (!user || !(await bcrypt.compare(loginDto.password, user.passwordHash))) {
        throw new UnauthorizedException('Invalid credentials');
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...userDetails } = user; // No incluir passwordHash en el payload
    const payload = { username: user.username, sub: user.id, role: user.role, email: user.email };
    return {
      access_token: this.jwtService.sign(payload),
      user: userDetails,
    };
  }
}
