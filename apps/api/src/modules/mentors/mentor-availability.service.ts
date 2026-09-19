import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from "typeorm";
import {
  MentorAvailability,
  MentorAvailabilityException,
  DayOfWeek,
  DAY_OF_WEEK_LABELS,
  Mentor,
  ScheduledSession,
  ScheduledSessionStatus,
} from "@/database/entities/mentor.entity";
import {
  CreateAvailabilitySlotDto,
  UpdateAvailabilitySlotDto,
  SetWeeklyAvailabilityDto,
  CreateAvailabilityExceptionDto,
  UpdateAvailabilityExceptionDto,
  CreateDateRangeExceptionDto,
  GetAvailableSlotsQueryDto,
  AvailabilitySlotResponseDto,
  WeeklyAvailabilityResponseDto,
  AvailabilityExceptionResponseDto,
  BookableSlotDto,
  AvailableSlotsResponseDto,
} from "./dto/mentor-availability.dto";

@Injectable()
export class MentorAvailabilityService {
  constructor(
    @InjectRepository(MentorAvailability)
    private availabilityRepository: Repository<MentorAvailability>,
    @InjectRepository(MentorAvailabilityException)
    private exceptionRepository: Repository<MentorAvailabilityException>,
    @InjectRepository(Mentor)
    private mentorRepository: Repository<Mentor>,
    @InjectRepository(ScheduledSession)
    private sessionRepository: Repository<ScheduledSession>,
  ) {}

  // ============ Weekly Availability Methods ============

  /**
   * Get all weekly availability slots for a mentor
   */
  async getWeeklyAvailability(mentorId: string): Promise<WeeklyAvailabilityResponseDto> {
    const mentor = await this.mentorRepository.findOne({ where: { id: mentorId } });
    if (!mentor) {
      throw new NotFoundException(`Mentor with ID ${mentorId} not found`);
    }

    const slots = await this.availabilityRepository.find({
      where: { mentorId, isActive: true },
      order: { dayOfWeek: "ASC", startTime: "ASC" },
    });

    const slotResponses: AvailabilitySlotResponseDto[] = slots.map((slot) => ({
      id: slot.id,
      dayOfWeek: slot.dayOfWeek,
      dayName: DAY_OF_WEEK_LABELS[slot.dayOfWeek],
      startTime: slot.startTime,
      endTime: slot.endTime,
      durationMinutes: slot.durationMinutes,
      bufferMinutes: slot.bufferMinutes,
      isActive: slot.isActive,
      timezone: slot.timezone,
      slotCount: slot.slotCount,
    }));

    return {
      mentorId,
      mentorName: mentor.fullName,
      slots: slotResponses,
      totalWeeklySlots: slotResponses.reduce((sum, s) => sum + s.slotCount, 0),
      defaultTimezone: slots[0]?.timezone || "Africa/Nairobi",
    };
  }

  /**
   * Create a single availability slot
   */
  async createAvailabilitySlot(
    mentorId: string,
    dto: CreateAvailabilitySlotDto,
  ): Promise<AvailabilitySlotResponseDto> {
    const mentor = await this.mentorRepository.findOne({ where: { id: mentorId } });
    if (!mentor) {
      throw new NotFoundException(`Mentor with ID ${mentorId} not found`);
    }

    // Validate time range
    this.validateTimeRange(dto.startTime, dto.endTime);

    // Check for overlapping slots on the same day
    await this.checkForOverlappingSlots(mentorId, dto.dayOfWeek, dto.startTime, dto.endTime);

    const slot = this.availabilityRepository.create({
      mentorId,
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime + ":00", // Add seconds for TIME type
      endTime: dto.endTime + ":00",
      durationMinutes: dto.durationMinutes || 45,
      bufferMinutes: dto.bufferMinutes || 15,
      timezone: dto.timezone || "Africa/Nairobi",
      isActive: true,
    });

    const saved = await this.availabilityRepository.save(slot);

    return {
      id: saved.id,
      dayOfWeek: saved.dayOfWeek,
      dayName: DAY_OF_WEEK_LABELS[saved.dayOfWeek],
      startTime: saved.startTime,
      endTime: saved.endTime,
      durationMinutes: saved.durationMinutes,
      bufferMinutes: saved.bufferMinutes,
      isActive: saved.isActive,
      timezone: saved.timezone,
      slotCount: saved.slotCount,
    };
  }

