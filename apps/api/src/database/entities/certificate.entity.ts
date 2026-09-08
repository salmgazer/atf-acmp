import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { Cohort } from "./cohort.entity";
import { Team } from "./team.entity";
import { Participant } from "./participant.entity";

export enum CertificateTier {
  PARTICIPATION = "participation",
  COMPLETION = "completion",
  EXCELLENCE = "excellence",
  WINNER = "winner",
}

export enum CertificateStatus {
  PENDING = "pending",
  GENERATED = "generated",
  FAILED = "failed",
}

@Entity("certificates")
@Index(["cohortId", "participantId"], { unique: true })
@Index(["certificateId"], { unique: true })
@Index(["tier"])
@Index(["status"])
export class Certificate extends BaseEntity {
  @Column({ name: "certificate_id", unique: true })
  certificateId: string; // Unique verification code (e.g., ACMP-2024-XXXXX)

  @Column({ name: "cohort_id" })
  cohortId: string;

  @ManyToOne(() => Cohort)
  @JoinColumn({ name: "cohort_id" })
  cohort: Cohort;

  @Column({ name: "participant_id" })
  participantId: string;

  @ManyToOne(() => Participant)
  @JoinColumn({ name: "participant_id" })
  participant: Participant;

  @Column({ name: "team_id", nullable: true })
  teamId?: string;

  @ManyToOne(() => Team, { nullable: true })
  @JoinColumn({ name: "team_id" })
  team?: Team;

  @Column({ type: "enum", enum: CertificateTier })
  tier: CertificateTier;

  @Column({ type: "enum", enum: CertificateStatus, default: CertificateStatus.PENDING })
  status: CertificateStatus;

  // Participant details at time of certificate generation (snapshot)
  @Column({ name: "participant_name" })
  participantName: string;

  @Column({ name: "team_name", nullable: true })
  teamName?: string;

  @Column({ name: "cohort_name" })
  cohortName: string;

  @Column({ name: "vertical_name", nullable: true })
  verticalName?: string;

  // Score and rank at time of generation
  @Column({ name: "final_score", type: "decimal", precision: 5, scale: 2, nullable: true })
  finalScore?: number;

  @Column({ nullable: true })
  rank?: number;

  // File storage
  @Column({ name: "pdf_url", nullable: true })
  pdfUrl?: string;

  @Column({ name: "qr_code_data", nullable: true })
  qrCodeData?: string; // Base64 encoded QR code or URL

  // Generation metadata
  @Column({ name: "generated_at", nullable: true })
  generatedAt?: Date;

  @Column({ name: "generated_by", nullable: true })
  generatedBy?: string;

  @Column({ name: "error_message", nullable: true })
  errorMessage?: string;

  // Verification
  @Column({ name: "verification_url", nullable: true })
  verificationUrl?: string;

  @Column({ name: "download_count", default: 0 })
  downloadCount: number;

  @Column({ name: "last_downloaded_at", nullable: true })
  lastDownloadedAt?: Date;
}
