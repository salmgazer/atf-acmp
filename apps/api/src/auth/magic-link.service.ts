import { randomInt, createHash, timingSafeEqual } from "crypto";
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThan, LessThan, IsNull } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { User, Role } from "../database/entities/user.entity";
import {
  VerificationCode,
  VerificationCodeType,
} from "../database/entities/verification-code.entity";
import { Organization } from "../database/entities/organization.entity";
import { Mentor } from "../database/entities/mentor.entity";
import { Cohort, CohortStatus } from "../database/entities/cohort.entity";
import { AuthService } from "./auth.service";
import { AuthResponseDto, PortalType } from "./dto/auth.dto";
import { EmailService } from "../email/email.service";

@Injectable()
export class MagicLinkService {
  private readonly logger = new Logger(MagicLinkService.name);
  private readonly codeExpiryMinutes = 15;
  private readonly maxAttempts = 5;
  private readonly rateLimitMinutes = 1;

  /**
   * Blocked cohort statuses - users cannot login if their cohort is in these statuses
   */
  private readonly blockedCohortStatuses = [CohortStatus.DRAFT, CohortStatus.ARCHIVED];

  constructor(
    @InjectRepository(VerificationCode)
    private readonly verificationCodeRepository: Repository<VerificationCode>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(Mentor)
    private readonly mentorRepository: Repository<Mentor>,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService
  ) {}

  async sendMagicCode(email: string, portal: PortalType): Promise<void> {
    const normalizedEmail = email.toLowerCase();

    // Find user by email
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // Don't reveal if user exists - still "send" the email
      this.logger.warn(`Magic link requested for non-existent email: ${normalizedEmail}`);
      return;
    }

    // Validate user can access this portal
    if (!this.authService.canAccessPortal(user.role, portal)) {
      this.logger.warn(`User ${user.id} attempted magic link for unauthorized portal: ${portal}`);
      return;
    }

    if (!user.isActive) {
      this.logger.warn(`Magic link requested for inactive user: ${normalizedEmail}`);
      return;
    }

    // Check cohort status for organization and mentor portals
    const cohortCheck = await this.checkUserCohortAccess(normalizedEmail, portal);
    if (!cohortCheck.hasAccess) {
      this.logger.warn(`Magic link blocked for ${normalizedEmail}: ${cohortCheck.reason}`);
      // Don't reveal cohort status during code request - silently fail
      return;
    }

    // Check rate limiting - no new codes within rateLimitMinutes
    const recentCode = await this.verificationCodeRepository.findOne({
      where: {
        email: normalizedEmail,
        type: VerificationCodeType.MAGIC_LINK,
        createdAt: MoreThan(new Date(Date.now() - this.rateLimitMinutes * 60 * 1000)),
      },
      order: { createdAt: "DESC" },
    });

    if (recentCode) {
      throw new BadRequestException(
        `Please wait ${this.rateLimitMinutes} minute(s) before requesting a new code`
      );
    }

    // Invalidate any existing unused codes
    await this.verificationCodeRepository.update(
      {
        email: normalizedEmail,
        type: VerificationCodeType.MAGIC_LINK,
        usedAt: IsNull(),
      },
      { usedAt: new Date() }
    );

    // Generate new 6-digit code
    const code = this.generateCode();

    // Create verification code record
    const verificationCode = this.verificationCodeRepository.create({
      email: normalizedEmail,
      code: createHash("sha256").update(code).digest("hex"),
      type: VerificationCodeType.MAGIC_LINK,
      portal,
      userId: user.id,
      expiresAt: new Date(Date.now() + this.codeExpiryMinutes * 60 * 1000),
    });

    await this.verificationCodeRepository.save(verificationCode);

    // Send email
    await this.emailService.sendMagicLinkCode({
      to: normalizedEmail,
      code,
      firstName: user.firstName,
      expiryMinutes: this.codeExpiryMinutes,
    });

