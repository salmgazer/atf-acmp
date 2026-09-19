---
inclusion: fileMatch
fileMatchPattern: "**/*.entity.ts,**/entities/**/*.ts,**/migrations/**/*.ts"
---

# Database Schema & TypeORM Conventions

## ⚠️ CRITICAL RULE: Schema Changes via Migrations ONLY

**NEVER modify entity files directly to add, remove, or alter database columns.**

All database schema changes MUST follow this process:
1. **Create migration first**: Write SQL in `up()` and `down()` methods
2. **Run migration**: Apply changes to database
3. **Update entity**: Then update the TypeScript entity to match

Why: Entity decorators don't modify the actual database. Production has existing data.

See also: `.kiro/steering/database-rules.md`

---

## Entity Base Class

All entities extend a common base:

```typescript
@Entity()
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Entity class | PascalCase, singular | `Team`, `Participant` |
| Table name | snake_case, plural | `teams`, `participants` |
| Column name | camelCase in entity, snake_case in DB | `createdAt` → `created_at` |
| Foreign key | `{relation}Id` | `cohortId`, `teamId` |
| Enum | PascalCase | `CohortStatus`, `TeamRole` |

## Core Entities

### User & Auth

```typescript
@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column({ type: 'enum', enum: Role })
  role: Role;

  @Column({ nullable: true })
  firebaseUid: string;

  @Column({ default: false })
  mustChangePassword: boolean;
}
```

### Cohort

```typescript
@Entity('cohorts')
export class Cohort extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'enum', enum: CohortStatus, default: CohortStatus.DRAFT })
  status: CohortStatus;

  @Column()
  teamSizeMin: number;

  @Column()
  teamSizeMax: number;

  @Column({ type: 'jsonb' })
  deadlines: CohortDeadlines;

  @Column({ type: 'jsonb' })
  rubric: RubricConfig;

  @Column({ type: 'jsonb' })
  countries: string[];

  @Column()
  briefCap: number;

  @OneToMany(() => Vertical, (v) => v.cohort)
  verticals: Vertical[];

  @OneToMany(() => Team, (t) => t.cohort)
  teams: Team[];
}
```

### Team

```typescript
@Entity('teams')
export class Team extends BaseEntity {
  @Column()
  name: string;

  @ManyToOne(() => Cohort, (c) => c.teams)
  @JoinColumn({ name: 'cohort_id' })
  cohort: Cohort;

  @Column()
  cohortId: string;

  @ManyToOne(() => Brief, { nullable: true })
  @JoinColumn({ name: 'brief_id' })
  brief: Brief;

  @Column({ nullable: true })
  briefId: string;

  @Column({ type: 'enum', enum: TeamStatus, default: TeamStatus.FORMING })
  status: TeamStatus;

  @OneToMany(() => TeamMember, (m) => m.team)
  members: TeamMember[];
}
```

### Participant

```typescript
@Entity('participants')
export class Participant extends BaseEntity {
  @Column({ unique: true })
  participantId: string;

  @Column({ unique: true })
  email: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  country: string;

  @Column({ nullable: true })
  institution: string;

  @Column({ type: 'jsonb', default: [] })
  skills: string[];

  @Column({ nullable: true })
  firebaseUid: string;

  @Column({ default: true })
  mustChangePassword: boolean;

  @Column({ default: false })
  onboardingComplete: boolean;
}
```

## Enums

```typescript
export enum CohortStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  EVALUATION = 'evaluation',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export enum TeamStatus {
  FORMING = 'forming',
  ACTIVE = 'active',
  SUBMITTED = 'submitted',
  EVALUATED = 'evaluated',
  DISQUALIFIED = 'disqualified',
}

export enum TeamRole {
  LEAD = 'lead',
  CO_LEAD = 'co_lead',
  MEMBER = 'member',
}

export enum BriefStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REVISION_REQUESTED = 'revision_requested',
}

export enum Role {
  SUPER_ADMIN = 'super_admin',
  PROGRAM_MANAGER = 'program_manager',
  EVALUATOR = 'evaluator',
  VIEWER = 'viewer',
  ORGANIZATION = 'organization',
  PARTICIPANT = 'participant',
  MENTOR = 'mentor',
}
```

## Relationships

| Relationship | Pattern |
|--------------|---------|
| One-to-Many | `@OneToMany` + `@ManyToOne` |
| Many-to-Many | Join table with `@ManyToMany` or explicit entity |
| Soft Delete | `@DeleteDateColumn() deletedAt: Date` |

## Migrations

Generate migrations with:

```bash
npm run typeorm migration:generate -- -n MigrationName
npm run typeorm migration:run
```

Always review generated migrations before running.

## Indexes

Add indexes for frequently queried columns:

```typescript
@Entity('teams')
@Index(['cohortId', 'status'])
@Index(['briefId'])
export class Team extends BaseEntity { ... }
```

## JSON Columns

Use `jsonb` for flexible data:

```typescript
@Column({ type: 'jsonb', default: {} })
metadata: Record<string, any>;

// With typed interface
@Column({ type: 'jsonb' })
deadlines: {
  registrationEnd: string;
  teamFormationEnd: string;
  stage1End: string;
  stage2End: string;
  stage3End: string;
};
```
