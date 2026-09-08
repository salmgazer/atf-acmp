import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  Unique,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { Team } from "./team.entity";
import { Participant } from "./participant.entity";
import { Cohort } from "./cohort.entity";

export enum JournalEntryStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
}

@Entity("journal_entries")
@Index(["teamId", "weekNumber"])
@Index(["cohortId", "weekNumber"])
@Index(["createdAt"])
@Unique(["teamId", "weekNumber"]) // One entry per team per week
export class JournalEntry extends BaseEntity {
  @Column({ name: "team_id" })
  teamId: string;

  @ManyToOne(() => Team)
  @JoinColumn({ name: "team_id" })
  team: Team;

  @Column({ name: "cohort_id" })
  cohortId: string;

  @ManyToOne(() => Cohort)
  @JoinColumn({ name: "cohort_id" })
  cohort: Cohort;

  @Column({ name: "author_id" })
  authorId: string;

  @ManyToOne(() => Participant)
  @JoinColumn({ name: "author_id" })
  author: Participant;

  @Column({ name: "week_number" })
  weekNumber: number;

  @Column({ type: "text", nullable: true })
  title?: string;

  @Column({ type: "text" })
  content: string;

  @Column({ type: "jsonb", nullable: true })
  highlights?: string[];

  @Column({ type: "jsonb", nullable: true })
  challenges?: string[];

  @Column({ name: "next_week_goals", type: "jsonb", nullable: true })
  nextWeekGoals?: string[];

  @Column({ type: "enum", enum: JournalEntryStatus, default: JournalEntryStatus.PUBLISHED })
  status: JournalEntryStatus;

  @Column({ name: "editable_until", type: "timestamp" })
  editableUntil: Date;

  @Column({ name: "last_edited_at", type: "timestamp", nullable: true })
  lastEditedAt?: Date;

  @Column({ name: "last_edited_by", nullable: true })
  lastEditedBy?: string;

  @Column({ name: "word_count", default: 0 })
  wordCount: number;

  /**
   * Check if entry can still be edited
   */
  canEdit(): boolean {
    return new Date() <= this.editableUntil;
  }

  /**
   * Calculate hours remaining for edit
   */
  hoursRemainingToEdit(): number {
    const now = new Date();
    const diff = this.editableUntil.getTime() - now.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60)));
  }
}
