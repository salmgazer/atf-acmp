import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, IsNull } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { Team, TeamMember, TeamStatus, TeamRole, TeamMemberStatus } from "@/database/entities/team.entity";
import { Cohort } from "@/database/entities/cohort.entity";
import {
  Participant,
  ParticipantPreference,
  ParticipantStatus,
} from "@/database/entities/participant.entity";
import { Brief, BriefStatus } from "@/database/entities/brief.entity";
import { Vertical } from "@/database/entities/vertical.entity";
import {
  getSkillBreakdown,
  classifyParticipantSkills,
  type ParticipantSkillProfile,
} from "@acmp/shared";
import {
  TeamFormationConfigDto,
  RunTeamFormationDto,
  FinalizeTeamFormationDto,
  TeamFormationPreviewDto,
  ProposedTeamDto,
  ProposedBackfillDto,
  ProposedBriefAssignmentDto,
  BackfillStatsDto,
  BriefAssignmentStatsDto,
  SkillBalanceStatsDto,
  TeamFormationStatsDto,
  ParticipantFormationStatusDto,
  LeadSelectionStrategy,
  SkillProfile,
} from "./dto/team-formation.dto";

interface ParticipantWithPreferences {
  participant: Participant;
  preference: ParticipantPreference | null;
  skills: string[];
  interests: string[];
  verticalPreferences: string[];
  crossCountryWilling: boolean;
  skillProfile: SkillProfile;
  techSkillCount: number;
  nonTechSkillCount: number;
}

interface CompatibilityScore {
  total: number;
  skillScore: number;
  interestScore: number;
  verticalScore: number;
  countryScore: number;
  techBalanceScore: number;
}

interface TeamSkillBalance {
  techCount: number;
  nonTechCount: number;
  techRatio: number;
  profiles: Record<SkillProfile, number>;
}

interface ExistingTeamInfo {
  team: Team;
  members: TeamMember[];
  memberParticipants: Participant[];
  memberPreferences: ParticipantPreference[];
  currentSize: number;
  briefId: string | null;
  verticalPreferences: string[];
  countries: string[];
}

@Injectable()
export class TeamFormationService {
  private readonly logger = new Logger(TeamFormationService.name);

  // Cache for preview results
  private formationPreviewCache: Map<string, TeamFormationPreviewDto> = new Map();

  constructor(
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
    @InjectRepository(Cohort)
    private readonly cohortRepository: Repository<Cohort>,
    @InjectRepository(Participant)
    private readonly participantRepository: Repository<Participant>,
    @InjectRepository(ParticipantPreference)
    private readonly preferenceRepository: Repository<ParticipantPreference>,
    @InjectRepository(Brief)
    private readonly briefRepository: Repository<Brief>,
    @InjectRepository(Vertical)
    private readonly verticalRepository: Repository<Vertical>,
  ) {}

  /**
   * Run the team formation algorithm and generate a preview
   * 
   * When useBriefCentricAssignment is enabled (default), uses round-robin approach:
   * 1. Get all approved briefs organized by vertical
   * 2. Get existing teams without briefs
   * 3. Round-robin through verticals, assigning briefs to teams (existing or newly formed)
   */
  async runTeamFormation(
    cohortId: string,
    dto: RunTeamFormationDto = {},
  ): Promise<TeamFormationPreviewDto> {
    const cohort = await this.cohortRepository.findOne({
      where: { id: cohortId },
    });
    if (!cohort) {
      throw new NotFoundException("Cohort not found");
    }

    const config = this.normalizeConfig(dto.config, cohort);
    const warnings: string[] = [];

    // Get eligible participants (active, in this cohort, without a team)
    const participants = await this.getEligibleParticipants(cohortId, dto.participantIds);
    if (participants.length === 0) {
      warnings.push("No eligible participants found for team formation");
    }

    // Prepare participant data with preferences
    const participantsWithPrefs = await this.prepareParticipantsWithPreferences(participants);

    // Use brief-centric round-robin assignment if enabled
    if (config.useBriefCentricAssignment) {
      return this.runBriefCentricFormation(cohortId, cohort, participantsWithPrefs, config, warnings);
    }

    // Otherwise use legacy team-first formation
    return this.runLegacyTeamFormation(cohortId, cohort, participantsWithPrefs, config, warnings);
  }

  /**
   * Brief-centric round-robin team formation
   * Assigns briefs to teams (not teams to briefs) for fair distribution
   */
  private async runBriefCentricFormation(
    cohortId: string,
    cohort: Cohort,
    participantsWithPrefs: ParticipantWithPreferences[],
    config: Required<TeamFormationConfigDto>,
    warnings: string[],
  ): Promise<TeamFormationPreviewDto> {
    // ====== PHASE 0: BACKFILL EXISTING UNDERSIZED TEAMS (as PENDING) ======
    const { proposedBackfills, backfilledParticipantIds, backfillStats } = 
      await this.executeBackfillPhase(cohortId, participantsWithPrefs, config);

    // Filter out backfilled participants from new team formation
    let remainingParticipants = participantsWithPrefs.filter(
      (p) => !backfilledParticipantIds.has(p.participant.id),
    );

    if (proposedBackfills.length > 0) {
      this.logger.log(
        `Backfill phase: ${proposedBackfills.length} teams will receive ${backfilledParticipantIds.size} participants (as PENDING)`,
      );
    }

    // ====== PHASE 1: GET APPROVED BRIEFS BY VERTICAL ======
    const briefsByVertical = await this.getApprovedBriefsByVertical(cohortId);
    const verticals = await this.verticalRepository.find({
      where: { cohortId, isActive: true },
      order: { displayOrder: "ASC" },
    });

    if (verticals.length === 0) {
      warnings.push("No active verticals found in this cohort");
    }

    // ====== PHASE 2: GET EXISTING TEAMS WITHOUT BRIEFS ======
    const teamsWithoutBriefs = await this.getTeamsWithoutBriefs(cohortId);
    this.logger.log(`Found ${teamsWithoutBriefs.length} existing teams without briefs`);

    // ====== PHASE 3: ROUND-ROBIN BRIEF ASSIGNMENT ======
    const proposedTeams: ProposedTeamDto[] = [];
    const proposedBriefAssignments: ProposedBriefAssignmentDto[] = [];
    const assignedBriefIds = new Set<string>();
    const assignedParticipantIds = new Set<string>();
    const usedTeamIds = new Set<string>();
    let teamCounter = 1;

    // Track brief index for each vertical (for round-robin)
    const verticalBriefIndex: Map<string, number> = new Map();
    verticals.forEach((v) => verticalBriefIndex.set(v.id, 0));

    // Calculate total briefs that need teams
    const totalBriefsNeedingTeams = Array.from(briefsByVertical.values())
      .flat()
      .filter((b) => b.teamsCount < b.maxTeams).length;

    this.logger.log(`Brief-centric formation: ${totalBriefsNeedingTeams} briefs need teams, ${remainingParticipants.length} available participants`);

    // Round-robin through verticals until we run out of briefs or participants
    let globalIterations = 0;
    const maxIterations = totalBriefsNeedingTeams + 10; // Safety limit

    while (globalIterations < maxIterations) {
      let assignedThisRound = false;

      for (const vertical of verticals) {
        const verticalBriefs = briefsByVertical.get(vertical.id) || [];
        const briefIndex = verticalBriefIndex.get(vertical.id) || 0;

        // Find next unassigned brief in this vertical
        let nextBrief: Brief | null = null;
        for (let i = briefIndex; i < verticalBriefs.length; i++) {
          const brief = verticalBriefs[i];
          if (!assignedBriefIds.has(brief.id) && brief.teamsCount < brief.maxTeams) {
            nextBrief = brief;
            verticalBriefIndex.set(vertical.id, i + 1);
            break;
          }
        }

        if (!nextBrief) {
          continue; // No more briefs in this vertical
        }

        // Try to assign this brief to a team
        const assignment = await this.assignBriefToTeam(
          nextBrief,
          vertical,
          teamsWithoutBriefs.filter((t) => !usedTeamIds.has(t.team.id)),
          remainingParticipants.filter((p) => !assignedParticipantIds.has(p.participant.id)),
          config,
          teamCounter,
        );

        if (assignment) {
          assignedBriefIds.add(nextBrief.id);
          assignedThisRound = true;

          if (assignment.type === "existing_team") {
            proposedBriefAssignments.push(assignment.briefAssignment!);
            usedTeamIds.add(assignment.briefAssignment!.teamId);
          } else if (assignment.type === "new_team") {
            proposedTeams.push(assignment.proposedTeam!);
            assignment.proposedTeam!.participantIds.forEach((id) => assignedParticipantIds.add(id));
            teamCounter++;
          }
        }
      }

      if (!assignedThisRound) {
        break; // No more assignments possible
      }

      globalIterations++;
    }

    // Collect unassigned data
    const unassignedParticipantIds = remainingParticipants
      .filter((p) => !assignedParticipantIds.has(p.participant.id))
      .map((p) => p.participant.id);

    const unassignedBriefIds = Array.from(briefsByVertical.values())
      .flat()
      .filter((b) => !assignedBriefIds.has(b.id) && b.teamsCount < b.maxTeams)
      .map((b) => b.id);

    if (unassignedParticipantIds.length > 0) {
      warnings.push(
        `${unassignedParticipantIds.length} participant(s) could not be assigned to a team`,
      );
    }

    if (unassignedBriefIds.length > 0) {
      warnings.push(
        `${unassignedBriefIds.length} brief(s) could not be assigned teams (not enough participants)`,
      );
    }

    // Calculate statistics
    const statistics = this.calculateStatisticsWithBriefs(
      participantsWithPrefs,
      proposedTeams,
      proposedBriefAssignments,
      unassignedParticipantIds,
      unassignedBriefIds,
      backfillStats,
      briefsByVertical,
    );

    const preview: TeamFormationPreviewDto = {
      cohortId,
      cohortName: cohort.name,
      generatedAt: new Date(),
      statistics,
      proposedBackfills,
      proposedBriefAssignments,
      proposedTeams,
      unassignedParticipantIds,
      unassignedBriefIds,
      configUsed: config,
      warnings,
    };

    // Cache the preview
    this.formationPreviewCache.set(cohortId, preview);

    return preview;
  }

