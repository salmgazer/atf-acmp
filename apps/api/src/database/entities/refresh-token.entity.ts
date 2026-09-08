import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";

@Entity("refresh_tokens")
@Index(["token"], { unique: true })
@Index(["userId", "isRevoked"])
export class RefreshToken {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  token: string;

  @Column("uuid", { nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "userId" })
  user: User | null;

  // For participant tokens (participants are not in users table)
  @Column("uuid", { nullable: true })
  participantId: string | null;

  @Column({ type: "timestamp" })
  expiresAt: Date;

  @Column({ default: false })
  isRevoked: boolean;

  @Column({ type: "timestamp", nullable: true })
  revokedAt: Date | null;

  @Column({ type: "varchar", nullable: true })
  revokedReason: string | null;

  @Column({ type: "varchar", nullable: true })
  userAgent: string | null;

  @Column({ type: "varchar", nullable: true })
  ipAddress: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: "timestamp", nullable: true })
  lastUsedAt: Date | null;
}
