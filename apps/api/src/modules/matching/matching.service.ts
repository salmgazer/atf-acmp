import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, IsNull, Not } from "typeorm";
import { Team, TeamStatus } from "@/database/entities/team.entity";
import { Brief, BriefStatus } from "@/database/entities/brief.entity";
import { Cohort } from "@/database/entities/cohort.entity";
import {
  Participant,
  ParticipantPreference,
} from "@/database/entities/participant.entity";
import {
  MatchingConfigDto,
  RunMatchingDto,
  FinalizeMatchingDto,
  MatchingPreviewDto,
  MatchResultDto,
  MatchingStatsDto,
  BriefCapacityDto,
  TeamMatchStatusDto,
} from "./dto/matching.dto";

interface TeamWithPreferences {
  team: Team;
  briefRankings: string[];
  verticalPreferences: string[];
  skills: string[];
  interests: string[];
}

interface BriefWithCapacity {
  brief: Brief;
  currentTeams: number;
  availableSlots: number;
}

interface MatchCandidate {
  teamId: string;
  briefId: string;
  score: number;
  scoreBreakdown: {
    rankingScore: number;
    verticalScore: number;
    skillScore: number;
    interestScore: number;
  };
  rankPosition: number | null;
  verticalMatch: boolean;
  skillOverlap: number;
  interestOverlap: number;
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  // Cache for preview results
  private previewCache: Map<string, MatchingPreviewDto> = new Map();

  constructor(
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(Brief)
    private readonly briefRepository: Repository<Brief>,
    @InjectRepository(Cohort)
    private readonly cohortRepository: Repository<Cohort>,
    @InjectRepository(ParticipantPreference)
    private readonly preferenceRepository: Repository<ParticipantPreference>
  ) {}

  /**
   * Run the matching algorithm and generate a preview
   */
  async runMatching(
    cohortId: string,
    dto: RunMatchingDto = {}
  ): Promise<MatchingPreviewDto> {
    const cohort = await this.cohortRepository.findOne({
      where: { id: cohortId },
    });
    if (!cohort) {
      throw new NotFoundException("Cohort not found");
    }

    const config = this.normalizeConfig(dto.config);
    const warnings: string[] = [];

    // Get eligible teams (forming or active, without a brief)
    const allTeams = await this.getEligibleTeams(cohortId, dto.teamIds);
    
    // Filter teams that meet minimum size requirement
    const minTeamSize = cohort.teamSizeMin || 3;
    const teams = allTeams.filter((team) => team.members.length >= minTeamSize);
    const undersizedTeams = allTeams.filter((team) => team.members.length < minTeamSize);

    if (undersizedTeams.length > 0) {
      warnings.push(
        `${undersizedTeams.length} team(s) excluded from matching because they don't meet minimum size requirement (${minTeamSize} members)`
      );
    }

    if (teams.length === 0) {
      warnings.push("No eligible teams found for matching");
    }

    // Get available briefs
    const briefs = await this.getAvailableBriefs(cohortId, dto.briefIds);
    if (briefs.length === 0) {
      warnings.push("No available briefs found for matching");
    }

    // Prepare team data with preferences
    const teamsWithPrefs = await this.prepareTeamsWithPreferences(teams);

    // Prepare brief data with capacity
    const briefsWithCapacity = await this.prepareBriefsWithCapacity(
      briefs,
      config.maxTeamsPerBrief
    );

    // Run the matching algorithm
    const { matches, unmatchedTeamIds } = this.executeMatching(
      teamsWithPrefs,
      briefsWithCapacity,
      config
    );

    // Add undersized team IDs to unmatched (they were excluded)
    const allUnmatchedTeamIds = [
      ...unmatchedTeamIds,
      ...undersizedTeams.map((t) => t.id),
    ];

    // Calculate statistics
    const statistics = this.calculateStatistics(
      allTeams.length, // Total including undersized
      briefs.length,
      matches,
      allUnmatchedTeamIds
    );

    // Build match results with full details
    const matchResults = await this.buildMatchResults(matches, teams, briefs);

    const preview: MatchingPreviewDto = {
      cohortId,
      cohortName: cohort.name,
      generatedAt: new Date(),
      statistics,
      matches: matchResults,
      unmatchedTeamIds: allUnmatchedTeamIds,
      configUsed: config,
      warnings,
    };

    // Cache the preview
    this.previewCache.set(cohortId, preview);

    return preview;
  }

