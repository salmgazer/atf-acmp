import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between } from "typeorm";
import { JournalEntry, JournalEntryStatus } from "@/database/entities/journal.entity";
import { TeamMember } from "@/database/entities/team.entity";
import {
  CreateJournalEntryDto,
  UpdateJournalEntryDto,
  JournalQueryDto,
} from "./dto/journal.dto";

@Injectable()
export class JournalsService {
  private readonly EDIT_WINDOW_HOURS = 24;

  constructor(
    @InjectRepository(JournalEntry)
    private journalRepository: Repository<JournalEntry>,
    @InjectRepository(TeamMember)
    private teamMemberRepository: Repository<TeamMember>,
  ) {}

  private calculateWordCount(content: string): number {
    return content
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  private getEditableUntil(): Date {
    const editableUntil = new Date();
    editableUntil.setHours(editableUntil.getHours() + this.EDIT_WINDOW_HOURS);
    return editableUntil;
  }

  async getTeamForParticipant(participantId: string): Promise<TeamMember | null> {
    return this.teamMemberRepository.findOne({
      where: { participantId },
      relations: ["team"],
    });
  }

  async create(
    participantId: string,
    dto: CreateJournalEntryDto,
  ): Promise<JournalEntry> {
    const membership = await this.getTeamForParticipant(participantId);
    if (!membership || !membership.team) {
      throw new ForbiddenException("You must be part of a team to create journal entries");
    }

    // Check if entry already exists for this week
    const existing = await this.journalRepository.findOne({
      where: { teamId: membership.teamId, weekNumber: dto.weekNumber },
    });

    if (existing) {
      throw new BadRequestException(
        `Journal entry for week ${dto.weekNumber} already exists. Use update instead.`
      );
    }

    const entry = this.journalRepository.create({
      teamId: membership.teamId,
      cohortId: membership.team.cohortId,
      authorId: participantId,
      weekNumber: dto.weekNumber,
      title: dto.title,
      content: dto.content,
      highlights: dto.highlights,
      challenges: dto.challenges,
      nextWeekGoals: dto.nextWeekGoals,
      status: dto.status || JournalEntryStatus.PUBLISHED,
      editableUntil: this.getEditableUntil(),
      wordCount: this.calculateWordCount(dto.content),
    });

    return this.journalRepository.save(entry);
  }

  async update(
    id: string,
    participantId: string,
    dto: UpdateJournalEntryDto,
  ): Promise<JournalEntry> {
    const entry = await this.journalRepository.findOne({
      where: { id },
      relations: ["team"],
    });

    if (!entry) {
      throw new NotFoundException("Journal entry not found");
    }

    // Verify participant is part of the team
    const membership = await this.getTeamForParticipant(participantId);
    if (!membership || membership.teamId !== entry.teamId) {
      throw new ForbiddenException("You can only edit your team's journal entries");
    }

    // Check if still editable
    if (!entry.canEdit()) {
      throw new BadRequestException(
        "Journal entry can no longer be edited. Edit window has expired."
      );
    }

    // Update fields
    if (dto.title !== undefined) entry.title = dto.title;
    if (dto.content !== undefined) {
      entry.content = dto.content;
      entry.wordCount = this.calculateWordCount(dto.content);
    }
    if (dto.highlights !== undefined) entry.highlights = dto.highlights;
    if (dto.challenges !== undefined) entry.challenges = dto.challenges;
    if (dto.nextWeekGoals !== undefined) entry.nextWeekGoals = dto.nextWeekGoals;
    if (dto.status !== undefined) entry.status = dto.status;

    entry.lastEditedAt = new Date();
    entry.lastEditedBy = participantId;

    return this.journalRepository.save(entry);
  }

  async getById(id: string): Promise<JournalEntry> {
    const entry = await this.journalRepository.findOne({
      where: { id },
      relations: ["team", "author"],
    });

    if (!entry) {
      throw new NotFoundException("Journal entry not found");
    }

    return entry;
  }

  async getMyTeamEntries(participantId: string): Promise<JournalEntry[]> {
    const membership = await this.getTeamForParticipant(participantId);
    if (!membership) {
      return [];
    }

    return this.journalRepository.find({
      where: { teamId: membership.teamId },
      relations: ["author"],
      order: { weekNumber: "DESC" },
    });
  }

  async getMyTeamEntryForWeek(
    participantId: string,
    weekNumber: number,
  ): Promise<JournalEntry | null> {
    const membership = await this.getTeamForParticipant(participantId);
    if (!membership) {
      return null;
    }

    return this.journalRepository.findOne({
      where: { teamId: membership.teamId, weekNumber },
      relations: ["author"],
    });
  }

  async getEntries(query: JournalQueryDto): Promise<{
    entries: JournalEntry[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.journalRepository
      .createQueryBuilder("entry")
      .leftJoinAndSelect("entry.team", "team")
      .leftJoinAndSelect("entry.author", "author");

    if (query.teamId) {
      qb.andWhere("entry.team_id = :teamId", { teamId: query.teamId });
    }

    if (query.cohortId) {
      qb.andWhere("entry.cohort_id = :cohortId", { cohortId: query.cohortId });
    }

    if (query.weekNumber !== undefined) {
      qb.andWhere("entry.week_number = :weekNumber", { weekNumber: query.weekNumber });
    }

    if (query.fromWeek !== undefined && query.toWeek !== undefined) {
      qb.andWhere("entry.week_number BETWEEN :fromWeek AND :toWeek", {
        fromWeek: query.fromWeek,
        toWeek: query.toWeek,
      });
    } else if (query.fromWeek !== undefined) {
      qb.andWhere("entry.week_number >= :fromWeek", { fromWeek: query.fromWeek });
    } else if (query.toWeek !== undefined) {
      qb.andWhere("entry.week_number <= :toWeek", { toWeek: query.toWeek });
    }

    qb.orderBy("entry.week_number", "DESC")
      .addOrderBy("team.name", "ASC");

    const [entries, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { entries, total, page, limit };
  }

  async getTeamEntries(teamId: string): Promise<JournalEntry[]> {
    return this.journalRepository.find({
      where: { teamId },
      relations: ["author"],
      order: { weekNumber: "DESC" },
    });
  }

  async getCohortWeekSummary(cohortId: string, weekNumber: number): Promise<{
    totalTeams: number;
    entriesSubmitted: number;
    missingTeams: string[];
  }> {
    // Get all teams in cohort
    const teamsResult = await this.journalRepository.manager
      .createQueryBuilder()
      .select("team.id", "id")
      .addSelect("team.name", "name")
      .from("teams", "team")
      .where("team.cohort_id = :cohortId", { cohortId })
      .getRawMany();

    const teamIds = teamsResult.map((t) => t.id);
    const teamNames = new Map(teamsResult.map((t) => [t.id, t.name]));

    // Get teams that have submitted for this week
    const submittedEntries = await this.journalRepository.find({
      where: { cohortId, weekNumber },
      select: ["teamId"],
    });

    const submittedTeamIds = new Set(submittedEntries.map((e) => e.teamId));
    const missingTeamIds = teamIds.filter((id) => !submittedTeamIds.has(id));
    const missingTeams = missingTeamIds.map((id) => teamNames.get(id) || id);

    return {
      totalTeams: teamIds.length,
      entriesSubmitted: submittedEntries.length,
      missingTeams,
    };
  }

  async delete(id: string, participantId: string): Promise<void> {
    const entry = await this.journalRepository.findOne({ where: { id } });

    if (!entry) {
      throw new NotFoundException("Journal entry not found");
    }

    // Verify participant is part of the team
    const membership = await this.getTeamForParticipant(participantId);
    if (!membership || membership.teamId !== entry.teamId) {
      throw new ForbiddenException("You can only delete your team's journal entries");
    }

    // Check if still editable
    if (!entry.canEdit()) {
      throw new BadRequestException("Journal entry can no longer be deleted");
    }

    await this.journalRepository.remove(entry);
  }

  async adminDelete(id: string): Promise<void> {
    const entry = await this.journalRepository.findOne({ where: { id } });

    if (!entry) {
      throw new NotFoundException("Journal entry not found");
    }

    await this.journalRepository.remove(entry);
  }
}
