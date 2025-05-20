// En src/users/users.service.ts (o un servicio dedicado a la inicialización)
import { Injectable, OnApplicationBootstrap, ConflictException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// ... otras importaciones ...
// User, UserRole, CreateUserDto, InjectRepository, Repository, bcrypt

@Injectable()
export class UsersService implements OnApplicationBootstrap { // Implementa OnApplicationBootstrap
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private configService: ConfigService, // Inyecta ConfigService
  ) {}

  async onApplicationBootstrap() {
    await this.createInitialSuperAdmin();
  }

  private async createInitialSuperAdmin() {
    const superAdminUsername = this.configService.get<string>('INITIAL_SUPERADMIN_USERNAME');
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
        const admin = await this.create(createUserDto); // Usa el método create existente
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

  // ... el resto de tus métodos de UsersService (findByUsername, create, etc.)
  // Asegúrate que el método create maneje la existencia de usuarios:
  async create(createUserDto: CreateUserDto): Promise<User> {
    const { username, email, password, role } = createUserDto;

    // Verifica si ya existe por username o email (si el email se provee)
    const queryBuilder = this.usersRepository.createQueryBuilder("user");
    queryBuilder.where("user.username = :username", { username });
    if (email) {
        queryBuilder.orWhere("user.email = :email", { email });
    }
    const existingUser = await queryBuilder.getOne();

    if (existingUser) {
      // Lanza ConflictException si el usuario ya existe y no es el mismo que se intenta crear (para actualizaciones)
      // Para creación simple, si existe, es un conflicto.
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

    return this.usersRepository.save(user);
  }
}
