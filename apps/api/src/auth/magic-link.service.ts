import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThan, LessThan } from "typeorm";
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
        usedAt: undefined,
      },
      { usedAt: new Date() }
    );

    // Generate new 6-digit code
    const code = this.generateCode();

    // Create verification code record
    const verificationCode = this.verificationCodeRepository.create({
      email: normalizedEmail,
      code,
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
        usedAt: undefined,
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

    // Increment attempts
    verificationCode.attempts += 1;
    await this.verificationCodeRepository.save(verificationCode);

    // Verify code
    if (verificationCode.code !== code) {
      const attemptsLeft = this.maxAttempts - verificationCode.attempts;
      throw new UnauthorizedException(
        `Invalid code. ${attemptsLeft} attempt(s) remaining.`
      );
    }

    // Mark as used
    verificationCode.usedAt = new Date();
    await this.verificationCodeRepository.save(verificationCode);

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
    await this.userRepository.save(user);

    // Generate token
    const accessToken = this.authService.generateToken(user);

    return {
      accessToken,
      refreshToken: "", // Magic link doesn't use refresh tokens
      expiresIn: 86400, // 24 hours default
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        mustChangePassword: user.mustChangePassword,
      },
    };
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
      const organization = await this.organizationRepository.findOne({
        where: { email },
        relations: ["cohort"],
      });

      if (!organization) {
        return { hasAccess: true }; // Let other validation handle missing org
      }

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

      if (!mentor) {
        return { hasAccess: true }; // Let other validation handle missing mentor
      }

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
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
