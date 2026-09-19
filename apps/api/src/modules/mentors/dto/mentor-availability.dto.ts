import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsUUID,
  IsEnum,
  IsBoolean,
  IsDateString,
  Min,
  Max,
  ValidateNested,
  Matches,
  ArrayMinSize,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { DayOfWeek } from "@/database/entities/mentor.entity";

// ============ Availability Slot DTOs ============

/**
 * DTO for creating a single weekly availability slot
 */
export class CreateAvailabilitySlotDto {
  @ApiProperty({ enum: DayOfWeek, description: "Day of the week (0 = Sunday, 6 = Saturday)" })
  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  @ApiProperty({ description: "Start time in HH:MM format (24-hour)", example: "10:00" })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Start time must be in HH:MM format (24-hour)" })
  startTime: string;

  @ApiProperty({ description: "End time in HH:MM format (24-hour)", example: "12:00" })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "End time must be in HH:MM format (24-hour)" })
  endTime: string;

  @ApiPropertyOptional({ description: "Duration of each session in minutes", default: 45 })
  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(120)
  durationMinutes?: number;

  @ApiPropertyOptional({ description: "Buffer between sessions in minutes", default: 15 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  bufferMinutes?: number;

  @ApiPropertyOptional({ description: "Timezone for this slot", default: "Africa/Nairobi" })
  @IsOptional()
  @IsString()
  timezone?: string;
}

/**
 * DTO for updating an availability slot
 */
export class UpdateAvailabilitySlotDto {
  @ApiPropertyOptional({ enum: DayOfWeek })
  @IsOptional()
  @IsEnum(DayOfWeek)
  dayOfWeek?: DayOfWeek;

  @ApiPropertyOptional({ description: "Start time in HH:MM format (24-hour)" })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Start time must be in HH:MM format (24-hour)" })
  startTime?: string;

  @ApiPropertyOptional({ description: "End time in HH:MM format (24-hour)" })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "End time must be in HH:MM format (24-hour)" })
  endTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(120)
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  bufferMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;
}

/**
 * DTO for bulk setting weekly availability (replace all slots)
 */
export class SetWeeklyAvailabilityDto {
  @ApiProperty({ type: [CreateAvailabilitySlotDto], description: "Array of weekly availability slots" })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAvailabilitySlotDto)
  slots: CreateAvailabilitySlotDto[];

  @ApiPropertyOptional({ description: "Default timezone for all slots", default: "Africa/Nairobi" })
  @IsOptional()
  @IsString()
  defaultTimezone?: string;
}

// ============ Availability Exception DTOs ============

/**
 * Custom time slot for exceptions
 */
export class CustomTimeSlotDto {
  @ApiProperty({ description: "Start time in HH:MM format (24-hour)" })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Start time must be in HH:MM format (24-hour)" })
  startTime: string;

  @ApiProperty({ description: "End time in HH:MM format (24-hour)" })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "End time must be in HH:MM format (24-hour)" })
  endTime: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(120)
  durationMinutes?: number;
}

/**
 * DTO for creating an availability exception (vacation, custom hours, etc.)
 */
export class CreateAvailabilityExceptionDto {
  @ApiProperty({ description: "Date in YYYY-MM-DD format", example: "2026-08-15" })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ description: "If true, mentor is unavailable the entire day" })
  @IsOptional()
  @IsBoolean()
  isUnavailable?: boolean;

  @ApiPropertyOptional({ type: [CustomTimeSlotDto], description: "Custom time slots for this day (overrides weekly schedule)" })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomTimeSlotDto)
  customSlots?: CustomTimeSlotDto[];

  @ApiPropertyOptional({ description: "Reason for the exception (vacation, holiday, etc.)" })
  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * DTO for updating an availability exception
 */
export class UpdateAvailabilityExceptionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isUnavailable?: boolean;

  @ApiPropertyOptional({ type: [CustomTimeSlotDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomTimeSlotDto)
  customSlots?: CustomTimeSlotDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * DTO for creating a date range exception (e.g., vacation from date A to date B)
 */
export class CreateDateRangeExceptionDto {
  @ApiProperty({ description: "Start date in YYYY-MM-DD format" })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: "End date in YYYY-MM-DD format" })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ description: "Reason for unavailability" })
  @IsOptional()
  @IsString()
  reason?: string;
}

// ============ Available Slots Query DTOs ============

/**
 * DTO for querying available slots for a mentor
 */
export class GetAvailableSlotsQueryDto {
  @ApiProperty({ description: "Start date for slot search (YYYY-MM-DD)" })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: "End date for slot search (YYYY-MM-DD)" })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ description: "Timezone for returned slots", default: "Africa/Nairobi" })
  @IsOptional()
  @IsString()
  timezone?: string;
}

// ============ Response DTOs ============

/**
 * Response DTO for a single availability slot
 */
export class AvailabilitySlotResponseDto {
  id: string;
  dayOfWeek: DayOfWeek;
  dayName: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  bufferMinutes: number;
  isActive: boolean;
  timezone: string;
  slotCount: number;
}

/**
 * Response DTO for weekly availability
 */
export class WeeklyAvailabilityResponseDto {
  mentorId: string;
  mentorName: string;
  slots: AvailabilitySlotResponseDto[];
  totalWeeklySlots: number;
  defaultTimezone: string;
}

/**
 * Response DTO for an availability exception
 */
export class AvailabilityExceptionResponseDto {
  id: string;
  date: string;
  isUnavailable: boolean;
  customSlots?: CustomTimeSlotDto[];
  reason?: string;
}

/**
 * Response DTO for a bookable time slot (computed from availability)
 */
export class BookableSlotDto {
  date: string; // YYYY-MM-DD
  dayOfWeek: DayOfWeek;
  dayName: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  startDateTime: string; // ISO datetime
  endDateTime: string; // ISO datetime
  durationMinutes: number;
  isAvailable: boolean; // false if already booked
  timezone: string;
}

/**
 * Response DTO for available slots grouped by date
 */
export class AvailableSlotsResponseDto {
  mentorId: string;
  mentorName: string;
  startDate: string;
  endDate: string;
  timezone: string;
  slots: BookableSlotDto[];
  slotsByDate: Record<string, BookableSlotDto[]>;
}

// ============ Booking DTOs ============

/**
 * DTO for booking a session with a mentor
 */
export class BookSessionDto {
  @ApiProperty({ description: "Claim ID for the mentor-team pairing" })
  @IsUUID()
  claimId: string;

  @ApiProperty({ description: "Date of the session (YYYY-MM-DD)" })
  @IsDateString()
  date: string;

  @ApiProperty({ description: "Start time of the session (HH:MM)", example: "10:00" })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Start time must be in HH:MM format (24-hour)" })
  startTime: string;

  @ApiProperty({ description: "The specific question the team wants to discuss" })
  @IsString()
  @Min(10)
  question: string;

  @ApiPropertyOptional({ description: "Timezone for the session", default: "Africa/Nairobi" })
  @IsOptional()
  @IsString()
  timezone?: string;
}

/**
 * Response DTO for a booked session
 */
export class BookedSessionResponseDto {
  id: string;
  claimId: string;
  mentorId: string;
  mentorName: string;
  teamId: string;
  teamName: string;
  sessionNumber: number;
  scheduledAt: string;
  durationMinutes: number;
  question: string;
  status: string;
  googleMeetLink?: string;
  googleEventId?: string;
}
