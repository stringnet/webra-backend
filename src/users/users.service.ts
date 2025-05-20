// src/users/users.service.ts
import { Injectable, ConflictException, NotFoundException, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm'; // IMPORTADO
import { Repository } from 'typeorm'; // IMPORTADO
import { User, UserRole } from './entities/user.entity'; // IMPORTADO (User y UserRole)
import * as bcrypt from 'bcrypt'; // IMPORTADO
import { CreateUserDto } from './dto/create-user.dto'; // IMPORTADO
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private configService: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    await this.createInitialSuperAdmin();
  }

  private async createInitialSuperAdmin() {
    const superAdminUsername = this.configService.get<string>('INITIAL_SUPERADMIN_USERNAME');
    // Asegúrate que findByUsername esté definido ANTES de esta llamada o que sea público
    const existingSuperAdmin = await this.findByUsername(superAdminUsername);

    if (!existingSuperAdmin) {
      const superAdminPassword = this.configService.get<string>('INITIAL_SUPERADMIN_PASSWORD');
      const superAdminEmail = this.configService.get<string>('INITIAL_SUPERADMIN_EMAIL');

      const createUserDto: CreateUserDto = {
        username: superAdminUsername,
        email: superAdminEmail,
        password: superAdminPassword,
        role: UserRole.SUPERADMIN,
      };

      try {
        const admin = await this.create(createUserDto);
        this.logger.log(`Initial superadmin "${admin.username}" created successfully.`);
      } catch (error) {
        if (error instanceof ConflictException) {
          this.logger.warn(`Initial superadmin "${superAdminUsername}" already exists or conflicts.`);
        } else {
          this.logger.error('Failed to create initial superadmin', error.stack);
        }
      }
    } else {
      this.logger.log(`Initial superadmin "${superAdminUsername}" already exists. Skipping creation.`);
    }
  }

  async findByUsername(username: string): Promise<User | undefined> {
    return this.usersRepository.findOne({ where: { username } });
  }

  async findById(id: string): Promise<User | undefined> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const { username, email, password, role } = createUserDto;

    const queryBuilder = this.usersRepository.createQueryBuilder("user");
    queryBuilder.where("user.username = :username", { username });
    if (email) {
        queryBuilder.orWhere("user.email = :email", { email });
    }
    const existingUser = await queryBuilder.getOne();

    if (existingUser) {
      throw new ConflictException(`User with username '${username}' or email '${email}' already exists.`);
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = this.usersRepository.create({
      username,
      email,
      passwordHash: hashedPassword,
      role: role || UserRole.EDITOR,
    });

    const savedUser = await this.usersRepository.save(user);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } = savedUser; // No devolver el hash
    return result as User; // Asegurarse de que el tipo devuelto coincida
  }

  // Puedes añadir otros métodos aquí, como:
  // async findAll(): Promise<User[]> {
  //   return this.usersRepository.find();
  // }

  // async update(id: string, updateUserDto: Partial<CreateUserDto>): Promise<User | null> {
  //   // Lógica para actualizar...
  //   return this.findById(id);
  // }

  // async remove(id: string): Promise<void> {
  //   await this.usersRepository.delete(id);
  // }
}
