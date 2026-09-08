import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { Cohort } from "./cohort.entity";
import { Vertical } from "./vertical.entity";

export enum ResourceType {
  DOCUMENT = "document",
  VIDEO = "video",
  LINK = "link",
  TEMPLATE = "template",
}

export enum ResourceVisibility {
  ALL = "all",
  VERTICAL = "vertical",
  STAFF = "staff",
}

@Entity("resources")
@Index(["cohortId", "type"])
@Index(["cohortId", "verticalId"])
@Index(["isPublished"])
export class Resource extends BaseEntity {
  @Column({ name: "cohort_id", nullable: true })
  cohortId?: string;

  @ManyToOne(() => Cohort, { nullable: true })
  @JoinColumn({ name: "cohort_id" })
  cohort?: Cohort;

  @Column({ name: "vertical_id", nullable: true })
  verticalId?: string;

  @ManyToOne(() => Vertical, { nullable: true })
  @JoinColumn({ name: "vertical_id" })
  vertical?: Vertical;

  @Column()
  title: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "enum", enum: ResourceType })
  type: ResourceType;

  @Column({ name: "file_url", nullable: true })
  fileUrl?: string;

  @Column({ name: "external_url", nullable: true })
  externalUrl?: string;

  @Column({ name: "video_embed_url", nullable: true })
  videoEmbedUrl?: string;

  @Column({ name: "file_name", nullable: true })
  fileName?: string;

  @Column({ name: "file_size", nullable: true })
  fileSize?: number;

  @Column({ name: "file_type", nullable: true })
  fileType?: string;

  @Column({ name: "thumbnail_url", nullable: true })
  thumbnailUrl?: string;

  @Column({ type: "jsonb", default: [] })
  tags: string[];

  @Column({ type: "enum", enum: ResourceVisibility, default: ResourceVisibility.ALL })
  visibility: ResourceVisibility;

  @Column({ name: "is_published", default: true })
  isPublished: boolean;

  @Column({ name: "is_featured", default: false })
  isFeatured: boolean;

  @Column({ name: "sort_order", default: 0 })
  sortOrder: number;

  @Column({ name: "download_count", default: 0 })
  downloadCount: number;

  @Column({ name: "view_count", default: 0 })
  viewCount: number;

  @Column({ name: "uploaded_by" })
  uploadedBy: string;

  /**
   * Get the URL to access this resource
   */
  getAccessUrl(): string | null {
    if (this.type === ResourceType.LINK) {
      return this.externalUrl || null;
    }
    if (this.type === ResourceType.VIDEO) {
      return this.videoEmbedUrl || this.externalUrl || this.fileUrl || null;
    }
    return this.fileUrl || this.externalUrl || null;
  }
}