  /**
   * Legacy team-first formation (original algorithm)
   */
  private async runLegacyTeamFormation(
    cohortId: string,
    cohort: Cohort,
    participantsWithPrefs: ParticipantWithPreferences[],
    config: Required<TeamFormationConfigDto>,
    warnings: string[],
  ): Promise<TeamFormationPreviewDto> {
    // ====== PHASE 0: BACKFILL EXISTING UNDERSIZED TEAMS ======
    const { proposedBackfills, backfilledParticipantIds, backfillStats } = 
      await this.executeBackfillPhase(cohortId, participantsWithPrefs, config);

    // Filter out backfilled participants from new team formation
    const remainingParticipants = participantsWithPrefs.filter(
      (p) => !backfilledParticipantIds.has(p.participant.id),
    );

    if (proposedBackfills.length > 0) {
      this.logger.log(
        `Backfill phase: ${proposedBackfills.length} teams will receive ${backfilledParticipantIds.size} participants`,
      );
    }

    // Separate remaining participants by cross-country willingness
    const crossCountryWilling = remainingParticipants.filter((p) => p.crossCountryWilling);
    const sameCountryPreferred = remainingParticipants.filter((p) => !p.crossCountryWilling);

    this.logger.log(
      `Team formation: ${remainingParticipants.length} remaining after backfill, ${crossCountryWilling.length} cross-country willing, ${sameCountryPreferred.length} same-country preferred`,
    );

    // Form new teams from remaining participants
    const { proposedTeams, unassignedParticipantIds } = this.executeTeamFormation(
      crossCountryWilling,
      sameCountryPreferred,
      config,
      cohort,
    );

    if (unassignedParticipantIds.length > 0) {
      warnings.push(
        `${unassignedParticipantIds.length} participant(s) could not be assigned to a team due to insufficient matches`,
      );
    }

    // Calculate statistics (include backfill info)
    const statistics = this.calculateStatistics(
      participantsWithPrefs,
      proposedTeams,
      unassignedParticipantIds,
      backfillStats,
    );

    const preview: TeamFormationPreviewDto = {
      cohortId,
      cohortName: cohort.name,
      generatedAt: new Date(),
      statistics,
      proposedBackfills,
      proposedBriefAssignments: [],
      proposedTeams,
      unassignedParticipantIds,
      unassignedBriefIds: [],
      configUsed: config,
      warnings,
    };

    // Cache the preview
    this.formationPreviewCache.set(cohortId, preview);

    return preview;
  }

  /**
   * Get approved briefs organized by vertical
   */
  private async getApprovedBriefsByVertical(cohortId: string): Promise<Map<string, Brief[]>> {
    const briefs = await this.briefRepository.find({
      where: {
        cohortId,
        status: BriefStatus.APPROVED,
      },
      relations: ["vertical", "organization"],
      order: { priorityScore: "DESC" },
    });

    const byVertical = new Map<string, Brief[]>();
    for (const brief of briefs) {
      if (!brief.verticalId) continue;
      
      const existing = byVertical.get(brief.verticalId) || [];
      existing.push(brief);
      byVertical.set(brief.verticalId, existing);
    }

    return byVertical;
  }

  /**
   * Get existing teams without briefs assigned
   */
  private async getTeamsWithoutBriefs(cohortId: string): Promise<ExistingTeamInfo[]> {
    const teams = await this.teamRepository.find({
      where: {
        cohortId,
        briefId: IsNull(),
        status: In([TeamStatus.ACTIVE, TeamStatus.FORMING]),
      },
      relations: ["members", "members.participant"],
    });

    const result: ExistingTeamInfo[] = [];

    for (const team of teams) {
      const activeMembers = team.members?.filter(
        (m) => m.status === TeamMemberStatus.CONFIRMED && m.participant?.status !== ParticipantStatus.INACTIVE,
      ) || [];

      const memberParticipants = activeMembers
        .map((m) => m.participant)
        .filter((p) => p != null);

      // Get member preferences
      const memberPreferences = await this.preferenceRepository.find({
        where: { participantId: In(memberParticipants.map((p) => p.id)) },
      });

      // Collect vertical preferences from team members
      const verticalPrefs: string[] = [];
      for (const pref of memberPreferences) {
        if (pref.verticalId1) verticalPrefs.push(pref.verticalId1);
        if (pref.verticalId2) verticalPrefs.push(pref.verticalId2);
      }

      // Collect countries from team members
      const countries = [
        ...new Set(memberParticipants.map((p) => p.country).filter(Boolean)),
      ];

      result.push({
        team,
        members: activeMembers,
        memberParticipants,
        memberPreferences,
        currentSize: activeMembers.length,
        briefId: null,
        verticalPreferences: [...new Set(verticalPrefs)],
        countries,
      });
    }

    return result;
  }

  /**
   * Try to assign a brief to either an existing team or form a new team
   */
  private async assignBriefToTeam(
    brief: Brief,
    vertical: Vertical,
    availableTeams: ExistingTeamInfo[],
    availableParticipants: ParticipantWithPreferences[],
    config: Required<TeamFormationConfigDto>,
    teamCounter: number,
  ): Promise<{
    type: "existing_team" | "new_team";
    briefAssignment?: ProposedBriefAssignmentDto;
    proposedTeam?: ProposedTeamDto;
  } | null> {
    // First, try to find an existing team that matches this brief well
    const bestExistingTeam = this.findBestTeamForBrief(brief, vertical, availableTeams);

    if (bestExistingTeam && bestExistingTeam.matchScore >= 20) {
      // Assign brief to existing team
      return {
        type: "existing_team",
        briefAssignment: bestExistingTeam,
      };
    }

    // If no good existing team, try to form a new team
    if (availableParticipants.length >= config.teamSizeMin) {
      const newTeam = this.formTeamForBrief(
        brief,
        vertical,
        availableParticipants,
        config,
        teamCounter,
      );

      if (newTeam) {
        return {
          type: "new_team",
          proposedTeam: newTeam,
        };
      }
    }

    return null;
  }

  /**
   * Find the best existing team for a brief based on collective interests
   */
  private findBestTeamForBrief(
    brief: Brief,
    vertical: Vertical,
    availableTeams: ExistingTeamInfo[],
  ): ProposedBriefAssignmentDto | null {
    if (availableTeams.length === 0) return null;

    let bestTeam: ExistingTeamInfo | null = null;
    let bestScore = 0;
    let bestMembersWithRanking = 0;

    for (const teamInfo of availableTeams) {
      let score = 0;
      let membersWithRanking = 0;

      // Check vertical alignment
      const verticalMatches = teamInfo.verticalPreferences.filter(
        (v) => v === brief.verticalId,
      ).length;
      score += verticalMatches * 20;

      // Check brief rankings in member preferences
      for (const pref of teamInfo.memberPreferences) {
        if (pref.briefRankings?.includes(brief.id)) {
          const rank = pref.briefRankings.indexOf(brief.id);
          score += Math.max(0, 30 - rank * 5); // 30 for first choice, 25 for second, etc.
          membersWithRanking++;
        }
      }

      // Bonus for team size
      score += teamInfo.currentSize * 5;

      if (score > bestScore) {
        bestScore = score;
        bestTeam = teamInfo;
        bestMembersWithRanking = membersWithRanking;
      }
    }

    if (!bestTeam) return null;

    return {
      teamId: bestTeam.team.id,
      teamName: bestTeam.team.name,
      briefId: brief.id,
      briefTitle: brief.title,
      verticalId: vertical.id,
      verticalName: vertical.name,
      matchScore: bestScore,
      teamMemberCount: bestTeam.currentSize,
      teamVerticalPreferences: bestTeam.verticalPreferences,
      membersWithBriefRanking: bestMembersWithRanking,
    };
  }