  /**
   * Update an availability slot
   */
  async updateAvailabilitySlot(
    slotId: string,
    dto: UpdateAvailabilitySlotDto,
  ): Promise<AvailabilitySlotResponseDto> {
    const slot = await this.availabilityRepository.findOne({ where: { id: slotId } });
    if (!slot) {
      throw new NotFoundException(`Availability slot with ID ${slotId} not found`);
    }

    // If updating time, validate
    const newStartTime = dto.startTime || slot.startTime.substring(0, 5);
    const newEndTime = dto.endTime || slot.endTime.substring(0, 5);
    const newDayOfWeek = dto.dayOfWeek ?? slot.dayOfWeek;

    if (dto.startTime || dto.endTime) {
      this.validateTimeRange(newStartTime, newEndTime);
    }

    // Check for overlapping slots if day or time changed
    if (dto.dayOfWeek !== undefined || dto.startTime || dto.endTime) {
      await this.checkForOverlappingSlots(
        slot.mentorId,
        newDayOfWeek,
        newStartTime,
        newEndTime,
        slotId,
      );
    }

    // Update fields
    if (dto.dayOfWeek !== undefined) slot.dayOfWeek = dto.dayOfWeek;
    if (dto.startTime) slot.startTime = dto.startTime + ":00";
    if (dto.endTime) slot.endTime = dto.endTime + ":00";
    if (dto.durationMinutes !== undefined) slot.durationMinutes = dto.durationMinutes;
    if (dto.bufferMinutes !== undefined) slot.bufferMinutes = dto.bufferMinutes;
    if (dto.isActive !== undefined) slot.isActive = dto.isActive;
    if (dto.timezone) slot.timezone = dto.timezone;

    const saved = await this.availabilityRepository.save(slot);

    return {
      id: saved.id,
      dayOfWeek: saved.dayOfWeek,
      dayName: DAY_OF_WEEK_LABELS[saved.dayOfWeek],
      startTime: saved.startTime,
      endTime: saved.endTime,
      durationMinutes: saved.durationMinutes,
      bufferMinutes: saved.bufferMinutes,
      isActive: saved.isActive,
      timezone: saved.timezone,
      slotCount: saved.slotCount,
    };
  }

  /**
   * Delete an availability slot
   */
  async deleteAvailabilitySlot(slotId: string): Promise<void> {
    const slot = await this.availabilityRepository.findOne({ where: { id: slotId } });
    if (!slot) {
      throw new NotFoundException(`Availability slot with ID ${slotId} not found`);
    }
    await this.availabilityRepository.remove(slot);
  }

  /**
   * Set the entire weekly availability (replaces existing)
   */
  async setWeeklyAvailability(
    mentorId: string,
    dto: SetWeeklyAvailabilityDto,
  ): Promise<WeeklyAvailabilityResponseDto> {
    const mentor = await this.mentorRepository.findOne({ where: { id: mentorId } });
    if (!mentor) {
      throw new NotFoundException(`Mentor with ID ${mentorId} not found`);
    }

    // Validate all slots
    for (const slotDto of dto.slots) {
      this.validateTimeRange(slotDto.startTime, slotDto.endTime);
    }

    // Check for overlapping slots within the provided slots
    this.checkForOverlappingInBatch(dto.slots);

    // Delete existing slots
    await this.availabilityRepository.delete({ mentorId });

    // Create new slots
    const defaultTimezone = dto.defaultTimezone || "Africa/Nairobi";
    const slots = dto.slots.map((slotDto) =>
      this.availabilityRepository.create({
        mentorId,
        dayOfWeek: slotDto.dayOfWeek,
        startTime: slotDto.startTime + ":00",
        endTime: slotDto.endTime + ":00",
        durationMinutes: slotDto.durationMinutes || 45,
        bufferMinutes: slotDto.bufferMinutes || 15,
        timezone: slotDto.timezone || defaultTimezone,
        isActive: true,
      }),
    );

    await this.availabilityRepository.save(slots);

    return this.getWeeklyAvailability(mentorId);
  }

