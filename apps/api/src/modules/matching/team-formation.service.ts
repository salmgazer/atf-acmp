import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, IsNull } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { Team, TeamMember, TeamStatus, TeamRole } from "@/database/entities/team.entity";
import { Cohort } from "@/database/entities/cohort.entity";
import {
  Participant,
  ParticipantPreference,
  ParticipantStatus,
} from "@/database/entities/participant.entity";
import {
  TeamFormationConfigDto,
  RunTeamFormationDto,
  FinalizeTeamFormationDto,
  TeamFormationPreviewDto,
  ProposedTeamDto,
  ProposedBackfillDto,
  BackfillStatsDto,
  TeamFormationStatsDto,
  ParticipantFormationStatusDto,
  LeadSelectionStrategy,
} from "./dto/team-formation.dto";

interface ParticipantWithPreferences {
  participant: Participant;
  preference: ParticipantPreference | null;
  skills: string[];
  interests: string[];
  verticalPreferences: string[];
  crossCountryWilling: boolean;
}

interface CompatibilityScore {
  total: number;
  skillScore: number;
  interestScore: number;
  verticalScore: number;
  countryScore: number;
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
  ) {}

  /**
   * Run the team formation algorithm and generate a preview
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
      proposedTeams,
      unassignedParticipantIds,
      configUsed: config,
      warnings,
    };

    // Cache the preview
    this.formationPreviewCache.set(cohortId, preview);

    return preview;
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
  ): Promise<{ createdTeamCount: number; backfilledTeamCount: number; errors: string[] }> {
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

    // ====== STEP 2: Create new teams ======
    const teamsToCreate: Array<{
      participantIds: string[];
      teamName: string;
      leadParticipantId: string;
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
        );
        createdTeamCount++;
      } catch (error) {
        errors.push(`Failed to create team "${teamData.teamName}": ${error.message}`);
      }
    }

    // Clear cache after finalization
    this.formationPreviewCache.delete(cohortId);

    return { createdTeamCount, backfilledTeamCount, errors };
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
        skillCount: participant.skills?.length || 0,
        interestCount: participant.interests?.length || 0,
        verticalPreferenceCount: (pref?.verticalId1 ? 1 : 0) + (pref?.verticalId2 ? 1 : 0),
      };
    });
  }

  // ============ Private Methods ============

  private normalizeConfig(
    config: TeamFormationConfigDto | undefined,
    cohort: Cohort,
  ): Required<TeamFormationConfigDto> {
    return {
      skillWeight: config?.skillWeight ?? 0.3,
      interestWeight: config?.interestWeight ?? 0.2,
      verticalWeight: config?.verticalWeight ?? 0.3,
      countryWeight: config?.countryWeight ?? 0.2,
      prioritizeSkillDiversity: config?.prioritizeSkillDiversity ?? true,
      leadSelectionStrategy: config?.leadSelectionStrategy ?? LeadSelectionStrategy.MOST_PREFERENCES,
      teamSizeMin: config?.teamSizeMin ?? cohort.teamSizeMin ?? 3,
      teamSizeMax: config?.teamSizeMax ?? cohort.teamSizeMax ?? 5,
      forceCrossCountry: config?.forceCrossCountry ?? false,
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

      return {
        participant,
        preference: pref || null,
        skills: participant.skills || [],
        interests: participant.interests || [],
        verticalPreferences,
        crossCountryWilling: pref?.crossCountryWilling ?? true, // Default to true if no preference
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
      // Find the best team we can form
      const team = this.formBestTeam(available, config);

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
      const { score, breakdown } = this.calculateTeamCompatibility(team, config);
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
        })),
        leadParticipantId: leadParticipant.participant.id,
        compatibilityScore: score,
        scoreBreakdown: breakdown,
        countries,
        isCrossCountry: countries.length > 1,
        verticalPreferences: [
          ...new Set(team.flatMap((p) => p.verticalPreferences)),
        ],
      };

      teams.push(proposedTeam);
      counter++;
    }

    return teams;
  }

  /**
   * Form the best possible team from available participants
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
   * Calculate team compatibility score
   */
  private calculateTeamCompatibility(
    team: ParticipantWithPreferences[],
    config: Required<TeamFormationConfigDto>,
  ): { score: number; breakdown: CompatibilityScore } {
    if (team.length < 2) {
      return {
        score: 100,
        breakdown: { total: 100, skillScore: 25, interestScore: 25, verticalScore: 25, countryScore: 25 },
      };
    }

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

    const total = Math.round(skillScore + interestScore + verticalScore + countryScore);

    return {
      score: total,
      breakdown: {
        total,
        skillScore: Math.round(skillScore),
        interestScore: Math.round(interestScore),
        verticalScore: Math.round(verticalScore),
        countryScore: Math.round(countryScore),
      },
    };
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
  ): Promise<Team> {
    // Generate invite code
    const inviteCode = this.generateInviteCode();

    // Create team
    const team = this.teamRepository.create({
      name: teamName,
      cohortId,
      status: TeamStatus.ACTIVE,
      inviteCode,
    });

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
          })),
          compatibilityScore: score,
          briefId: teamInfo.briefId,
          verticalPreferences: teamInfo.verticalPreferences,
          existingCountries: teamInfo.countries,
          introducesCrossCountry,
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
      const activeMembers = team.members?.filter(
        (m) => m.participant?.status !== ParticipantStatus.INACTIVE,
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

        return {
          participant: p,
          preference: pref || null,
          skills: p.skills || [],
          interests: p.interests || [],
          verticalPreferences: verticalPrefs,
          crossCountryWilling: pref?.crossCountryWilling ?? true,
        };
      });

    const combinedTeam = [...existingAsParticipantWithPrefs, ...newParticipants];
    const { score } = this.calculateTeamCompatibility(combinedTeam, config);

    return { score };
  }

  /**
   * Apply backfill to an existing team - add new members
   */
  private async applyBackfillToTeam(
    teamId: string,
    participantIds: string[],
  ): Promise<void> {
    // Create team members for the new participants
    const members: TeamMember[] = [];
    for (const participantId of participantIds) {
      const member = this.teamMemberRepository.create({
        teamId,
        participantId,
        role: TeamRole.MEMBER,
      });
      members.push(member);
    }

    await this.teamMemberRepository.save(members);

    // Update participant status to ASSIGNED
    await this.participantRepository.update(
      { id: In(participantIds) },
      { status: ParticipantStatus.ASSIGNED },
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
