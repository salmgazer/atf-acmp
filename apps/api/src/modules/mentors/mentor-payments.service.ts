import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual, In } from "typeorm";
import {
  Mentor,
  MentorPayment,
  MentorPaymentStatus,
  ScheduledSession,
  ScheduledSessionStatus,
} from "@/database/entities/mentor.entity";
import { Cohort } from "@/database/entities/cohort.entity";
import {
  CreateMentorPaymentDto,
  UpdateMentorPaymentDto,
  MentorPaymentQueryDto,
  MentorEarningsDto,
  MentorEarningsSummaryDto,
  MentorPaymentRecordDto,
} from "./dto/mentor.dto";

@Injectable()
export class MentorPaymentsService {
  private readonly logger = new Logger(MentorPaymentsService.name);

  constructor(
    @InjectRepository(Mentor)
    private readonly mentorRepository: Repository<Mentor>,
    @InjectRepository(MentorPayment)
    private readonly paymentRepository: Repository<MentorPayment>,
    @InjectRepository(ScheduledSession)
    private readonly scheduledSessionRepository: Repository<ScheduledSession>,
    @InjectRepository(Cohort)
    private readonly cohortRepository: Repository<Cohort>,
  ) {}

  /**
   * Get the effective session rate for a mentor
   */
  private async getEffectiveSessionRate(mentor: Mentor): Promise<number> {
    if (mentor.sessionRateOverride !== null && mentor.sessionRateOverride !== undefined) {
      return Number(mentor.sessionRateOverride);
    }
    
    // Load cohort if not already loaded
    if (!mentor.cohort) {
      const cohort = await this.cohortRepository.findOne({ where: { id: mentor.cohortId } });
      return cohort?.sessionRate ? Number(cohort.sessionRate) : 0;
    }
    
    return mentor.cohort?.sessionRate ? Number(mentor.cohort.sessionRate) : 0;
  }

