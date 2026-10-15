import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Repository, ILike, In } from "typeorm";
import * as bcrypt from "bcrypt";
import {
  Participant,
  ParticipantStatus,
  ParticipantPreference,
} from "@/database/entities/participant.entity";
import { Cohort } from "@/database/entities/cohort.entity";
import { NotificationsService } from "@/modules/notifications/notifications.service";
import { NotificationRecipientType, NotificationType, NotificationPriority } from "@/database/entities/notification.entity";
import { EmailService } from "@/email/email.service";
import { CohortsService } from "@/modules/cohorts/cohorts.service";
import {
  CreateParticipantDto,
  UpdateParticipantDto,
  ParticipantQueryDto,
  PaginatedParticipantsDto,
  BulkImportParticipantsDto,
  BulkImportResultDto,
  ImportResultDto,
  CompleteOnboardingDto,
  OnboardingPreferencesDto,
  ParticipantStatisticsDto,
} from "./dto/participant.dto";

@Injectable()
export class ParticipantsService {
  private readonly logger = new Logger(ParticipantsService.name);

  constructor(
    @InjectRepository(Participant)
    private readonly participantRepository: Repository<Participant>,
    @InjectRepository(ParticipantPreference)
    private readonly preferenceRepository: Repository<ParticipantPreference>,
    @InjectRepository(Cohort)
    private readonly cohortRepository: Repository<Cohort>,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly cohortsService: CohortsService,
  ) {}

  async create(dto: CreateParticipantDto): Promise<Participant> {
    // Verify cohort exists
    const cohort = await this.cohortRepository.findOne({
      where: { id: dto.cohortId },
    });
    if (!cohort) {
      throw new NotFoundException("Cohort not found");
    }

    // Check for existing participant (including soft-deleted)
    const existingByEmail = await this.participantRepository.findOne({
      where: { email: dto.email },
      withDeleted: true,
    });

    const existingById = await this.participantRepository.findOne({
      where: { participantId: dto.participantId },
      withDeleted: true,
    });

    // Check if there's an active (non-deleted) duplicate
    if (existingByEmail && !existingByEmail.deletedAt) {
      throw new ConflictException("Email already registered");
    }
    if (existingById && !existingById.deletedAt && existingById.id !== existingByEmail?.id) {
      throw new ConflictException("Participant ID already exists");
    }

    // If there's a soft-deleted record with matching email, restore and update it
    if (existingByEmail && existingByEmail.deletedAt) {
      existingByEmail.deletedAt = undefined;
      existingByEmail.participantId = dto.participantId;
      existingByEmail.firstName = dto.firstName;
      existingByEmail.lastName = dto.lastName;
      existingByEmail.country = dto.country;
      existingByEmail.institution = dto.institution;
      existingByEmail.phoneNumber = dto.phoneNumber;
      existingByEmail.cohortId = dto.cohortId;
      existingByEmail.status = ParticipantStatus.IMPORTED;
      existingByEmail.mustChangePassword = true;
      existingByEmail.onboardingComplete = false;
      existingByEmail.firebaseUid = undefined;
      existingByEmail.passwordHash = undefined;
      existingByEmail.skills = [];
      existingByEmail.interests = [];
      return this.participantRepository.save(existingByEmail);
    }

    // If there's a soft-deleted record with matching participantId (but different email), restore and update it
    if (existingById && existingById.deletedAt) {
      existingById.deletedAt = undefined;
      existingById.email = dto.email;
      existingById.firstName = dto.firstName;
      existingById.lastName = dto.lastName;
      existingById.country = dto.country;
      existingById.institution = dto.institution;
      existingById.phoneNumber = dto.phoneNumber;
      existingById.cohortId = dto.cohortId;
      existingById.status = ParticipantStatus.IMPORTED;
      existingById.mustChangePassword = true;
      existingById.onboardingComplete = false;
      existingById.firebaseUid = undefined;
      existingById.passwordHash = undefined;
      existingById.skills = [];
      existingById.interests = [];
      return this.participantRepository.save(existingById);
    }

    const participant = this.participantRepository.create({
      ...dto,
      status: ParticipantStatus.IMPORTED,
      mustChangePassword: true,
      onboardingComplete: false,
    });

    return this.participantRepository.save(participant);
  }

