import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Team } from "@/database/entities/team.entity";
import { Participant } from "@/database/entities/participant.entity";
import { Evaluation } from "@/database/entities/evaluation.entity";
import { Stage } from "@/database/entities/stage.entity";
import { Cohort, LeaderboardConfig } from "@/database/entities/cohort.entity";
import { Vertical } from "@/database/entities/vertical.entity";
import { Brief } from "@/database/entities/brief.entity";
import {
  LeaderboardQueryDto,
  LeaderboardEntry,
  LeaderboardResponse,
  LeaderboardExportEntry,
} from "./dto/leaderboard.dto";

interface TeamScore {
  teamId: string;
  teamName: string;
  verticalId: string;
  verticalName: string;
  country: string | null;
  memberCount: number;
  finalScore: number;
  stageScores: Map<string, number | null>;
  evaluatedAt: Date | null;
}

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectRepository(Team)
    private teamRepo: Repository<Team>,
    @InjectRepository(Participant)
    private participantRepo: Repository<Participant>,
    @InjectRepository(Evaluation)
    private evaluationRepo: Repository<Evaluation>,
    @InjectRepository(Stage)
    private stageRepo: Repository<Stage>,
    @InjectRepository(Cohort)
    private cohortRepo: Repository<Cohort>,
    @InjectRepository(Vertical)
    private verticalRepo: Repository<Vertical>,
    @InjectRepository(Brief)
    private briefRepo: Repository<Brief>,
  ) {}

  async getLeaderboard(query: LeaderboardQueryDto, isAdmin = false): Promise<LeaderboardResponse> {
    const { cohortId, stageId, verticalId, country, limit = 50, offset = 0 } = query;

    // Get cohort
    const cohort = await this.cohortRepo.findOne({ where: { id: cohortId } });
    if (!cohort) {
      throw new NotFoundException("Cohort not found");
    }

    // Check leaderboard visibility for public access
    const leaderboardConfig: LeaderboardConfig = cohort.leaderboardConfig || {};
    const isPublic = leaderboardConfig.isPublic ?? false;
    const showScores = isAdmin || (leaderboardConfig.showScores ?? true);

    if (!isAdmin && !isPublic) {
      return {
        entries: [],
        meta: {
          total: 0,
          limit,
          offset,
          cohortId,
          cohortName: cohort.name,
          isPublic: false,
          showScores: false,
        },
        filters: { verticalId, country, stageId },
      };
    }

    // Get stages for this cohort
    const stages = await this.stageRepo.find({
      where: { cohortId },
      order: { number: "ASC" },
    });

    // Determine which stages contribute to ranking
    const contributingStageIds = leaderboardConfig.contributingStageIds?.length
      ? leaderboardConfig.contributingStageIds
      : stages.map((s) => s.id);

    // Build team query
    const teamQb = this.teamRepo
      .createQueryBuilder("team")
      .leftJoinAndSelect("team.brief", "brief")
      .leftJoinAndSelect("brief.vertical", "vertical")
      .where("team.cohortId = :cohortId", { cohortId })
      .andWhere("team.status NOT IN (:...excludedStatuses)", {
        excludedStatuses: ["forming", "disqualified"],
      });

    if (verticalId) {
      teamQb.andWhere("brief.verticalId = :verticalId", { verticalId });
    }

    const teams = await teamQb.getMany();

    // Filter by country if specified
    let teamIds = teams.map((t) => t.id);
    if (country && teamIds.length > 0) {
      const teamsInCountry = await this.participantRepo
        .createQueryBuilder("p")
        .select("DISTINCT p.teamId", "teamId")
        .where("p.teamId IN (:...teamIds)", { teamIds })
        .andWhere("p.country = :country", { country })
        .getRawMany();
      teamIds = teamsInCountry.map((t) => t.teamId);
    }

    if (teamIds.length === 0) {
      return {
        entries: [],
        meta: {
          total: 0,
          limit,
          offset,
          cohortId,
          cohortName: cohort.name,
          isPublic,
          showScores,
        },
        filters: { verticalId, country, stageId },
      };
    }

    // Get member counts
    const memberCounts = await this.participantRepo
      .createQueryBuilder("p")
      .select("p.teamId", "teamId")
      .addSelect("COUNT(*)", "count")
      .where("p.teamId IN (:...teamIds)", { teamIds })
      .groupBy("p.teamId")
      .getRawMany();

    const memberCountMap = new Map<string, number>();
    memberCounts.forEach((m) => memberCountMap.set(m.teamId, Number(m.count)));

    // Get primary country for each team (most common)
    const teamCountries = await this.participantRepo
      .createQueryBuilder("p")
      .select("p.teamId", "teamId")
      .addSelect("p.country", "country")
      .addSelect("COUNT(*)", "cnt")
      .where("p.teamId IN (:...teamIds)", { teamIds })
      .groupBy("p.teamId")
      .addGroupBy("p.country")
      .orderBy("cnt", "DESC")
      .getRawMany();

    const teamCountryMap = new Map<string, string>();
    teamCountries.forEach((tc) => {
      if (!teamCountryMap.has(tc.teamId)) {
        teamCountryMap.set(tc.teamId, tc.country);
      }
    });

    // Get evaluations for contributing stages
    const evaluations = await this.evaluationRepo
      .createQueryBuilder("eval")
      .where("eval.teamId IN (:...teamIds)", { teamIds })
      .andWhere("eval.stageId IN (:...stageIds)", { stageIds: contributingStageIds })
      .andWhere("eval.isPublished = :isPublished", { isPublished: true })
      .getMany();

    // Build team scores
    const teamScores: TeamScore[] = [];
    const filteredTeams = teams.filter((t) => teamIds.includes(t.id));

    for (const team of filteredTeams) {
      const teamEvals = evaluations.filter((e) => e.teamId === team.id);

      // Calculate final score as weighted average of stage scores
      let totalWeight = 0;
      let weightedSum = 0;
      const stageScores = new Map<string, number | null>();
      let latestEvalDate: Date | null = null;

      for (const stage of stages) {
        const stageEval = teamEvals.find((e) => e.stageId === stage.id);
        if (stageEval && stageEval.finalScore !== null && stageEval.finalScore !== undefined) {
          const weight = Number(stage.weightPercentage) || 1;
          stageScores.set(stage.id, stageEval.finalScore);
          weightedSum += stageEval.finalScore * weight;
          totalWeight += weight;

          if (!latestEvalDate || (stageEval.updatedAt && stageEval.updatedAt > latestEvalDate)) {
            latestEvalDate = stageEval.updatedAt;
          }
        } else {
          stageScores.set(stage.id, null);
        }
      }

      const finalScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

      teamScores.push({
        teamId: team.id,
        teamName: team.name,
        verticalId: team.brief?.verticalId || "",
        verticalName: team.brief?.vertical?.name || "Unknown",
        country: teamCountryMap.get(team.id) || null,
        memberCount: memberCountMap.get(team.id) || 0,
        finalScore: Math.round(finalScore * 100) / 100,
        stageScores,
        evaluatedAt: latestEvalDate,
      });
    }

    // Sort by final score (descending), then by team name (ascending) for tie-breaking
    teamScores.sort((a, b) => {
      if (b.finalScore !== a.finalScore) {
        return b.finalScore - a.finalScore;
      }
      // Tie-breaker 1: Earlier evaluation date wins
      if (a.evaluatedAt && b.evaluatedAt) {
        const dateDiff = a.evaluatedAt.getTime() - b.evaluatedAt.getTime();
        if (dateDiff !== 0) return dateDiff;
      }
      // Tie-breaker 2: Alphabetical by team name
      return a.teamName.localeCompare(b.teamName);
    });

    // Assign ranks with tie handling
    const rankedScores = this.assignRanks(teamScores);

    // Apply pagination
    const total = rankedScores.length;
    const paginatedScores = rankedScores.slice(offset, offset + limit);

    // Build response
    const entries: LeaderboardEntry[] = paginatedScores.map((ts) => ({
      rank: ts.rank,
      teamId: ts.teamId,
      teamName: ts.teamName,
      verticalId: ts.verticalId,
      verticalName: ts.verticalName,
      country: ts.country,
      memberCount: ts.memberCount,
      finalScore: showScores ? ts.finalScore : 0,
      stageScores: stages.map((s) => ({
        stageId: s.id,
        stageName: s.name,
        score: showScores ? (ts.stageScores.get(s.id) ?? null) : null,
      })),
      evaluatedAt: ts.evaluatedAt,
    }));

    return {
      entries,
      meta: {
        total,
        limit,
        offset,
        cohortId,
        cohortName: cohort.name,
        isPublic,
        showScores,
      },
      filters: { verticalId, country, stageId },
    };
  }

  private assignRanks(scores: TeamScore[]): (TeamScore & { rank: number })[] {
    const result: (TeamScore & { rank: number })[] = [];
    let currentRank = 1;
    let previousScore: number | null = null;
    let sameRankCount = 0;

    for (let i = 0; i < scores.length; i++) {
      const score = scores[i];

      if (previousScore === null || score.finalScore !== previousScore) {
        currentRank = i + 1;
        sameRankCount = 1;
      } else {
        sameRankCount++;
      }

      result.push({ ...score, rank: currentRank });
      previousScore = score.finalScore;
    }

    return result;
  }

  async getTeamRank(cohortId: string, teamId: string): Promise<{ rank: number; totalTeams: number } | null> {
    const leaderboard = await this.getLeaderboard({ cohortId, limit: 10000, offset: 0 }, true);
    const entry = leaderboard.entries.find((e) => e.teamId === teamId);

    if (!entry) {
      return null;
    }

    return {
      rank: entry.rank,
      totalTeams: leaderboard.meta.total,
    };
  }

  async exportLeaderboard(query: LeaderboardQueryDto): Promise<LeaderboardExportEntry[]> {
    const leaderboard = await this.getLeaderboard({ ...query, limit: 10000, offset: 0 }, true);

    return leaderboard.entries.map((entry) => {
      const exportEntry: LeaderboardExportEntry = {
        rank: entry.rank,
        teamName: entry.teamName,
        vertical: entry.verticalName,
        country: entry.country || "N/A",
        memberCount: entry.memberCount,
        finalScore: entry.finalScore,
      };

      // Add stage scores as dynamic columns
      entry.stageScores.forEach((ss) => {
        exportEntry[ss.stageName] = ss.score ?? "N/A";
      });

      return exportEntry;
    });
  }

  async getLeaderboardConfig(cohortId: string): Promise<{
    isPublic: boolean;
    showScores: boolean;
    contributingStageIds: string[];
  }> {
    const cohort = await this.cohortRepo.findOne({ where: { id: cohortId } });
    if (!cohort) {
      throw new NotFoundException("Cohort not found");
    }

    const config: LeaderboardConfig = cohort.leaderboardConfig || {};

    return {
      isPublic: config.isPublic ?? false,
      showScores: config.showScores ?? true,
      contributingStageIds: config.contributingStageIds ?? [],
    };
  }

  async updateLeaderboardConfig(
    cohortId: string,
    config: { isPublic?: boolean; showScores?: boolean; contributingStageIds?: string[] },
  ): Promise<void> {
    const cohort = await this.cohortRepo.findOne({ where: { id: cohortId } });
    if (!cohort) {
      throw new NotFoundException("Cohort not found");
    }

    const currentConfig: LeaderboardConfig = cohort.leaderboardConfig || {};
    const updatedConfig: LeaderboardConfig = {
      ...currentConfig,
      ...(config.isPublic !== undefined && { isPublic: config.isPublic }),
      ...(config.showScores !== undefined && { showScores: config.showScores }),
      ...(config.contributingStageIds !== undefined && { contributingStageIds: config.contributingStageIds }),
    };

    await this.cohortRepo.update(cohortId, { leaderboardConfig: updatedConfig });
  }
}