  /**
   * Get the current matching preview
   */
  async getMatchingPreview(cohortId: string): Promise<MatchingPreviewDto | null> {
    return this.previewCache.get(cohortId) || null;
  }

  /**
   * Clear the matching preview cache
   */
  clearPreviewCache(cohortId: string): void {
    this.previewCache.delete(cohortId);
  }

  /**
   * Finalize matching and apply assignments
   */
  async finalizeMatching(
    cohortId: string,
    dto: FinalizeMatchingDto = {}
  ): Promise<{ assignedCount: number; errors: string[] }> {
    const preview = this.previewCache.get(cohortId);
    if (!preview) {
      throw new BadRequestException(
        "No matching preview found. Run matching first."
      );
    }

    const errors: string[] = [];
    let assignedCount = 0;

    // Build final assignments map
    const assignments = new Map<string, string>();

    // Start with preview matches
    for (const match of preview.matches) {
      if (!dto.excludeTeamIds?.includes(match.teamId)) {
        assignments.set(match.teamId, match.briefId);
      }
    }

    // Apply overrides
    if (dto.overrides) {
      for (const override of dto.overrides) {
        assignments.set(override.teamId, override.briefId);
      }
    }

    // Apply assignments
    for (const [teamId, briefId] of assignments) {
      try {
        await this.assignBriefToTeam(teamId, briefId);
        assignedCount++;
      } catch (error) {
        errors.push(`Failed to assign team ${teamId} to brief ${briefId}: ${error.message}`);
      }
    }

    // Clear cache after finalization
    this.previewCache.delete(cohortId);

    return { assignedCount, errors };
  }

  /**
   * Get brief capacity summary for a cohort
   */
  async getBriefCapacities(cohortId: string): Promise<BriefCapacityDto[]> {
    const briefs = await this.briefRepository.find({
      where: { cohortId, status: BriefStatus.APPROVED },
      relations: ["organization", "vertical"],
    });

    const preview = this.previewCache.get(cohortId);
    const previewAssignments = new Map<string, number>();

    if (preview) {
      for (const match of preview.matches) {
        const count = previewAssignments.get(match.briefId) || 0;
        previewAssignments.set(match.briefId, count + 1);
      }
    }

    return Promise.all(
      briefs.map(async (brief) => {
        const currentTeams = await this.teamRepository.count({
          where: { briefId: brief.id },
        });

        return {
          briefId: brief.id,
          briefTitle: brief.title,
          organizationName: brief.organization?.name || "Unknown",
          verticalName: brief.vertical?.name || null,
          maxTeams: brief.maxTeams,
          currentTeams,
          previewTeams: previewAssignments.get(brief.id) || 0,
          availableSlots: Math.max(0, brief.maxTeams - currentTeams),
        };
      })
    );
  }

  /**
   * Get team matching status for a cohort
   */
  async getTeamMatchStatus(cohortId: string): Promise<TeamMatchStatusDto[]> {
    const teams = await this.teamRepository.find({
      where: {
        cohortId,
        status: In([TeamStatus.FORMING, TeamStatus.ACTIVE]),
      },
      relations: ["members", "members.participant"],
    });

    const preview = this.previewCache.get(cohortId);
    const previewAssignments = new Map<string, { briefId: string; score: number }>();

    if (preview) {
      for (const match of preview.matches) {
        previewAssignments.set(match.teamId, {
          briefId: match.briefId,
          score: match.score,
        });
      }
    }

    return Promise.all(
      teams.map(async (team) => {
        const preferences = await this.getTeamAggregatedPreferences(team);
        const previewMatch = previewAssignments.get(team.id);

        return {
          teamId: team.id,
          teamName: team.name,
          memberCount: team.members.length,
          hasPreferences: preferences.briefRankings.length > 0,
          rankedBriefIds: preferences.briefRankings,
          currentBriefId: team.briefId || null,
          previewBriefId: previewMatch?.briefId || null,
          previewScore: previewMatch?.score || null,
        };
      })
    );
  }

  // ============ Private Methods ============

