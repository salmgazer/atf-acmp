import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, Like, ILike } from "typeorm";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { User, Role } from "../../database/entities/user.entity";
import { 
  CreateStaffDto, 
  UpdateStaffDto, 
  StaffQueryDto, 
  StaffResponseDto,
  STAFF_ROLES,
  StaffRole,
} from "./dto/staff.dto";
import { EmailService } from "../../email/email.service";

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create(data);
    return this.userRepository.save(user);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    await this.userRepository.update(id, data);
    return this.findById(id);
  }

  // ============ Staff Management ============

  /**
   * Get all staff members (users with staff roles)
   */
  async findAllStaff(query: StaffQueryDto): Promise<StaffResponseDto[]> {
    const qb = this.userRepository
      .createQueryBuilder("user")
      .where("user.role IN (:...roles)", { roles: STAFF_ROLES })
      .andWhere("user.deletedAt IS NULL")
      .orderBy("user.createdAt", "DESC");

    if (query.role) {
      qb.andWhere("user.role = :role", { role: query.role });
    }

    if (query.search) {
      qb.andWhere(
        "(LOWER(user.email) LIKE LOWER(:search) OR LOWER(user.firstName) LIKE LOWER(:search) OR LOWER(user.lastName) LIKE LOWER(:search))",
        { search: `%${query.search}%` }
      );
    }

    if (query.isActive !== undefined) {
      qb.andWhere("user.isActive = :isActive", { isActive: query.isActive });
    }

    const users = await qb.getMany();

    return users.map(this.toStaffResponse);
  }

  /**
   * Get IDs of active staff members who can review briefs
   * Used for sending notifications about new brief submissions
   */
  async getActiveReviewerIds(): Promise<string[]> {
    const reviewerRoles = [Role.SUPER_ADMIN, Role.PROGRAM_MANAGER, Role.EVALUATOR];
    
    const users = await this.userRepository.find({
      where: {
        role: In(reviewerRoles),
        isActive: true,
      },
      select: ["id"],
    });

    return users.map(u => u.id);
  }

  /**
   * Get a staff member by ID
   */
  async findStaffById(id: string): Promise<StaffResponseDto> {
    const user = await this.userRepository.findOne({
      where: { 
        id,
        role: In(STAFF_ROLES as unknown as Role[]),
      },
    });

    if (!user) {
      throw new NotFoundException("Staff member not found");
    }

    return this.toStaffResponse(user);
  }

  /**
   * Create a new staff member
   */
  async createStaff(dto: CreateStaffDto): Promise<StaffResponseDto> {
    // Check if email already exists
    const existing = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException("A user with this email already exists");
    }

    // Validate role is a staff role
    if (!STAFF_ROLES.includes(dto.role as any)) {
      throw new BadRequestException("Invalid staff role");
    }

    // Generate a secure temporary password
    const temporaryPassword = this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const user = this.userRepository.create({
      email: dto.email.toLowerCase(),
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role as Role,
      passwordHash: hashedPassword,
      isActive: true,
      mustChangePassword: true,
    });

    const saved = await this.userRepository.save(user);

    // Send welcome email with temporary password
    const frontendUrl = this.configService.get<string>("FRONTEND_URL", "http://localhost:3000");
    const portalUrl = `${frontendUrl}/portal/login`;

    try {
      await this.emailService.sendWelcomeEmail({
        to: saved.email,
        firstName: saved.firstName,
        temporaryPassword,
        portalUrl,
      });
      this.logger.log(`Welcome email sent to new staff member: ${saved.email}`);
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${saved.email}`, error);
      // Don't fail the creation if email fails - admin can resend
    }

    return this.toStaffResponse(saved);
  }

  /**
   * Generate a secure temporary password
   */
  private generateTemporaryPassword(): string {
    // Generate a 12-character password with mix of characters
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    const specialChars = "!@#$%&*";
    
    let password = "";
    
    // Get 10 random alphanumeric characters
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Add 2 special characters
    for (let i = 0; i < 2; i++) {
      password += specialChars.charAt(Math.floor(Math.random() * specialChars.length));
    }
    
    // Shuffle the password
    return password.split("").sort(() => Math.random() - 0.5).join("");
  }

  /**
   * Update a staff member
   */
  async updateStaff(id: string, dto: UpdateStaffDto): Promise<StaffResponseDto> {
    const user = await this.userRepository.findOne({
      where: { 
        id,
        role: In(STAFF_ROLES as unknown as Role[]),
      },
    });

    if (!user) {
      throw new NotFoundException("Staff member not found");
    }

    // Validate role if provided
    if (dto.role && !STAFF_ROLES.includes(dto.role as any)) {
      throw new BadRequestException("Invalid staff role");
    }

    // Update fields
    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.role !== undefined) user.role = dto.role as Role;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;

    const saved = await this.userRepository.save(user);
    return this.toStaffResponse(saved);
  }

  /**
   * Deactivate a staff member (revoke access)
   */
  async deactivateStaff(id: string): Promise<StaffResponseDto> {
    return this.updateStaff(id, { isActive: false });
  }

  /**
   * Reactivate a staff member
   */
  async activateStaff(id: string): Promise<StaffResponseDto> {
    return this.updateStaff(id, { isActive: true });
  }

  /**
   * Resend invitation email with a new temporary password
   */
  async resendStaffInvite(id: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { 
        id,
        role: In(STAFF_ROLES as unknown as Role[]),
      },
    });

    if (!user) {
      throw new NotFoundException("Staff member not found");
    }

    // Generate a new temporary password
    const temporaryPassword = this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    // Update password and ensure mustChangePassword is set
    user.passwordHash = hashedPassword;
    user.mustChangePassword = true;
    await this.userRepository.save(user);

    // Send welcome email with new temporary password
    const frontendUrl = this.configService.get<string>("FRONTEND_URL", "http://localhost:3000");
    const portalUrl = `${frontendUrl}/portal/login`;

    await this.emailService.sendWelcomeEmail({
      to: user.email,
      firstName: user.firstName,
      temporaryPassword,
      portalUrl,
    });

    this.logger.log(`Invitation email resent to staff member: ${user.email}`);
  }

  /**
   * Delete a staff member (soft delete)
   */
  async deleteStaff(id: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { 
        id,
        role: In(STAFF_ROLES as unknown as Role[]),
      },
    });

    if (!user) {
      throw new NotFoundException("Staff member not found");
    }

    // Prevent deleting super admin if they're the only one
    if (user.role === Role.SUPER_ADMIN) {
      const superAdminCount = await this.userRepository.count({
        where: { 
          role: Role.SUPER_ADMIN,
          isActive: true,
          deletedAt: undefined,
        },
      });

      if (superAdminCount <= 1) {
        throw new BadRequestException("Cannot delete the only super admin");
      }
    }

    await this.userRepository.softDelete(id);
  }

  /**
   * Get staff statistics
   */
  async getStaffStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byRole: Record<string, number>;
  }> {
    const stats = await this.userRepository
      .createQueryBuilder("user")
      .select("user.role", "role")
      .addSelect("user.isActive", "isActive")
      .addSelect("COUNT(*)", "count")
      .where("user.role IN (:...roles)", { roles: STAFF_ROLES })
      .andWhere("user.deletedAt IS NULL")
      .groupBy("user.role")
      .addGroupBy("user.isActive")
      .getRawMany();

    let total = 0;
    let active = 0;
    let inactive = 0;
    const byRole: Record<string, number> = {};

    for (const stat of stats) {
      const count = parseInt(stat.count, 10);
      total += count;
      
      if (stat.isActive) {
        active += count;
      } else {
        inactive += count;
      }

      byRole[stat.role] = (byRole[stat.role] || 0) + count;
    }

    return { total, active, inactive, byRole };
  }

  /**
   * Convert User entity to StaffResponseDto
   */
  private toStaffResponse(user: User): StaffResponseDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      role: user.role as StaffRole,
      isActive: user.isActive,
      avatarUrl: user.avatarUrl,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}
