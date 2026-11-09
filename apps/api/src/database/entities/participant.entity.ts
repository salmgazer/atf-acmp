import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { Cohort } from "./cohort.entity";
import { Vertical } from "./vertical.entity";
import type { BuildDeployAbility, MatchingSector, MatchingTeamStatus } from "@acmp/shared";

export enum ParticipantStatus {
  IMPORTED = "imported",
  ACTIVE = "active",
  ONBOARDING = "onboarding",
  READY = "ready",
  ASSIGNED = "assigned",
  INACTIVE = "inactive",
}

/**
 * Stores participant preferences for team formation matching
 * Defined before Participant to avoid circular reference issues
 */
@Entity("participant_preferences")
@Index(["participantId"], { unique: true })
export class ParticipantPreference extends BaseEntity {
  @Column({ name: "participant_id" })
  participantId: string;

  @OneToOne("Participant", "preference", {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "participant_id" })
  participant: any;

  // First vertical preference
  @Column({ name: "vertical_id_1", nullable: true })
  verticalId1?: string;

  @ManyToOne(() => Vertical, { nullable: true })
  @JoinColumn({ name: "vertical_id_1" })
  vertical1?: Vertical;

  // Second vertical preference
  @Column({ name: "vertical_id_2", nullable: true })
  verticalId2?: string;

  @ManyToOne(() => Vertical, { nullable: true })
  @JoinColumn({ name: "vertical_id_2" })
  vertical2?: Vertical;

  // Ranked list of brief IDs (top 5)
  @Column({ type: "jsonb", name: "brief_rankings", default: [] })
  briefRankings: string[];

  // Willing to work with participants from other countries
  @Column({ name: "cross_country_willing", default: true })
  crossCountryWilling: boolean;

  // Optional: preferred team role
  @Column({ name: "preferred_role", nullable: true })
  preferredRole?: string;

  @Column({ name: "build_deploy_ability", type: "varchar", length: 30, nullable: true }) buildDeployAbility: BuildDeployAbility | null;
  @Column({ name: "first_choice_sector", type: "varchar", length: 50, nullable: true }) firstChoiceSector: MatchingSector | null;
  @Column({ name: "backup_sector", type: "varchar", length: 50, nullable: true }) backupSector: MatchingSector | null;
  @Column({ name: "team_status", type: "varchar", length: 30, nullable: true }) teamStatus: MatchingTeamStatus | null;
  @Column({ name: "matching_profile_consent", type: "boolean", nullable: true }) matchingProfileConsent: boolean | null;
  @Column({ name: "matching_profile_consent_at", type: "timestamptz", nullable: true }) matchingProfileConsentAt: Date | null;
  @Column({ name: "matching_profile_consent_version", type: "varchar", length: 30, nullable: true }) matchingProfileConsentVersion: string | null;
  @Column({ name: "matching_profile_completed_at", type: "timestamptz", nullable: true }) matchingProfileCompletedAt: Date | null;

  // Optional: availability notes
  @Column({ type: "text", nullable: true })
  availabilityNotes?: string;

  // Timestamp when preferences were last updated
  @Column({ name: "preferences_updated_at", nullable: true })
  preferencesUpdatedAt?: Date;
}

@Entity("participants")
@Index('participant_cohort_group', ['cohortId', 'group'])
@Index(["cohortId", "country"])
@Index(["cohortId", "status"])
@Index("participant_learning_certificate_unique", ["learningCertificateId"], { unique: true, where: '"learning_certificate_id" IS NOT NULL' })
export class Participant extends BaseEntity {
  @Index({ unique: true })
  @Column({ name: "participant_id", unique: true })
  participantId: string;

  @Index({ unique: true })
  @Column({ unique: true })
  email: string;

  @Column({ name: "first_name" })
  firstName: string;

  @Column({ name: "last_name" })
  lastName: string;

  @Column()
  country: string;

  @Column({ nullable: true })
  institution?: string;

  @Column({ name: "phone_number", nullable: true })
  phoneNumber?: string;