    this.logger.log(`Magic link code sent to ${normalizedEmail} for ${portal} portal`);
  }

  async verifyCode(email: string, code: string): Promise<AuthResponseDto> {
    const normalizedEmail = email.toLowerCase();

    // Find the most recent valid code
    const verificationCode = await this.verificationCodeRepository.findOne({
      where: {
        email: normalizedEmail,
        type: VerificationCodeType.MAGIC_LINK,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: "DESC" },
      relations: ["user"],
    });

    if (!verificationCode) {
      throw new UnauthorizedException("Invalid or expired code");
    }

    // Check max attempts
    if (verificationCode.attempts >= this.maxAttempts) {
      throw new UnauthorizedException("Too many attempts. Please request a new code.");
    }

    const digest = createHash("sha256").update(code).digest("hex");
    const matches = verificationCode.code.length === digest.length && timingSafeEqual(Buffer.from(verificationCode.code), Buffer.from(digest));
    const consumed = await this.verificationCodeRepository.createQueryBuilder()
      .update()
      .set({ attempts: () => '"attempts" + 1', ...(matches ? { usedAt: new Date() } : {}) })
      .where({ id: verificationCode.id, usedAt: IsNull(), expiresAt: MoreThan(new Date()), attempts: LessThan(this.maxAttempts) })
      .execute();
    if (consumed.affected !== 1 || !matches) throw new UnauthorizedException("Invalid or expired code");

    // Get user
    const user = verificationCode.user || await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    if (!user.isActive) {
      throw new UnauthorizedException("Account is deactivated");
    }
    if (user.role === Role.MENTOR && user.email.toLowerCase() !== normalizedEmail) throw new UnauthorizedException("Invalid or expired code");

    // Check cohort status for organization and mentor portals
    const portal = verificationCode.portal as PortalType | undefined;
    if (portal && portal !== PortalType.STAFF) {
      const cohortCheck = await this.checkUserCohortAccess(normalizedEmail, portal);
      if (!cohortCheck.hasAccess) {
        throw new UnauthorizedException(
          "COHORT_NOT_ACCESSIBLE: Your cohort is no longer accessible. Please contact support if you need assistance."
        );
      }
    }

    // Update last login
    user.lastLoginAt = new Date();
    if (user.role === Role.MENTOR) {
      const updated = await this.userRepository.update({ id: user.id, email: normalizedEmail }, { lastLoginAt: user.lastLoginAt });
      if (updated.affected !== 1) throw new UnauthorizedException("Your mentor account changed. Please request a new code");
    } else await this.userRepository.save(user);

    return this.authService.generateTokens(user);
  }

  async cleanupExpiredCodes(): Promise<number> {
    const result = await this.verificationCodeRepository.delete({
      expiresAt: LessThan(new Date(Date.now() - 24 * 60 * 60 * 1000)), // 24 hours old
    });
    return result.affected || 0;
  }

  /**
   * Check if user has access based on their cohort status
   */
  private async checkUserCohortAccess(
    email: string,
    portal: PortalType
  ): Promise<{ hasAccess: boolean; reason?: string }> {
    if (portal === PortalType.ORGANIZATION) {
      const account = await this.userRepository.findOne({ where: { email } });
      const link = account ? await this.userRepository.manager.getRepository("OrganizationUser").findOne({ where: { userId: account.id } }) : null;
      const organization = await this.organizationRepository.findOne({
        where: link ? { id: link.organizationId } : { email },
        relations: ["cohort"],
      });

      if (!organization || !organization.isActive || organization.status !== "approved") return { hasAccess: false, reason: "Organization is not approved and active" };

      if (organization.cohort && this.blockedCohortStatuses.includes(organization.cohort.status)) {
        return {
          hasAccess: false,
          reason: `Organization cohort is ${organization.cohort.status}`,
        };
      }
    }

    if (portal === PortalType.MENTOR) {
      const mentor = await this.mentorRepository.findOne({
        where: { email },
        relations: ["cohort"],
      });

      if (!mentor || mentor.status === "inactive") return { hasAccess: false, reason: "Mentor is not active" };

      if (mentor.cohort && this.blockedCohortStatuses.includes(mentor.cohort.status)) {
        return {
          hasAccess: false,
          reason: `Mentor cohort is ${mentor.cohort.status}`,
        };
      }
    }

    return { hasAccess: true };
  }

  private generateCode(): string {
    return randomInt(100000, 1000000).toString();
  }
}
