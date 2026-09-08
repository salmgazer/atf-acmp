import { Injectable, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { User, Role } from "../../database/entities/user.entity";
import { CreateInitialAdminDto } from "./dto/setup.dto";

@Injectable()
export class SetupService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Check if initial setup is complete (at least one super_admin exists)
   */
  async isSetupComplete(): Promise<boolean> {
    const superAdminCount = await this.userRepository.count({
      where: { role: Role.SUPER_ADMIN },
    });
    return superAdminCount > 0;
  }

  /**
   * Create the initial super admin user
   * Only works if no super admin exists yet
   */
  async createInitialAdmin(dto: CreateInitialAdminDto): Promise<User> {
    // Check if setup is already complete
    const setupComplete = await this.isSetupComplete();
    if (setupComplete) {
      throw new ConflictException(
        "Setup is already complete. Initial admin already exists.",
      );
    }

    // Check if email already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (existingUser) {
      throw new ConflictException("A user with this email already exists.");
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Create super admin user
    const user = this.userRepository.create({
      email: dto.email.toLowerCase(),
      role: Role.SUPER_ADMIN,
      firstName: dto.firstName,
      lastName: dto.lastName,
      passwordHash,
      isActive: true,
      mustChangePassword: false,
    });

    return this.userRepository.save(user);
  }
}
