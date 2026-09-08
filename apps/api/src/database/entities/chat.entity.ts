import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { Team } from "./team.entity";
import { Cohort } from "./cohort.entity";

export enum ChannelType {
  TEAM = "team", // Team internal channel
  MENTOR_TEAM = "mentor_team", // Mentor-Team channel
  STAFF = "staff", // Staff channel
  ANNOUNCEMENT = "announcement", // Broadcast channel
  DIRECT = "direct", // Direct messages
}

@Entity("chat_channels")
@Index(["cohortId", "type"])
@Index(["teamId"])
export class ChatChannel extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "enum", enum: ChannelType })
  type: ChannelType;

  @Column({ name: "cohort_id", nullable: true })
  cohortId?: string;

  @ManyToOne(() => Cohort, { nullable: true })
  @JoinColumn({ name: "cohort_id" })
  cohort?: Cohort;

  @Column({ name: "team_id", nullable: true })
  teamId?: string;

  @ManyToOne(() => Team, { nullable: true })
  @JoinColumn({ name: "team_id" })
  team?: Team;

  @Column({ name: "is_private", default: false })
  isPrivate: boolean;

  @Column({ name: "is_archived", default: false })
  isArchived: boolean;

  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, any>;

  @OneToMany(() => ChatMessage, (message) => message.channel)
  messages: ChatMessage[];

  @OneToMany(() => ChannelMember, (member) => member.channel)
  members: ChannelMember[];

  /**
   * Get member count
   */
  get memberCount(): number {
    return this.members?.length || 0;
  }
}

export enum SenderType {
  PARTICIPANT = "participant",
  MENTOR = "mentor",
  STAFF = "staff",
  ORGANIZATION = "organization",
  SYSTEM = "system",
}

export enum MessageType {
  TEXT = "text",
  IMAGE = "image",
  FILE = "file",
  SYSTEM = "system",
}

@Entity("chat_messages")
@Index(["channelId", "createdAt"])
@Index(["senderId", "senderType"])
export class ChatMessage extends BaseEntity {
  @Column({ name: "channel_id" })
  channelId: string;

  @ManyToOne(() => ChatChannel, (channel) => channel.messages, { onDelete: "CASCADE" })
  @JoinColumn({ name: "channel_id" })
  channel: ChatChannel;

  @Column({ name: "sender_id" })
  senderId: string;

  @Column({ name: "sender_type", type: "enum", enum: SenderType })
  senderType: SenderType;

  @Column({ name: "sender_name" })
  senderName: string;

  @Column({ name: "sender_avatar_url", nullable: true })
  senderAvatarUrl?: string;

  @Column({ type: "text" })
  content: string;

  @Column({ name: "message_type", type: "enum", enum: MessageType, default: MessageType.TEXT })
  messageType: MessageType;

  @Column({ name: "attachment_url", nullable: true })
  attachmentUrl?: string;

  @Column({ name: "attachment_name", nullable: true })
  attachmentName?: string;

  @Column({ name: "attachment_size", nullable: true })
  attachmentSize?: number;

  @Column({ name: "attachment_mime_type", nullable: true })
  attachmentMimeType?: string;

  @Column({ name: "reply_to_id", nullable: true })
  replyToId?: string;

  @ManyToOne(() => ChatMessage, { nullable: true })
  @JoinColumn({ name: "reply_to_id" })
  replyTo?: ChatMessage;

  @Column({ name: "is_edited", default: false })
  isEdited: boolean;

  @Column({ name: "edited_at", type: "timestamp", nullable: true })
  editedAt?: Date;

  @Column({ name: "is_deleted", default: false })
  isDeleted: boolean;

  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, any>;

  @OneToMany(() => MessageReaction, (reaction) => reaction.message)
  reactions: MessageReaction[];
}

@Entity("channel_members")
@Index(["channelId"])
@Index(["memberId", "memberType"])
@Index(["channelId", "memberId", "memberType"], { unique: true })
export class ChannelMember extends BaseEntity {
  @Column({ name: "channel_id" })
  channelId: string;

  @ManyToOne(() => ChatChannel, (channel) => channel.members, { onDelete: "CASCADE" })
  @JoinColumn({ name: "channel_id" })
  channel: ChatChannel;

  @Column({ name: "member_id" })
  memberId: string;

  @Column({ name: "member_type", type: "enum", enum: SenderType })
  memberType: SenderType;

  @Column({ name: "member_name" })
  memberName: string;

  @Column({ name: "member_avatar_url", nullable: true })
  memberAvatarUrl?: string;

  @Column({ name: "last_read_at", type: "timestamp", nullable: true })
  lastReadAt?: Date;

  @Column({ name: "last_read_message_id", nullable: true })
  lastReadMessageId?: string;

  @Column({ name: "is_admin", default: false })
  isAdmin: boolean;

  @Column({ name: "is_muted", default: false })
  isMuted: boolean;

  @Column({ name: "muted_until", type: "timestamp", nullable: true })
  mutedUntil?: Date;

  @Column({ name: "joined_at", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  joinedAt: Date;

  @Column({ name: "left_at", type: "timestamp", nullable: true })
  leftAt?: Date;

  /**
   * Check if member has unread messages
   */
  hasUnreadMessages(latestMessageTime?: Date): boolean {
    if (!latestMessageTime) return false;
    if (!this.lastReadAt) return true;
    return this.lastReadAt < latestMessageTime;
  }
}

@Entity("message_reactions")
@Index(["messageId"])
@Index(["messageId", "reactorId", "reactorType", "emoji"], { unique: true })
export class MessageReaction extends BaseEntity {
  @Column({ name: "message_id" })
  messageId: string;

  @ManyToOne(() => ChatMessage, (message) => message.reactions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "message_id" })
  message: ChatMessage;

  @Column({ name: "reactor_id" })
  reactorId: string;

  @Column({ name: "reactor_type", type: "enum", enum: SenderType })
  reactorType: SenderType;

  @Column()
  emoji: string;
}

/**
 * Entity to track typing status (ephemeral, not persisted long-term)
 */
@Entity("typing_indicators")
@Index(["channelId"])
export class TypingIndicator extends BaseEntity {
  @Column({ name: "channel_id" })
  channelId: string;

  @Column({ name: "user_id" })
  userId: string;

  @Column({ name: "user_type", type: "enum", enum: SenderType })
  userType: SenderType;

  @Column({ name: "user_name" })
  userName: string;

  @Column({ name: "started_at", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  startedAt: Date;
}
