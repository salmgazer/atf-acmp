import { resolveCohortTeamDeadlines } from "@/common/services/cohort-team-deadlines";
import { assertJoiningWindow, assertMemberAdmission, chooseCompetitionCountry, teamRuleContext } from "@/common/services/team-rules";
import { formAtfTeams, compareMatchingCandidates, matchingGuideScore } from "./atf-team-matcher";
import { canShareTeam, evaluateTeamRules, hasNonComputingStudy, isQualifiedBuilder, normalizeTeamCountry, participantTeamIssues } from "@acmp/shared";
import { resolveCohortGroup } from "@/common/services/cohort-groups";
import { Inject } from "@nestjs/common";
import { CACHE_MANAGER, Cache } from "@nestjs/cache-manager";
import { afterCommit, Transactional } from "@/common/decorators/transactional.decorator";
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, Not } from "typeorm";
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
import { OneSignalService } from "@/modules/notifications/onesignal.service";
import { EmailService } from "@/email/email.service";
import {
  getSkillBreakdown,
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

interface TeamSkillBalance {
  techCount: number;
  nonTechCount: number;
  techRatio: number;
  profiles: Record<SkillProfile, number>;
}

@Injectable()
export class TeamFormationService {
  private readonly logger = new Logger(TeamFormationService.name);

  // Cache for preview results

  constructor(
    @Inject(CACHE_MANAGER) private readonly previewStore: Cache,
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
    private readonly _verticalRepository: Repository<Vertical>,
    private readonly oneSignalService: OneSignalService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Form teams under ATF's hard admission rules and ordered matching priorities.
   * Backfills remain pending; optional brief assignments never start a challenge.
   */
  async runTeamFormation(
    cohortId: string,
    dto: RunTeamFormationDto = {},
  ): Promise<TeamFormationPreviewDto> {
    const cohort = await this.cohortRepository.findOneBy({ id: cohortId });
    if (!cohort) throw new NotFoundException("Cohort not found");
    await resolveCohortTeamDeadlines(this.teamRepository.manager, cohort);
    assertJoiningWindow(cohort);
    const config = this.normalizeConfig(dto.config, cohort);
    if (config.forceCrossCountry) throw new BadRequestException("Cross-country consent cannot be overridden");
    if (config.teamSizeMin < 3 || config.teamSizeMax > 5 || config.teamSizeMin > config.teamSizeMax) throw new BadRequestException("Teams must contain 3 to 5 members");
    const eligible = await this.getEligibleParticipants(cohortId, dto.participantIds);
    const prepared = await this.prepareParticipantsWithPreferences(eligible);
    const rows = prepared.map(p => Object.assign(p.participant, { preference: p.preference || undefined }));
    const excluded = rows.filter(p => participantTeamIssues(p, cohort).length || p.preference?.teamStatus === "full_team");
    const excludedIds = new Set(excluded.map(p => p.id));
    let available = rows.filter(p => !excludedIds.has(p.id));
    const warnings = excluded.map(p => `${p.participantId}: ${participantTeamIssues(p, cohort).map(issue => issue.message).join("; ") || "Full-team status: assemble and register the existing team manually"}`);
    const existing = await this.teamRepository.find({ where: { cohortId, status: TeamStatus.FORMING }, relations: ["cohort", "brief", "brief.organization", "members", "members.participant", "members.participant.preference"], order: { createdAt: "ASC", id: "ASC" } });
    const proposedBackfills: ProposedBackfillDto[] = [];
    for (const team of existing) {
      const confirmedRows = team.members.filter(m => m.status === TeamMemberStatus.CONFIRMED);
      const confirmed = confirmedRows.map(m => m.participant).filter(Boolean);
      if (!confirmed.length || confirmed.length !== confirmedRows.length || confirmed.some(p => participantTeamIssues(p, cohort).length)) { warnings.push(`Skipped backfill for ${team.name}: existing members need an eligibility review`); continue; }
      const slots = Math.min(config.teamSizeMax, 5) - team.members.length;
      const selected: Participant[] = [];
      for (let slot = 0; slot < slots; slot++) {
        const current = [...confirmed, ...selected];
        const candidates = available.filter(p => (p.group || null) === (team.group || null) && canShareTeam([...current, p]));
        const needsBuilder = !current.some(isQualifiedBuilder), needsNonComputing = !current.some(hasNonComputingStudy);
        const required = candidates.filter(p => (needsBuilder && isQualifiedBuilder(p)) || (needsNonComputing && hasNonComputingStudy(p)));
        const next = (required.length ? required : candidates).sort((a, b) => compareMatchingCandidates(current, a, b))[0];
        if (!next) break;
        selected.push(next); available = available.filter(p => p.id !== next.id);
      }
      if (selected.length) proposedBackfills.push({ teamId: team.id, teamName: team.name, group: team.group, currentMemberCount: confirmed.length, targetSize: Math.min(config.teamSizeMax, 5), participantsToAdd: selected.map(p => { const source = prepared.find(person => person.participant.id === p.id)!; return { id: p.id, participantId: p.participantId, firstName: p.firstName, lastName: p.lastName, country: p.country, skills: p.skills, interests: p.interests, skillProfile: source.skillProfile }; }), briefId: team.briefId || null, verticalPreferences: [], existingCountries: [...new Set(confirmed.map(p => p.country))], addAsPending: true, skillBalanceAfter: this.calculateTeamSkillBalance(prepared.filter(p => [...confirmed, ...selected].some(person => person.id === p.participant.id))), participantIdsToAdd: selected.map(p => p.id), compatibilityScore: matchingGuideScore([...confirmed, ...selected]), introducesCrossCountry: new Set([...confirmed, ...selected].map(p => normalizeTeamCountry(p.country))).size > 1 } as ProposedBackfillDto);
    }
    if (!rows.length) warnings.push("No eligible participants found for team formation");
    const formed = formAtfTeams(available, config.teamSizeMax);
    const approvedBriefs = await this.briefRepository.find({ where: { cohortId, status: BriefStatus.APPROVED }, relations: ["organization", "vertical"], order: { priorityScore: "DESC", id: "ASC" } });
    const actualCounts = await Promise.all(approvedBriefs.map(brief => this.teamRepository.countBy({ briefId: brief.id, status: Not(TeamStatus.DISQUALIFIED) })));
    const capacity = new Map(approvedBriefs.map((brief, index) => [brief.id, Math.max(0, brief.maxTeams - (actualCounts[index] || 0))]));
    const matchBrief = (members: Participant[], country?: string | null) => {
      const candidates = approvedBriefs.filter(brief => (capacity.get(brief.id) || 0) > 0 && members.some(member => normalizeTeamCountry(member.country) === normalizeTeamCountry(brief.problemCountry || brief.organization?.country)) && (!country || normalizeTeamCountry(country) === normalizeTeamCountry(brief.problemCountry || brief.organization?.country)));
      const sectorNames: Record<string, string> = { healthcare: "health", health: "health", education: "education", agriculture: "agriculture", finance: "finance", legal: "legal", logistics: "logistics", "public service": "public_service", "mining and manufacturing": "mining_manufacturing" };
      candidates.sort((a, b) => {
        const score = (brief: Brief, backup = false) => members.filter(member => { const sector = sectorNames[brief.vertical?.name?.toLowerCase() || ""]; return !!sector && (backup ? member.preference?.backupSector : member.preference?.firstChoiceSector) === sector; }).length;
        return score(b) - score(a) || score(b, true) - score(a, true) || (capacity.get(b.id) || 0) - (capacity.get(a.id) || 0) || (b.priorityScore || 0) - (a.priorityScore || 0) || a.id.localeCompare(b.id);
      });
      const brief = candidates[0]; if (brief) capacity.set(brief.id, capacity.get(brief.id)! - 1); return brief;
    };
    const proposedTeams = formed.teams.map((members, index) => {
      const people = members as Participant[];
      const preparedMembers = prepared.filter(p => people.some(person => person.id === p.participant.id));
      const { lead: leadMember, coLead: coLeadMember } = this.selectTeamLeadAndCoLead(preparedMembers, config.leadSelectionStrategy);
      const lead = leadMember.participant, coLead = coLeadMember.participant;
      const brief = config.useBriefCentricAssignment ? matchBrief(people) : undefined;
      const competitionCountry = chooseCompetitionCountry(people, brief?.problemCountry || brief?.organization?.country);
      const report = evaluateTeamRules(cohort, people, { competitionCountry, hasBrief: !!brief, problemCountry: brief?.problemCountry || brief?.organization?.country });
      const guideScore = matchingGuideScore(people);
      return { proposedTeamId: uuidv4(), suggestedName: `Team ${index + 1}`, group: lead.group || null, participantIds: people.map(p => p.id),
        participants: preparedMembers.map(p => ({ id: p.participant.id, participantId: p.participant.participantId, firstName: p.participant.firstName, lastName: p.participant.lastName, country: p.participant.country, skills: p.skills, interests: p.interests, isProposedLead: p.participant.id === lead.id, isProposedCoLead: p.participant.id === coLead.id, skillProfile: p.skillProfile })),
        leadParticipantId: lead.id, coLeadParticipantId: coLead.id, compatibilityScore: guideScore, scoreBreakdown: { skillScore: 0, interestScore: 0, verticalScore: 0, countryScore: 0, techBalanceScore: 0, total: guideScore },
        countries: report.countries, isCrossCountry: report.countries.length > 1, verticalPreferences: [...new Set(preparedMembers.flatMap(p => p.verticalPreferences))], skillBalance: this.calculateTeamSkillBalance(preparedMembers),
        assignedBriefId: brief?.id, assignedBriefTitle: brief?.title, assignedVerticalId: brief?.verticalId, competitionCountry, eligibility: report } as ProposedTeamDto;
    });
    const proposedBriefAssignments: ProposedBriefAssignmentDto[] = [];
    if (config.useBriefCentricAssignment) for (const team of existing.filter(t => !t.briefId)) {
      const members = team.members.filter(m => m.status === TeamMemberStatus.CONFIRMED).map(m => m.participant).filter(Boolean);
      if (!members.length || members.some(person => participantTeamIssues(person, cohort).length)) continue;
      const brief = matchBrief(members, team.competitionCountry);
      if (brief) proposedBriefAssignments.push({ teamId: team.id, teamName: team.name, briefId: brief.id, briefTitle: brief.title, verticalId: brief.verticalId || "", matchScore: 100, teamMemberCount: members.length, teamVerticalPreferences: [], membersWithBriefRanking: members.filter(p => p.preference?.briefRankings.includes(brief.id)).length, verticalName: brief.vertical?.name || "", compatibilityScore: 100, membersWithRanking: 0 } as ProposedBriefAssignmentDto);
    }
    const unassignedParticipantIds = [...formed.unassigned.map(p => p.id), ...excludedIds];
    const backfillStats = { undersizedTeamCount: existing.filter(t => t.members.length < 5).length, teamsToBackfillCount: proposedBackfills.length, participantsToBackfillCount: proposedBackfills.reduce((n, b) => n + b.participantIdsToAdd.length, 0), averageBackfillCompatibility: proposedBackfills.length ? 100 : 0, teamsStillUndersizedCount: 0, pendingMemberCount: 0 };
    const statistics = this.calculateStatistics(prepared.filter(p => !excludedIds.has(p.participant.id)), proposedTeams, unassignedParticipantIds, backfillStats);
    if (unassignedParticipantIds.length) warnings.push(`${unassignedParticipantIds.length} participants remain unassigned; review their eligibility, sectors and available builders/non-computing members.`);
    const assignedBriefs = [...proposedTeams.map(team => team.assignedBriefId).filter(Boolean), ...proposedBriefAssignments.map(assignment => assignment.briefId)];
    statistics.briefAssignmentStats = { totalApprovedBriefs: approvedBriefs.length, briefsAssigned: new Set(assignedBriefs).size, briefsWithoutTeams: approvedBriefs.filter(brief => (capacity.get(brief.id) || 0) > 0).length, existingTeamsAssignedBriefs: proposedBriefAssignments.length, assignmentsByVertical: Object.fromEntries([...new Set(approvedBriefs.map(brief => brief.verticalId).filter(Boolean))].map(id => [id!, assignedBriefs.filter(briefId => approvedBriefs.find(brief => brief.id === briefId)?.verticalId === id).length])) };
    const sourceVersion = (person: Participant) => JSON.stringify([person.updatedAt?.toISOString(), person.preference?.updatedAt?.toISOString()]);
    const sourceVersions = Object.fromEntries([...rows, ...existing.flatMap(team => team.members.map(member => member.participant).filter(Boolean))].map(person => [person.id, sourceVersion(person)]));
    const preview = { cohortId, cohortName: cohort.name, generatedAt: new Date(), proposedTeams, proposedBackfills, proposedBriefAssignments, unassignedParticipantIds, unassignedBriefIds: approvedBriefs.filter(brief => (capacity.get(brief.id) || 0) > 0).map(brief => brief.id), statistics, configUsed: config, warnings, policyVersion: "atf-2026-v3", deadlineVersion: cohort.teamRuleDeadlineVersion, sourceVersions, cohortVersion: cohort.updatedAt?.toISOString() };
    await this.previewStore.set("formation:" + cohortId, preview, 30 * 60 * 1000);
    return preview;
  }

  /**
   * Get the current team formation preview
   */
  async getTeamFormationPreview(cohortId: string): Promise<TeamFormationPreviewDto | null> {
    return await this.previewStore.get<TeamFormationPreviewDto>("formation:" + cohortId) || null;
  }

  /**
   * Clear the team formation preview cache
   */
  async clearFormationPreviewCache(cohortId: string): Promise<void> {
    await this.previewStore.del("formation:" + cohortId);
  }

  /**
   * Finalize team formation and create actual teams
   */
  @Transactional("formation")
  async finalizeTeamFormation(
    cohortId: string,
    dto: FinalizeTeamFormationDto = {},
  ): Promise<{ createdTeamCount: number; backfilledTeamCount: number; briefsAssigned: number; errors: string[] }> {
    const preview = await this.previewStore.get<TeamFormationPreviewDto>("formation:" + cohortId);
    if (!preview || preview.policyVersion !== "atf-2026-v3") throw new BadRequestException("Run a fresh team formation preview under the current ATF rules before finalizing");
    const cohort = await this.cohortRepository.findOneBy({ id: cohortId });
    if (!cohort) throw new NotFoundException("Cohort not found");
    await resolveCohortTeamDeadlines(this.teamRepository.manager, cohort);
    assertJoiningWindow(cohort);
    if (preview.deadlineVersion !== cohort.teamRuleDeadlineVersion) throw new BadRequestException("Cohort stage deadlines changed. Run a fresh formation preview");
    if (preview.cohortVersion && preview.cohortVersion !== cohort.updatedAt.toISOString()) throw new BadRequestException("Cohort settings changed. Run a fresh formation preview");
    const sourceIds = Object.keys(preview.sourceVersions || {});
    const currentPeople = sourceIds.length ? await this.participantRepository.find({ where: { id: In(sourceIds) }, relations: ["preference"] }) : [];
    if (currentPeople.length !== sourceIds.length || currentPeople.some(person => JSON.stringify([person.updatedAt.toISOString(), person.preference?.updatedAt?.toISOString()]) !== preview.sourceVersions?.[person.id])) throw new BadRequestException("Participant data changed. Run a fresh formation preview");
    const errors: string[] = [], newTeamParticipantIds: string[] = [], backfilledParticipantIds: string[] = [];
    let createdTeamCount = 0, backfilledTeamCount = 0, briefsAssigned = 0;
    const excluded = new Set(dto.excludeParticipantIds || []);
    const manualIds = new Set((dto.manualTeams || []).flatMap(team => team.participantIds));
    const used = new Set<string>();
    for (const backfill of preview.proposedBackfills) {
      const ids = backfill.participantIdsToAdd.filter(id => !excluded.has(id) && !manualIds.has(id));
      if (!ids.length) continue;
      if (ids.some(id => used.has(id))) throw new BadRequestException("A participant appears in more than one proposed team/backfill");
      ids.forEach(id => used.add(id));
      await this.applyBackfillToTeam(backfill.teamId, ids);
      backfilledParticipantIds.push(...ids); backfilledTeamCount++;
    }
    for (const assignment of preview.proposedBriefAssignments) {
      const { team, members } = await teamRuleContext(this.teamRepository.manager, assignment.teamId);
      const brief = await this.briefRepository.findOne({ where: { id: assignment.briefId, cohortId, status: BriefStatus.APPROVED }, relations: ["organization"] });
      if (!brief || team.cohortId !== cohortId || team.briefId) throw new BadRequestException("An existing team or brief changed since the preview; run it again");
      const country = normalizeTeamCountry(brief.problemCountry || brief.organization?.country);
      if (!country || !members.some(member => normalizeTeamCountry(member.country) === country) || (team.competitionCountry && normalizeTeamCountry(team.competitionCountry) !== country)) throw new BadRequestException("The problem country must match a country where a team member lives");
      await this.teamRepository.update(team.id, { briefId: brief.id, competitionCountry: team.competitionCountry || country, challengeStartedAt: null, status: TeamStatus.FORMING });
      briefsAssigned++;
    }
    const plans = preview.proposedTeams.map(team => ({ ids: team.participantIds.filter(id => !excluded.has(id) && !manualIds.has(id)), name: team.suggestedName, lead: team.leadParticipantId, coLead: team.coLeadParticipantId, briefId: team.assignedBriefId }));
    for (const manual of dto.manualTeams || []) {
      if ((manual.leadParticipantId && !manual.participantIds.includes(manual.leadParticipantId)) || (manual.coLeadParticipantId && (!manual.participantIds.includes(manual.coLeadParticipantId) || manual.coLeadParticipantId === manual.leadParticipantId))) throw new BadRequestException("Manual team lead and co-lead must be different members of that team");
    }
    for (const manual of dto.manualTeams || []) plans.push({ ids: manual.participantIds, name: manual.teamName || `Team ${plans.length + 1}`, lead: manual.leadParticipantId || manual.participantIds[0], coLead: manual.coLeadParticipantId || manual.participantIds.find(id => id !== manual.leadParticipantId) || manual.participantIds[1], briefId: undefined });
    for (const plan of plans) {
      if (plan.ids.length < 3) { if (plan.ids.length) errors.push(`${plan.name} was skipped: fewer than three members remain after exclusions/overrides`); continue; }
      if (plan.ids.length > 5 || new Set(plan.ids).size !== plan.ids.length || plan.ids.some(id => used.has(id) || excluded.has(id))) throw new BadRequestException("Every team needs 3 to 5 unique participants, with no participant reused or excluded");
      plan.ids.forEach(id => used.add(id));
      const lead = plan.ids.includes(plan.lead) ? plan.lead : plan.ids[0];
      const coLead = plan.ids.includes(plan.coLead) && plan.coLead !== lead ? plan.coLead : plan.ids.find(id => id !== lead)!;
      await this.createTeamWithMembers(cohortId, plan.name, plan.ids, lead, coLead, plan.briefId);
      createdTeamCount++; newTeamParticipantIds.push(...plan.ids); if (plan.briefId) briefsAssigned++;
    }
    const assignedBriefIds = new Set([...plans.map(plan => plan.briefId).filter(Boolean), ...preview.proposedBriefAssignments.map(assignment => assignment.briefId)]);
    for (const briefId of assignedBriefIds) await this.briefRepository.update(briefId!, { teamsCount: await this.teamRepository.countBy({ briefId: briefId!, status: Not(TeamStatus.DISQUALIFIED) }) });
    afterCommit(this, async () => {
      await this.previewStore.del("formation:" + cohortId);
      await this.sendTeamFormationNotifications(cohort, newTeamParticipantIds, backfilledParticipantIds, createdTeamCount, backfilledTeamCount);
    });
    return { createdTeamCount, backfilledTeamCount, briefsAssigned, errors };
  }

  /**
   * Send notifications to participants after team formation
   */
  private async sendTeamFormationNotifications(
    cohort: Cohort,
    newTeamParticipantIds: string[],
    backfilledParticipantIds: string[],
    createdTeamCount: number,
    backfilledTeamCount: number,
  ): Promise<void> {
    const allParticipantIds = [...new Set([...newTeamParticipantIds, ...backfilledParticipantIds])];
    
    if (allParticipantIds.length === 0) {
      this.logger.log("No participants to notify for team formation");
      return;
    }

    // Get participant details for emails
    const participants = await this.participantRepository.find({
      where: { id: In(allParticipantIds) },
    });

    // Get their team assignments
    const teamMembers = await this.teamMemberRepository.find({
      where: { participantId: In(allParticipantIds) },
      relations: ["team"],
    });
    const participantTeamMap = new Map(teamMembers.map(m => [m.participantId, m.team]));

    // Send push notifications
    const externalUserIds = allParticipantIds.map(id => `participant:${id}`);
    
    try {
      await this.oneSignalService.sendToExternalUserIds(externalUserIds, {
        title: "🎉 You've Been Assigned to a Team!",
        body: `Team formation is complete for ${cohort.name}. Check your team and start collaborating!`,
        data: {
          type: "team_formation_complete",
          cohortId: cohort.id,
        },
        url: "/participant/team",
      });
      this.logger.log(`Sent push notifications to ${externalUserIds.length} participants`);
    } catch (error) {
      this.logger.warn(`Failed to send team formation push notifications: ${error.message}`);
    }

    // Send emails to each participant (async, don't block)
    for (const participant of participants) {
      const team = participantTeamMap.get(participant.id);
      this.sendTeamFormationEmailAsync(participant, team, cohort.name);
    }

    this.logger.log(
      `Team formation notifications sent: ${createdTeamCount} new teams, ${backfilledTeamCount} backfilled teams, ${allParticipantIds.length} participants notified`,
    );
  }

  /**
   * Send team formation email asynchronously (non-blocking)
   */
  private sendTeamFormationEmailAsync(
    participant: Participant,
    team: Team | undefined,
    cohortName: string,
  ): void {
    const teamName = team?.name || "your new team";
    this.emailService.sendTeamFormationEmail({
      to: participant.email,
      firstName: participant.firstName,
      teamName,
      cohortName,
    }).catch((error) => {
      this.logger.warn(`Failed to send team formation email to ${participant.email}: ${error.message}`);
    });
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
        crossCountryWilling: pref?.crossCountryWilling ?? false,
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
      teamSizeMin: config?.teamSizeMin ?? Math.max(3, Math.min(5, cohort.teamSizeMin || 3)),
      teamSizeMax: config?.teamSizeMax ?? Math.min(5, Math.max(3, cohort.teamSizeMax || 5)),
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
      .andWhere("p.status = :status", {
        status: ParticipantStatus.READY,
      })
      .andWhere("p.onboarding_complete = true");

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
        crossCountryWilling: pref?.crossCountryWilling ?? false, // Default to true if no preference
        skillProfile: skillBreakdown.profile as SkillProfile,
        techSkillCount: skillBreakdown.techCount,
        nonTechSkillCount: skillBreakdown.nonTechCount,
      };
    });
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
   * Select team lead and co-lead based on strategy
   */
  private selectTeamLeadAndCoLead(
    team: ParticipantWithPreferences[],
    strategy: LeadSelectionStrategy,
  ): { lead: ParticipantWithPreferences; coLead: ParticipantWithPreferences } {
    if (team.length < 2) {
      // If only one member, they are both lead and co-lead
      return { lead: team[0], coLead: team[0] };
    }

    // Sort team by the strategy criteria
    let sorted: ParticipantWithPreferences[];

    switch (strategy) {
      case LeadSelectionStrategy.RANDOM:
        // Shuffle the array randomly
        sorted = [...team].sort(() => Math.random() - 0.5);
        break;

      case LeadSelectionStrategy.MOST_PREFERENCES:
        sorted = [...team].sort((a, b) => {
          const aScore = this.getParticipantEngagementScore(a);
          const bScore = this.getParticipantEngagementScore(b);
          return bScore - aScore;
        });
        break;

      case LeadSelectionStrategy.MOST_SKILLS:
        sorted = [...team].sort((a, b) => b.skills.length - a.skills.length);
        break;

      case LeadSelectionStrategy.FIRST_REGISTERED:
        sorted = [...team].sort((a, b) => {
          const aDate = a.participant.createdAt?.getTime() || 0;
          const bDate = b.participant.createdAt?.getTime() || 0;
          return aDate - bDate;
        });
        break;

      default:
        sorted = [...team];
    }

    // First is lead, second is co-lead
    return { lead: sorted[0], coLead: sorted[1] };
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
  @Transactional()
  private async createTeamWithMembers(
    cohortId: string,
    teamName: string,
    participantIds: string[],
    leadParticipantId: string,
    coLeadParticipantId: string,
    briefId?: string,
  ): Promise<Team> {
    const cohort = await this.cohortRepository.findOne({ where: { id: cohortId } });
    if (!cohort) throw new BadRequestException("Cohort not found");
    const participants = await this.participantRepository.find({ where: { id: In(participantIds), cohortId } });
    const lead = participants.find(participant => participant.id === leadParticipantId);
    if (!lead || participants.length !== new Set(participantIds).size) throw new BadRequestException("Every member and the team lead must belong to this cohort");
    const group = resolveCohortGroup(cohort, lead.group);
    if (participants.some(participant => (participant.group || null) !== group)) throw new BadRequestException("Every team member must belong to the team lead's group");
    await resolveCohortTeamDeadlines(this.teamRepository.manager, cohort);
    assertJoiningWindow(cohort);
    if (new Set(participantIds).size !== participantIds.length || !participantIds.includes(coLeadParticipantId) || leadParticipantId === coLeadParticipantId) throw new BadRequestException("Team members and lead/co-lead selections must be unique and valid");
    for (const p of participants) p.preference = (await this.preferenceRepository.findOneBy({ participantId: p.id })) || undefined;
    const existingMembership = await this.teamMemberRepository.countBy({ participantId: In(participantIds) });
    if (existingMembership) throw new BadRequestException("A selected participant already belongs to a team or has a pending membership");
    const brief = briefId ? await this.briefRepository.findOne({ where: { id: briefId }, relations: ["organization"] }) : null;
    if (briefId && (!brief || brief.cohortId !== cohortId || brief.status !== BriefStatus.APPROVED)) throw new BadRequestException("Choose an approved brief from this cohort");
    const competitionCountry = chooseCompetitionCountry(participants, brief?.problemCountry || brief?.organization?.country);
    const report = evaluateTeamRules(cohort, participants, { competitionCountry, hasBrief: !!briefId, problemCountry: brief?.problemCountry || brief?.organization?.country });
    if (!report.canRegister) throw new BadRequestException(report.registrationIssues.map(issue => issue.message).join("; "));
    // Generate invite code
    const inviteCode = this.generateInviteCode();

    // Create team
    const teamData: Partial<Team> = {
      name: teamName,
      cohortId,
      group,
      status: TeamStatus.FORMING,
      competitionCountry, registeredAt: new Date(),
      inviteCode,
    };
    
    if (briefId) {
      teamData.briefId = briefId;
    }

    const team = this.teamRepository.create(teamData);
    const savedTeam = await this.teamRepository.save(team);

    // Create team members with appropriate roles
    const members: TeamMember[] = [];
    for (const participantId of participantIds) {
      let role: TeamRole;
      if (participantId === leadParticipantId) {
        role = TeamRole.LEAD;
      } else if (participantId === coLeadParticipantId) {
        role = TeamRole.CO_LEAD;
      } else {
        role = TeamRole.MEMBER;
      }
      
      const member = this.teamMemberRepository.create({
        teamId: savedTeam.id,
        participantId,
        role,
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

  /**
   * Apply backfill to an existing team - add new members as PENDING (requires team lead approval)
   */
  private async applyBackfillToTeam(
    teamId: string,
    participantIds: string[],
  ): Promise<void> {
    const { team, members: confirmed } = await teamRuleContext(this.teamRepository.manager, teamId);
    const additions: Participant[] = [];
    if (team.members.length + participantIds.length > 5) throw new BadRequestException("Team backfill exceeds five members");
    for (const participantId of participantIds) {
      if (await this.teamMemberRepository.countBy({ participantId })) throw new BadRequestException("Participant already has a team membership");
      additions.push(await assertMemberAdmission(this.teamRepository.manager, teamId, participantId));
    }
    if (!canShareTeam([...confirmed, ...additions])) throw new BadRequestException("Backfill would violate group or cross-country consent rules");
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