  private normalizeConfig(config?: MatchingConfigDto): Omit<Required<MatchingConfigDto>, 'maxTeamsPerBrief'> & { maxTeamsPerBrief?: number } {
    return {
      firstChoiceWeight: config?.firstChoiceWeight ?? 1.0,
      secondChoiceWeight: config?.secondChoiceWeight ?? 0.8,
      thirdChoiceWeight: config?.thirdChoiceWeight ?? 0.6,
      fourthChoiceWeight: config?.fourthChoiceWeight ?? 0.4,
      fifthChoiceWeight: config?.fifthChoiceWeight ?? 0.2,
      verticalWeight: config?.verticalWeight ?? 0.5,
      skillOverlapWeight: config?.skillOverlapWeight ?? 0.3,
      balanceDistribution: config?.balanceDistribution ?? true,
      maxTeamsPerBrief: config?.maxTeamsPerBrief,
    };
  }

  private async getEligibleTeams(
    cohortId: string,
    teamIds?: string[]
  ): Promise<Team[]> {
    const where: any = {
      cohortId,
      status: In([TeamStatus.FORMING, TeamStatus.ACTIVE]),
      briefId: IsNull(),
    };

    if (teamIds?.length) {
      where.id = In(teamIds);
    }

    return this.teamRepository.find({
      where,
      relations: ["members", "members.participant"],
    });
  }

  private async getAvailableBriefs(
    cohortId: string,
    briefIds?: string[]
  ): Promise<Brief[]> {
    const where: any = {
      cohortId,
      status: BriefStatus.APPROVED,
    };

    if (briefIds?.length) {
      where.id = In(briefIds);
    }

    return this.briefRepository.find({
      where,
      relations: ["organization", "vertical"],
    });
  }

  private async prepareTeamsWithPreferences(
    teams: Team[]
  ): Promise<TeamWithPreferences[]> {
    return Promise.all(
      teams.map(async (team) => {
        const prefs = await this.getTeamAggregatedPreferences(team);
        return {
          team,
          ...prefs,
        };
      })
    );
  }

  private async getTeamAggregatedPreferences(team: Team): Promise<{
    briefRankings: string[];
    verticalPreferences: string[];
    skills: string[];
    interests: string[];
  }> {
    const participantIds = team.members.map((m) => m.participantId);

    const preferences = await this.preferenceRepository.find({
      where: { participantId: In(participantIds) },
    });

    // Aggregate brief rankings using Borda count
    const briefScores = new Map<string, number>();
    for (const pref of preferences) {
      if (pref.briefRankings) {
        pref.briefRankings.forEach((briefId, index) => {
          const score = 5 - index; // 5 for first, 4 for second, etc.
          briefScores.set(briefId, (briefScores.get(briefId) || 0) + score);
        });
      }
    }

    // Sort by aggregated score
    const briefRankings = Array.from(briefScores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([briefId]) => briefId)
      .slice(0, 5);

    // Aggregate vertical preferences
    const verticalCounts = new Map<string, number>();
    for (const pref of preferences) {
      if (pref.verticalId1) {
        verticalCounts.set(
          pref.verticalId1,
          (verticalCounts.get(pref.verticalId1) || 0) + 2
        );
      }
      if (pref.verticalId2) {
        verticalCounts.set(
          pref.verticalId2,
          (verticalCounts.get(pref.verticalId2) || 0) + 1
        );
      }
    }

    const verticalPreferences = Array.from(verticalCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([verticalId]) => verticalId);

    // Aggregate skills
    const skills = new Set<string>();
    for (const member of team.members) {
      if (member.participant.skills) {
        member.participant.skills.forEach((skill) => skills.add(skill));
      }
    }

    // Aggregate interests
    const interests = new Set<string>();
    for (const member of team.members) {
      if (member.participant.interests) {
        member.participant.interests.forEach((interest) => interests.add(interest));
      }
    }

    return {
      briefRankings,
      verticalPreferences,
      skills: Array.from(skills),
      interests: Array.from(interests),
    };
  }

  private async prepareBriefsWithCapacity(
    briefs: Brief[],
    maxTeamsOverride?: number
  ): Promise<BriefWithCapacity[]> {
    return Promise.all(
      briefs.map(async (brief) => {
        const currentTeams = await this.teamRepository.count({
          where: { briefId: brief.id },
        });

        const maxTeams = maxTeamsOverride ?? brief.maxTeams;
        const availableSlots = Math.max(0, maxTeams - currentTeams);

        return {
          brief,
          currentTeams,
          availableSlots,
        };
      })
    );
  }

