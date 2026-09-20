import {
  IsString,
  IsEmail,
  IsOptional,
  IsArray,
  IsNumber,
  IsUUID,
  IsEnum,
  IsBoolean,
  IsDateString,
  Min,
  Max,
  MinLength,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { MentorStatus, MentorPaymentStatus } from "@/database/entities/mentor.entity";

// ============ Mentor DTOs ============

export class CreateMentorDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  firstName: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  lastName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profileImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  expertise?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkedinUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxTeams?: number;

  @ApiPropertyOptional({ description: "Override session rate for this mentor (null = use cohort default)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sessionRateOverride?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  verticalScope?: string[];

  @ApiProperty()
  @IsUUID()
  cohortId: string;
}

export class UpdateMentorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profileImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  expertise?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  linkedinUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxTeams?: number;

  @ApiPropertyOptional({ description: "Override session rate for this mentor (null = use cohort default)" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sessionRateOverride?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  verticalScope?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(MentorStatus)
  status?: MentorStatus;
}

export class MentorQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cohortId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(MentorStatus)
  status?: MentorStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  verticalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  hasCapacity?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 20;
}

export class PaginatedMentorsDto {
  data: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============ Bulk Import DTOs ============

export class BulkImportMentorDto {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  company?: string;
  title?: string;
  bio?: string;
  expertise?: string[];
  maxTeams?: number;
  linkedinUrl?: string;
  sessionRateOverride?: number;
}

export class BulkImportResultDto {
  success: number;
  failed: number;
  errors: Array<{
    row: number;
    email?: string;
    error: string;
  }>;
  imported: string[];
}

// ============ Assignment DTOs ============

export class AssignMentorDto {
  @ApiProperty()
  @IsUUID()
  teamId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UnassignMentorDto {
  @ApiProperty()
  @IsUUID()
  teamId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

// ============ Session DTOs ============

export class CreateSessionDto {
  @ApiProperty()
  @IsUUID()
  teamId: string;

  @ApiProperty()
  @IsDateString()
  sessionDate: string;

  @ApiProperty()
  @IsNumber()
  @Min(15)
  @Max(480)
  durationMinutes: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topicsDiscussed?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  actionItems?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamProgressNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nextSessionGoals?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sessionType?: string;
}

export class UpdateSessionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  sessionDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(480)
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topicsDiscussed?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  actionItems?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamProgressNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nextSessionGoals?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sessionType?: string;
}

export class SessionQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  mentorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 20;
}

// ============ Statistics DTOs ============

export class MentorStatisticsDto {
  total: number;
  active: number;
  inactive: number;
  imported: number;
  totalCapacity: number;
  assignedTeams: number;
  availableSlots: number;
  averageTeamsPerMentor: number;
  totalSessions: number;
  totalSessionHours: number;
}

export class MentorCapacityDto {
  mentorId: string;
  mentorName: string;
  email: string;
  maxTeams: number;
  assignedTeams: number;
  availableSlots: number;
  verticalScope: string[];
  status: MentorStatus;
}


// ============ Payment DTOs ============

export class CreateMentorPaymentDto {
  @ApiProperty()
  @IsUUID()
  mentorId: string;

  @ApiProperty({ description: "Total payment amount" })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ description: "Number of sessions this payment covers" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sessionsCount?: number;

  @ApiPropertyOptional({ description: "IDs of ScheduledSessions included in this payment" })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  sessionIds?: string[];

  @ApiPropertyOptional({ description: "Start of payment period (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional({ description: "End of payment period (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @ApiPropertyOptional({ description: "External payment reference (e.g., bank transfer ID)" })
  @IsOptional()
  @IsString()
  paymentReference?: string;

  @ApiPropertyOptional({ description: "Payment method (bank_transfer, mobile_money, etc.)" })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateMentorPaymentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(MentorPaymentStatus)
  status?: MentorPaymentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class MentorPaymentQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  mentorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cohortId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(MentorPaymentStatus)
  status?: MentorPaymentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 20;
}

export class MentorEarningsDto {
  mentorId: string;
  mentorName: string;
  email: string;
  sessionRate: number; // Effective rate (mentor override or cohort default)
  confirmedSessions: number; // Completed sessions count
  completedSessions: number; // Same as confirmed for payment purposes
  totalEarned: number; // Total earnings from all completed sessions
  totalPaid: number; // Total amount already paid
  unpaidAmount: number; // Amount still owed (totalEarned - totalPaid)
  currentMonthEarned: number; // Earnings for current month
  currentMonthPaid: number; // Payments made this month
  currentMonthUnpaid: number; // Unpaid for current month
}

export class MentorEarningsSummaryDto {
  totalMentors: number;
  totalCompletedSessions: number;
  totalEarnings: number;
  totalPaid: number;
  totalUnpaid: number;
  currentMonthEarnings: number;
  currentMonthPaid: number;
  currentMonthUnpaid: number;
}

export class MentorPaymentRecordDto {
  id: string;
  mentorId: string;
  mentorName: string;
  amount: number;
  status: MentorPaymentStatus;
  sessionsCount: number;
  periodStart?: string;
  periodEnd?: string;
  paidAt?: Date;
  paidBy?: string;
  paymentReference?: string;
  paymentMethod?: string;
  notes?: string;
  createdAt: Date;
}