  async findAll(query: ParticipantQueryDto): Promise<PaginatedParticipantsDto> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.cohortId) {
      where.cohortId = query.cohortId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.country) {
      where.country = query.country;
    }

    if (query.onboardingComplete !== undefined) {
      where.onboardingComplete = query.onboardingComplete;
    }

    if (query.search) {
      // Search by name, email, or participant ID (all case-insensitive)
      const searchResults = await this.participantRepository
        .createQueryBuilder("p")
        .where(where)
        .andWhere(
          "(LOWER(p.firstName) LIKE :search OR LOWER(p.lastName) LIKE :search OR LOWER(p.email) LIKE :search OR LOWER(p.participantId) LIKE :search)",
          { search: `%${query.search.toLowerCase()}%` }
        )
        .orderBy("p.createdAt", "DESC")
        .skip(skip)
        .take(limit)
        .getManyAndCount();

      return {
        data: searchResults[0],
        total: searchResults[1],
        page,
        limit,
        totalPages: Math.ceil(searchResults[1] / limit),
      };
    }

    const [data, total] = await this.participantRepository.findAndCount({
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

  async findOne(id: string): Promise<Participant> {
    const participant = await this.participantRepository.findOne({
      where: { id },
      relations: ["preference", "cohort"],
    });

    if (!participant) {
      throw new NotFoundException("Participant not found");
    }

    return participant;
  }

  async findByParticipantId(participantId: string): Promise<Participant | null> {
    return this.participantRepository.findOne({
      where: { participantId },
      relations: ["preference"],
    });
  }

  async findByEmail(email: string): Promise<Participant | null> {
    return this.participantRepository.findOne({
      where: { email },
      relations: ["preference"],
    });
  }

  async findByFirebaseUid(firebaseUid: string): Promise<Participant | null> {
    return this.participantRepository.findOne({
      where: { firebaseUid },
      relations: ["preference"],
    });
  }

  async update(id: string, dto: UpdateParticipantDto): Promise<Participant> {
    const participant = await this.findOne(id);
    Object.assign(participant, dto);
    return this.participantRepository.save(participant);
  }

  async updateStatus(id: string, status: ParticipantStatus): Promise<Participant> {
    const participant = await this.findOne(id);
    participant.status = status;
    return this.participantRepository.save(participant);
  }

  async setFirebaseUid(id: string, firebaseUid: string): Promise<Participant> {
    const participant = await this.findOne(id);
    participant.firebaseUid = firebaseUid;
    participant.status = ParticipantStatus.ACTIVE;
    return this.participantRepository.save(participant);
  }

  async markPasswordChanged(id: string): Promise<Participant> {
    const participant = await this.findOne(id);
    participant.mustChangePassword = false;
    if (participant.status === ParticipantStatus.ACTIVE) {
      participant.status = ParticipantStatus.ONBOARDING;
    }
    return this.participantRepository.save(participant);
  }

  /**
   * Bulk import participants from CSV data
   * Creates Firebase users with participantId as initial password
   */
  async bulkImport(dto: BulkImportParticipantsDto): Promise<BulkImportResultDto> {
    const results: ImportResultDto[] = [];
    let successCount = 0;
    let failureCount = 0;
    const successfulImports: { email: string; firstName: string; participantId: string }[] = [];

    // Verify cohort exists
    const cohort = await this.cohortRepository.findOne({
      where: { id: dto.cohortId },
    });
    if (!cohort) {
      throw new NotFoundException("Cohort not found");
    }

    // Get existing participants (including soft-deleted) to check for duplicates
    const existingByEmail = await this.participantRepository.find({
      where: { email: In(dto.participants.map((p) => p.email)) },
      select: ["id", "email", "deletedAt"],
      withDeleted: true,
    });
    const existingEmailMap = new Map(existingByEmail.map((p) => [p.email, p]));

    const existingByIds = await this.participantRepository.find({
      where: { participantId: In(dto.participants.map((p) => p.participantId)) },
      select: ["id", "participantId", "deletedAt"],
      withDeleted: true,
    });
    const existingIdMap = new Map(existingByIds.map((p) => [p.participantId, p]));

    // Track which emails/IDs have been processed in this batch
    const processedEmails = new Set<string>();
    const processedIds = new Set<string>();

    for (const row of dto.participants) {
      try {
        const existingEmail = existingEmailMap.get(row.email);
        const existingId = existingIdMap.get(row.participantId);

        // Check for duplicates within this batch
        if (processedEmails.has(row.email)) {
          results.push({
            success: false,
            participantId: row.participantId,
            email: row.email,
            error: "Duplicate email in import batch",
          });
          failureCount++;
          continue;
        }

        if (processedIds.has(row.participantId)) {
          results.push({
            success: false,
            participantId: row.participantId,
            email: row.email,
            error: "Duplicate participant ID in import batch",
          });
          failureCount++;
          continue;
        }

        // Check for active (non-deleted) duplicates in database
        if (existingEmail && !existingEmail.deletedAt) {
          results.push({
            success: false,
            participantId: row.participantId,
            email: row.email,
            error: "Email already exists",
          });
          failureCount++;
          continue;
        }

        if (existingId && !existingId.deletedAt) {
          results.push({
            success: false,
            participantId: row.participantId,
            email: row.email,
            error: "Participant ID already exists",
          });
          failureCount++;
          continue;
        }

        // Hash the initial password (participantId)
        const passwordHash = await bcrypt.hash(row.participantId, 10);

        // If there's a soft-deleted record, restore and update it
        if (existingEmail && existingEmail.deletedAt) {
          await this.participantRepository
            .createQueryBuilder()
            .update(Participant)
            .set({
              deletedAt: undefined,
              participantId: row.participantId,
              firstName: row.firstName,
              lastName: row.lastName,
              country: row.country,
              institution: row.institution,
              phoneNumber: row.phoneNumber,
              cohortId: dto.cohortId,
              passwordHash,
              status: ParticipantStatus.ACTIVE,
              mustChangePassword: true,
              onboardingComplete: false,
              firebaseUid: undefined,
              skills: [],
              interests: [],
            })
            .where("id = :id", { id: existingEmail.id })
            .execute();
        } else if (existingId && existingId.deletedAt) {
          await this.participantRepository
            .createQueryBuilder()
            .update(Participant)
            .set({
              deletedAt: undefined,
              email: row.email,
              firstName: row.firstName,
              lastName: row.lastName,
              country: row.country,
              institution: row.institution,
              phoneNumber: row.phoneNumber,
              cohortId: dto.cohortId,
              passwordHash,
              status: ParticipantStatus.ACTIVE,
              mustChangePassword: true,
              onboardingComplete: false,
              firebaseUid: undefined,
              skills: [],
              interests: [],
            })
            .where("id = :id", { id: existingId.id })
            .execute();
        } else {
          // Create new participant record
          const participant = this.participantRepository.create({
            participantId: row.participantId,
            email: row.email,
            firstName: row.firstName,
            lastName: row.lastName,
            country: row.country,
            institution: row.institution,
            phoneNumber: row.phoneNumber,
            cohortId: dto.cohortId,
            passwordHash,
            status: ParticipantStatus.ACTIVE,
            mustChangePassword: true,
            onboardingComplete: false,
          });

          await this.participantRepository.save(participant);
        }

        // Mark as processed to prevent duplicates within same batch
        processedEmails.add(row.email);
        processedIds.add(row.participantId);

        // Track successful imports for welcome emails
        successfulImports.push({
          email: row.email,
          firstName: row.firstName,
          participantId: row.participantId,
        });

        results.push({
          success: true,
          participantId: row.participantId,
          email: row.email,
        });
        successCount++;
      } catch (error: any) {
        this.logger.error(
          `Failed to import participant ${row.participantId}: ${error.message}`
        );
        results.push({
          success: false,
          participantId: row.participantId,
          email: row.email,
          error: error.message,
        });
        failureCount++;
      }
    }

    // Send welcome emails if requested (don't block on email failures)
    if (dto.sendWelcomeEmail !== false && successfulImports.length > 0) {
      const frontendUrl = this.configService.get<string>("FRONTEND_URL", "https://challenge.atf.africa");
      const portalUrl = `${frontendUrl}/app/login`;

      // Send emails asynchronously - don't wait for all to complete
      Promise.all(
        successfulImports.map(async (participant) => {
          try {
            await this.emailService.sendParticipantWelcomeEmail({
              to: participant.email,
              firstName: participant.firstName,
              participantId: participant.participantId,
              portalUrl,
            });
            this.logger.log(`Welcome email sent to ${participant.email}`);
          } catch (error) {
            this.logger.warn(`Failed to send welcome email to ${participant.email}: ${error}`);
          }
        })
      ).catch((error) => {
        this.logger.error(`Error sending welcome emails: ${error}`);
      });
    }

    return {
      totalProcessed: dto.participants.length,
      successCount,
      failureCount,
      results,
    };
  }

  /**
   * Complete onboarding process
   */
  async completeOnboarding(
    id: string,
    dto: CompleteOnboardingDto
  ): Promise<Participant> {
    const participant = await this.findOne(id);

    // Update profile
    participant.firstName = dto.profile.firstName;
    participant.lastName = dto.profile.lastName;
    participant.institution = dto.profile.institution;
    participant.phoneNumber = dto.profile.phoneNumber;

    // Update skills and interests
    participant.skills = dto.skills.skills;
    participant.interests = dto.skills.interests;

    // Mark onboarding as complete
    participant.onboardingComplete = true;
    participant.status = ParticipantStatus.READY;

    // Save participant
    await this.participantRepository.save(participant);

    // Create or update preferences
    await this.savePreferences(id, dto.preferences);

    // Send welcome notification
    try {
      await this.notificationsService.create({
        recipientId: participant.id,
        recipientType: NotificationRecipientType.PARTICIPANT,
        type: NotificationType.ANNOUNCEMENT,
        title: "Welcome to the AI Challenge! 🎉",
        body: `Hi ${participant.firstName}! Your profile is set up and you're ready to go. Start by exploring challenge briefs and finding a team to join.`,
        actionUrl: "/participant/dashboard",
        priority: NotificationPriority.NORMAL,
      });
    } catch (error) {
      this.logger.warn(`Failed to send welcome notification: ${error}`);
    }

    // Add participant to forum chat channels
    try {
      await this.cohortsService.addParticipantToForumChannels(participant);
    } catch (error) {
      this.logger.warn(`Failed to add participant to forum channels: ${error}`);
    }

    return this.findOne(id);
  }

  /**
   * Save participant preferences
   */
  async savePreferences(
    participantId: string,
    dto: OnboardingPreferencesDto
  ): Promise<ParticipantPreference> {
    let preference = await this.preferenceRepository.findOne({
      where: { participantId },
    });

    if (!preference) {
      preference = this.preferenceRepository.create({
        participantId,
      });
    }

    preference.verticalId1 = dto.verticalId1;
    preference.verticalId2 = dto.verticalId2;
    preference.briefRankings = dto.briefRankings;
    preference.crossCountryWilling = dto.crossCountryWilling;
    preference.preferredRole = dto.preferredRole;
    preference.availabilityNotes = dto.availabilityNotes;
    preference.preferencesUpdatedAt = new Date();

    return this.preferenceRepository.save(preference);
  }

  /**
   * Get participant preferences
   */
  async getPreferences(participantId: string): Promise<ParticipantPreference | null> {
    return this.preferenceRepository.findOne({
      where: { participantId },
      relations: ["vertical1", "vertical2"],
    });
  }

  /**
   * Update brief rankings
   */
  async updateBriefRankings(
    participantId: string,
    briefRankings: string[]
  ): Promise<ParticipantPreference> {
    let preference = await this.preferenceRepository.findOne({
      where: { participantId },
    });

    if (!preference) {
      preference = this.preferenceRepository.create({
        participantId,
        briefRankings: [],
        crossCountryWilling: true,
      });
    }

    preference.briefRankings = briefRankings;
    preference.preferencesUpdatedAt = new Date();

    return this.preferenceRepository.save(preference);
  }

  /**
   * Get statistics for participants in a cohort
   */
  async getStatistics(cohortId?: string): Promise<ParticipantStatisticsDto> {
    const where = cohortId ? { cohortId } : {};

    const [
      total,
      imported,
      active,
      onboarding,
      ready,
      assigned,
      inactive,
      onboardingCompleted,
      passwordChanged,
    ] = await Promise.all([
      this.participantRepository.count({ where }),
      this.participantRepository.count({ where: { ...where, status: ParticipantStatus.IMPORTED } }),
      this.participantRepository.count({ where: { ...where, status: ParticipantStatus.ACTIVE } }),
      this.participantRepository.count({ where: { ...where, status: ParticipantStatus.ONBOARDING } }),
      this.participantRepository.count({ where: { ...where, status: ParticipantStatus.READY } }),
      this.participantRepository.count({ where: { ...where, status: ParticipantStatus.ASSIGNED } }),
      this.participantRepository.count({ where: { ...where, status: ParticipantStatus.INACTIVE } }),
      this.participantRepository.count({ where: { ...where, onboardingComplete: true } }),
      this.participantRepository.count({ where: { ...where, mustChangePassword: false } }),
    ]);

    // Get counts by country
    const countryStats = await this.participantRepository
      .createQueryBuilder("p")
      .select("p.country", "country")
      .addSelect("COUNT(*)", "count")
      .where(cohortId ? "p.cohort_id = :cohortId" : "1=1", { cohortId })
      .groupBy("p.country")
      .getRawMany();

    const byCountry: Record<string, number> = {};
    for (const stat of countryStats) {
      byCountry[stat.country] = parseInt(stat.count, 10);
    }

    return {
      total,
      imported,
      active,
      onboarding,
      ready,
      assigned,
      inactive,
      onboardingCompleted,
      passwordChanged,
      byCountry,
    };
  }

  /**
   * Delete a participant (soft delete)
   */
  async remove(id: string): Promise<void> {
    const participant = await this.findOne(id);
    await this.participantRepository.softRemove(participant);
  }

  /**
   * Get participants by country for a cohort
   */
  async findByCountry(cohortId: string, country: string): Promise<Participant[]> {
    return this.participantRepository.find({
      where: { cohortId, country },
      order: { lastName: "ASC", firstName: "ASC" },
    });
  }

  /**
   * Get participants ready for team formation
   */
  async findReadyForTeamFormation(cohortId: string): Promise<Participant[]> {
    return this.participantRepository.find({
      where: {
        cohortId,
        status: ParticipantStatus.READY,
        onboardingComplete: true,
      },
      relations: ["preference"],
      order: { country: "ASC", lastName: "ASC" },
    });
  }
}
