import { SocketSessionsService } from "@/auth/socket-sessions.service";
import { applyProgrammeOptOut } from "@/common/services/team-rules";
import { resolveCohortGroup } from "@/common/services/cohort-groups";
import { isBriefCountryAllowed, participantBriefScope } from "@/common/services/brief-country-access";
import { Brief, BriefStatus } from "@/database/entities/brief.entity";
import { afterCommit, Transactional } from "@/common/decorators/transactional.decorator";
import {
  Injectable, Optional,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Repository, ILike, In, IsNull, Not, Raw } from "typeorm";
import * as bcrypt from "bcrypt";
import {
  Participant,
  ParticipantStatus,
  ParticipantPreference,
} from "@/database/entities/participant.entity";
import { AuditLog, AuditAction } from "@/database/entities/audit-log.entity";
import { Cohort } from "@/database/entities/cohort.entity";
import { Vertical } from "@/database/entities/vertical.entity";
import { COUNTRY_NAMES, MATCHING_CONSENT_VERSION, PARTICIPANT_LEARNING_FIELDS, normalizeTeamCountry } from "@acmp/shared";
import { STAFF_PARTICIPANT_PROFILE_FIELDS, StaffParticipantProfileDto } from "./dto/staff-participant-profile.dto";
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
  CompleteOnboardingPreferencesDto,
  UpdateParticipantProgrammeDto,
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
    @Optional() private readonly socketSessions?: SocketSessionsService,
  ) {}

  @Transactional()
  async create(dto: CreateParticipantDto): Promise<Participant> {
    // Verify cohort exists
    const cohort = await this.cohortRepository.findOne({
      where: { id: dto.cohortId },
    });
    if (!cohort) {
      throw new NotFoundException("Cohort not found");
    }

    const group = resolveCohortGroup(cohort, dto.group);

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
      await this.resetRestoredAccess(existingByEmail.id);
      existingByEmail.deletedAt = null as any;
      existingByEmail.participantId = dto.participantId;
      existingByEmail.firstName = dto.firstName;
      existingByEmail.lastName = dto.lastName;
      existingByEmail.country = dto.country;
      existingByEmail.institution = dto.institution;
      existingByEmail.phoneNumber = dto.phoneNumber;
      existingByEmail.cohortId = dto.cohortId;
      existingByEmail.group = group;
      existingByEmail.status = ParticipantStatus.IMPORTED;
      existingByEmail.mustChangePassword = true;
      existingByEmail.onboardingComplete = false;
      existingByEmail.firebaseUid = null as any;
      existingByEmail.passwordHash = await bcrypt.hash(dto.participantId, 10);
      existingByEmail.passwordResetToken = null;
      existingByEmail.passwordResetExpires = null;
      existingByEmail.skills = [];
      existingByEmail.interests = [];
      return this.participantRepository.save(existingByEmail);
    }

    // If there's a soft-deleted record with matching participantId (but different email), restore and update it
    if (existingById && existingById.deletedAt) {
      await this.resetRestoredAccess(existingById.id);
      existingById.deletedAt = null as any;
      existingById.email = dto.email;
      existingById.firstName = dto.firstName;
      existingById.lastName = dto.lastName;
      existingById.country = dto.country;
      existingById.institution = dto.institution;
      existingById.phoneNumber = dto.phoneNumber;
      existingById.cohortId = dto.cohortId;
      existingById.group = group;
      existingById.status = ParticipantStatus.IMPORTED;
      existingById.mustChangePassword = true;
      existingById.onboardingComplete = false;
      existingById.firebaseUid = null as any;
      existingById.passwordHash = await bcrypt.hash(dto.participantId, 10);
      existingById.passwordResetToken = null;
      existingById.passwordResetExpires = null;
      existingById.skills = [];
      existingById.interests = [];
      return this.participantRepository.save(existingById);
    }

    const participant = this.participantRepository.create({
      ...dto,
      group,
      status: ParticipantStatus.IMPORTED,
      mustChangePassword: true,
      onboardingComplete: false,
    });

    return this.participantRepository.save(participant);
  }

  private async resetRestoredAccess(participantId: string): Promise<void> {
    const manager = this.participantRepository.manager;
    await manager.getRepository("RefreshToken").update({ participantId, isRevoked: false }, { isRevoked: true, revokedAt: new Date(), revokedReason: "Participant restored" });
    await manager.getRepository("TeamMember").softDelete({ participantId });
    await manager.getRepository("ChannelMember").update({ memberId: participantId, memberType: "participant" }, { leftAt: new Date() });
    await manager.getRepository("ParticipantPreference").delete({ participantId });
  }

  async findAll(query: ParticipantQueryDto): Promise<PaginatedParticipantsDto> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.group && query.ungrouped) throw new BadRequestException("Choose a group or ungrouped participants");
    if (query.group) where.group = query.group;
    if (query.ungrouped) where.group = IsNull();

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

  @Transactional()
  async updateStaffProfile(id: string, dto: StaffParticipantProfileDto, actor: { id: string; role: string; email?: string }): Promise<Participant> {
    if (!["super_admin", "program_manager"].includes(actor.role)) throw new ForbiddenException("Only staff managers may edit participant profiles");
    const manager = this.participantRepository.manager;
    // Coordinate with manual LMS imports as well as concurrent profile saves.
    await manager.query("SELECT pg_advisory_xact_lock(hashtext('participant-learning-import'))");
    const participant = await this.participantRepository.findOne({ where: { id }, lock: { mode: "pessimistic_write" } });
    if (!participant) throw new NotFoundException("Participant not found");
    if (participant.updatedAt.toISOString() !== new Date(dto.expectedUpdatedAt).toISOString()) throw new ConflictException("Participant changed since this editor was opened. Reload the profile and review your edits.");
    const patch: Record<string, any> = {};
    for (const field of STAFF_PARTICIPANT_PROFILE_FIELDS) {
      const value = dto[field];
      if (value !== undefined) patch[field] = typeof value === "string" ? value.trim() || null : Array.isArray(value) ? [...new Set(value.map(item => item.trim()).filter(Boolean))] : value;
    }
    for (const field of ["firstName", "lastName", "country"]) if (field in patch && !patch[field]) throw new BadRequestException(`${field} is required`);
    if ("country" in patch) {
      patch.country = normalizeTeamCountry(patch.country);
      const cohort = await this.cohortRepository.findOne({ where: { id: participant.cohortId } });
      if (!cohort) throw new NotFoundException("Cohort not found");
      if (cohort.countries?.length && !cohort.countries.some(country => normalizeTeamCountry(country).toLowerCase() === patch.country.toLowerCase())) throw new BadRequestException("Choose a country enabled for this cohort");
    }
    if (patch.lmsEmail) {
      patch.lmsEmail = patch.lmsEmail.toLowerCase();
      const owner = await this.participantRepository.findOne({ where: { id: Not(id), lmsEmail: Raw(alias => `LOWER(${alias}) = :profileLmsEmail`, { profileLmsEmail: patch.lmsEmail }) } });
      if (owner && owner.id !== id) throw new ConflictException("LMS email belongs to another participant");
    }
    const learningChanged = PARTICIPANT_LEARNING_FIELDS.some(field => field in patch && patch[field] !== participant[field]);
    if (learningChanged) {
      const correction = ["learningCertificateIssued", "learningFinishedAllLessons", "learningHalfwayReached"].some(field => (participant as any)[field] === true && field in patch && patch[field] !== true)
        || ["learningCertificateId", "learningCertificateDate"].some(field => (participant as any)[field] && field in patch && patch[field] !== (participant as any)[field]);
      if (correction && !dto.allowLearningCorrections) throw new BadRequestException("Review and confirm the learning correction before saving");
      if ("learningCertificateIssued" in patch && patch.learningCertificateIssued !== true) { patch.learningCertificateId = null; patch.learningCertificateDate = null; }
      const final = { ...participant, ...patch };
      if (final.learningCertificateIssued === true && !final.learningCertificateId) throw new BadRequestException("A learning certificate marked Yes requires a certificate ID");
      if (final.learningCertificateIssued !== true && (final.learningCertificateId || final.learningCertificateDate)) throw new BadRequestException("Set learning certificate issued to Yes when providing a certificate ID or date");
      if (final.learningCertificateDate) {
        const date = new Date(final.learningCertificateDate);
        if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== final.learningCertificateDate) throw new BadRequestException("Enter a valid learning certificate date");
      }
      if (final.learningCertificateId) {
        const owner = await this.participantRepository.findOne({ where: { learningCertificateId: final.learningCertificateId }, withDeleted: true });
        if (owner && owner.id !== id) throw new ConflictException("Learning certificate ID belongs to another participant");
      }
    }
    if ("githubUsername" in patch) patch.githubAccountStatus = patch.githubUsername ? "has_account" : "no_account";
    const changes = Object.entries(patch).filter(([field, value]) => JSON.stringify(value) !== JSON.stringify((participant as any)[field] ?? null));
    if (!changes.length) return this.findOne(id);
    const before = Object.fromEntries(changes.map(([field]) => [field, (participant as any)[field] ?? null]));
    Object.assign(participant, patch);
    try { await this.participantRepository.save(participant); }
    catch (error) {
      if ((error as { code?: string }).code === "23505") throw new ConflictException("A participant already uses this learning certificate ID");
      throw error;
    }
    await manager.save(AuditLog, manager.create(AuditLog, {
      actorId: actor.id, actorEmail: actor.email, action: AuditAction.UPDATE, entityType: "Participant", entityId: id,
      description: "Updated participant profile and learning records",
      before,
      after: Object.fromEntries(changes), metadata: { source: "staff-profile-editor", learningCorrectionReviewed: !!dto.allowLearningCorrections },
    }));
    return this.findOne(id);
  }

  @Transactional()
  async assignGroup(id: string, value?: string | null): Promise<Participant> {
    const participant = await this.findOne(id);
    const cohort = await this.cohortRepository.findOne({ where: { id: participant.cohortId } });
    if (!cohort) throw new NotFoundException('Cohort not found');
    const group = resolveCohortGroup(cohort, value);
    if ((participant.group || null) !== group) {
      const membership = await this.participantRepository.manager.getRepository('TeamMember').findOne({ where: { participantId: id } });
      if (membership) throw new BadRequestException('Remove the participant from their team before changing group');
    }
    participant.group = group;
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
  @Transactional()
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

    const group = resolveCohortGroup(cohort, dto.group);

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
          await this.resetRestoredAccess(existingEmail.id);
          await this.participantRepository
            .createQueryBuilder()
            .update(Participant)
            .set({
              deletedAt: null as any,
              participantId: row.participantId,
              firstName: row.firstName,
              lastName: row.lastName,
              country: row.country,
              institution: row.institution,
              phoneNumber: row.phoneNumber,
              cohortId: dto.cohortId,
              group,
              passwordHash,
              status: ParticipantStatus.ACTIVE,
              mustChangePassword: true,
              onboardingComplete: false,
              firebaseUid: null as any,
              passwordResetToken: null, passwordResetExpires: null,
              skills: [],
              interests: [],
            })
            .where("id = :id", { id: existingEmail.id })
            .execute();
        } else if (existingId && existingId.deletedAt) {
          await this.resetRestoredAccess(existingId.id);
          await this.participantRepository
            .createQueryBuilder()
            .update(Participant)
            .set({
              deletedAt: null as any,
              email: row.email,
              firstName: row.firstName,
              lastName: row.lastName,
              country: row.country,
              institution: row.institution,
              phoneNumber: row.phoneNumber,
              cohortId: dto.cohortId,
              group,
              passwordHash,
              status: ParticipantStatus.ACTIVE,
              mustChangePassword: true,
              onboardingComplete: false,
              firebaseUid: null as any,
              passwordResetToken: null, passwordResetExpires: null,
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
            group,
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
      const portalUrl = `${frontendUrl}/participant/login`;

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
  @Transactional("participant-onboarding")
  async completeOnboarding(id: string, dto: CompleteOnboardingDto): Promise<Participant> {
    const participant = await this.findOne(id);
    if (participant.onboardingComplete && participant.preference?.matchingProfileCompletedAt) return participant;
    const alreadyOnboarded = participant.onboardingComplete;
    if (participant.mustChangePassword) throw new BadRequestException("Change your initial password before completing onboarding");
    if (participant.status === ParticipantStatus.INACTIVE || participant.cohort.status !== "active") throw new BadRequestException("Onboarding requires an active participant and cohort");
    if (dto.preferences.firstChoiceSector === dto.preferences.backupSector) throw new BadRequestException("Choose a different backup sector");
    const countryName = (value: string) => Object.entries(COUNTRY_NAMES).find(([code, name]) => [code.toLowerCase(), name.toLowerCase()].includes(value.trim().toLowerCase()))?.[1] || value.trim();
    const country = countryName(dto.profile.country);
    const allowed = participant.cohort.countries.map(countryName);
    if (!country || (allowed.length && !allowed.includes(country))) throw new BadRequestException("Choose a country enabled for this cohort");
    const verticalIds = [dto.preferences.verticalId1, dto.preferences.verticalId2].filter(Boolean) as string[];
    if (new Set(verticalIds).size !== verticalIds.length) throw new BadRequestException("Choose different programme verticals");
    if (verticalIds.length && await this.participantRepository.manager.getRepository(Vertical).countBy({ id: In(verticalIds), cohortId: participant.cohortId, isActive: true }) !== verticalIds.length) throw new BadRequestException("Choose active verticals from your cohort");
    for (const field of ["firstName", "lastName", "institution", "phoneNumber", "whatsappNumber", "city", "locationType", "gender", "educationLevel", "currentAffiliation", "fieldOfStudy", "pythonSkill", "gitSkill", "aiExperience"] as const) {
      const value = dto.profile[field];
      if (value !== undefined) (participant as any)[field] = value?.trim() ?? null;
    }
    if (!participant.firstName || !participant.lastName) throw new BadRequestException("First name and last name are required");
    participant.country = country;
    participant.githubAccountStatus = dto.profile.githubAccountStatus;
    participant.githubUsername = dto.profile.githubAccountStatus === "has_account" ? dto.profile.githubUsername!.trim() : null;
    participant.skills = dto.skills.skills;
    participant.interests = dto.skills.interests;
    participant.profileConfirmedAt = new Date();
    participant.onboardingComplete = true;
    // Existing team membership/status is preserved for legacy participants.
    if (!alreadyOnboarded && participant.status !== ParticipantStatus.ASSIGNED) participant.status = ParticipantStatus.READY;
    await this.participantRepository.save(participant);
    await this.savePreferences(id, dto.preferences);

    if (!alreadyOnboarded) afterCommit(this, async () => {
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
    });

    return this.findOne(id);
  }

  /**
   * Save participant preferences
   */
  async savePreferences(
    participantId: string,
    dto: OnboardingPreferencesDto
  ): Promise<ParticipantPreference> {
    if (dto.briefRankings?.length) await this.validateBriefRankings(participantId, dto.briefRankings);
    let preference = await this.preferenceRepository.findOne({
      where: { participantId },
    });

    if (!preference) {
      preference = this.preferenceRepository.create({
        participantId,
      });
    }

    // Older profile clients update only their submitted preferences. They must
    // not erase the matching answers recorded during onboarding.
    for (const field of ["verticalId1", "verticalId2", "briefRankings", "crossCountryWilling", "preferredRole", "availabilityNotes"] as const) {
      if (dto[field] !== undefined) (preference as any)[field] = dto[field];
    }
    if ("buildDeployAbility" in dto) {
      const matching = dto as CompleteOnboardingPreferencesDto;
      preference.buildDeployAbility = matching.buildDeployAbility;
      preference.firstChoiceSector = matching.firstChoiceSector;
      preference.backupSector = matching.backupSector;
      preference.teamStatus = matching.teamStatus;
      preference.matchingProfileConsent = matching.matchingProfileConsent;
      preference.matchingProfileConsentAt = new Date();
      preference.matchingProfileConsentVersion = MATCHING_CONSENT_VERSION;
      preference.matchingProfileCompletedAt = new Date();
    }
    preference.preferencesUpdatedAt = new Date();

    return this.preferenceRepository.save(preference);
  }

  @Transactional("participant-programme")
  async updateProgrammeStatus(id: string, dto: UpdateParticipantProgrammeDto, actorId: string) {
    const participant = await this.findOne(id);
    const before = { programmeOptedOut: participant.programmeOptedOut, codeLabsCompleted: participant.codeLabsCompleted };
    if (dto.programmeOptedOut === undefined && dto.codeLabsCompleted === undefined) throw new BadRequestException("Choose a programme status to update");
    if (dto.programmeOptedOut !== undefined) {
      participant.programmeOptedOut = dto.programmeOptedOut;
      participant.programmeOptedOutAt = dto.programmeOptedOut ? new Date() : null;
      participant.programmeOptOutReason = dto.reason?.trim() || null;
    }
    if (dto.codeLabsCompleted !== undefined) {
      participant.codeLabsCompleted = dto.codeLabsCompleted;
      participant.codeLabsVerifiedAt = dto.codeLabsCompleted ? new Date() : null;
      participant.codeLabsVerifiedBy = dto.codeLabsCompleted ? actorId : null;
    }
    await this.participantRepository.save(participant);
    if (participant.programmeOptedOut) {
      await applyProgrammeOptOut(this.participantRepository.manager, id);
      afterCommit(this, () => this.socketSessions?.revokePrincipal(id));
    }
    await this.participantRepository.manager.save(AuditLog, this.participantRepository.manager.create(AuditLog, { actorId, action: AuditAction.UPDATE, entityType: "Participant", entityId: id, before, after: { programmeOptedOut: participant.programmeOptedOut, codeLabsCompleted: participant.codeLabsCompleted }, description: "Updated programme eligibility: opt-out and verified CodeLabs evidence" }));
    return this.findOne(id);
  }

  @Transactional("participant-onboarding")
  async updateMatchingConsent(participantId: string, consent: boolean): Promise<ParticipantPreference> {
    await this.findOne(participantId);
    let preference = await this.preferenceRepository.findOneBy({ participantId });
    if (!preference) preference = this.preferenceRepository.create({ participantId, briefRankings: [], crossCountryWilling: false });
    preference.matchingProfileConsent = consent;
    preference.matchingProfileConsentAt = new Date();
    preference.matchingProfileConsentVersion = MATCHING_CONSENT_VERSION;
    return this.preferenceRepository.save(preference);
  }

  /**
   * Update only the participant’s cross-country answer.
   */
  @Transactional("participant-onboarding")
  async updateCrossCountryPreference(participantId: string, crossCountryWilling: boolean): Promise<ParticipantPreference> {
    await this.findOne(participantId);
    const preference = await this.preferenceRepository.findOneBy({ participantId });
    const changes = { crossCountryWilling, preferencesUpdatedAt: new Date() };
    if (preference) {
      // Change only this answer; do not overwrite rankings, consent or other matching answers.
      await this.preferenceRepository.update(preference.id, changes);
    } else {
      await this.preferenceRepository.save(this.preferenceRepository.create({ participantId, briefRankings: [], ...changes }));
    }
    return (await this.getPreferences(participantId))!;
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
    if (briefRankings.length) await this.validateBriefRankings(participantId, briefRankings);
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

  private async validateBriefRankings(participantId: string, briefRankings: string[]): Promise<void> {
    const scope = await participantBriefScope(this.participantRepository.manager, participantId);
    const briefs = await this.participantRepository.manager.getRepository(Brief).find({
      where: { id: In(briefRankings), cohortId: scope.cohortId, status: BriefStatus.APPROVED }, relations: ["organization"],
    });
    if (briefs.length !== new Set(briefRankings).size || briefs.some(brief => !isBriefCountryAllowed(brief, scope.countries))) {
      throw new BadRequestException("Rank only approved briefs from the countries of your confirmed team members");
    }
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
