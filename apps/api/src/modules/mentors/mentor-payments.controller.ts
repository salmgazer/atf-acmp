import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { MentorPaymentsService } from "./mentor-payments.service";
import {
  CreateMentorPaymentDto,
  UpdateMentorPaymentDto,
  MentorPaymentQueryDto,
  MentorEarningsDto,
  MentorEarningsSummaryDto,
  MentorPaymentRecordDto,
} from "./dto/mentor.dto";
import { MentorPayment } from "@/database/entities/mentor.entity";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Audit } from "@/common/decorators/audit.decorator";
import { AuditInterceptor } from "@/common/interceptors/audit.interceptor";
import { AuditAction } from "@/database/entities/audit-log.entity";

@ApiTags("Mentor Payments")
@ApiBearerAuth()
@Controller("mentor-payments")
@UseInterceptors(AuditInterceptor)
export class MentorPaymentsController {
  constructor(private readonly paymentsService: MentorPaymentsService) {}

  // ============ Earnings Endpoints ============

  @Get("earnings/summary")
  @ApiOperation({ summary: "Get summary of all mentor earnings" })
  @ApiResponse({ status: 200, type: MentorEarningsSummaryDto })
  async getEarningsSummary(
    @Query("cohortId") cohortId?: string,
  ): Promise<MentorEarningsSummaryDto> {
    return this.paymentsService.getEarningsSummary(cohortId);
  }

  @Get("earnings")
  @ApiOperation({ summary: "Get earnings for all mentors" })
  @ApiResponse({ status: 200, type: [MentorEarningsDto] })
  async getAllMentorEarnings(
    @Query("cohortId") cohortId?: string,
  ): Promise<MentorEarningsDto[]> {
    return this.paymentsService.getAllMentorEarnings(cohortId);
  }

  @Get("earnings/:mentorId")
  @ApiOperation({ summary: "Get earnings for a specific mentor" })
  @ApiResponse({ status: 200, type: MentorEarningsDto })
  async getMentorEarnings(
    @Param("mentorId", ParseUUIDPipe) mentorId: string,
  ): Promise<MentorEarningsDto> {
    return this.paymentsService.getMentorEarnings(mentorId);
  }

  // ============ Payment CRUD Endpoints ============

  @Post()
  @Audit({
    action: AuditAction.CREATE,
    entityType: "MentorPayment",
    getEntityId: (result) => result?.id,
    getDescription: (result) => `Created payment record of ${result?.amount} for mentor`,
  })
  @ApiOperation({ summary: "Create a new payment record" })
  @ApiResponse({ status: 201, type: MentorPayment })
  async createPayment(
    @Body() dto: CreateMentorPaymentDto,
    @CurrentUser() user: { id: string },
  ): Promise<MentorPayment> {
    return this.paymentsService.createPayment(dto, user?.id);
  }

  @Get()
  @ApiOperation({ summary: "List payment records with filters" })
  async getPayments(
    @Query() query: MentorPaymentQueryDto,
  ): Promise<{ data: MentorPaymentRecordDto[]; total: number }> {
    return this.paymentsService.getPayments(query);
  }

  @Get("mentor/:mentorId")
  @ApiOperation({ summary: "Get all payments for a specific mentor" })
  @ApiResponse({ status: 200, type: [MentorPaymentRecordDto] })
  async getMentorPayments(
    @Param("mentorId", ParseUUIDPipe) mentorId: string,
  ): Promise<MentorPaymentRecordDto[]> {
    return this.paymentsService.getMentorPayments(mentorId);
  }

  @Patch(":id")
  @Audit({
    action: AuditAction.UPDATE,
    entityType: "MentorPayment",
    getEntityId: (result) => result?.id,
    getDescription: (result) => `Updated payment record status to ${result?.status}`,
  })
  @ApiOperation({ summary: "Update a payment record" })
  @ApiResponse({ status: 200, type: MentorPayment })
  async updatePayment(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateMentorPaymentDto,
    @CurrentUser() user: { id: string },
  ): Promise<MentorPayment> {
    return this.paymentsService.updatePayment(id, dto, user?.id);
  }

  @Post(":id/complete")
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: AuditAction.UPDATE,
    entityType: "MentorPayment",
    getEntityId: (result) => result?.id,
    getDescription: (result) => `Marked payment as completed`,
  })
  @ApiOperation({ summary: "Mark a payment as completed" })
  @ApiResponse({ status: 200, type: MentorPayment })
  async markPaymentCompleted(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: { paymentReference?: string; paymentMethod?: string },
    @CurrentUser() user: { id: string },
  ): Promise<MentorPayment> {
    return this.paymentsService.markPaymentCompleted(
      id,
      body.paymentReference,
      body.paymentMethod,
      user?.id,
    );
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({
    action: AuditAction.DELETE,
    entityType: "MentorPayment",
    getEntityId: (_, args) => args[0],
    getDescription: () => `Deleted payment record`,
  })
  @ApiOperation({ summary: "Delete a pending payment record" })
  async deletePayment(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.paymentsService.deletePayment(id);
  }
}
