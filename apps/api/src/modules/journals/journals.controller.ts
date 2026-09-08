import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  ParseIntPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { Role } from "@/database/entities/user.entity";
import { JournalsService } from "./journals.service";
import {
  CreateJournalEntryDto,
  UpdateJournalEntryDto,
  JournalQueryDto,
} from "./dto/journal.dto";

@ApiTags("journals")
@Controller("journals")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class JournalsController {
  constructor(private readonly journalsService: JournalsService) {}

  @Get("my")
  @ApiOperation({ summary: "Get my team journal entries" })
  @ApiResponse({ status: 200, description: "List of journal entries" })
  async getMyTeamEntries(@Request() req: any) {
    const participantId = req.user.participantId;
    if (!participantId) {
      return [];
    }

    const entries = await this.journalsService.getMyTeamEntries(participantId);
    return entries.map((entry) => ({
      ...entry,
      canEdit: entry.canEdit(),
      hoursRemainingToEdit: entry.hoursRemainingToEdit(),
    }));
  }

  @Get("my/week/:weekNumber")
  @ApiOperation({ summary: "Get my team journal entry for a specific week" })
  @ApiParam({ name: "weekNumber", description: "Week number" })
  @ApiResponse({ status: 200, description: "Journal entry for the week" })
  async getMyTeamEntryForWeek(
    @Request() req: any,
    @Param("weekNumber", ParseIntPipe) weekNumber: number,
  ) {
    const participantId = req.user.participantId;
    if (!participantId) {
      return null;
    }

    const entry = await this.journalsService.getMyTeamEntryForWeek(
      participantId,
      weekNumber,
    );

    if (!entry) return null;

    return {
      ...entry,
      canEdit: entry.canEdit(),
      hoursRemainingToEdit: entry.hoursRemainingToEdit(),
    };
  }

  @Post()
  @ApiOperation({ summary: "Create a journal entry" })
  @ApiResponse({ status: 201, description: "Journal entry created" })
  @ApiResponse({ status: 400, description: "Entry already exists for this week" })
  async create(@Request() req: any, @Body() dto: CreateJournalEntryDto) {
    const participantId = req.user.participantId;
    const entry = await this.journalsService.create(participantId, dto);
    return {
      ...entry,
      canEdit: entry.canEdit(),
      hoursRemainingToEdit: entry.hoursRemainingToEdit(),
    };
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a journal entry (within edit window)" })
  @ApiParam({ name: "id", description: "Journal entry ID" })
  @ApiResponse({ status: 200, description: "Journal entry updated" })
  @ApiResponse({ status: 400, description: "Edit window expired" })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Request() req: any,
    @Body() dto: UpdateJournalEntryDto,
  ) {
    const participantId = req.user.participantId;
    const entry = await this.journalsService.update(id, participantId, dto);
    return {
      ...entry,
      canEdit: entry.canEdit(),
      hoursRemainingToEdit: entry.hoursRemainingToEdit(),
    };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a journal entry by ID" })
  @ApiParam({ name: "id", description: "Journal entry ID" })
  @ApiResponse({ status: 200, description: "Journal entry details" })
  @ApiResponse({ status: 404, description: "Entry not found" })
  async getById(@Param("id", ParseUUIDPipe) id: string) {
    const entry = await this.journalsService.getById(id);
    return {
      ...entry,
      canEdit: entry.canEdit(),
      hoursRemainingToEdit: entry.hoursRemainingToEdit(),
    };
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a journal entry (within edit window)" })
  @ApiParam({ name: "id", description: "Journal entry ID" })
  @ApiResponse({ status: 200, description: "Journal entry deleted" })
  @ApiResponse({ status: 400, description: "Edit window expired" })
  async delete(@Param("id", ParseUUIDPipe) id: string, @Request() req: any) {
    const participantId = req.user.participantId;
    await this.journalsService.delete(id, participantId);
    return { success: true };
  }
}

@ApiTags("journals-admin")
@Controller("admin/journals")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
@ApiBearerAuth()
export class AdminJournalsController {
  constructor(private readonly journalsService: JournalsService) {}

  @Get()
  @ApiOperation({ summary: "Get all journal entries with filters" })
  @ApiResponse({ status: 200, description: "Paginated journal entries" })
  async getEntries(@Query() query: JournalQueryDto) {
    const result = await this.journalsService.getEntries(query);
    return {
      ...result,
      entries: result.entries.map((entry) => ({
        ...entry,
        canEdit: entry.canEdit(),
        hoursRemainingToEdit: entry.hoursRemainingToEdit(),
      })),
    };
  }

  @Get("team/:teamId")
  @ApiOperation({ summary: "Get all journal entries for a team" })
  @ApiParam({ name: "teamId", description: "Team ID" })
  @ApiResponse({ status: 200, description: "Team journal entries" })
  async getTeamEntries(@Param("teamId", ParseUUIDPipe) teamId: string) {
    const entries = await this.journalsService.getTeamEntries(teamId);
    return entries.map((entry) => ({
      ...entry,
      canEdit: entry.canEdit(),
      hoursRemainingToEdit: entry.hoursRemainingToEdit(),
    }));
  }

  @Get("cohort/:cohortId/week/:weekNumber/summary")
  @ApiOperation({ summary: "Get journal submission summary for a cohort week" })
  @ApiParam({ name: "cohortId", description: "Cohort ID" })
  @ApiParam({ name: "weekNumber", description: "Week number" })
  @ApiResponse({ status: 200, description: "Week summary statistics" })
  async getCohortWeekSummary(
    @Param("cohortId", ParseUUIDPipe) cohortId: string,
    @Param("weekNumber", ParseIntPipe) weekNumber: number,
  ) {
    return this.journalsService.getCohortWeekSummary(cohortId, weekNumber);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a journal entry by ID (admin)" })
  @ApiParam({ name: "id", description: "Journal entry ID" })
  @ApiResponse({ status: 200, description: "Journal entry details" })
  async getById(@Param("id", ParseUUIDPipe) id: string) {
    const entry = await this.journalsService.getById(id);
    return {
      ...entry,
      canEdit: entry.canEdit(),
      hoursRemainingToEdit: entry.hoursRemainingToEdit(),
    };
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a journal entry (admin)" })
  @ApiParam({ name: "id", description: "Journal entry ID" })
  @ApiResponse({ status: 200, description: "Journal entry deleted" })
  async delete(@Param("id", ParseUUIDPipe) id: string) {
    await this.journalsService.adminDelete(id);
    return { success: true };
  }
}