  /**
   * Form a new team specifically for a brief
   */
  private formTeamForBrief(
    brief: Brief,
    vertical: Vertical,
    availableParticipants: ParticipantWithPreferences[],
    config: Required<TeamFormationConfigDto>,
    teamCounter: number,
  ): ProposedTeamDto | null {
    // Score participants by how well they match this brief
    const scoredParticipants = availableParticipants.map((p) => {
      let score = 0;

      // Vertical preference match
      if (p.verticalPreferences.includes(brief.verticalId || "")) {
        score += 30;
      }

      // Brief ranking match
      if (p.preference?.briefRankings?.includes(brief.id)) {
        const rank = p.preference.briefRankings.indexOf(brief.id);
        score += Math.max(0, 25 - rank * 5);
      }

      // Engagement score
      score += this.getParticipantEngagementScore(p) * 0.5;

      return { participant: p, score };
    });

    // Sort by score
    scoredParticipants.sort((a, b) => b.score - a.score);

    // Select participants with balance
    const targetSize = config.teamSizeMax;
    const targetTechCount = Math.round(targetSize * config.targetTechRatio);
    const targetNonTechCount = targetSize - targetTechCount;

    const selectedParticipants: ParticipantWithPreferences[] = [];
    const usedIds = new Set<string>();

    // First pass: select high-scoring participants with balance
    let techAdded = 0;
    let nonTechAdded = 0;

    for (const { participant: p } of scoredParticipants) {
      if (selectedParticipants.length >= targetSize) break;
      if (usedIds.has(p.participant.id)) continue;

      if (p.skillProfile === "technical" && techAdded < targetTechCount) {
        selectedParticipants.push(p);
        usedIds.add(p.participant.id);
        techAdded++;
      } else if (p.skillProfile === "non-technical" && nonTechAdded < targetNonTechCount) {
        selectedParticipants.push(p);
        usedIds.add(p.participant.id);
        nonTechAdded++;
      } else if (p.skillProfile === "hybrid") {
        selectedParticipants.push(p);
        usedIds.add(p.participant.id);
        techAdded += 0.5;
        nonTechAdded += 0.5;
      }
    }

    // Fill remaining slots
    for (const { participant: p } of scoredParticipants) {
      if (selectedParticipants.length >= targetSize) break;
      if (!usedIds.has(p.participant.id)) {
        selectedParticipants.push(p);
        usedIds.add(p.participant.id);
      }
    }

    if (selectedParticipants.length < config.teamSizeMin) {
      return null;
    }

    // Build the proposed team
    const { score, breakdown, skillBalance } = this.calculateTeamCompatibility(
      selectedParticipants,
      config,
    );
    const leadParticipant = this.selectTeamLead(selectedParticipants, config.leadSelectionStrategy);
    const countries = [...new Set(selectedParticipants.map((p) => p.participant.country))];

    return {
      proposedTeamId: uuidv4(),
      suggestedName: `Team ${vertical.name} ${teamCounter}`,
      participantIds: selectedParticipants.map((p) => p.participant.id),
      participants: selectedParticipants.map((p) => ({
        id: p.participant.id,
        participantId: p.participant.participantId,
        firstName: p.participant.firstName,
        lastName: p.participant.lastName,
        country: p.participant.country,
        skills: p.skills,
        interests: p.interests,
        isProposedLead: p.participant.id === leadParticipant.participant.id,
        skillProfile: p.skillProfile,
      })),
      leadParticipantId: leadParticipant.participant.id,
      compatibilityScore: score,
      scoreBreakdown: breakdown,
      countries,
      isCrossCountry: countries.length > 1,
      verticalPreferences: [brief.verticalId || ""],
      skillBalance,
      assignedBriefId: brief.id,
      assignedBriefTitle: brief.title,
      assignedVerticalId: vertical.id,
      assignedVerticalName: vertical.name,
    };
  }

  /**
   * Calculate statistics including brief assignment stats
   */
  private calculateStatisticsWithBriefs(
    participants: ParticipantWithPreferences[],
    proposedTeams: ProposedTeamDto[],
    proposedBriefAssignments: ProposedBriefAssignmentDto[],
    unassignedParticipantIds: string[],
    unassignedBriefIds: string[],
    backfillStats: BackfillStatsDto,
    briefsByVertical: Map<string, Brief[]>,
  ): TeamFormationStatsDto {
    const withPrefs = participants.filter((p) => p.preference !== null);
    const crossCountryWilling = participants.filter((p) => p.crossCountryWilling);
    const sameCountryPreferred = participants.filter((p) => !p.crossCountryWilling);

    const totalMembers = proposedTeams.reduce((sum, t) => sum + t.participantIds.length, 0);
    const avgTeamSize = proposedTeams.length > 0 ? totalMembers / proposedTeams.length : 0;

    const totalScore = proposedTeams.reduce((sum, t) => sum + t.compatibilityScore, 0);
    const avgScore = proposedTeams.length > 0 ? totalScore / proposedTeams.length : 0;

    const crossCountryTeams = proposedTeams.filter((t) => t.isCrossCountry);
    const sameCountryTeams = proposedTeams.filter((t) => !t.isCrossCountry);

    // Country distribution
    const countryDistribution: Record<string, number> = {};
    for (const p of participants) {
      const country = p.participant.country || "Unknown";
      countryDistribution[country] = (countryDistribution[country] || 0) + 1;
    }

    // Skill balance statistics
    const skillProfiles = { technical: 0, "non-technical": 0, hybrid: 0 };
    for (const p of participants) {
      skillProfiles[p.skillProfile]++;
    }

    const techRatios = proposedTeams
      .filter((t) => t.skillBalance)
      .map((t) => t.skillBalance.techRatio);
    const avgTechRatio = techRatios.length > 0
      ? techRatios.reduce((a, b) => a + b, 0) / techRatios.length
      : 0.5;

    const wellBalancedTeams = proposedTeams.filter(
      (t) => t.skillBalance && t.skillBalance.techRatio >= 0.4 && t.skillBalance.techRatio <= 0.6,
    ).length;
    const techHeavyTeams = proposedTeams.filter(
      (t) => t.skillBalance && t.skillBalance.techRatio > 0.6,
    ).length;
    const nonTechHeavyTeams = proposedTeams.filter(
      (t) => t.skillBalance && t.skillBalance.techRatio < 0.4,
    ).length;

    // Brief assignment statistics
    const totalApprovedBriefs = Array.from(briefsByVertical.values()).flat().length;
    const briefsAssigned = proposedTeams.filter((t) => t.assignedBriefId).length + proposedBriefAssignments.length;

    const assignmentsByVertical: Record<string, number> = {};
    for (const team of proposedTeams) {
      if (team.assignedVerticalName) {
        assignmentsByVertical[team.assignedVerticalName] = (assignmentsByVertical[team.assignedVerticalName] || 0) + 1;
      }
    }
    for (const assignment of proposedBriefAssignments) {
      assignmentsByVertical[assignment.verticalName] = (assignmentsByVertical[assignment.verticalName] || 0) + 1;
    }

    return {
      totalEligibleParticipants: participants.length,
      participantsWithPreferences: withPrefs.length,
      participantsWithoutPreferences: participants.length - withPrefs.length,
      crossCountryWillingCount: crossCountryWilling.length,
      sameCountryPreferredCount: sameCountryPreferred.length,
      proposedTeamCount: proposedTeams.length,
      averageTeamSize: Math.round(avgTeamSize * 10) / 10,
      averageCompatibilityScore: Math.round(avgScore * 10) / 10,
      crossCountryTeamCount: crossCountryTeams.length,
      sameCountryTeamCount: sameCountryTeams.length,
      unassignedParticipantCount: unassignedParticipantIds.length,
      countryDistribution,
      backfillStats,
      skillBalanceStats: {
        totalTechnical: skillProfiles.technical,
        totalNonTechnical: skillProfiles["non-technical"],
        totalHybrid: skillProfiles.hybrid,
        averageTechRatio: Math.round(avgTechRatio * 100) / 100,
        wellBalancedTeamCount: wellBalancedTeams,
        techHeavyTeamCount: techHeavyTeams,
        nonTechHeavyTeamCount: nonTechHeavyTeams,
      },
      briefAssignmentStats: {
        totalApprovedBriefs,
        briefsAssigned,
        briefsWithoutTeams: unassignedBriefIds.length,
        existingTeamsAssignedBriefs: proposedBriefAssignments.length,
        assignmentsByVertical,
      },
    };
  }

