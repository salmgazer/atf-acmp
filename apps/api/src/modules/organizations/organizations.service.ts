import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, ILike, In } from "typeorm";
import {
  Organization,
  OrganizationStatus,
  OrganizationUser,
  OrganizationUserRole,
} from "@/database/entities/organization.entity";
import { User, Role } from "@/database/entities/user.entity";
import { Vertical } from "@/database/entities/vertical.entity";
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  ApproveOrganizationDto,
  RejectOrganizationDto,
  OrganizationQueryDto,
  PaginatedOrganizationsDto,
  BulkImportOrganizationsDto,
  BulkImportResultDto,
  ImportResultDto,
  BulkInviteResultDto,
  InviteResultDto,
} from "./dto/organization.dto";
import { EmailService } from "@/email/email.service";

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(OrganizationUser)
    private readonly orgUserRepository: Repository<OrganizationUser>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Vertical)
    private readonly verticalRepository: Repository<Vertical>,
    private readonly emailService: EmailService
  ) {}

  async create(dto: CreateOrganizationDto): Promise<Organization> {
    // Check for existing email
    const existing = await this.organizationRepository.findOne({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException("Organization with this email already exists");
    }

    const organization = this.organizationRepository.create({
      ...dto,
      status: OrganizationStatus.PENDING,
    });

    return this.organizationRepository.save(organization);
  }

  async findAll(query: OrganizationQueryDto): Promise<PaginatedOrganizationsDto> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.country) {
      where.country = query.country;
    }

    if (query.cohortId) {
      where.cohortId = query.cohortId;
    }

    if (query.search) {
      where.name = ILike(`%${query.search}%`);
    }

    const [data, total] = await this.organizationRepository.findAndCount({
      where,
      order: { createdAt: "DESC" },
      skip,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Organization> {
    const organization = await this.organizationRepository.findOne({
      where: { id },
      relations: ["users"],
    });

    if (!organization) {
      throw new NotFoundException("Organization not found");
    }

    return organization;
  }

  async findByEmail(email: string): Promise<Organization | null> {
    return this.organizationRepository.findOne({
      where: { email },
      relations: ["cohort"],
    });
  }

  async getVerticalsForOrganization(email: string): Promise<Vertical[]> {
    const organization = await this.organizationRepository.findOne({
      where: { email },
      relations: ["cohort"],
    });

    if (!organization) {
      throw new NotFoundException("Organization not found");
    }

    if (!organization.cohortId) {
      throw new NotFoundException("Organization does not have a cohort assigned");
    }

    return this.verticalRepository.find({
      where: { cohortId: organization.cohortId, isActive: true },
      order: { displayOrder: "ASC" },
    });
  }

  async update(id: string, dto: UpdateOrganizationDto): Promise<Organization> {
    const organization = await this.findOne(id);

    Object.assign(organization, dto);

    const saved = await this.organizationRepository.save(organization);

    // If organization is approved, ensure it has a User record
    if (organization.status === OrganizationStatus.APPROVED) {
      await this.ensureUserExists(organization);
    }

    return saved;
  }

  /**
   * Ensure a User record exists for an approved organization
   */
  private async ensureUserExists(organization: Organization): Promise<void> {
    const existingUser = await this.userRepository.findOne({
      where: { email: organization.email },
    });

    if (!existingUser) {
      const user = this.userRepository.create({
        email: organization.email,
        role: Role.ORGANIZATION,
        firstName: organization.contactPerson || organization.name,
        isActive: true,
      });
      await this.userRepository.save(user);
      this.logger.log(`Created User record for organization: ${organization.email}`);
    }
  }

  async approve(id: string, dto: ApproveOrganizationDto): Promise<Organization> {
    const organization = await this.findOne(id);

    if (organization.status !== OrganizationStatus.PENDING) {
      throw new BadRequestException(
        `Cannot approve organization with status: ${organization.status}`
      );
    }

    // Create a User record for the organization if it doesn't exist
    await this.ensureUserExists(organization);

    organization.status = OrganizationStatus.APPROVED;
    organization.approvedAt = new Date();
    organization.approvedBy = dto.approvedBy;
    organization.rejectionReason = undefined;

    return this.organizationRepository.save(organization);
  }

  async reject(id: string, dto: RejectOrganizationDto): Promise<Organization> {
    const organization = await this.findOne(id);

    if (organization.status !== OrganizationStatus.PENDING) {
      throw new BadRequestException(
        `Cannot reject organization with status: ${organization.status}`
      );
    }

    organization.status = OrganizationStatus.REJECTED;
    organization.rejectionReason = dto.reason;

    return this.organizationRepository.save(organization);
  }

  async deactivate(id: string): Promise<Organization> {
    const organization = await this.findOne(id);
    organization.isActive = false;
    return this.organizationRepository.save(organization);
  }

  async activate(id: string): Promise<Organization> {
    const organization = await this.findOne(id);
    organization.isActive = true;
    return this.organizationRepository.save(organization);
  }

  async updateLogo(id: string, logoUrl: string): Promise<Organization> {
    const organization = await this.findOne(id);
    organization.logoUrl = logoUrl;
    return this.organizationRepository.save(organization);
  }

  async addUser(
    organizationId: string,
    userId: string,
    role: OrganizationUserRole = OrganizationUserRole.MEMBER,
    isPrimary: boolean = false
  ): Promise<OrganizationUser> {
    const existing = await this.orgUserRepository.findOne({
      where: { organizationId, userId },
    });

    if (existing) {
      throw new ConflictException("User is already a member of this organization");
    }

    const orgUser = this.orgUserRepository.create({
      organizationId,
      userId,
      role,
      isPrimary,
    });

    return this.orgUserRepository.save(orgUser);
  }

  async removeUser(organizationId: string, userId: string): Promise<void> {
    const orgUser = await this.orgUserRepository.findOne({
      where: { organizationId, userId },
    });

    if (!orgUser) {
      throw new NotFoundException("User not found in organization");
    }

    if (orgUser.isPrimary) {
      throw new BadRequestException("Cannot remove primary user from organization");
    }

    await this.orgUserRepository.remove(orgUser);
  }

  async getOrganizationUsers(organizationId: string): Promise<OrganizationUser[]> {
    return this.orgUserRepository.find({
      where: { organizationId },
    });
  }

  async getUserOrganizations(userId: string): Promise<Organization[]> {
    const orgUsers = await this.orgUserRepository.find({
      where: { userId },
      relations: ["organization"],
    });

    return orgUsers.map((ou) => ou.organization);
  }

  async getStatistics(): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  }> {
    const [total, pending, approved, rejected] = await Promise.all([
      this.organizationRepository.count(),
      this.organizationRepository.count({ where: { status: OrganizationStatus.PENDING } }),
      this.organizationRepository.count({ where: { status: OrganizationStatus.APPROVED } }),
      this.organizationRepository.count({ where: { status: OrganizationStatus.REJECTED } }),
    ]);

    return { total, pending, approved, rejected };
  }

  // ============ Bulk Import ============

  async bulkImport(dto: BulkImportOrganizationsDto): Promise<BulkImportResultDto> {
    const results: ImportResultDto[] = [];

    for (const orgRow of dto.organizations) {
      try {
        // Check for existing email
        const existing = await this.organizationRepository.findOne({
          where: { email: orgRow.email },
        });

        if (existing) {
          results.push({
            success: false,
            email: orgRow.email,
            name: orgRow.name,
            error: "Organization with this email already exists",
            organizationId: existing.id,
          });
          continue;
        }

        // Create the organization
        const organization = this.organizationRepository.create({
          name: orgRow.name,
          email: orgRow.email,
          contactPerson: orgRow.contactPerson,
          contactPhone: orgRow.contactPhone,
          country: orgRow.country,
          industry: orgRow.industry,
          website: orgRow.website,
          status: OrganizationStatus.PENDING,
        });

        const saved = await this.organizationRepository.save(organization);

        results.push({
          success: true,
          email: orgRow.email,
          name: orgRow.name,
          organizationId: saved.id,
        });
      } catch (error) {
        results.push({
          success: false,
          email: orgRow.email,
          name: orgRow.name,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return {
      totalProcessed: results.length,
      successCount,
      failureCount: results.length - successCount,
      results,
    };
  }

  // ============ Invite Emails ============

  async sendInvite(
    organizationId: string,
    customMessage?: string
  ): Promise<InviteResultDto> {
    const organization = await this.findOne(organizationId);

    const success = await this.emailService.sendOrganizationInvite(
      organization.name,
      organization.email,
      customMessage
    );

    return {
      organizationId,
      email: organization.email,
      success,
      error: success ? undefined : "Failed to send email",
    };
  }

  async bulkSendInvites(
    organizationIds: string[],
    customMessage?: string
  ): Promise<BulkInviteResultDto> {
    const organizations = await this.organizationRepository.find({
      where: { id: In(organizationIds) },
    });

    const results: InviteResultDto[] = [];

    for (const org of organizations) {
      const success = await this.emailService.sendOrganizationInvite(
        org.name,
        org.email,
        customMessage
      );

      results.push({
        organizationId: org.id,
        email: org.email,
        success,
        error: success ? undefined : "Failed to send email",
      });
    }

    // Add results for any IDs not found
    const foundIds = new Set(organizations.map((o) => o.id));
    for (const id of organizationIds) {
      if (!foundIds.has(id)) {
        results.push({
          organizationId: id,
          email: "",
          success: false,
          error: "Organization not found",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return {
      totalProcessed: results.length,
      successCount,
      failureCount: results.length - successCount,
      results,
    };
  }
}
