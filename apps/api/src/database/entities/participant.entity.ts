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

  // Optional: availability notes
  @Column({ type: "text", nullable: true })
  availabilityNotes?: string;

  // Timestamp when preferences were last updated
  @Column({ name: "preferences_updated_at", nullable: true })
  preferencesUpdatedAt?: Date;
}

@Entity("participants")
@Index(["cohortId", "country"])
@Index(["cohortId", "status"])
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

  @Column({ type: "jsonb", default: [] })
  skills: string[];

  @Column({ type: "jsonb", default: [], name: "interests" })
  interests: string[];

  @Column({ name: "firebase_uid", nullable: true })
  firebaseUid?: string;

  @Column({ name: "password_hash", nullable: true })
  passwordHash?: string;

  @Column({ name: "must_change_password", default: true })
  mustChangePassword: boolean;

  @Column({ name: "onboarding_complete", default: false })
  onboardingComplete: boolean;

  @Column({
    type: "enum",
    enum: ParticipantStatus,
    default: ParticipantStatus.IMPORTED,
  })
  status: ParticipantStatus;

  @Column({ name: "cohort_id" })
  cohortId: string;

  @ManyToOne(() => Cohort)
  @JoinColumn({ name: "cohort_id" })
  cohort: Cohort;

  @OneToOne(
    () => ParticipantPreference,
    (preference) => preference.participant,
    { cascade: true },
  )
  preference?: ParticipantPreference;

  /**
   * Get full name
   */
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
