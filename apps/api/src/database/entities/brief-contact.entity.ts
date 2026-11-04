import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "./base.entity";
import { Brief } from "./brief.entity";

@Entity("brief_contacts")
@Check("brief_contact_normalized_email", "email = lower(btrim(email))")
@Index("brief_contact_email_unique", ["briefId", "email"], { unique: true })
@Index("brief_contact_primary_unique", ["briefId"], { unique: true, where: 'is_primary = true AND deleted_at IS NULL' })
export class BriefContact extends BaseEntity {
  @Column({ name: "brief_id", type: "uuid" }) briefId: string;
  @ManyToOne(() => Brief, { onDelete: "CASCADE" })
  @JoinColumn({ name: "brief_id", foreignKeyConstraintName: "brief_contacts_brief_id_fkey" }) brief: Brief;
  @Column({ length: 255 }) name: string;
  @Column({ length: 255 }) email: string;
  @Column({ nullable: true, length: 255 }) role?: string;
  @Column({ nullable: true, length: 50 }) phone?: string;
  @Column({ name: "is_primary", default: false }) isPrimary: boolean;
  @Column({ name: "is_submitter", default: false }) isSubmitter: boolean;
}
