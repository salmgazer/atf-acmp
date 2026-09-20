import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { Organization, OrganizationStatus, OrganizationUser, OrganizationUserRole } from "@/database/entities/organization.entity";
import { Brief, BriefStatus } from "@/database/entities/brief.entity";
import { Cohort, CohortStatus } from "@/database/entities/cohort.entity";
import { User, Role } from "@/database/entities/user.entity";
import { BriefScoringService } from "@/modules/briefs/brief-scoring.service";
import { EmailService } from "@/email/email.service";
import {
  PublicSubmissionDto,
  PublicSubmissionResponseDto,
} from "./dto/public-submission.dto";

@Injectable()
export class PublicService {
  private readonly logger = new Logger(PublicService.name);

  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(Brief)
    private readonly briefRepository: Repository<Brief>,
    @InjectRepository(Cohort)
    private readonly cohortRepository: Repository<Cohort>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly briefScoringService: BriefScoringService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Submit organization and briefs from public form
   * - Creates organization with public_submission flag
   * - Creates 1-3 briefs with scoring
   * - Handles duplicate detection via sessionId
   */
  async submitOrganizationBriefs(
    dto: PublicSubmissionDto
  ): Promise<PublicSubmissionResponseDto> {
    // Check for duplicate submission by session ID
    const existingBrief = await this.briefRepository.findOne({
      where: { sessionId: dto.sessionId },
    });

    if (existingBrief) {
      this.logger.log(`Duplicate submission detected for session ${dto.sessionId}`);
      return { success: true, duplicate: true };
    }

    // Validate consent
    if (!dto.consentGiven) {
      throw new BadRequestException("Consent must be given to submit");
    }

    // Find active cohort
    const activeCohort = await this.cohortRepository.findOne({
      where: { status: CohortStatus.ACTIVE },
    });

    if (!activeCohort) {
      throw new BadRequestException("No active cohort available for submissions");
    }

    // Use transaction for atomic operation
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let isNewUser = false;

    try {
      // Check if organization with this email already exists
      let organization = await queryRunner.manager.findOne(Organization, {
        where: { email: dto.org.email },
      });

      // Check if user with this email already exists
      let user = await queryRunner.manager.findOne(User, {
        where: { email: dto.org.email },
      });

      if (organization) {
        // Update existing organization with new submission data
        organization.name = dto.org.orgName;
        organization.country = dto.org.country;
        organization.city = dto.org.city;
        organization.sector = dto.org.sector;
        organization.sectorOther = dto.org.sectorOther;
        organization.submitterName = dto.org.contactName;
        organization.submitterDesignation = dto.org.designation;
        organization.submitterDepartment = dto.org.department;
        organization.contactPerson = dto.org.contactName;
        organization.contactPhone = dto.org.phone;
        organization.publicSubmission = true;
        organization.consentGiven = dto.consentGiven;
        organization.consentTimestamp = new Date();
        organization.cohortId = activeCohort.id;

        organization = await queryRunner.manager.save(Organization, organization);
        this.logger.log(`Updated existing organization ${organization.id} from public form`);
      } else {
        // Create new organization
        organization = queryRunner.manager.create(Organization, {
          name: dto.org.orgName,
          email: dto.org.email,
          country: dto.org.country,
          city: dto.org.city,
          sector: dto.org.sector,
          sectorOther: dto.org.sectorOther,
          submitterName: dto.org.contactName,
          submitterDesignation: dto.org.designation,
          submitterDepartment: dto.org.department,
          contactPerson: dto.org.contactName,
          contactPhone: dto.org.phone,
          status: OrganizationStatus.PENDING,
          publicSubmission: true,
          consentGiven: dto.consentGiven,
          consentTimestamp: new Date(),
          cohortId: activeCohort.id,
        });

        organization = await queryRunner.manager.save(Organization, organization);
        this.logger.log(`Created new organization ${organization.id} from public form`);
      }

      // Create user account if doesn't exist (no password - orgs use magic link)
      if (!user) {
        // Parse contact name into first and last name
        const nameParts = dto.org.contactName.trim().split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        user = queryRunner.manager.create(User, {
          email: dto.org.email,
          role: Role.ORGANIZATION,
          firstName,
          lastName,
          isActive: true,
        });

        user = await queryRunner.manager.save(User, user);
        isNewUser = true;
        this.logger.log(`Created new user ${user.id} for organization contact`);
      }

      // Link user to organization if not already linked
      const existingOrgUser = await queryRunner.manager.findOne(OrganizationUser, {
        where: { organizationId: organization.id, userId: user.id },
      });

      if (!existingOrgUser) {
        const orgUser = queryRunner.manager.create(OrganizationUser, {
          organizationId: organization.id,
          userId: user.id,
          role: OrganizationUserRole.OWNER,
          isPrimary: true,
        });
        await queryRunner.manager.save(OrganizationUser, orgUser);
        this.logger.log(`Linked user ${user.id} to organization ${organization.id}`);
      }

      // Create briefs for each opportunity
      const briefIds: string[] = [];
      const totalOpportunities = dto.opportunities.length;

      for (let i = 0; i < dto.opportunities.length; i++) {
        const opp = dto.opportunities[i];
        const opportunityNumber = i + 1;

        // Calculate scores
        const scores = this.briefScoringService.calculateScores(opp.scoringAnswers);

        const briefData: Partial<Brief> = {
          // Basic fields
          title: opp.title,
          description: opp.description,
          problemStatement: opp.description, // Use description for problem statement
          expectedOutcomes: opp.whatChanges,
          status: BriefStatus.SUBMITTED,
          cohortId: activeCohort.id,
          organizationId: organization.id,

          // Public submission fields
          sessionId: dto.sessionId,
          opportunityNumber,
          whatChanges: opp.whatChanges,
          affectedCount: opp.howMany,
          dataDescription: opp.dataDescription,
          dataAccess: opp.dataAccess,
          secondaryContact: opp.secondaryContact || undefined,
          scoringAnswers: opp.scoringAnswers,

          // Scoring results
          fitScore: scores.fitScore,
          fitBand: scores.fitBand,
          scoreOverride: scores.scoreOverride || undefined,
          depthScore: scores.depthScore || undefined,
          breadthScore: scores.breadthScore || undefined,
          impactScore: scores.impactScore || undefined,
          impactBand: scores.impactBand || undefined,
          priorityScore: scores.priorityScore,
        };

        const brief = queryRunner.manager.create(Brief, briefData);
        const savedBrief = await queryRunner.manager.save(brief);
        briefIds.push(savedBrief.id);

        this.logger.log(
          `Created brief ${savedBrief.id} (${opportunityNumber}/${totalOpportunities}) ` +
            `with fit score ${scores.fitScore} (${scores.fitBand})`
        );
      }

      await queryRunner.commitTransaction();

      // Send welcome email after successful transaction (non-blocking)
      if (isNewUser) {
        this.sendOrganizationWelcomeEmail(
          dto.org.email,
          dto.org.contactName,
          dto.org.orgName,
        ).catch((error) => {
          this.logger.error(`Failed to send welcome email to ${dto.org.email}`, error);
        });
      }

      return {
        success: true,
        organizationId: organization.id,
        briefIds,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error("Failed to submit organization briefs", error);
      throw new InternalServerErrorException("Failed to submit form. Please try again.");
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Send welcome email to new organization contact
   */
  private async sendOrganizationWelcomeEmail(
    email: string,
    contactName: string,
    orgName: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>("FRONTEND_URL", "http://localhost:3000");
    const portalUrl = `${frontendUrl}/org/login`;

    const firstName = contactName.split(/\s+/)[0] || contactName;

    const subject = `Welcome to ATF AI Challenge - ${orgName}`;
    const html = this.getOrganizationWelcomeTemplate(firstName, orgName, email, portalUrl);
    const text = this.getOrganizationWelcomeTextTemplate(firstName, orgName, email, portalUrl);

    // Send email directly using the email service
    await this.emailService.sendCustomEmail(email, subject, html, text);

    this.logger.log(`Sent welcome email to ${email} for organization ${orgName}`);
  }

  /**
   * Get HTML template for organization welcome email
   */
  private getOrganizationWelcomeTemplate(
    firstName: string,
    orgName: string,
    email: string,
    portalUrl: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ATF AI Challenge</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <tr>
                  <td style="padding: 40px;">
                    <h1 style="margin: 0 0 24px 0; color: #18181b; font-size: 24px; font-weight: 700;">Welcome to ATF AI Challenge!</h1>
                    <p style="margin: 0 0 16px 0; color: #52525b; font-size: 16px; line-height: 1.6;">
                      Hi <strong>${firstName}</strong>,
                    </p>
                    <p style="margin: 0 0 16px 0; color: #52525b; font-size: 16px; line-height: 1.6;">
                      Thank you for submitting your organisation <strong>${orgName}</strong> to the ATF AI Challenge. We're excited to have you participate!
                    </p>
                    <p style="margin: 0 0 16px 0; color: #52525b; font-size: 16px; line-height: 1.6;">
                      Your briefs have been received and are now under review by our team.
                    </p>
                    
                    <div style="margin: 24px 0; padding: 20px; background-color: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
                      <p style="margin: 0 0 12px 0; color: #166534; font-size: 14px; font-weight: 600;">
                        🔐 How to access your Organization Portal
                      </p>
                      <ol style="margin: 0; padding-left: 20px; color: #52525b; font-size: 14px; line-height: 1.8;">
                        <li>Go to the Organization Portal</li>
                        <li>Enter your email: <strong>${email}</strong></li>
                        <li>We'll send you a verification code</li>
                        <li>Enter the code to access your dashboard</li>
                      </ol>
                    </div>

                    <p style="margin: 24px 0 16px 0; color: #52525b; font-size: 16px; line-height: 1.6;">
                      <strong>What's next?</strong>
                    </p>
                    <ul style="margin: 0 0 24px 0; padding-left: 24px; color: #52525b; font-size: 15px; line-height: 1.8;">
                      <li>Our team will review your submission</li>
                      <li>You'll be notified once your brief is approved</li>
                      <li>Approved briefs will be matched with participant teams</li>
                      <li>Teams will build AI-powered solutions for your challenges</li>
                    </ul>
                    
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 8px 0;">
                          <a href="${portalUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                            Go to Organization Portal
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 24px 0 0 0; color: #71717a; font-size: 14px; line-height: 1.6;">
                      If you have any questions, please reach out to our team.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px 40px; background-color: #f4f4f5; text-align: center;">
                    <p style="margin: 0; color: #71717a; font-size: 12px;">
                      © ${new Date().getFullYear()} Africa Technology Foundation. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  /**
   * Get plain text template for organization welcome email
   */
  private getOrganizationWelcomeTextTemplate(
    firstName: string,
    orgName: string,
    email: string,
    portalUrl: string,
  ): string {
    return `
Welcome to ATF AI Challenge!

Hi ${firstName},

Thank you for submitting your organisation ${orgName} to the ATF AI Challenge. We're excited to have you participate!

Your briefs have been received and are now under review by our team.

HOW TO ACCESS YOUR ORGANIZATION PORTAL:
1. Go to the Organization Portal: ${portalUrl}
2. Enter your email: ${email}
3. We'll send you a verification code
4. Enter the code to access your dashboard

WHAT'S NEXT:
- Our team will review your submission
- You'll be notified once your brief is approved
- Approved briefs will be matched with participant teams
- Teams will build AI-powered solutions for your challenges

If you have any questions, please reach out to our team.

© ${new Date().getFullYear()} Africa Technology Foundation. All rights reserved.
    `.trim();
  }

  /**
   * Calculate scores for preview (before submission)
   */
  calculatePreviewScores(scoringAnswers: any) {
    return this.briefScoringService.calculateScores(scoringAnswers);
  }
}