  /**
   * Get the current team formation preview
   */
  async getTeamFormationPreview(cohortId: string): Promise<TeamFormationPreviewDto | null> {
    return this.formationPreviewCache.get(cohortId) || null;
  }

  /**
   * Clear the team formation preview cache
   */
  clearFormationPreviewCache(cohortId: string): void {
    this.formationPreviewCache.delete(cohortId);
  }

  /**
   * Finalize team formation and create actual teams
   */
  async finalizeTeamFormation(
    cohortId: string,
    dto: FinalizeTeamFormationDto = {},
  ): Promise<{ createdTeamCount: number; backfilledTeamCount: number; briefsAssigned: number; errors: string[] }> {
    const preview = this.formationPreviewCache.get(cohortId);
    if (!preview) {
      throw new BadRequestException(
        "No team formation preview found. Run team formation first.",
      );
    }

    const cohort = await this.cohortRepository.findOne({
      where: { id: cohortId },
    });
    if (!cohort) {
      throw new NotFoundException("Cohort not found");
    }

    const errors: string[] = [];
    let createdTeamCount = 0;
    let backfilledTeamCount = 0;
    let briefsAssigned = 0;

    // ====== STEP 1: Apply backfills to existing teams ======
    for (const backfill of preview.proposedBackfills) {
      // Skip if all participants in this backfill are excluded
      const participantsToAdd = backfill.participantIdsToAdd.filter(
        (id) => !dto.excludeParticipantIds?.includes(id),
      );

      if (participantsToAdd.length === 0) {
        continue;
      }

      try {
        await this.applyBackfillToTeam(backfill.teamId, participantsToAdd);
        backfilledTeamCount++;
        this.logger.log(
          `Backfilled team "${backfill.teamName}" with ${participantsToAdd.length} participants`,
        );
      } catch (error) {
        errors.push(`Failed to backfill team "${backfill.teamName}": ${error.message}`);
      }
    }

    // ====== STEP 2: Apply brief assignments to existing teams without briefs ======
    for (const briefAssignment of preview.proposedBriefAssignments) {
      try {
        await this.teamRepository.update(
          { id: briefAssignment.teamId },
          { briefId: briefAssignment.briefId },
        );
        briefsAssigned++;
        this.logger.log(
          `Assigned brief "${briefAssignment.briefTitle}" to existing team "${briefAssignment.teamName}"`,
        );
      } catch (error) {
        errors.push(`Failed to assign brief to team "${briefAssignment.teamName}": ${error.message}`);
      }
    }

    // ====== STEP 3: Create new teams ======
    const teamsToCreate: Array<{
      participantIds: string[];
      teamName: string;
      leadParticipantId: string;
      briefId?: string;
    }> = [];

    // Start with preview teams (excluding excluded participants)
    for (const proposedTeam of preview.proposedTeams) {
      const filteredParticipantIds = proposedTeam.participantIds.filter(
        (id) => !dto.excludeParticipantIds?.includes(id),
      );

      if (filteredParticipantIds.length >= (cohort.teamSizeMin || 3)) {
        teamsToCreate.push({
          participantIds: filteredParticipantIds,
          teamName: proposedTeam.suggestedName,
          leadParticipantId: filteredParticipantIds.includes(proposedTeam.leadParticipantId)
            ? proposedTeam.leadParticipantId
            : filteredParticipantIds[0],
          briefId: proposedTeam.assignedBriefId,
        });
      }
    }

    // Apply manual team overrides
    if (dto.manualTeams) {
      for (const manualTeam of dto.manualTeams) {
        teamsToCreate.push({
          participantIds: manualTeam.participantIds,
          teamName: manualTeam.teamName || `Team ${teamsToCreate.length + 1}`,
          leadParticipantId: manualTeam.leadParticipantId || manualTeam.participantIds[0],
        });
      }
    }

    // Create teams
    for (const teamData of teamsToCreate) {
      try {
        await this.createTeamWithMembers(
          cohortId,
          teamData.teamName,
          teamData.participantIds,
          teamData.leadParticipantId,
          teamData.briefId,
        );
        createdTeamCount++;
        if (teamData.briefId) {
          briefsAssigned++;
        }
      } catch (error) {
        errors.push(`Failed to create team "${teamData.teamName}": ${error.message}`);
      }
    }

    // Clear cache after finalization
    this.formationPreviewCache.delete(cohortId);

    return { createdTeamCount, backfilledTeamCount, briefsAssigned, errors };
  }

  /**
   * Get participant formation status for a cohort
   */
  async getParticipantFormationStatus(
    cohortId: string,
  ): Promise<ParticipantFormationStatusDto[]> {
    const participants = await this.participantRepository.find({
      where: {
        cohortId,
        status: In([ParticipantStatus.ACTIVE, ParticipantStatus.READY, ParticipantStatus.ASSIGNED]),
      },
    });

    const preferences = await this.preferenceRepository.find({
      where: { participantId: In(participants.map((p) => p.id)) },
    });
    const prefMap = new Map(preferences.map((p) => [p.participantId, p]));

    // Get team memberships
    const teamMembers = await this.teamMemberRepository.find({
      where: { participantId: In(participants.map((p) => p.id)) },
      relations: ["team"],
    });
    const memberMap = new Map(teamMembers.map((m) => [m.participantId, m]));

    return participants.map((participant) => {
      const pref = prefMap.get(participant.id);
      const membership = memberMap.get(participant.id);
      
      // Calculate skill profile
      const skills = participant.skills || [];
      const skillBreakdown = getSkillBreakdown(skills);

      return {
        participantId: participant.id,
        participantDisplayId: participant.participantId,
        fullName: `${participant.firstName} ${participant.lastName}`,
        country: participant.country,
        hasTeam: !!membership,
        teamId: membership?.teamId || null,
        teamName: membership?.team?.name || null,
        hasPreferences: !!pref,
        crossCountryWilling: pref?.crossCountryWilling ?? true,
        skillCount: skills.length,
        interestCount: participant.interests?.length || 0,
        verticalPreferenceCount: (pref?.verticalId1 ? 1 : 0) + (pref?.verticalId2 ? 1 : 0),
        skillProfile: skillBreakdown.profile as SkillProfile,
        techSkillCount: skillBreakdown.techCount,
        nonTechSkillCount: skillBreakdown.nonTechCount,
      };
    });
  }

  // ============ Private Methods ============

  private normalizeConfig(
    config: TeamFormationConfigDto | undefined,
    cohort: Cohort,
  ): Required<TeamFormationConfigDto> {
    return {
      skillWeight: config?.skillWeight ?? 0.25,
      interestWeight: config?.interestWeight ?? 0.15,
      verticalWeight: config?.verticalWeight ?? 0.25,
      countryWeight: config?.countryWeight ?? 0.1,
      prioritizeSkillDiversity: config?.prioritizeSkillDiversity ?? true,
      targetTechRatio: config?.targetTechRatio ?? 0.5,
      techBalanceWeight: config?.techBalanceWeight ?? 0.25,
      leadSelectionStrategy: config?.leadSelectionStrategy ?? LeadSelectionStrategy.MOST_PREFERENCES,
      teamSizeMin: config?.teamSizeMin ?? cohort.teamSizeMin ?? 3,
      teamSizeMax: config?.teamSizeMax ?? cohort.teamSizeMax ?? 5,
      forceCrossCountry: config?.forceCrossCountry ?? false,
      useBriefCentricAssignment: config?.useBriefCentricAssignment ?? true,
    };
  }

  private async getEligibleParticipants(
    cohortId: string,
    participantIds?: string[],
  ): Promise<Participant[]> {
    // Find participants who are NOT in any team
    const participantsInTeams = await this.teamMemberRepository
      .createQueryBuilder("tm")
      .select("tm.participant_id")
      .innerJoin("tm.team", "t")
      .where("t.cohort_id = :cohortId", { cohortId })
      .getRawMany();

    const inTeamIds = new Set(participantsInTeams.map((r) => r.tm_participant_id));

    let query = this.participantRepository
      .createQueryBuilder("p")
      .where("p.cohort_id = :cohortId", { cohortId })
      .andWhere("p.status IN (:...statuses)", {
        statuses: [ParticipantStatus.ACTIVE, ParticipantStatus.READY, ParticipantStatus.ONBOARDING],
      });

    if (participantIds?.length) {
      query = query.andWhere("p.id IN (:...participantIds)", { participantIds });
    }

    const allParticipants = await query.getMany();

    // Filter out those already in teams
    return allParticipants.filter((p) => !inTeamIds.has(p.id));
  }

