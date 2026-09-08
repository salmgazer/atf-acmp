import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { Cohort } from "./cohort.entity";

/**
 * Author types for forum posts - can be participant, mentor, or staff
 */
export enum ForumAuthorType {
  PARTICIPANT = "participant",
  MENTOR = "mentor",
  STAFF = "staff",
}

/**
 * Forum categories organize threads by topic or vertical
 */
@Entity("forum_categories")
@Index(["cohortId", "sortOrder"])
@Index(["cohortId", "verticalId"])
export class ForumCategory extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ name: "cohort_id" })
  cohortId: string;

  @ManyToOne(() => Cohort)
  @JoinColumn({ name: "cohort_id" })
  cohort: Cohort;

  /**
   * Optional vertical ID - if set, only participants in this vertical can access
   * If null, category is visible to all cohort participants
   */
  @Column({ name: "vertical_id", nullable: true })
  verticalId?: string;

  @Column({ name: "icon_name", nullable: true })
  iconName?: string;

  @Column({ name: "sort_order", default: 0 })
  sortOrder: number;

  @Column({ name: "is_active", default: true })
  isActive: boolean;

  /**
   * Whether only staff can create threads in this category
   */
  @Column({ name: "staff_only", default: false })
  staffOnly: boolean;

  /**
   * Whether the category is locked (no new threads/replies allowed)
   */
  @Column({ name: "is_locked", default: false })
  isLocked: boolean;

  @OneToMany(() => ForumThread, (thread) => thread.category)
  threads: ForumThread[];

  // Virtual field for thread count
  threadCount?: number;

  // Virtual field for last activity
  lastActivity?: Date;
}

/**
 * Forum threads are discussion topics within a category
 */
@Entity("forum_threads")
@Index(["categoryId", "isPinned", "createdAt"])
@Index(["categoryId", "lastReplyAt"])
@Index(["authorId", "authorType"])
export class ForumThread extends BaseEntity {
  @Column({ name: "category_id" })
  categoryId: string;

  @ManyToOne(() => ForumCategory, (category) => category.threads, { onDelete: "CASCADE" })
  @JoinColumn({ name: "category_id" })
  category: ForumCategory;

  @Column()
  title: string;

  @Column({ type: "text" })
  content: string;

  /**
   * Author ID - references Participant, Mentor, or Staff based on authorType
   */
  @Column({ name: "author_id" })
  authorId: string;

  @Column({ name: "author_type", type: "enum", enum: ForumAuthorType })
  authorType: ForumAuthorType;

  /**
   * Denormalized author info for display
   */
  @Column({ name: "author_name" })
  authorName: string;

  @Column({ name: "author_avatar_url", nullable: true })
  authorAvatarUrl?: string;

  /**
   * Pinned threads appear at the top of the list
   */
  @Column({ name: "is_pinned", default: false })
  isPinned: boolean;

  /**
   * Locked threads cannot receive new replies
   */
  @Column({ name: "is_locked", default: false })
  isLocked: boolean;

  /**
   * Soft delete - uses BaseEntity.deletedAt
   */
  @Column({ name: "is_deleted", default: false })
  isDeleted: boolean;

  @Column({ name: "deleted_by", nullable: true })
  deletedBy?: string;

  /**
   * Edit tracking
   */
  @Column({ name: "is_edited", default: false })
  isEdited: boolean;

  @Column({ name: "edited_at", type: "timestamp", nullable: true })
  editedAt?: Date;

  /**
   * Reply tracking
   */
  @Column({ name: "reply_count", default: 0 })
  replyCount: number;

  @Column({ name: "last_reply_at", type: "timestamp", nullable: true })
  lastReplyAt?: Date;

  @Column({ name: "last_reply_author_name", nullable: true })
  lastReplyAuthorName?: string;

  /**
   * View count for analytics
   */
  @Column({ name: "view_count", default: 0 })
  viewCount: number;

  @OneToMany(() => ForumReply, (reply) => reply.thread)
  replies: ForumReply[];
}

/**
 * Forum replies are responses to threads
 */
@Entity("forum_replies")
@Index(["threadId", "createdAt"])
@Index(["authorId", "authorType"])
@Index(["parentReplyId"])
export class ForumReply extends BaseEntity {
  @Column({ name: "thread_id" })
  threadId: string;

  @ManyToOne(() => ForumThread, (thread) => thread.replies, { onDelete: "CASCADE" })
  @JoinColumn({ name: "thread_id" })
  thread: ForumThread;

  @Column({ type: "text" })
  content: string;

  /**
   * Author ID - references Participant, Mentor, or Staff based on authorType
   */
  @Column({ name: "author_id" })
  authorId: string;

  @Column({ name: "author_type", type: "enum", enum: ForumAuthorType })
  authorType: ForumAuthorType;

  /**
   * Denormalized author info for display
   */
  @Column({ name: "author_name" })
  authorName: string;

  @Column({ name: "author_avatar_url", nullable: true })
  authorAvatarUrl?: string;

  /**
   * Optional parent reply for nested replies (threaded discussions)
   */
  @Column({ name: "parent_reply_id", nullable: true })
  parentReplyId?: string;

  @ManyToOne(() => ForumReply, { nullable: true })
  @JoinColumn({ name: "parent_reply_id" })
  parentReply?: ForumReply;

  /**
   * Soft delete - uses BaseEntity.deletedAt
   */
  @Column({ name: "is_deleted", default: false })
  isDeleted: boolean;

  @Column({ name: "deleted_by", nullable: true })
  deletedBy?: string;

  /**
   * Edit tracking
   */
  @Column({ name: "is_edited", default: false })
  isEdited: boolean;

  @Column({ name: "edited_at", type: "timestamp", nullable: true })
  editedAt?: Date;

  /**
   * Marked as solution by thread author or staff
   */
  @Column({ name: "is_solution", default: false })
  isSolution: boolean;

  @Column({ name: "marked_solution_at", type: "timestamp", nullable: true })
  markedSolutionAt?: Date;

  @Column({ name: "marked_solution_by", nullable: true })
  markedSolutionBy?: string;
}

/**
 * Track thread views per user to avoid duplicate counting
 */
@Entity("forum_thread_views")
@Index(["threadId", "viewerId", "viewerType"], { unique: true })
export class ForumThreadView extends BaseEntity {
  @Column({ name: "thread_id" })
  threadId: string;

  @ManyToOne(() => ForumThread, { onDelete: "CASCADE" })
  @JoinColumn({ name: "thread_id" })
  thread: ForumThread;

  @Column({ name: "viewer_id" })
  viewerId: string;

  @Column({ name: "viewer_type", type: "enum", enum: ForumAuthorType })
  viewerType: ForumAuthorType;

  @Column({ name: "last_viewed_at", type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  lastViewedAt: Date;
}