  /**
   * Core matching algorithm using a modified Gale-Shapley approach
   */
  private executeMatching(
    teams: TeamWithPreferences[],
    briefs: BriefWithCapacity[],
    config: Omit<Required<MatchingConfigDto>, 'maxTeamsPerBrief'> & { maxTeamsPerBrief?: number }
  ): { matches: MatchCandidate[]; unmatchedTeamIds: string[] } {
    const matches: MatchCandidate[] = [];
    const unmatchedTeamIds: string[] = [];

    // Track remaining capacity for each brief
    const briefCapacity = new Map<string, number>();
    for (const b of briefs) {
      briefCapacity.set(b.brief.id, b.availableSlots);
    }

    // Calculate all possible match scores
    const allCandidates: MatchCandidate[] = [];
    for (const teamData of teams) {
      for (const briefData of briefs) {
        if (briefData.availableSlots > 0) {
          const candidate = this.calculateMatchScore(
            teamData,
            briefData.brief,
            config
          );
          allCandidates.push(candidate);
        }
      }
    }

    // Sort candidates by score (descending)
    allCandidates.sort((a, b) => b.score - a.score);

    // Greedy assignment: assign highest scoring pairs first
    const assignedTeams = new Set<string>();
    const assignedBriefs = new Map<string, number>(); // briefId -> assignedCount

    for (const candidate of allCandidates) {
      if (assignedTeams.has(candidate.teamId)) {
        continue;
      }

      const briefCap = briefCapacity.get(candidate.briefId) || 0;
      const assignedCount = assignedBriefs.get(candidate.briefId) || 0;

      if (assignedCount < briefCap) {
        matches.push(candidate);
        assignedTeams.add(candidate.teamId);
        assignedBriefs.set(candidate.briefId, assignedCount + 1);
      }
    }

    // Find unmatched teams
    for (const teamData of teams) {
      if (!assignedTeams.has(teamData.team.id)) {
        unmatchedTeamIds.push(teamData.team.id);
      }
    }

    return { matches, unmatchedTeamIds };
  }

  private calculateMatchScore(
    teamData: TeamWithPreferences,
    brief: Brief,
    config: Omit<Required<MatchingConfigDto>, 'maxTeamsPerBrief'> & { maxTeamsPerBrief?: number }
  ): MatchCandidate {
    const rankWeights = [
      config.firstChoiceWeight,
      config.secondChoiceWeight,
      config.thirdChoiceWeight,
      config.fourthChoiceWeight,
      config.fifthChoiceWeight,
    ];

    // Calculate ranking score (max 40 points)
    const rankPosition = teamData.briefRankings.indexOf(brief.id);
    let rankingScore = 0;
    if (rankPosition >= 0 && rankPosition < 5) {
      rankingScore = rankWeights[rankPosition] * 40;
    }

    // Calculate vertical match score (max 25 points)
    let verticalScore = 0;
    const verticalMatch =
      brief.verticalId != null &&
      teamData.verticalPreferences.includes(brief.verticalId);
    if (verticalMatch && brief.verticalId) {
      const verticalRank = teamData.verticalPreferences.indexOf(brief.verticalId);
      verticalScore =
        config.verticalWeight * (verticalRank === 0 ? 25 : 15);
    }

    // Calculate skill overlap score (max 20 points)
    let skillScore = 0;
    let skillOverlap = 0;
    if (brief.tags?.length && teamData.skills.length) {
      const briefTags = new Set(brief.tags.map((t) => t.toLowerCase()));
      skillOverlap = teamData.skills.filter((s) =>
        briefTags.has(s.toLowerCase())
      ).length;
      skillScore =
        config.skillOverlapWeight * Math.min(skillOverlap * 8, 20);
    }

    // Calculate interest overlap score (max 15 points)
    let interestScore = 0;
    let interestOverlap = 0;
    if (brief.tags?.length && teamData.interests.length) {
      const briefTags = new Set(brief.tags.map((t) => t.toLowerCase()));
      interestOverlap = teamData.interests.filter((i) =>
        briefTags.has(i.toLowerCase())
      ).length;
      // Use interest weight (default to half of skill weight if not specified)
      const interestWeight = config.skillOverlapWeight * 0.5;
      interestScore = interestWeight * Math.min(interestOverlap * 6, 15);
    }

    const totalScore = Math.round(rankingScore + verticalScore + skillScore + interestScore);

    return {
      teamId: teamData.team.id,
      briefId: brief.id,
      score: totalScore,
      scoreBreakdown: {
        rankingScore: Math.round(rankingScore),
        verticalScore: Math.round(verticalScore),
        skillScore: Math.round(skillScore),
        interestScore: Math.round(interestScore),
      },
      rankPosition: rankPosition >= 0 ? rankPosition + 1 : null,
      verticalMatch: !!verticalMatch,
      skillOverlap,
      interestOverlap,
    };
  }