  @Index("participant_lms_email_lookup")
  @Column({ name: "lms_email", type: "varchar", length: 255, nullable: true }) lmsEmail: string | null;
  @Column({ name: "whatsapp_number", type: "varchar", length: 50, nullable: true }) whatsappNumber: string | null;
  @Column({ type: "varchar", length: 150, nullable: true }) city: string | null;
  @Column({ name: "location_type", type: "varchar", length: 150, nullable: true }) locationType: string | null;
  @Column({ type: "varchar", length: 100, nullable: true }) gender: string | null;
  @Column({ name: "education_level", type: "varchar", length: 150, nullable: true }) educationLevel: string | null;
  @Column({ name: "current_affiliation", type: "varchar", length: 150, nullable: true }) currentAffiliation: string | null;
  @Column({ name: "field_of_study", type: "varchar", length: 255, nullable: true }) fieldOfStudy: string | null;
  @Column({ name: "python_skill", type: "varchar", length: 255, nullable: true }) pythonSkill: string | null;
  @Column({ name: "git_skill", type: "varchar", length: 255, nullable: true }) gitSkill: string | null;
  @Column({ name: "ai_experience", type: "varchar", length: 255, nullable: true }) aiExperience: string | null;
  @Column({ name: "github_username", type: "varchar", length: 255, nullable: true }) githubUsername: string | null;
  @Column({ name: "learning_certificate_issued", type: "boolean", nullable: true }) learningCertificateIssued: boolean | null;
  @Column({ name: "learning_certificate_id", type: "varchar", length: 255, nullable: true }) learningCertificateId: string | null;
  @Column({ name: "learning_certificate_date", type: "date", nullable: true }) learningCertificateDate: string | null;
  @Column({ name: "learning_finished_all_lessons", type: "boolean", nullable: true }) learningFinishedAllLessons: boolean | null;
  @Column({ name: "learning_halfway_reached", type: "boolean", nullable: true }) learningHalfwayReached: boolean | null;
  @Column({ name: "learning_imported_at", type: "timestamptz", nullable: true }) learningImportedAt: Date | null;

  @Column({ name: "programme_opted_out", default: false }) programmeOptedOut: boolean;
  @Column({ name: "programme_opted_out_at", type: "timestamptz", nullable: true }) programmeOptedOutAt: Date | null;
  @Column({ name: "programme_opt_out_reason", type: "text", nullable: true }) programmeOptOutReason: string | null;
  @Column({ name: "code_labs_completed", default: false }) codeLabsCompleted: boolean;
  @Column({ name: "code_labs_verified_at", type: "timestamptz", nullable: true }) codeLabsVerifiedAt: Date | null;
  @Column({ name: "code_labs_verified_by", type: "uuid", nullable: true }) codeLabsVerifiedBy: string | null;

  @Column({ name: "profile_confirmed_at", type: "timestamptz", nullable: true }) profileConfirmedAt: Date | null;
  @Column({ name: "github_account_status", type: "varchar", length: 20, nullable: true }) githubAccountStatus: "has_account" | "no_account" | null;

  @Column({ type: "jsonb", default: [] })
  skills: string[];

  @Column({ type: "jsonb", default: [], name: "interests" })
  interests: string[];

  @Column({ name: "firebase_uid", nullable: true })
  firebaseUid?: string;

  @Column({ name: "password_hash", nullable: true, select: false })
  passwordHash?: string;

  @Column({ name: "must_change_password", default: true })
  mustChangePassword: boolean;

  @Column({ name: "onboarding_complete", default: false })
  onboardingComplete: boolean;

  @Column({ name: "profile_image_url", nullable: true })
  profileImageUrl?: string;

  @Column({
    type: "enum",
    enum: ParticipantStatus,
    default: ParticipantStatus.IMPORTED,
  })
  status: ParticipantStatus;

  @Column({ name: "cohort_id" })
  cohortId: string;

  @Column({ name: 'group_name', type: 'varchar', length: 100, nullable: true })
  group: string | null;

  @ManyToOne(() => Cohort)
  @JoinColumn({ name: "cohort_id" })
  cohort: Cohort;

  @OneToOne(
    () => ParticipantPreference,
    (preference) => preference.participant,
    { cascade: true },
  )
  preference?: ParticipantPreference;

  @Column({ name: "password_reset_token", type: "varchar", nullable: true, select: false })
  passwordResetToken?: string | null;

  @Column({ name: "password_reset_expires", type: "timestamp", nullable: true, select: false })
  passwordResetExpires?: Date | null;

  /**
   * Get full name
   */
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