  private async prepareParticipantsWithPreferences(
    participants: Participant[],
  ): Promise<ParticipantWithPreferences[]> {
    const preferences = await this.preferenceRepository.find({
      where: { participantId: In(participants.map((p) => p.id)) },
    });
    const prefMap = new Map(preferences.map((p) => [p.participantId, p]));

    return participants.map((participant) => {
      const pref = prefMap.get(participant.id);
      const verticalPreferences: string[] = [];
      if (pref?.verticalId1) verticalPreferences.push(pref.verticalId1);
      if (pref?.verticalId2) verticalPreferences.push(pref.verticalId2);

      // Calculate skill profile using shared utility
      const skills = participant.skills || [];
      const skillBreakdown = getSkillBreakdown(skills);

      return {
        participant,
        preference: pref || null,
        skills,
        interests: participant.interests || [],
        verticalPreferences,
        crossCountryWilling: pref?.crossCountryWilling ?? true, // Default to true if no preference
        skillProfile: skillBreakdown.profile as SkillProfile,
        techSkillCount: skillBreakdown.techCount,
        nonTechSkillCount: skillBreakdown.nonTechCount,
      };
    });
  }

  /**
   * Core team formation algorithm
   */
  private executeTeamFormation(
    crossCountryWilling: ParticipantWithPreferences[],
    sameCountryPreferred: ParticipantWithPreferences[],
    config: Required<TeamFormationConfigDto>,
    cohort: Cohort,
  ): { proposedTeams: ProposedTeamDto[]; unassignedParticipantIds: string[] } {
    const proposedTeams: ProposedTeamDto[] = [];
    const assigned = new Set<string>();
    let teamCounter = 1;

    // Phase 1: Form same-country teams from participants who prefer same country
    const countryGroups = this.groupByCountry(sameCountryPreferred);

    for (const [country, participants] of countryGroups) {
      const teams = this.formTeamsFromGroup(
        participants,
        config,
        assigned,
        `Team ${country}`,
        teamCounter,
      );

      for (const team of teams) {
        proposedTeams.push(team);
        teamCounter++;
      }
    }

    // Phase 2: Form cross-country teams from participants willing to work cross-country
    // Also include leftover same-country-preferred participants if forceCrossCountry is true
    let crossCountryPool = [...crossCountryWilling.filter((p) => !assigned.has(p.participant.id))];

    if (config.forceCrossCountry) {
      const leftoverSameCountry = sameCountryPreferred.filter(
        (p) => !assigned.has(p.participant.id),
      );
      crossCountryPool = [...crossCountryPool, ...leftoverSameCountry];
    }

    if (crossCountryPool.length >= config.teamSizeMin) {
      const crossCountryTeams = this.formTeamsFromGroup(
        crossCountryPool,
        config,
        assigned,
        "Cross-Country Team",
        teamCounter,
      );

      for (const team of crossCountryTeams) {
        proposedTeams.push(team);
        teamCounter++;
      }
    }

    // Phase 3: Try to form teams from any remaining unassigned participants
    const allParticipants = [...sameCountryPreferred, ...crossCountryWilling];
    const remaining = allParticipants.filter((p) => !assigned.has(p.participant.id));

    if (remaining.length >= config.teamSizeMin) {
      const remainingTeams = this.formTeamsFromGroup(
        remaining,
        config,
        assigned,
        "Mixed Team",
        teamCounter,
      );

      for (const team of remainingTeams) {
        proposedTeams.push(team);
        teamCounter++;
      }
    }

    // Collect unassigned participants
    const unassignedParticipantIds = allParticipants
      .filter((p) => !assigned.has(p.participant.id))
      .map((p) => p.participant.id);

    return { proposedTeams, unassignedParticipantIds };
  }

  private groupByCountry(
    participants: ParticipantWithPreferences[],
  ): Map<string, ParticipantWithPreferences[]> {
    const groups = new Map<string, ParticipantWithPreferences[]>();

    for (const p of participants) {
      const country = p.participant.country || "Unknown";
      if (!groups.has(country)) {
        groups.set(country, []);
      }
      groups.get(country)!.push(p);
    }

    return groups;
  }

  /**
   * Form teams from a group of participants using greedy matching
   */
  private formTeamsFromGroup(
    participants: ParticipantWithPreferences[],
    config: Required<TeamFormationConfigDto>,
    assigned: Set<string>,
    teamNamePrefix: string,
    startingCounter: number,
  ): ProposedTeamDto[] {
    const teams: ProposedTeamDto[] = [];
    const available = participants.filter((p) => !assigned.has(p.participant.id));
    let counter = startingCounter;

    while (available.length >= config.teamSizeMin) {
      // Find the best team we can form with skill balance consideration
      const team = this.formBestTeamWithBalance(available, config);

      if (team.length < config.teamSizeMin) {
        break; // Can't form a valid team
      }

      // Mark as assigned
      for (const p of team) {
        assigned.add(p.participant.id);
        const idx = available.findIndex((a) => a.participant.id === p.participant.id);
        if (idx >= 0) available.splice(idx, 1);
      }

      // Calculate compatibility and select lead
      const { score, breakdown, skillBalance } = this.calculateTeamCompatibility(team, config);
      const leadParticipant = this.selectTeamLead(team, config.leadSelectionStrategy);
      const countries = [...new Set(team.map((p) => p.participant.country))];

      const proposedTeam: ProposedTeamDto = {
        proposedTeamId: uuidv4(),
        suggestedName: `${teamNamePrefix} ${counter}`,
        participantIds: team.map((p) => p.participant.id),
        participants: team.map((p) => ({
          id: p.participant.id,
          participantId: p.participant.participantId,
          firstName: p.participant.firstName,
          lastName: p.participant.lastName,
          country: p.participant.country,
          skills: p.skills,
          interests: p.interests,
          isProposedLead: p.participant.id === leadParticipant.participant.id,
          skillProfile: p.skillProfile,
        })),
        leadParticipantId: leadParticipant.participant.id,
        compatibilityScore: score,
        scoreBreakdown: breakdown,
        countries,
        isCrossCountry: countries.length > 1,
        verticalPreferences: [
          ...new Set(team.flatMap((p) => p.verticalPreferences)),
        ],
        skillBalance,
      };

      teams.push(proposedTeam);
      counter++;
    }

    return teams;
  }

  /**
   * Form the best possible team from available participants with tech/non-tech balance
   */
  private formBestTeamWithBalance(
    available: ParticipantWithPreferences[],
    config: Required<TeamFormationConfigDto>,
  ): ParticipantWithPreferences[] {
    if (available.length < config.teamSizeMin) {
      return [];
    }

    const targetSize = Math.min(config.teamSizeMax, available.length);
    const team: ParticipantWithPreferences[] = [];

    // Separate participants by skill profile for balanced selection
    const techParticipants = available.filter((p) => p.skillProfile === "technical");
    const nonTechParticipants = available.filter((p) => p.skillProfile === "non-technical");
    const hybridParticipants = available.filter((p) => p.skillProfile === "hybrid");

    // Sort each group by engagement score
    const sortByEngagement = (a: ParticipantWithPreferences, b: ParticipantWithPreferences) => 
      this.getParticipantEngagementScore(b) - this.getParticipantEngagementScore(a);
    
    techParticipants.sort(sortByEngagement);
    nonTechParticipants.sort(sortByEngagement);
    hybridParticipants.sort(sortByEngagement);

    // Calculate how many of each type we need for target ratio
    const targetTechCount = Math.round(targetSize * config.targetTechRatio);
    const targetNonTechCount = targetSize - targetTechCount;

    // Start building team with balanced selection
    let techAdded = 0;
    let nonTechAdded = 0;
    const usedIds = new Set<string>();

    // Add tech participants
    for (const p of techParticipants) {
      if (techAdded >= targetTechCount) break;
      if (!usedIds.has(p.participant.id)) {
        team.push(p);
        usedIds.add(p.participant.id);
        techAdded++;
      }
    }

    // Add non-tech participants
    for (const p of nonTechParticipants) {
      if (nonTechAdded >= targetNonTechCount) break;
      if (!usedIds.has(p.participant.id)) {
        team.push(p);
        usedIds.add(p.participant.id);
        nonTechAdded++;
      }
    }

    // Fill remaining slots with hybrid or whatever's available
    const remaining = [...hybridParticipants, ...techParticipants, ...nonTechParticipants]
      .filter((p) => !usedIds.has(p.participant.id));
    
    for (const p of remaining) {
      if (team.length >= targetSize) break;
      team.push(p);
      usedIds.add(p.participant.id);
    }

    // If we still don't have enough, use greedy approach for remaining
    if (team.length < config.teamSizeMin) {
      const allAvailable = available.filter((p) => !usedIds.has(p.participant.id));
      for (const p of allAvailable.sort(sortByEngagement)) {
        if (team.length >= config.teamSizeMin) break;
        team.push(p);
      }
    }

    return team;
  }