  private calculateStatistics(
    totalTeams: number,
    totalBriefs: number,
    matches: MatchCandidate[],
    unmatchedTeamIds: string[]
  ): MatchingStatsDto {
    const matchedTeams = matches.length;
    const unmatchedTeams = unmatchedTeamIds.length;

    const averageScore =
      matches.length > 0
        ? matches.reduce((sum, m) => sum + m.score, 0) / matches.length
        : 0;

    const firstChoiceCount = matches.filter((m) => m.rankPosition === 1).length;
    const topThreeCount = matches.filter(
      (m) => m.rankPosition && m.rankPosition <= 3
    ).length;
    const rankedCount = matches.filter((m) => m.rankPosition !== null).length;
    const unrankedCount = matches.filter((m) => m.rankPosition === null).length;

    const briefsWithTeams = new Set(matches.map((m) => m.briefId)).size;

    return {
      totalTeams,
      matchedTeams,
      unmatchedTeams,
      totalBriefs,
      briefsWithTeams,
      briefsAtCapacity: 0, // Could calculate this if needed
      averageScore: Math.round(averageScore * 10) / 10,
      firstChoicePercentage:
        matchedTeams > 0 ? Math.round((firstChoiceCount / matchedTeams) * 100) : 0,
      topThreePercentage:
        matchedTeams > 0 ? Math.round((topThreeCount / matchedTeams) * 100) : 0,
      matchedToRankedBrief: rankedCount,
      matchedToUnrankedBrief: unrankedCount,
    };
  }

  private async buildMatchResults(
    matches: MatchCandidate[],
    teams: Team[],
    briefs: Brief[]
  ): Promise<MatchResultDto[]> {
    const teamMap = new Map(teams.map((t) => [t.id, t]));
    const briefMap = new Map(briefs.map((b) => [b.id, b]));

    return matches.map((match) => {
      const team = teamMap.get(match.teamId)!;
      const brief = briefMap.get(match.briefId)!;

      return {
        teamId: match.teamId,
        teamName: team.name,
        briefId: match.briefId,
        briefTitle: brief.title,
        organizationName: brief.organization?.name || "Unknown",
        score: match.score,
        scoreBreakdown: match.scoreBreakdown,
        rankPosition: match.rankPosition,
        verticalMatch: match.verticalMatch,
        skillOverlap: match.skillOverlap,
        interestOverlap: match.interestOverlap,
      };
    });
  }

  private async assignBriefToTeam(
    teamId: string,
    briefId: string
  ): Promise<void> {
    const team = await this.teamRepository.findOne({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundException(`Team ${teamId} not found`);
    }

    if (team.briefId) {
      throw new BadRequestException(`Team ${teamId} already has a brief assigned`);
    }

    const brief = await this.briefRepository.findOne({
      where: { id: briefId },
    });

    if (!brief) {
      throw new NotFoundException(`Brief ${briefId} not found`);
    }

    // Check capacity
    const currentCount = await this.teamRepository.count({
      where: { briefId },
    });

    if (currentCount >= brief.maxTeams) {
      throw new BadRequestException(
        `Brief ${briefId} has reached maximum team capacity`
      );
    }

    // Assign brief and update status
    team.briefId = briefId;
    if (team.status === TeamStatus.FORMING) {
      team.status = TeamStatus.ACTIVE;
    }

    await this.teamRepository.save(team);

    // Update brief teams count
    await this.briefRepository.increment({ id: briefId }, "teamsCount", 1);
  }
}