  /**
   * Get completed sessions count for a mentor
   */
  private async getCompletedSessionsCount(
    mentorId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<number> {
    const qb = this.scheduledSessionRepository
      .createQueryBuilder("session")
      .where("session.mentorId = :mentorId", { mentorId })
      .andWhere("session.status = :status", { status: ScheduledSessionStatus.COMPLETED });

    if (startDate) {
      qb.andWhere("session.completedAt >= :startDate", { startDate });
    }
    if (endDate) {
      qb.andWhere("session.completedAt <= :endDate", { endDate });
    }

    return qb.getCount();
  }

  /**
   * Get confirmed sessions count for a mentor (confirmed by mentor but not yet completed)
   */
  private async getConfirmedSessionsCount(
    mentorId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<number> {
    const qb = this.scheduledSessionRepository
      .createQueryBuilder("session")
      .where("session.mentorId = :mentorId", { mentorId })
      .andWhere("session.status IN (:...statuses)", { 
        statuses: [ScheduledSessionStatus.CONFIRMED, ScheduledSessionStatus.COMPLETED] 
      });

    if (startDate) {
      qb.andWhere("session.scheduledAt >= :startDate", { startDate });
    }
    if (endDate) {
      qb.andWhere("session.scheduledAt <= :endDate", { endDate });
    }

    return qb.getCount();
  }

  /**
   * Get total paid amount for a mentor
   */
  private async getTotalPaidAmount(
    mentorId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<number> {
    const qb = this.paymentRepository
      .createQueryBuilder("payment")
      .select("COALESCE(SUM(payment.amount), 0)", "total")
      .where("payment.mentorId = :mentorId", { mentorId })
      .andWhere("payment.status = :status", { status: MentorPaymentStatus.COMPLETED });

    if (startDate) {
      qb.andWhere("payment.paidAt >= :startDate", { startDate });
    }
    if (endDate) {
      qb.andWhere("payment.paidAt <= :endDate", { endDate });
    }

    const result = await qb.getRawOne();
    return parseFloat(result?.total || "0");
  }

  /**
   * Get earnings for a single mentor
   */
  async getMentorEarnings(mentorId: string): Promise<MentorEarningsDto> {
    const mentor = await this.mentorRepository.findOne({
      where: { id: mentorId },
      relations: ["cohort"],
    });

    if (!mentor) {
      throw new NotFoundException("Mentor not found");
    }

    const sessionRate = await this.getEffectiveSessionRate(mentor);
    
    // All-time stats
    const completedSessions = await this.getCompletedSessionsCount(mentorId);
    const confirmedSessions = await this.getConfirmedSessionsCount(mentorId);
    const totalEarned = completedSessions * sessionRate;
    const totalPaid = await this.getTotalPaidAmount(mentorId);
    
    // Current month stats
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    const currentMonthCompleted = await this.getCompletedSessionsCount(mentorId, monthStart, monthEnd);
    const currentMonthEarned = currentMonthCompleted * sessionRate;
    const currentMonthPaid = await this.getTotalPaidAmount(mentorId, monthStart, monthEnd);

    return {
      mentorId: mentor.id,
      mentorName: `${mentor.firstName} ${mentor.lastName}`,
      email: mentor.email,
      sessionRate,
      confirmedSessions,
      completedSessions,
      totalEarned,
      totalPaid,
      unpaidAmount: totalEarned - totalPaid,
      currentMonthEarned,
      currentMonthPaid,
      currentMonthUnpaid: currentMonthEarned - currentMonthPaid,
    };
  }

  /**
   * Get earnings for all mentors in a cohort
   */
  async getAllMentorEarnings(cohortId?: string): Promise<MentorEarningsDto[]> {
    const where = cohortId ? { cohortId } : {};
    const mentors = await this.mentorRepository.find({
      where,
      relations: ["cohort"],
      order: { lastName: "ASC", firstName: "ASC" },
    });

    const earnings: MentorEarningsDto[] = [];
    
    for (const mentor of mentors) {
      const mentorEarnings = await this.getMentorEarnings(mentor.id);
      earnings.push(mentorEarnings);
    }

    return earnings;
  }

  /**
   * Get summary of all mentor earnings
   */
  async getEarningsSummary(cohortId?: string): Promise<MentorEarningsSummaryDto> {
    const earnings = await this.getAllMentorEarnings(cohortId);

    const now = new Date();
    
    return {
      totalMentors: earnings.length,
      totalCompletedSessions: earnings.reduce((sum, e) => sum + e.completedSessions, 0),
      totalEarnings: earnings.reduce((sum, e) => sum + e.totalEarned, 0),
      totalPaid: earnings.reduce((sum, e) => sum + e.totalPaid, 0),
      totalUnpaid: earnings.reduce((sum, e) => sum + e.unpaidAmount, 0),
      currentMonthEarnings: earnings.reduce((sum, e) => sum + e.currentMonthEarned, 0),
      currentMonthPaid: earnings.reduce((sum, e) => sum + e.currentMonthPaid, 0),
      currentMonthUnpaid: earnings.reduce((sum, e) => sum + e.currentMonthUnpaid, 0),
    };
  }

  /**
   * Create a payment record
   */
  async createPayment(dto: CreateMentorPaymentDto, paidBy?: string): Promise<MentorPayment> {
    const mentor = await this.mentorRepository.findOne({
      where: { id: dto.mentorId },
    });

    if (!mentor) {
      throw new NotFoundException("Mentor not found");
    }

    // Validate session IDs if provided
    if (dto.sessionIds && dto.sessionIds.length > 0) {
      const sessions = await this.scheduledSessionRepository.find({
        where: { id: In(dto.sessionIds), mentorId: dto.mentorId },
      });
      
      if (sessions.length !== dto.sessionIds.length) {
        throw new BadRequestException("Some session IDs are invalid or don't belong to this mentor");
      }
    }

    const payment = this.paymentRepository.create({
      mentorId: dto.mentorId,
      amount: dto.amount,
      sessionsCount: dto.sessionsCount || 0,
      sessionIds: dto.sessionIds || [],
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      paymentReference: dto.paymentReference,
      paymentMethod: dto.paymentMethod,
      notes: dto.notes,
      status: MentorPaymentStatus.PENDING,
    });

    return this.paymentRepository.save(payment);
  }

  /**
   * Update a payment record (e.g., mark as completed)
   */
  async updatePayment(paymentId: string, dto: UpdateMentorPaymentDto, paidBy?: string): Promise<MentorPayment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    // If marking as completed, set paidAt and paidBy
    if (dto.status === MentorPaymentStatus.COMPLETED && payment.status !== MentorPaymentStatus.COMPLETED) {
      payment.paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
      payment.paidBy = paidBy;
    }

    Object.assign(payment, {
      ...dto,
      paidAt: dto.paidAt ? new Date(dto.paidAt) : payment.paidAt,
    });

    return this.paymentRepository.save(payment);
  }

  /**
   * Mark a payment as completed
   */
  async markPaymentCompleted(
    paymentId: string,
    paymentReference?: string,
    paymentMethod?: string,
    paidBy?: string,
  ): Promise<MentorPayment> {
    return this.updatePayment(paymentId, {
      status: MentorPaymentStatus.COMPLETED,
      paymentReference,
      paymentMethod,
    }, paidBy);
  }

  /**
   * Get payment records with filters
   */
  async getPayments(query: MentorPaymentQueryDto): Promise<{ data: MentorPaymentRecordDto[]; total: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.paymentRepository
      .createQueryBuilder("payment")
      .leftJoinAndSelect("payment.mentor", "mentor");

    if (query.mentorId) {
      qb.andWhere("payment.mentorId = :mentorId", { mentorId: query.mentorId });
    }

    if (query.cohortId) {
      qb.andWhere("mentor.cohortId = :cohortId", { cohortId: query.cohortId });
    }

    if (query.status) {
      qb.andWhere("payment.status = :status", { status: query.status });
    }

    if (query.startDate) {
      qb.andWhere("payment.createdAt >= :startDate", { startDate: new Date(query.startDate) });
    }

    if (query.endDate) {
      qb.andWhere("payment.createdAt <= :endDate", { endDate: new Date(query.endDate) });
    }

    qb.orderBy("payment.createdAt", "DESC")
      .skip(skip)
      .take(limit);

    const [payments, total] = await qb.getManyAndCount();

    const data: MentorPaymentRecordDto[] = payments.map((p) => ({
      id: p.id,
      mentorId: p.mentorId,
      mentorName: p.mentor ? `${p.mentor.firstName} ${p.mentor.lastName}` : "",
      amount: Number(p.amount),
      status: p.status,
      sessionsCount: p.sessionsCount,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      paidAt: p.paidAt,
      paidBy: p.paidBy,
      paymentReference: p.paymentReference,
      paymentMethod: p.paymentMethod,
      notes: p.notes,
      createdAt: p.createdAt,
    }));

    return { data, total };
  }

  /**
   * Get payments for a specific mentor
   */
  async getMentorPayments(mentorId: string): Promise<MentorPaymentRecordDto[]> {
    const result = await this.getPayments({ mentorId, limit: 100 });
    return result.data;
  }

  /**
   * Delete a payment record (only if pending)
   */
  async deletePayment(paymentId: string): Promise<void> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    if (payment.status === MentorPaymentStatus.COMPLETED) {
      throw new BadRequestException("Cannot delete a completed payment");
    }

    await this.paymentRepository.remove(payment);
  }
}
