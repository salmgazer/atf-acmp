import { Entity, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { BaseEntity } from "./base.entity";
import { Cohort } from "./cohort.entity";

@Entity("verticals")
@Index(["cohortId", "name"], { unique: true })
export class Vertical extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ name: "brief_cap", default: 10 })
  briefCap: number;

  @Column({ name: "brief_count", default: 0 })
  briefCount: number;

  @Column({ name: "display_order", default: 0 })
  displayOrder: number;

  @Column({ name: "is_active", default: true })
  isActive: boolean;

  @ManyToOne(() => Cohort, { onDelete: "CASCADE" })
  @JoinColumn({ name: "cohort_id" })
  cohort: Cohort;

  @Column({ name: "cohort_id" })
  cohortId: string;

  /**
   * Check if vertical has capacity for more briefs
   */
  hasCapacity(): boolean {
    return this.briefCount < this.briefCap;
  }

  /**
   * Get remaining capacity
   */
  getRemainingCapacity(): number {
    return Math.max(0, this.briefCap - this.briefCount);
  }
}