  /**
   * Form the best possible team from available participants (legacy greedy approach)
   */
  private formBestTeam(
    available: ParticipantWithPreferences[],
    config: Required<TeamFormationConfigDto>,
  ): ParticipantWithPreferences[] {
    if (available.length < config.teamSizeMin) {
      return [];
    }

    const targetSize = Math.min(config.teamSizeMax, available.length);
    const team: ParticipantWithPreferences[] = [];

    // Start with the participant who has the most preferences set (most engaged)
    const sorted = [...available].sort((a, b) => {
      const aScore = this.getParticipantEngagementScore(a);
      const bScore = this.getParticipantEngagementScore(b);
      return bScore - aScore;
    });

    team.push(sorted[0]);

    // Greedily add participants who maximize team compatibility
    while (team.length < targetSize && sorted.length > team.length) {
      let bestCandidate: ParticipantWithPreferences | null = null;
      let bestScore = -1;

      for (const candidate of sorted) {
        if (team.some((t) => t.participant.id === candidate.participant.id)) {
          continue;
        }

        const testTeam = [...team, candidate];
        const { score } = this.calculateTeamCompatibility(testTeam, config);

        if (score > bestScore) {
          bestScore = score;
          bestCandidate = candidate;
        }
      }

      if (bestCandidate) {
        team.push(bestCandidate);
      } else {
        break;
      }
    }

    return team;
  }

  private getParticipantEngagementScore(p: ParticipantWithPreferences): number {
    let score = 0;
    if (p.preference) score += 10;
    if (p.preference?.briefRankings?.length) score += p.preference.briefRankings.length * 2;
    if (p.verticalPreferences.length) score += p.verticalPreferences.length * 3;
    if (p.skills.length) score += p.skills.length;
    if (p.interests.length) score += p.interests.length;
    return score;
  }

  /**
   * Calculate team compatibility score including tech/non-tech balance
   */
  private calculateTeamCompatibility(
    team: ParticipantWithPreferences[],
    config: Required<TeamFormationConfigDto>,
  ): { score: number; breakdown: CompatibilityScore; skillBalance: TeamSkillBalance } {
    if (team.length < 2) {
      const defaultBalance: TeamSkillBalance = {
        techCount: team.filter((p) => p.skillProfile === "technical" || p.skillProfile === "hybrid").length,
        nonTechCount: team.filter((p) => p.skillProfile === "non-technical" || p.skillProfile === "hybrid").length,
        techRatio: 0.5,
        profiles: { technical: 0, "non-technical": 0, hybrid: 0 },
      };
      team.forEach((p) => defaultBalance.profiles[p.skillProfile]++);
      
      return {
        score: 100,
        breakdown: { total: 100, skillScore: 20, interestScore: 20, verticalScore: 20, countryScore: 20, techBalanceScore: 20 },
        skillBalance: defaultBalance,
      };
    }

    // Calculate skill balance
    const skillBalance = this.calculateTeamSkillBalance(team);

    // Skill compatibility - diversity is good (more unique skills = higher score)
    const allSkills = team.flatMap((p) => p.skills);
    const uniqueSkills = new Set(allSkills);
    const skillDiversity = uniqueSkills.size / Math.max(allSkills.length, 1);
    const skillScore = config.prioritizeSkillDiversity
      ? skillDiversity * 100 * config.skillWeight
      : (1 - skillDiversity) * 100 * config.skillWeight; // Similarity mode

    // Interest compatibility - some overlap is good
    const interestCounts = new Map<string, number>();
    for (const p of team) {
      for (const interest of p.interests) {
        interestCounts.set(interest, (interestCounts.get(interest) || 0) + 1);
      }
    }
    const sharedInterests = Array.from(interestCounts.values()).filter((c) => c > 1).length;
    const interestScore = Math.min(sharedInterests / team.length, 1) * 100 * config.interestWeight;

    // Vertical preference alignment - all same vertical is best
    const verticalCounts = new Map<string, number>();
    for (const p of team) {
      for (const v of p.verticalPreferences) {
        verticalCounts.set(v, (verticalCounts.get(v) || 0) + 1);
      }
    }
    const maxVerticalAlignment = Math.max(...Array.from(verticalCounts.values()), 0);
    const verticalScore = (maxVerticalAlignment / team.length) * 100 * config.verticalWeight;

    // Country score - same country gets bonus if applicable
    const countries = new Set(team.map((p) => p.participant.country));
    const countryScore = countries.size === 1 ? 100 * config.countryWeight : 50 * config.countryWeight;

    // Tech balance score - closer to target ratio = higher score
    const techBalanceDeviation = Math.abs(skillBalance.techRatio - config.targetTechRatio);
    // Perfect balance (0 deviation) = 100, worst case (1.0 deviation) = 0
    const techBalanceScore = (1 - techBalanceDeviation * 2) * 100 * config.techBalanceWeight;

    const total = Math.round(
      Math.max(0, skillScore + interestScore + verticalScore + countryScore + techBalanceScore)
    );

    return {
      score: total,
      breakdown: {
        total,
        skillScore: Math.round(skillScore),
        interestScore: Math.round(interestScore),
        verticalScore: Math.round(verticalScore),
        countryScore: Math.round(countryScore),
        techBalanceScore: Math.round(Math.max(0, techBalanceScore)),
      },
      skillBalance,
    };
  }

  /**
   * Calculate tech/non-tech skill balance for a team
   */
  private calculateTeamSkillBalance(team: ParticipantWithPreferences[]): TeamSkillBalance {
    const profiles: Record<SkillProfile, number> = {
      technical: 0,
      "non-technical": 0,
      hybrid: 0,
    };

    let techCount = 0;
    let nonTechCount = 0;

    for (const p of team) {
      profiles[p.skillProfile]++;
      // For ratio calculation, count hybrid as 0.5 tech and 0.5 non-tech
      if (p.skillProfile === "technical") {
        techCount += 1;
      } else if (p.skillProfile === "non-technical") {
        nonTechCount += 1;
      } else {
        // hybrid
        techCount += 0.5;
        nonTechCount += 0.5;
      }
    }

    const total = techCount + nonTechCount;
    const techRatio = total > 0 ? techCount / total : 0.5;

    return {
      techCount: Math.round(techCount),
      nonTechCount: Math.round(nonTechCount),
      techRatio: Math.round(techRatio * 100) / 100,
      profiles,
    };
  }

  /**
   * Calculate skill profile breakdown for an existing team's members
   */
  private calculateExistingTeamSkillProfile(teamInfo: ExistingTeamInfo): { tech: number; nonTech: number; hybrid: number } {
    const result = { tech: 0, nonTech: 0, hybrid: 0 };

    for (const participant of teamInfo.memberParticipants) {
      const skills = participant.skills || [];
      const breakdown = getSkillBreakdown(skills);
      
      if (breakdown.profile === "technical") {
        result.tech++;
      } else if (breakdown.profile === "non-technical") {
        result.nonTech++;
      } else {
        result.hybrid++;
      }
    }

    return result;
  }

  /**
   * Select team lead based on strategy
   */
  private selectTeamLead(
    team: ParticipantWithPreferences[],
    strategy: LeadSelectionStrategy,
  ): ParticipantWithPreferences {
    switch (strategy) {
      case LeadSelectionStrategy.RANDOM:
        return team[Math.floor(Math.random() * team.length)];

      case LeadSelectionStrategy.MOST_PREFERENCES:
        return [...team].sort((a, b) => {
          const aScore = this.getParticipantEngagementScore(a);
          const bScore = this.getParticipantEngagementScore(b);
          return bScore - aScore;
        })[0];

      case LeadSelectionStrategy.MOST_SKILLS:
        return [...team].sort((a, b) => b.skills.length - a.skills.length)[0];

      case LeadSelectionStrategy.FIRST_REGISTERED:
        return [...team].sort((a, b) => {
          const aDate = a.participant.createdAt?.getTime() || 0;
          const bDate = b.participant.createdAt?.getTime() || 0;
          return aDate - bDate;
        })[0];

      default:
        return team[0];
    }
  }

