import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Cohort } from "./cohort.entity";
import { User } from "./user.entity";

export enum AnnouncementAudience {
  ALL = "all",
  VERTICAL = "vertical",
  TEAM = "team",
  ORGANIZATION = "organization",
  MENTOR = "mentor",
}

export enum AnnouncementStatus {
  DRAFT = "draft",
  SCHEDULED = "scheduled",
  PUBLISHED = "published",
  ARCHIVED = "archived",
}

@Entity("announcements")
export class Announcement {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  title: string;

  @Column("text")
  content: string;

  @Column({
    type: "enum",
    enum: AnnouncementAudience,
    default: AnnouncementAudience.ALL,
  })
  audience: AnnouncementAudience;

  @Column({ type: "jsonb", nullable: true })
  audienceValue: string[] | null; // vertical IDs, team IDs, etc.

  @Column({
    type: "enum",
    enum: AnnouncementStatus,
    default: AnnouncementStatus.DRAFT,
  })
  status: AnnouncementStatus;

  @Column({ type: "timestamp", nullable: true })
  scheduledAt: Date | null;

  @Column({ type: "timestamp", nullable: true })
  publishedAt: Date | null;

  @Column({ default: false })
  isPinned: boolean;

  @Column({ type: "int", default: 0 })
  readCount: number;

  @Column("uuid")
  cohortId: string;

  @ManyToOne(() => Cohort, { onDelete: "CASCADE" })
  @JoinColumn({ name: "cohortId" })
  cohort: Cohort;

  @Column("uuid")
  createdById: string;

  @ManyToOne(() => User, { onDelete: "SET NULL" })
  @JoinColumn({ name: "createdById" })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