  // ============ Exception Methods ============

  /**
   * Get all exceptions for a mentor within a date range
   */
  async getExceptions(
    mentorId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<AvailabilityExceptionResponseDto[]> {
    const where: any = { mentorId };
    if (startDate && endDate) {
      where.date = Between(startDate, endDate);
    } else if (startDate) {
      where.date = MoreThanOrEqual(startDate);
    } else if (endDate) {
      where.date = LessThanOrEqual(endDate);
    }

    const exceptions = await this.exceptionRepository.find({
      where,
      order: { date: "ASC" },
    });

    return exceptions.map((exc) => ({
      id: exc.id,
      date: exc.date,
      isUnavailable: exc.isUnavailable,
      customSlots: exc.customSlots,
      reason: exc.reason,
    }));
  }

  /**
   * Create a single exception
   */
  async createException(
    mentorId: string,
    dto: CreateAvailabilityExceptionDto,
  ): Promise<AvailabilityExceptionResponseDto> {
    const mentor = await this.mentorRepository.findOne({ where: { id: mentorId } });
    if (!mentor) {
      throw new NotFoundException(`Mentor with ID ${mentorId} not found`);
    }

    // Check if exception already exists for this date
    const existing = await this.exceptionRepository.findOne({
      where: { mentorId, date: dto.date },
    });
    if (existing) {
      throw new ConflictException(`Exception already exists for date ${dto.date}`);
    }

    // Validate custom slots if provided
    if (dto.customSlots) {
      for (const slot of dto.customSlots) {
        this.validateTimeRange(slot.startTime, slot.endTime);
      }
    }

    const exception = this.exceptionRepository.create({
      mentorId,
      date: dto.date,
      isUnavailable: dto.isUnavailable || false,
      customSlots: dto.customSlots,
      reason: dto.reason,
    });

    const saved = await this.exceptionRepository.save(exception);

    return {
      id: saved.id,
      date: saved.date,
      isUnavailable: saved.isUnavailable,
      customSlots: saved.customSlots,
      reason: saved.reason,
    };
  }

  /**
   * Update an exception
   */
  async updateException(
    exceptionId: string,
    dto: UpdateAvailabilityExceptionDto,
  ): Promise<AvailabilityExceptionResponseDto> {
    const exception = await this.exceptionRepository.findOne({ where: { id: exceptionId } });
    if (!exception) {
      throw new NotFoundException(`Exception with ID ${exceptionId} not found`);
    }

    if (dto.customSlots) {
      for (const slot of dto.customSlots) {
        this.validateTimeRange(slot.startTime, slot.endTime);
      }
    }

    if (dto.isUnavailable !== undefined) exception.isUnavailable = dto.isUnavailable;
    if (dto.customSlots !== undefined) exception.customSlots = dto.customSlots;
    if (dto.reason !== undefined) exception.reason = dto.reason;

    const saved = await this.exceptionRepository.save(exception);

    return {
      id: saved.id,
      date: saved.date,
      isUnavailable: saved.isUnavailable,
      customSlots: saved.customSlots,
      reason: saved.reason,
    };
  }

  /**
   * Delete an exception
   */
  async deleteException(exceptionId: string): Promise<void> {
    const exception = await this.exceptionRepository.findOne({ where: { id: exceptionId } });
    if (!exception) {
      throw new NotFoundException(`Exception with ID ${exceptionId} not found`);
    }
    await this.exceptionRepository.remove(exception);
  }

  /**
   * Create exceptions for a date range (e.g., vacation)
   */
  async createDateRangeException(
    mentorId: string,
    dto: CreateDateRangeExceptionDto,
  ): Promise<AvailabilityExceptionResponseDto[]> {
    const mentor = await this.mentorRepository.findOne({ where: { id: mentorId } });
    if (!mentor) {
      throw new NotFoundException(`Mentor with ID ${mentorId} not found`);
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (startDate > endDate) {
      throw new BadRequestException("Start date must be before or equal to end date");
    }

    const exceptions: MentorAvailabilityException[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split("T")[0];

      // Check if exception already exists
      const existing = await this.exceptionRepository.findOne({
        where: { mentorId, date: dateStr },
      });

      if (!existing) {
        exceptions.push(
          this.exceptionRepository.create({
            mentorId,
            date: dateStr,
            isUnavailable: true,
            reason: dto.reason,
          }),
        );
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    const saved = await this.exceptionRepository.save(exceptions);

    return saved.map((exc) => ({
      id: exc.id,
      date: exc.date,
      isUnavailable: exc.isUnavailable,
      customSlots: exc.customSlots,
      reason: exc.reason,
    }));
  }

  // ============ Available Slots Calculation ============

  /**
   * Get available (bookable) slots for a mentor within a date range
   * This considers: weekly availability, exceptions, and already booked sessions
   */
  async getAvailableSlots(
    mentorId: string,
    query: GetAvailableSlotsQueryDto,
  ): Promise<AvailableSlotsResponseDto> {
    const mentor = await this.mentorRepository.findOne({ where: { id: mentorId } });
    if (!mentor) {
      throw new NotFoundException(`Mentor with ID ${mentorId} not found`);
    }

    const timezone = query.timezone || "Africa/Nairobi";
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);

    // Get weekly availability
    const weeklySlots = await this.availabilityRepository.find({
      where: { mentorId, isActive: true },
    });

    // Get exceptions in date range
    const exceptions = await this.exceptionRepository.find({
      where: {
        mentorId,
        date: Between(query.startDate, query.endDate),
      },
    });
    const exceptionsByDate = new Map(exceptions.map((e) => [e.date, e]));

    // Get booked sessions in date range
    const bookedSessions = await this.sessionRepository.find({
      where: {
        mentorId,
        scheduledAt: Between(startDate, endDate),
        status: ScheduledSessionStatus.SCHEDULED,
      },
    });

    // Build set of booked time slots
    const bookedSlotKeys = new Set(
      bookedSessions.map((s) => {
        const date = s.scheduledAt.toISOString().split("T")[0];
        const time = s.scheduledAt.toISOString().split("T")[1].substring(0, 5);
        return `${date}-${time}`;
      }),
    );

    // Generate all available slots
    const slots: BookableSlotDto[] = [];
    const slotsByDate: Record<string, BookableSlotDto[]> = {};
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split("T")[0];
      const dayOfWeek = currentDate.getDay() as DayOfWeek;
      const exception = exceptionsByDate.get(dateStr);

      // Skip if marked as unavailable
      if (exception?.isUnavailable) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // Get time slots for this day
      let daySlots: { startTime: string; endTime: string; durationMinutes: number }[] = [];

      if (exception?.customSlots && exception.customSlots.length > 0) {
        // Use custom slots from exception
        daySlots = exception.customSlots.map((s) => ({
          startTime: s.startTime,
          endTime: s.endTime,
          durationMinutes: s.durationMinutes || 45,
        }));
      } else {
        // Use weekly availability
        const weeklyForDay = weeklySlots.filter((s) => s.dayOfWeek === dayOfWeek);
        for (const weekly of weeklyForDay) {
          // Generate individual slots within the time window
          const generatedSlots = this.generateSlotsInWindow(
            weekly.startTime,
            weekly.endTime,
            weekly.durationMinutes,
            weekly.bufferMinutes,
          );
          daySlots.push(...generatedSlots);
        }
      }

      // Create bookable slots, checking for already booked
      slotsByDate[dateStr] = [];
      for (const slot of daySlots) {
        const slotKey = `${dateStr}-${slot.startTime}`;
        const isAvailable = !bookedSlotKeys.has(slotKey);

        // Calculate end time for this slot
        const [startHour, startMin] = slot.startTime.split(":").map(Number);
        const endMinutes = startHour * 60 + startMin + slot.durationMinutes;
        const endHour = Math.floor(endMinutes / 60);
        const endMin = endMinutes % 60;
        const slotEndTime = `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;

        const bookableSlot: BookableSlotDto = {
          date: dateStr,
          dayOfWeek,
          dayName: DAY_OF_WEEK_LABELS[dayOfWeek],
          startTime: slot.startTime,
          endTime: slotEndTime,
          startDateTime: `${dateStr}T${slot.startTime}:00`,
          endDateTime: `${dateStr}T${slotEndTime}:00`,
          durationMinutes: slot.durationMinutes,
          isAvailable,
          timezone,
        };

        slots.push(bookableSlot);
        slotsByDate[dateStr].push(bookableSlot);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      mentorId,
      mentorName: mentor.fullName,
      startDate: query.startDate,
      endDate: query.endDate,
      timezone,
      slots,
      slotsByDate,
    };
  }

  // ============ Helper Methods ============

  private validateTimeRange(startTime: string, endTime: string): void {
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (startMinutes >= endMinutes) {
      throw new BadRequestException("End time must be after start time");
    }

    if (endMinutes - startMinutes < 30) {
      throw new BadRequestException("Time slot must be at least 30 minutes");
    }
  }

  private async checkForOverlappingSlots(
    mentorId: string,
    dayOfWeek: DayOfWeek,
    startTime: string,
    endTime: string,
    excludeSlotId?: string,
  ): Promise<void> {
    const existingSlots = await this.availabilityRepository.find({
      where: { mentorId, dayOfWeek, isActive: true },
    });

    for (const existing of existingSlots) {
      if (excludeSlotId && existing.id === excludeSlotId) continue;

      const existingStart = existing.startTime.substring(0, 5);
      const existingEnd = existing.endTime.substring(0, 5);

      if (this.timesOverlap(startTime, endTime, existingStart, existingEnd)) {
        throw new ConflictException(
          `Time slot overlaps with existing slot (${existingStart} - ${existingEnd})`,
        );
      }
    }
  }

  private checkForOverlappingInBatch(slots: CreateAvailabilitySlotDto[]): void {
    // Group by day
    const byDay = new Map<DayOfWeek, CreateAvailabilitySlotDto[]>();
    for (const slot of slots) {
      const day = slot.dayOfWeek;
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(slot);
    }

    // Check for overlaps within each day
    for (const [day, daySlots] of byDay) {
      for (let i = 0; i < daySlots.length; i++) {
        for (let j = i + 1; j < daySlots.length; j++) {
          if (
            this.timesOverlap(
              daySlots[i].startTime,
              daySlots[i].endTime,
              daySlots[j].startTime,
              daySlots[j].endTime,
            )
          ) {
            throw new ConflictException(
              `Overlapping slots on ${DAY_OF_WEEK_LABELS[day]}: ${daySlots[i].startTime}-${daySlots[i].endTime} and ${daySlots[j].startTime}-${daySlots[j].endTime}`,
            );
          }
        }
      }
    }
  }

  private timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
    const toMinutes = (time: string) => {
      const [h, m] = time.split(":").map(Number);
      return h * 60 + m;
    };
    const s1 = toMinutes(start1),
      e1 = toMinutes(end1);
    const s2 = toMinutes(start2),
      e2 = toMinutes(end2);
    return s1 < e2 && s2 < e1;
  }

  private generateSlotsInWindow(
    startTime: string,
    endTime: string,
    durationMinutes: number,
    bufferMinutes: number,
  ): { startTime: string; endTime: string; durationMinutes: number }[] {
    const slots: { startTime: string; endTime: string; durationMinutes: number }[] = [];
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);

    let currentMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const slotWithBuffer = durationMinutes + bufferMinutes;

    while (currentMinutes + durationMinutes <= endMinutes) {
      const slotStartHour = Math.floor(currentMinutes / 60);
      const slotStartMin = currentMinutes % 60;
      const slotEndMinutes = currentMinutes + durationMinutes;
      const slotEndHour = Math.floor(slotEndMinutes / 60);
      const slotEndMin = slotEndMinutes % 60;

      slots.push({
        startTime: `${String(slotStartHour).padStart(2, "0")}:${String(slotStartMin).padStart(2, "0")}`,
        endTime: `${String(slotEndHour).padStart(2, "0")}:${String(slotEndMin).padStart(2, "0")}`,
        durationMinutes,
      });

      currentMinutes += slotWithBuffer;
    }

    return slots;
  }
}