  private calculateStatistics(
    participants: ParticipantWithPreferences[],
    proposedTeams: ProposedTeamDto[],
    unassignedParticipantIds: string[],
    backfillStats: BackfillStatsDto,
  ): TeamFormationStatsDto {
    const withPrefs = participants.filter((p) => p.preference !== null);
    const crossCountryWilling = participants.filter((p) => p.crossCountryWilling);
    const sameCountryPreferred = participants.filter((p) => !p.crossCountryWilling);

    const totalMembers = proposedTeams.reduce((sum, t) => sum + t.participantIds.length, 0);
    const avgTeamSize = proposedTeams.length > 0 ? totalMembers / proposedTeams.length : 0;

    const totalScore = proposedTeams.reduce((sum, t) => sum + t.compatibilityScore, 0);
    const avgScore = proposedTeams.length > 0 ? totalScore / proposedTeams.length : 0;

    const crossCountryTeams = proposedTeams.filter((t) => t.isCrossCountry);
    const sameCountryTeams = proposedTeams.filter((t) => !t.isCrossCountry);

    // Country distribution
    const countryDistribution: Record<string, number> = {};
    for (const p of participants) {
      const country = p.participant.country || "Unknown";
      countryDistribution[country] = (countryDistribution[country] || 0) + 1;
    }

    // Skill balance statistics (for legacy mode)
    const skillProfiles = { technical: 0, "non-technical": 0, hybrid: 0 };
    for (const p of participants) {
      skillProfiles[p.skillProfile]++;
    }

    const techRatios = proposedTeams
      .filter((t) => t.skillBalance)
      .map((t) => t.skillBalance.techRatio);
    const avgTechRatio = techRatios.length > 0
      ? techRatios.reduce((a, b) => a + b, 0) / techRatios.length
      : 0.5;

    const wellBalancedTeams = proposedTeams.filter(
      (t) => t.skillBalance && t.skillBalance.techRatio >= 0.4 && t.skillBalance.techRatio <= 0.6,
    ).length;
    const techHeavyTeams = proposedTeams.filter(
      (t) => t.skillBalance && t.skillBalance.techRatio > 0.6,
    ).length;
    const nonTechHeavyTeams = proposedTeams.filter(
      (t) => t.skillBalance && t.skillBalance.techRatio < 0.4,
    ).length;

    return {
      totalEligibleParticipants: participants.length,
      participantsWithPreferences: withPrefs.length,
      participantsWithoutPreferences: participants.length - withPrefs.length,
      crossCountryWillingCount: crossCountryWilling.length,
      sameCountryPreferredCount: sameCountryPreferred.length,
      proposedTeamCount: proposedTeams.length,
      averageTeamSize: Math.round(avgTeamSize * 10) / 10,
      averageCompatibilityScore: Math.round(avgScore * 10) / 10,
      crossCountryTeamCount: crossCountryTeams.length,
      sameCountryTeamCount: sameCountryTeams.length,
      unassignedParticipantCount: unassignedParticipantIds.length,
      countryDistribution,
      backfillStats,
      skillBalanceStats: {
        totalTechnical: skillProfiles.technical,
        totalNonTechnical: skillProfiles["non-technical"],
        totalHybrid: skillProfiles.hybrid,
        averageTechRatio: Math.round(avgTechRatio * 100) / 100,
        wellBalancedTeamCount: wellBalancedTeams,
        techHeavyTeamCount: techHeavyTeams,
        nonTechHeavyTeamCount: nonTechHeavyTeams,
      },
      briefAssignmentStats: {
        totalApprovedBriefs: 0, // Not applicable in legacy mode
        briefsAssigned: 0,
        briefsWithoutTeams: 0,
        existingTeamsAssignedBriefs: 0,
        assignmentsByVertical: {},
      },
    };
  }

  /**
   * Create a team with members in the database
   */
  private async createTeamWithMembers(
    cohortId: string,
    teamName: string,
    participantIds: string[],
    leadParticipantId: string,
    briefId?: string,
  ): Promise<Team> {
    // Generate invite code
    const inviteCode = this.generateInviteCode();

    // Create team
    const teamData: Partial<Team> = {
      name: teamName,
      cohortId,
      status: TeamStatus.ACTIVE,
      inviteCode,
    };
    
    if (briefId) {
      teamData.briefId = briefId;
    }

    const team = this.teamRepository.create(teamData);
    const savedTeam = await this.teamRepository.save(team);

    // Create team members
    const members: TeamMember[] = [];
    for (const participantId of participantIds) {
      const member = this.teamMemberRepository.create({
        teamId: savedTeam.id,
        participantId,
        role: participantId === leadParticipantId ? TeamRole.LEAD : TeamRole.MEMBER,
      });
      members.push(member);
    }

    await this.teamMemberRepository.save(members);

    // Update participant status to ASSIGNED
    await this.participantRepository.update(
      { id: In(participantIds) },
      { status: ParticipantStatus.ASSIGNED },
    );

    return savedTeam;
  }

  // ============ BACKFILL METHODS ============

  /**
   * Execute the backfill phase - fill existing undersized teams
   */
  private async executeBackfillPhase(
    cohortId: string,
    availableParticipants: ParticipantWithPreferences[],
    config: Required<TeamFormationConfigDto>,
  ): Promise<{
    proposedBackfills: ProposedBackfillDto[];
    backfilledParticipantIds: Set<string>;
    backfillStats: BackfillStatsDto;
  }> {
    const proposedBackfills: ProposedBackfillDto[] = [];
    const backfilledParticipantIds = new Set<string>();

    // Get existing undersized teams
    const undersizedTeams = await this.getUndersizedTeams(cohortId, config.teamSizeMax);

    if (undersizedTeams.length === 0) {
      return {
        proposedBackfills: [],
        backfilledParticipantIds,
        backfillStats: {
          undersizedTeamCount: 0,
          teamsToBackfillCount: 0,
          participantsToBackfillCount: 0,
          averageBackfillCompatibility: 0,
          teamsStillUndersizedCount: 0,
          pendingMemberCount: 0,
        },
      };
    }

    this.logger.log(`Found ${undersizedTeams.length} undersized teams to potentially backfill`);

    // Sort teams by how much they need (fewer members = higher priority)
    const sortedTeams = undersizedTeams.sort(
      (a, b) => a.currentSize - b.currentSize,
    );

    // Create a mutable pool of available participants
    const participantPool = [...availableParticipants];
    let teamsStillUndersized = 0;
    const compatibilityScores: number[] = [];

    for (const teamInfo of sortedTeams) {
      const slotsAvailable = config.teamSizeMax - teamInfo.currentSize;
      if (slotsAvailable <= 0) continue;

      // Find compatible participants for this team
      const compatibleParticipants = this.findCompatibleParticipantsForTeam(
        teamInfo,
        participantPool,
        config,
      );

      // Take up to slotsAvailable participants
      const participantsToAdd = compatibleParticipants.slice(0, slotsAvailable);

      if (participantsToAdd.length > 0) {
        // Calculate compatibility score for the proposed additions
        const { score } = this.calculateBackfillCompatibility(
          teamInfo,
          participantsToAdd,
          config,
        );
        compatibilityScores.push(score);

        // Check if backfill introduces cross-country
        const existingCountries = new Set(teamInfo.countries);
        const newCountries = participantsToAdd.map((p) => p.participant.country);
        const introducesCrossCountry = newCountries.some(
          (c) => !existingCountries.has(c),
        );

        // Calculate skill balance after adding new members
        const existingSkillProfiles = this.calculateExistingTeamSkillProfile(teamInfo);
        const newMemberProfiles = participantsToAdd.reduce(
          (acc, p) => {
            if (p.skillProfile === "technical") acc.tech++;
            else if (p.skillProfile === "non-technical") acc.nonTech++;
            else acc.hybrid++;
            return acc;
          },
          { tech: 0, nonTech: 0, hybrid: 0 },
        );
        
        const totalTech = existingSkillProfiles.tech + newMemberProfiles.tech + (existingSkillProfiles.hybrid + newMemberProfiles.hybrid) * 0.5;
        const totalNonTech = existingSkillProfiles.nonTech + newMemberProfiles.nonTech + (existingSkillProfiles.hybrid + newMemberProfiles.hybrid) * 0.5;
        const totalMembers = totalTech + totalNonTech;
        const techRatioAfter = totalMembers > 0 ? totalTech / totalMembers : 0.5;

        const backfill: ProposedBackfillDto = {
          teamId: teamInfo.team.id,
          teamName: teamInfo.team.name,
          currentMemberCount: teamInfo.currentSize,
          targetSize: config.teamSizeMax,
          participantIdsToAdd: participantsToAdd.map((p) => p.participant.id),
          participantsToAdd: participantsToAdd.map((p) => ({
            id: p.participant.id,
            participantId: p.participant.participantId,
            firstName: p.participant.firstName,
            lastName: p.participant.lastName,
            country: p.participant.country,
            skills: p.skills,
            interests: p.interests,
            skillProfile: p.skillProfile,
          })),
          compatibilityScore: score,
          briefId: teamInfo.briefId,
          verticalPreferences: teamInfo.verticalPreferences,
          existingCountries: teamInfo.countries,
          introducesCrossCountry,
          addAsPending: true, // Backfill members need team lead approval
          skillBalanceAfter: {
            techCount: Math.round(totalTech),
            nonTechCount: Math.round(totalNonTech),
            techRatio: Math.round(techRatioAfter * 100) / 100,
          },
        };

        proposedBackfills.push(backfill);

        // Mark these participants as backfilled and remove from pool
        for (const p of participantsToAdd) {
          backfilledParticipantIds.add(p.participant.id);
          const idx = participantPool.findIndex(
            (pp) => pp.participant.id === p.participant.id,
          );
          if (idx >= 0) participantPool.splice(idx, 1);
        }

        // Check if team will still be undersized after backfill
        if (teamInfo.currentSize + participantsToAdd.length < config.teamSizeMax) {
          teamsStillUndersized++;
        }
      } else {
        // No compatible participants found - team remains undersized
        teamsStillUndersized++;
      }
    }

    const avgCompatibility =
      compatibilityScores.length > 0
        ? Math.round(
            (compatibilityScores.reduce((a, b) => a + b, 0) /
              compatibilityScores.length) *
              10,
          ) / 10
        : 0;

    return {
      proposedBackfills,
      backfilledParticipantIds,
      backfillStats: {
        undersizedTeamCount: undersizedTeams.length,
        teamsToBackfillCount: proposedBackfills.length,
        participantsToBackfillCount: backfilledParticipantIds.size,
        averageBackfillCompatibility: avgCompatibility,
        teamsStillUndersizedCount: teamsStillUndersized,
        pendingMemberCount: backfilledParticipantIds.size, // All backfills are added as PENDING
      },
    };
  }

  /**
   * Get all existing teams in the cohort that are below max size
   */
  private async getUndersizedTeams(
    cohortId: string,
    maxSize: number,
  ): Promise<ExistingTeamInfo[]> {
    const teams = await this.teamRepository.find({
      where: {
        cohortId,
        status: In([TeamStatus.ACTIVE, TeamStatus.FORMING]),
      },
      relations: ["members", "members.participant"],
    });

    const result: ExistingTeamInfo[] = [];

    for (const team of teams) {
      // Only count CONFIRMED members (not PENDING) for sizing calculations
      const activeMembers = team.members?.filter(
        (m) => m.status === TeamMemberStatus.CONFIRMED && 
               m.participant?.status !== ParticipantStatus.INACTIVE,
      ) || [];

      if (activeMembers.length < maxSize) {
        const memberParticipants = activeMembers
          .map((m) => m.participant)
          .filter((p) => p != null);

        // Get member preferences
        const memberPreferences = await this.preferenceRepository.find({
          where: { participantId: In(memberParticipants.map((p) => p.id)) },
        });

        // Collect vertical preferences from team members
        const verticalPrefs: string[] = [];
        for (const pref of memberPreferences) {
          if (pref.verticalId1) verticalPrefs.push(pref.verticalId1);
          if (pref.verticalId2) verticalPrefs.push(pref.verticalId2);
        }

        // Collect countries from team members
        const countries = [
          ...new Set(memberParticipants.map((p) => p.country).filter(Boolean)),
        ];

        result.push({
          team,
          members: activeMembers,
          memberParticipants,
          memberPreferences,
          currentSize: activeMembers.length,
          briefId: team.briefId || null,
          verticalPreferences: [...new Set(verticalPrefs)],
          countries,
        });
      }
    }

    return result;
  }

  /**
   * Find participants compatible with an existing team
   * Prioritizes: same brief preference > same vertical > same country > skill diversity
   */
  private findCompatibleParticipantsForTeam(
    teamInfo: ExistingTeamInfo,
    availableParticipants: ParticipantWithPreferences[],
    config: Required<TeamFormationConfigDto>,
  ): ParticipantWithPreferences[] {
    // Score each available participant for compatibility with this team
    const scoredParticipants: Array<{
      participant: ParticipantWithPreferences;
      score: number;
    }> = [];

    // Get existing team skills for diversity calculation
    const existingSkills = new Set(
      teamInfo.memberParticipants.flatMap((p) => p.skills || []),
    );

    for (const p of availableParticipants) {
      let score = 0;

      // 1. Brief preference match (highest priority)
      if (teamInfo.briefId && p.preference?.briefRankings?.length) {
        const briefRank = p.preference.briefRankings.indexOf(teamInfo.briefId);
        if (briefRank === 0) {
          score += 50; // First choice
        } else if (briefRank === 1) {
          score += 40; // Second choice
        } else if (briefRank === 2) {
          score += 30; // Third choice
        } else if (briefRank >= 0) {
          score += 20; // Any match
        }
      }

      // 2. Vertical preference alignment
      const verticalMatch = p.verticalPreferences.some((v) =>
        teamInfo.verticalPreferences.includes(v),
      );
      if (verticalMatch) {
        score += 25 * config.verticalWeight;
      }

      // 3. Country preference
      const sameCountry = teamInfo.countries.includes(p.participant.country);
      if (sameCountry) {
        // Same country gets bonus
        score += 20 * config.countryWeight;
      } else if (p.crossCountryWilling) {
        // Cross-country willing gets partial bonus
        score += 10 * config.countryWeight;
      } else {
        // Not willing to cross country, and different country - penalty
        score -= 10;
      }

      // 4. Skill diversity (new skills are good)
      const newSkills = p.skills.filter((s) => !existingSkills.has(s));
      if (config.prioritizeSkillDiversity) {
        score += (newSkills.length / Math.max(p.skills.length, 1)) * 15 * config.skillWeight;
      }

      // 5. Interest overlap (some shared interests are good)
      const existingInterests = new Set(
        teamInfo.memberParticipants.flatMap((m) => m.interests || []),
      );
      const sharedInterests = p.interests.filter((i) => existingInterests.has(i));
      score += (sharedInterests.length / Math.max(p.interests.length, 1)) * 10 * config.interestWeight;

      scoredParticipants.push({ participant: p, score });
    }

    // Sort by score descending and return
    return scoredParticipants
      .filter((sp) => sp.score > 0) // Only positive matches
      .sort((a, b) => b.score - a.score)
      .map((sp) => sp.participant);
  }

  /**
   * Calculate compatibility score for backfill additions
   */
  private calculateBackfillCompatibility(
    teamInfo: ExistingTeamInfo,
    newParticipants: ParticipantWithPreferences[],
    config: Required<TeamFormationConfigDto>,
  ): { score: number } {
    // Combine existing members with new participants for compatibility calc
    const existingAsParticipantWithPrefs: ParticipantWithPreferences[] =
      teamInfo.memberParticipants.map((p) => {
        const pref = teamInfo.memberPreferences.find(
          (pr) => pr.participantId === p.id,
        );
        const verticalPrefs: string[] = [];
        if (pref?.verticalId1) verticalPrefs.push(pref.verticalId1);
        if (pref?.verticalId2) verticalPrefs.push(pref.verticalId2);

        // Calculate skill profile for existing member
        const skills = p.skills || [];
        const skillBreakdown = getSkillBreakdown(skills);

        return {
          participant: p,
          preference: pref || null,
          skills,
          interests: p.interests || [],
          verticalPreferences: verticalPrefs,
          crossCountryWilling: pref?.crossCountryWilling ?? true,
          skillProfile: skillBreakdown.profile as SkillProfile,
          techSkillCount: skillBreakdown.techCount,
          nonTechSkillCount: skillBreakdown.nonTechCount,
        };
      });

    const combinedTeam = [...existingAsParticipantWithPrefs, ...newParticipants];
    const { score } = this.calculateTeamCompatibility(combinedTeam, config);

    return { score };
  }

  /**
   * Apply backfill to an existing team - add new members as PENDING (requires team lead approval)
   */
  private async applyBackfillToTeam(
    teamId: string,
    participantIds: string[],
  ): Promise<void> {
    // Create team members for the new participants with PENDING status
    // Team lead will need to approve these members
    const members: TeamMember[] = [];
    for (const participantId of participantIds) {
      const member = this.teamMemberRepository.create({
        teamId,
        participantId,
        role: TeamRole.MEMBER,
        status: TeamMemberStatus.PENDING, // Requires team lead approval
      });
      members.push(member);
    }

    await this.teamMemberRepository.save(members);

    // Note: We do NOT update participant status to ASSIGNED yet
    // The status will be updated when the team lead confirms the member
    this.logger.log(
      `Added ${participantIds.length} pending member(s) to team ${teamId} awaiting approval`,
    );
  }

  private generateInviteCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
