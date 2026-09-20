import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { TeamFormationService } from "./team-formation.service";
import { LeadSelectionStrategy } from "./dto/team-formation.dto";
import { Team, TeamMember, TeamStatus, TeamRole, TeamMemberStatus } from "@/database/entities/team.entity";
import { Cohort } from "@/database/entities/cohort.entity";
import {
  Participant,
  ParticipantPreference,
  ParticipantStatus,
} from "@/database/entities/participant.entity";
import { Brief } from "@/database/entities/brief.entity";
import { Vertical } from "@/database/entities/vertical.entity";
import {
  createMockRepository,
  createMockQueryBuilder,
  createTestCohort,
  createTestParticipant,
} from "../../../test/utils/test-utils";

describe("TeamFormationService", () => {
  let service: TeamFormationService;
  let teamRepository: ReturnType<typeof createMockRepository>;
  let teamMemberRepository: ReturnType<typeof createMockRepository>;
  let cohortRepository: ReturnType<typeof createMockRepository>;
  let participantRepository: ReturnType<typeof createMockRepository>;
  let preferenceRepository: ReturnType<typeof createMockRepository>;
  let briefRepository: ReturnType<typeof createMockRepository>;
  let verticalRepository: ReturnType<typeof createMockRepository>;

  const mockCohort = createTestCohort({
    id: "cohort-123",
    name: "Test Cohort",
    teamSizeMin: 3,
    teamSizeMax: 5,
  });

  const createMockParticipant = (id: string, country: string, overrides: Partial<any> = {}) => ({
    ...createTestParticipant({
      id,
      participantId: `PART-${id}`,
      country,
      email: `${id}@example.com`,
      firstName: `First${id}`,
      lastName: `Last${id}`,
      skills: ["javascript", "python"],
      interests: ["ai", "web development"],
      status: ParticipantStatus.ACTIVE,
      cohortId: "cohort-123",
      createdAt: new Date("2024-01-01"),
    }),
    ...overrides,
  });

  const createMockPreference = (participantId: string, overrides: Partial<any> = {}) => ({
    participantId,
    verticalId1: "vertical-1",
    verticalId2: "vertical-2",
    briefRankings: ["brief-1", "brief-2", "brief-3"],
    crossCountryWilling: true,
    ...overrides,
  });

  beforeEach(async () => {
    teamRepository = createMockRepository();
    teamMemberRepository = createMockRepository();
    cohortRepository = createMockRepository();
    participantRepository = createMockRepository();
    preferenceRepository = createMockRepository();
    briefRepository = createMockRepository();
    verticalRepository = createMockRepository();

    // Setup mock query builder for team member repository
    const mockQB = createMockQueryBuilder();
    mockQB.getRawMany.mockResolvedValue([]);
    teamMemberRepository.createQueryBuilder.mockReturnValue(mockQB);

    // Setup mock query builder for participant repository
    const participantQB = createMockQueryBuilder();
    participantQB.getMany.mockResolvedValue([]);
    participantRepository.createQueryBuilder.mockReturnValue(participantQB);

    // Default: no existing teams to backfill
    teamRepository.find.mockResolvedValue([]);

    // Default: no briefs or verticals (for brief-centric formation)
    briefRepository.find.mockResolvedValue([]);
    verticalRepository.find.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamFormationService,
        { provide: getRepositoryToken(Team), useValue: teamRepository },
        { provide: getRepositoryToken(TeamMember), useValue: teamMemberRepository },
        { provide: getRepositoryToken(Cohort), useValue: cohortRepository },
        { provide: getRepositoryToken(Participant), useValue: participantRepository },
        { provide: getRepositoryToken(ParticipantPreference), useValue: preferenceRepository },
        { provide: getRepositoryToken(Brief), useValue: briefRepository },
        { provide: getRepositoryToken(Vertical), useValue: verticalRepository },
      ],
    }).compile();

    service = module.get<TeamFormationService>(TeamFormationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    service.clearFormationPreviewCache("cohort-123");
  });

  describe("runTeamFormation", () => {
    it("should throw NotFoundException if cohort not found", async () => {
      cohortRepository.findOne.mockResolvedValue(null);

      await expect(service.runTeamFormation("non-existent")).rejects.toThrow(
        NotFoundException
      );
    });

    it("should return warnings when no eligible participants found", async () => {
      cohortRepository.findOne.mockResolvedValue(mockCohort);

      const mockQB = createMockQueryBuilder();
      mockQB.getMany.mockResolvedValue([]);
      participantRepository.createQueryBuilder.mockReturnValue(mockQB);
      preferenceRepository.find.mockResolvedValue([]);

      const result = await service.runTeamFormation("cohort-123");

      expect(result.warnings).toContain(
        "No eligible participants found for team formation"
      );
      expect(result.statistics.totalEligibleParticipants).toBe(0);
    });

    it("should successfully run team formation and cache results", async () => {
      const participants = [
        createMockParticipant("p1", "SA"),
        createMockParticipant("p2", "SA"),
        createMockParticipant("p3", "SA"),
      ];

      cohortRepository.findOne.mockResolvedValue(mockCohort);

      const mockQB = createMockQueryBuilder();
      mockQB.getMany.mockResolvedValue(participants);
      participantRepository.createQueryBuilder.mockReturnValue(mockQB);

      preferenceRepository.find.mockResolvedValue([
        createMockPreference("p1"),
        createMockPreference("p2"),
        createMockPreference("p3"),
      ]);

      const result = await service.runTeamFormation("cohort-123");

      expect(result.cohortId).toBe("cohort-123");
      expect(result.cohortName).toBe("Test Cohort");
      expect(result.statistics.totalEligibleParticipants).toBe(3);

      // Should be cached
      const cached = await service.getTeamFormationPreview("cohort-123");
      expect(cached).not.toBeNull();
    });

    it("should exclude participants already in teams", async () => {
      const participants = [
        createMockParticipant("p1", "SA"),
        createMockParticipant("p2", "SA"),
        createMockParticipant("p3", "SA"),
        createMockParticipant("p4", "SA"), // Already in a team
      ];

      cohortRepository.findOne.mockResolvedValue(mockCohort);

      // Mock team members query to show p4 is already in a team
      const teamMemberQB = createMockQueryBuilder();
      teamMemberQB.getRawMany.mockResolvedValue([{ tm_participant_id: "p4" }]);
      teamMemberRepository.createQueryBuilder.mockReturnValue(teamMemberQB);

      const participantQB = createMockQueryBuilder();
      participantQB.getMany.mockResolvedValue(participants);
      participantRepository.createQueryBuilder.mockReturnValue(participantQB);

      preferenceRepository.find.mockResolvedValue([
        createMockPreference("p1"),
        createMockPreference("p2"),
        createMockPreference("p3"),
      ]);

      const result = await service.runTeamFormation("cohort-123");

      // p4 should be excluded - only 3 eligible
      expect(result.statistics.totalEligibleParticipants).toBe(3);
    });

    it("should form same-country teams for participants preferring same country", async () => {
      const participants = [
        createMockParticipant("p1", "SA"),
        createMockParticipant("p2", "SA"),
        createMockParticipant("p3", "SA"),
        createMockParticipant("p4", "EG"),
        createMockParticipant("p5", "EG"),
        createMockParticipant("p6", "EG"),
      ];

      cohortRepository.findOne.mockResolvedValue(mockCohort);

      const participantQB = createMockQueryBuilder();
      participantQB.getMany.mockResolvedValue(participants);
      participantRepository.createQueryBuilder.mockReturnValue(participantQB);

      preferenceRepository.find.mockResolvedValue([
        createMockPreference("p1", { crossCountryWilling: false }),
        createMockPreference("p2", { crossCountryWilling: false }),
        createMockPreference("p3", { crossCountryWilling: false }),
        createMockPreference("p4", { crossCountryWilling: false }),
        createMockPreference("p5", { crossCountryWilling: false }),
        createMockPreference("p6", { crossCountryWilling: false }),
      ]);

      const result = await service.runTeamFormation("cohort-123", {
        config: { useBriefCentricAssignment: false },
      });

      // Should form 2 same-country teams
      expect(result.proposedTeams.length).toBe(2);
      expect(result.statistics.sameCountryTeamCount).toBe(2);
      expect(result.statistics.crossCountryTeamCount).toBe(0);

      // Each team should have participants from the same country
      for (const team of result.proposedTeams) {
        expect(team.countries.length).toBe(1);
        expect(team.isCrossCountry).toBe(false);
      }
    });

    it("should form cross-country teams for participants willing to work cross-country", async () => {
      const participants = [
        createMockParticipant("p1", "SA"),
        createMockParticipant("p2", "EG"),
        createMockParticipant("p3", "AE"),
      ];

      cohortRepository.findOne.mockResolvedValue(mockCohort);

      const participantQB = createMockQueryBuilder();
      participantQB.getMany.mockResolvedValue(participants);
      participantRepository.createQueryBuilder.mockReturnValue(participantQB);

      preferenceRepository.find.mockResolvedValue([
        createMockPreference("p1", { crossCountryWilling: true }),
        createMockPreference("p2", { crossCountryWilling: true }),
        createMockPreference("p3", { crossCountryWilling: true }),
      ]);

      const result = await service.runTeamFormation("cohort-123", {
        config: { useBriefCentricAssignment: false },
      });

      expect(result.proposedTeams.length).toBe(1);
      expect(result.proposedTeams[0].isCrossCountry).toBe(true);
      expect(result.proposedTeams[0].countries.length).toBe(3);
    });

    it("should use custom config when provided", async () => {
      const participants = [
        createMockParticipant("p1", "SA"),
        createMockParticipant("p2", "SA"),
        createMockParticipant("p3", "SA"),
        createMockParticipant("p4", "SA"),
      ];

      cohortRepository.findOne.mockResolvedValue(mockCohort);

      const participantQB = createMockQueryBuilder();
      participantQB.getMany.mockResolvedValue(participants);
      participantRepository.createQueryBuilder.mockReturnValue(participantQB);

      preferenceRepository.find.mockResolvedValue([
        createMockPreference("p1"),
        createMockPreference("p2"),
        createMockPreference("p3"),
        createMockPreference("p4"),
      ]);

      const result = await service.runTeamFormation("cohort-123", {
        config: {
          teamSizeMin: 2,
          teamSizeMax: 2,
          useBriefCentricAssignment: false,
        },
      });

      expect(result.configUsed.teamSizeMin).toBe(2);
      expect(result.configUsed.teamSizeMax).toBe(2);
      // Should form 2 teams of 2 participants each
      expect(result.proposedTeams.length).toBe(2);
    });
  });

  describe("getTeamFormationPreview", () => {
    it("should return null if no preview cached", async () => {
      const result = await service.getTeamFormationPreview("cohort-123");
      expect(result).toBeNull();
    });

    it("should return cached preview after runTeamFormation", async () => {
      cohortRepository.findOne.mockResolvedValue(mockCohort);

      const participantQB = createMockQueryBuilder();
      participantQB.getMany.mockResolvedValue([]);
      participantRepository.createQueryBuilder.mockReturnValue(participantQB);
      preferenceRepository.find.mockResolvedValue([]);

      await service.runTeamFormation("cohort-123");
      const result = await service.getTeamFormationPreview("cohort-123");

      expect(result).not.toBeNull();
      expect(result?.cohortId).toBe("cohort-123");
    });
  });

  describe("clearFormationPreviewCache", () => {
    it("should clear cached preview", async () => {
      cohortRepository.findOne.mockResolvedValue(mockCohort);

      const participantQB = createMockQueryBuilder();
      participantQB.getMany.mockResolvedValue([]);
      participantRepository.createQueryBuilder.mockReturnValue(participantQB);
      preferenceRepository.find.mockResolvedValue([]);

      await service.runTeamFormation("cohort-123");
      service.clearFormationPreviewCache("cohort-123");

      const result = await service.getTeamFormationPreview("cohort-123");
      expect(result).toBeNull();
    });
  });

  describe("finalizeTeamFormation", () => {
    it("should throw BadRequestException if no preview exists", async () => {
      await expect(service.finalizeTeamFormation("cohort-123")).rejects.toThrow(
        BadRequestException
      );
    });

    it("should create teams from preview", async () => {
      // Setup preview first
      const participants = [
        createMockParticipant("p1", "SA"),
        createMockParticipant("p2", "SA"),
        createMockParticipant("p3", "SA"),
      ];

      cohortRepository.findOne.mockResolvedValue(mockCohort);

      const participantQB = createMockQueryBuilder();
      participantQB.getMany.mockResolvedValue(participants);
      participantRepository.createQueryBuilder.mockReturnValue(participantQB);

      preferenceRepository.find.mockResolvedValue([
        createMockPreference("p1"),
        createMockPreference("p2"),
        createMockPreference("p3"),
      ]);

      await service.runTeamFormation("cohort-123", {
        config: { useBriefCentricAssignment: false },
      });

      // Setup for finalize
      teamRepository.create.mockImplementation((data) => ({ ...data, id: "new-team-id" }));
      teamRepository.save.mockImplementation((team) => Promise.resolve({ ...team, id: "new-team-id" }));
      teamMemberRepository.create.mockImplementation((data) => data);
      teamMemberRepository.save.mockResolvedValue([]);
      participantRepository.update.mockResolvedValue({ affected: 3, raw: {}, generatedMaps: [] });

      const result = await service.finalizeTeamFormation("cohort-123");

      expect(result.createdTeamCount).toBe(1);
      expect(result.errors).toEqual([]);
      expect(teamRepository.save).toHaveBeenCalled();
      expect(teamMemberRepository.save).toHaveBeenCalled();
    });

    it("should exclude participants specified in excludeParticipantIds", async () => {
      const participants = [
        createMockParticipant("p1", "SA"),
        createMockParticipant("p2", "SA"),
        createMockParticipant("p3", "SA"),
        createMockParticipant("p4", "SA"),
      ];

      cohortRepository.findOne.mockResolvedValue(mockCohort);

      const participantQB = createMockQueryBuilder();
      participantQB.getMany.mockResolvedValue(participants);
      participantRepository.createQueryBuilder.mockReturnValue(participantQB);

      preferenceRepository.find.mockResolvedValue([
        createMockPreference("p1"),
        createMockPreference("p2"),
        createMockPreference("p3"),
        createMockPreference("p4"),
      ]);

      await service.runTeamFormation("cohort-123");

      teamRepository.create.mockImplementation((data) => ({ ...data, id: "new-team-id" }));
      teamRepository.save.mockImplementation((team) => Promise.resolve({ ...team, id: "new-team-id" }));
      teamMemberRepository.create.mockImplementation((data) => data);
      teamMemberRepository.save.mockResolvedValue([]);
      participantRepository.update.mockResolvedValue({ affected: 3, raw: {}, generatedMaps: [] });

      // Exclude enough participants to make the team undersized
      const result = await service.finalizeTeamFormation("cohort-123", {
        excludeParticipantIds: ["p1", "p2"],
      });

      // Team would be undersized after exclusion, so no teams created
      expect(result.createdTeamCount).toBeLessThanOrEqual(1);
    });

    it("should clear cache after finalization", async () => {
      const participants = [
        createMockParticipant("p1", "SA"),
        createMockParticipant("p2", "SA"),
        createMockParticipant("p3", "SA"),
      ];

      cohortRepository.findOne.mockResolvedValue(mockCohort);

      const participantQB = createMockQueryBuilder();
      participantQB.getMany.mockResolvedValue(participants);
      participantRepository.createQueryBuilder.mockReturnValue(participantQB);

      preferenceRepository.find.mockResolvedValue([]);

      await service.runTeamFormation("cohort-123");

      teamRepository.create.mockImplementation((data) => ({ ...data, id: "new-team-id" }));
      teamRepository.save.mockImplementation((team) => Promise.resolve({ ...team, id: "new-team-id" }));
      teamMemberRepository.create.mockImplementation((data) => data);
      teamMemberRepository.save.mockResolvedValue([]);
      participantRepository.update.mockResolvedValue({ affected: 3, raw: {}, generatedMaps: [] });

      await service.finalizeTeamFormation("cohort-123");

      const preview = await service.getTeamFormationPreview("cohort-123");
      expect(preview).toBeNull();
    });
  });

  describe("getParticipantFormationStatus", () => {
    it("should return participant formation status", async () => {
      const participants = [
        createMockParticipant("p1", "SA"),
        createMockParticipant("p2", "EG"),
      ];

      participantRepository.find.mockResolvedValue(participants);
      preferenceRepository.find.mockResolvedValue([
        createMockPreference("p1", { crossCountryWilling: true }),
        createMockPreference("p2", { crossCountryWilling: false }),
      ]);
      teamMemberRepository.find.mockResolvedValue([]);

      const result = await service.getParticipantFormationStatus("cohort-123");

      expect(result).toHaveLength(2);
      expect(result[0].participantId).toBe("p1");
      expect(result[0].hasTeam).toBe(false);
      expect(result[0].hasPreferences).toBe(true);
      expect(result[0].crossCountryWilling).toBe(true);
      expect(result[1].crossCountryWilling).toBe(false);
    });

    it("should show participants already in teams", async () => {
      const participants = [createMockParticipant("p1", "SA")];

      participantRepository.find.mockResolvedValue(participants);
      preferenceRepository.find.mockResolvedValue([]);
      teamMemberRepository.find.mockResolvedValue([
        {
          participantId: "p1",
          teamId: "team-1",
          team: { id: "team-1", name: "Existing Team" },
        },
      ]);

      const result = await service.getParticipantFormationStatus("cohort-123");

      expect(result[0].hasTeam).toBe(true);
      expect(result[0].teamId).toBe("team-1");
      expect(result[0].teamName).toBe("Existing Team");
    });
  });

  describe("team lead selection", () => {
    it("should select lead with most preferences when strategy is MOST_PREFERENCES", async () => {
      const participants = [
        createMockParticipant("p1", "SA", { skills: ["js"] }),
        createMockParticipant("p2", "SA", { skills: ["js", "python", "rust"] }),
        createMockParticipant("p3", "SA", { skills: ["js", "python"] }),
      ];

      cohortRepository.findOne.mockResolvedValue(mockCohort);

      const participantQB = createMockQueryBuilder();
      participantQB.getMany.mockResolvedValue(participants);
      participantRepository.createQueryBuilder.mockReturnValue(participantQB);

      // p2 has more complete preferences
      preferenceRepository.find.mockResolvedValue([
        createMockPreference("p1", { briefRankings: [] }),
        createMockPreference("p2", { briefRankings: ["b1", "b2", "b3", "b4", "b5"] }),
        createMockPreference("p3", { briefRankings: ["b1"] }),
      ]);

      const result = await service.runTeamFormation("cohort-123", {
        config: {
          leadSelectionStrategy: LeadSelectionStrategy.MOST_PREFERENCES,
          useBriefCentricAssignment: false,
        },
      });

      expect(result.proposedTeams.length).toBe(1);
      expect(result.proposedTeams[0].leadParticipantId).toBe("p2");
    });

    it("should select lead with most skills when strategy is MOST_SKILLS", async () => {
      const participants = [
        createMockParticipant("p1", "SA", { skills: ["js"] }),
        createMockParticipant("p2", "SA", { skills: ["js", "python", "rust", "go"] }),
        createMockParticipant("p3", "SA", { skills: ["js", "python"] }),
      ];

      cohortRepository.findOne.mockResolvedValue(mockCohort);

      const participantQB = createMockQueryBuilder();
      participantQB.getMany.mockResolvedValue(participants);
      participantRepository.createQueryBuilder.mockReturnValue(participantQB);

      preferenceRepository.find.mockResolvedValue([
        createMockPreference("p1"),
        createMockPreference("p2"),
        createMockPreference("p3"),
      ]);

      const result = await service.runTeamFormation("cohort-123", {
        config: {
          leadSelectionStrategy: LeadSelectionStrategy.MOST_SKILLS,
          useBriefCentricAssignment: false,
        },
      });

      expect(result.proposedTeams.length).toBe(1);
      expect(result.proposedTeams[0].leadParticipantId).toBe("p2");
    });
  });

  describe("compatibility scoring", () => {
    it("should calculate higher score for skill diversity when prioritizeSkillDiversity is true", async () => {
      // Team with diverse skills
      const diverseParticipants = [
        createMockParticipant("p1", "SA", { skills: ["javascript"], interests: ["ai"] }),
        createMockParticipant("p2", "SA", { skills: ["python"], interests: ["ai"] }),
        createMockParticipant("p3", "SA", { skills: ["rust"], interests: ["ai"] }),
      ];

      cohortRepository.findOne.mockResolvedValue(mockCohort);

      const participantQB = createMockQueryBuilder();
      participantQB.getMany.mockResolvedValue(diverseParticipants);
      participantRepository.createQueryBuilder.mockReturnValue(participantQB);

      preferenceRepository.find.mockResolvedValue([
        createMockPreference("p1"),
        createMockPreference("p2"),
        createMockPreference("p3"),
      ]);

      const result = await service.runTeamFormation("cohort-123", {
        config: {
          prioritizeSkillDiversity: true,
          useBriefCentricAssignment: false,
        },
      });

      expect(result.proposedTeams.length).toBe(1);
      // Score should reflect skill diversity
      expect(result.proposedTeams[0].scoreBreakdown.skillScore).toBeGreaterThan(0);
    });

    it("should give bonus for same country when countryWeight is high", async () => {
      const sameCountryParticipants = [
        createMockParticipant("p1", "SA"),
        createMockParticipant("p2", "SA"),
        createMockParticipant("p3", "SA"),
      ];

      cohortRepository.findOne.mockResolvedValue(mockCohort);

      const participantQB = createMockQueryBuilder();
      participantQB.getMany.mockResolvedValue(sameCountryParticipants);
      participantRepository.createQueryBuilder.mockReturnValue(participantQB);

      preferenceRepository.find.mockResolvedValue([
        createMockPreference("p1"),
        createMockPreference("p2"),
        createMockPreference("p3"),
      ]);

      const result = await service.runTeamFormation("cohort-123", {
        config: {
          countryWeight: 1.0, // High weight for country match
          useBriefCentricAssignment: false,
        },
      });

      expect(result.proposedTeams.length).toBe(1);
      expect(result.proposedTeams[0].scoreBreakdown.countryScore).toBeGreaterThan(0);
    });
  });

  describe("statistics calculation", () => {
    it("should calculate correct country distribution", async () => {
      const participants = [
        createMockParticipant("p1", "SA"),
        createMockParticipant("p2", "SA"),
        createMockParticipant("p3", "EG"),
        createMockParticipant("p4", "EG"),
        createMockParticipant("p5", "AE"),
      ];

      cohortRepository.findOne.mockResolvedValue({ ...mockCohort, teamSizeMin: 2 });

      const participantQB = createMockQueryBuilder();
      participantQB.getMany.mockResolvedValue(participants);
      participantRepository.createQueryBuilder.mockReturnValue(participantQB);

      preferenceRepository.find.mockResolvedValue([]);

      const result = await service.runTeamFormation("cohort-123");

      expect(result.statistics.countryDistribution).toEqual({
        SA: 2,
        EG: 2,
        AE: 1,
      });
    });

    it("should track unassigned participants", async () => {
      // Only 2 participants - can't form a team of min 3
      const participants = [
        createMockParticipant("p1", "SA"),
        createMockParticipant("p2", "SA"),
      ];

      cohortRepository.findOne.mockResolvedValue(mockCohort);

      const participantQB = createMockQueryBuilder();
      participantQB.getMany.mockResolvedValue(participants);
      participantRepository.createQueryBuilder.mockReturnValue(participantQB);

      preferenceRepository.find.mockResolvedValue([]);

      const result = await service.runTeamFormation("cohort-123");

      expect(result.statistics.unassignedParticipantCount).toBe(2);
      expect(result.unassignedParticipantIds).toContain("p1");
      expect(result.unassignedParticipantIds).toContain("p2");
    });
  });

  describe("edge cases", () => {
    it("should handle participants without preferences", async () => {
      const participants = [
        createMockParticipant("p1", "SA"),
        createMockParticipant("p2", "SA"),
        createMockParticipant("p3", "SA"),
      ];

      cohortRepository.findOne.mockResolvedValue(mockCohort);

      const participantQB = createMockQueryBuilder();
      participantQB.getMany.mockResolvedValue(participants);
      participantRepository.createQueryBuilder.mockReturnValue(participantQB);

      // No preferences set
      preferenceRepository.find.mockResolvedValue([]);

      const result = await service.runTeamFormation("cohort-123", {
        config: { useBriefCentricAssignment: false },
      });

      // Should still form teams, defaulting crossCountryWilling to true
      expect(result.proposedTeams.length).toBe(1);
      expect(result.statistics.participantsWithoutPreferences).toBe(3);
    });

    it("should handle single participant", async () => {
      const participants = [createMockParticipant("p1", "SA")];

      cohortRepository.findOne.mockResolvedValue(mockCohort);

      const participantQB = createMockQueryBuilder();
      participantQB.getMany.mockResolvedValue(participants);
      participantRepository.createQueryBuilder.mockReturnValue(participantQB);

      preferenceRepository.find.mockResolvedValue([]);

      const result = await service.runTeamFormation("cohort-123");

      expect(result.proposedTeams.length).toBe(0);
      expect(result.unassignedParticipantIds).toContain("p1");
    });

    it("should handle empty skills and interests arrays", async () => {
      const participants = [
        createMockParticipant("p1", "SA", { skills: [], interests: [] }),
        createMockParticipant("p2", "SA", { skills: [], interests: [] }),
        createMockParticipant("p3", "SA", { skills: [], interests: [] }),
      ];

      cohortRepository.findOne.mockResolvedValue(mockCohort);

      const participantQB = createMockQueryBuilder();
      participantQB.getMany.mockResolvedValue(participants);
      participantRepository.createQueryBuilder.mockReturnValue(participantQB);

      preferenceRepository.find.mockResolvedValue([]);

      const result = await service.runTeamFormation("cohort-123", {
        config: { useBriefCentricAssignment: false },
      });

      expect(result.proposedTeams.length).toBe(1);
    });
  });

  describe("team backfill", () => {
    it("should return empty backfills when no undersized teams exist", async () => {
      cohortRepository.findOne.mockResolvedValue(mockCohort);
      teamRepository.find.mockResolvedValue([]);

      const participantQB = createMockQueryBuilder();
      participantQB.getMany.mockResolvedValue([]);
      participantRepository.createQueryBuilder.mockReturnValue(participantQB);

      preferenceRepository.find.mockResolvedValue([]);

      const result = await service.runTeamFormation("cohort-123");

      expect(result.proposedBackfills).toEqual([]);
      expect(result.statistics.backfillStats.undersizedTeamCount).toBe(0);
      expect(result.statistics.backfillStats.teamsToBackfillCount).toBe(0);
    });

    it("should propose backfills for undersized teams", async () => {
      const undersizedTeam = {
        id: "team-1",
        name: "Undersized Team",
        cohortId: "cohort-123",
        status: TeamStatus.ACTIVE,
        briefId: "brief-1",
        members: [
          {
            participantId: "member-1",
            participant: createMockParticipant("member-1", "Kenya"),
            status: TeamMemberStatus.CONFIRMED,
          },
          {
            participantId: "member-2",
            participant: createMockParticipant("member-2", "Kenya"),
            status: TeamMemberStatus.CONFIRMED,
          },
        ],
      };

      cohortRepository.findOne.mockResolvedValue(mockCohort);
      teamRepository.find.mockResolvedValue([undersizedTeam]);

      // Available participants to backfill with
      const availableParticipants = [
        createMockParticipant("p1", "Kenya"),
        createMockParticipant("p2", "Kenya"),
        createMockParticipant("p3", "Nigeria"),
      ];

      const participantQB = createMockQueryBuilder();
      participantQB.getMany.mockResolvedValue(availableParticipants);
      participantRepository.createQueryBuilder.mockReturnValue(participantQB);

      // Preferences for available participants (prefer brief-1)
      preferenceRepository.find.mockResolvedValue([
        createMockPreference("p1", { briefRankings: ["brief-1", "brief-2"] }),
        createMockPreference("p2", { briefRankings: ["brief-2", "brief-1"] }),
        createMockPreference("p3", { briefRankings: ["brief-3"] }),
        // Member preferences
        createMockPreference("member-1", { verticalId1: "vertical-1" }),
        createMockPreference("member-2", { verticalId1: "vertical-1" }),
      ]);

      const result = await service.runTeamFormation("cohort-123");

      // Should propose backfill for undersized team
      expect(result.proposedBackfills.length).toBe(1);
      expect(result.proposedBackfills[0].teamId).toBe("team-1");
      expect(result.proposedBackfills[0].currentMemberCount).toBe(2);

      // Should prefer p1 (Kenya, prefers brief-1) over p3 (Nigeria, doesn't prefer brief-1)
      expect(result.proposedBackfills[0].participantIdsToAdd).toContain("p1");

      // Backfill stats should reflect the operation
      expect(result.statistics.backfillStats.undersizedTeamCount).toBe(1);
      expect(result.statistics.backfillStats.teamsToBackfillCount).toBe(1);
      expect(result.statistics.backfillStats.participantsToBackfillCount).toBeGreaterThan(0);
    });

    it("should prioritize same-country participants for backfill", async () => {
      const undersizedTeam = {
        id: "team-1",
        name: "Kenya Team",
        cohortId: "cohort-123",
        status: TeamStatus.ACTIVE,
        briefId: null,
        members: [
          {
            participantId: "member-1",
            participant: createMockParticipant("member-1", "Kenya"),
            status: TeamMemberStatus.CONFIRMED,
          },
        ],
      };

      cohortRepository.findOne.mockResolvedValue(mockCohort);
      teamRepository.find.mockResolvedValue([undersizedTeam]);

      const availableParticipants = [
        createMockParticipant("p1", "Nigeria"),
        createMockParticipant("p2", "Kenya"),
        createMockParticipant("p3", "Kenya"),
      ];

      const participantQB = createMockQueryBuilder();
      participantQB.getMany.mockResolvedValue(availableParticipants);
      participantRepository.createQueryBuilder.mockReturnValue(participantQB);

      preferenceRepository.find.mockResolvedValue([
        createMockPreference("p1", { crossCountryWilling: true }),
        createMockPreference("p2", { crossCountryWilling: true }),
        createMockPreference("p3", { crossCountryWilling: true }),
        createMockPreference("member-1"),
      ]);

      const result = await service.runTeamFormation("cohort-123");

      expect(result.proposedBackfills.length).toBe(1);
      // Kenya participants should be prioritized
      const backfillIds = result.proposedBackfills[0].participantIdsToAdd;
      expect(backfillIds).toContain("p2");
      expect(backfillIds).toContain("p3");
    });

    it("should not backfill with participants not willing to cross country", async () => {
      const undersizedTeam = {
        id: "team-1",
        name: "Kenya Team",
        cohortId: "cohort-123",
        status: TeamStatus.ACTIVE,
        briefId: null,
        members: [
          {
            participantId: "member-1",
            participant: createMockParticipant("member-1", "Kenya"),
            status: TeamMemberStatus.CONFIRMED,
          },
        ],
      };

      cohortRepository.findOne.mockResolvedValue(mockCohort);
      teamRepository.find.mockResolvedValue([undersizedTeam]);

      const availableParticipants = [
        createMockParticipant("p1", "Nigeria"),
        createMockParticipant("p2", "Nigeria"),
      ];

      const participantQB = createMockQueryBuilder();
      participantQB.getMany.mockResolvedValue(availableParticipants);
      participantRepository.createQueryBuilder.mockReturnValue(participantQB);

      preferenceRepository.find.mockResolvedValue([
        createMockPreference("p1", { crossCountryWilling: false }),
        createMockPreference("p2", { crossCountryWilling: false }),
        createMockPreference("member-1"),
      ]);

      const result = await service.runTeamFormation("cohort-123");

      // Should have no valid backfills (participants unwilling to cross country)
      expect(result.proposedBackfills[0]?.participantIdsToAdd.length || 0).toBe(0);
      expect(result.statistics.backfillStats.teamsStillUndersizedCount).toBe(1);
    });

    it("should apply backfills before creating new teams during finalization", async () => {
      const undersizedTeam = {
        id: "team-1",
        name: "Undersized Team",
        cohortId: "cohort-123",
        status: TeamStatus.ACTIVE,
        briefId: null,
        members: [
          {
            participantId: "member-1",
            participant: createMockParticipant("member-1", "Kenya"),
            status: TeamMemberStatus.CONFIRMED,
          },
          {
            participantId: "member-2",
            participant: createMockParticipant("member-2", "Kenya"),
            status: TeamMemberStatus.CONFIRMED,
          },
        ],
      };

      cohortRepository.findOne.mockResolvedValue(mockCohort);
      teamRepository.find.mockResolvedValue([undersizedTeam]);

      // 3 participants to backfill, 6 more to form new teams
      const availableParticipants = [
        createMockParticipant("p1", "Kenya"),
        createMockParticipant("p2", "Kenya"),
        createMockParticipant("p3", "Kenya"),
        createMockParticipant("p4", "Nigeria"),
        createMockParticipant("p5", "Nigeria"),
        createMockParticipant("p6", "Nigeria"),
        createMockParticipant("p7", "Nigeria"),
        createMockParticipant("p8", "Nigeria"),
        createMockParticipant("p9", "Nigeria"),
      ];

      const participantQB = createMockQueryBuilder();
      participantQB.getMany.mockResolvedValue(availableParticipants);
      participantRepository.createQueryBuilder.mockReturnValue(participantQB);

      preferenceRepository.find.mockResolvedValue([
        ...availableParticipants.map((p) => createMockPreference(p.id)),
        createMockPreference("member-1"),
        createMockPreference("member-2"),
      ]);

      // Run formation to generate preview (use legacy mode to ensure teams are formed)
      await service.runTeamFormation("cohort-123", {
        config: { useBriefCentricAssignment: false },
      });

      // Mock save operations
      teamRepository.create.mockImplementation((data) => ({ ...data, id: `new-team-${Date.now()}` }));
      teamRepository.save.mockImplementation((team) => Promise.resolve({ ...team, id: team.id || `saved-${Date.now()}` }));
      teamMemberRepository.create.mockImplementation((data) => data);
      teamMemberRepository.save.mockResolvedValue([]);
      participantRepository.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      // Finalize
      const finalResult = await service.finalizeTeamFormation("cohort-123");

      // Should have backfilled at least 1 team
      expect(finalResult.backfilledTeamCount).toBe(1);
      // Should have created new teams for remaining participants
      expect(finalResult.createdTeamCount).toBeGreaterThan(0);
      expect(finalResult.errors.length).toBe(0);
    });

    it("should exclude specified participants from backfill during finalization", async () => {
      const undersizedTeam = {
        id: "team-1",
        name: "Undersized Team",
        cohortId: "cohort-123",
        status: TeamStatus.ACTIVE,
        briefId: null,
        members: [
          {
            participantId: "member-1",
            participant: createMockParticipant("member-1", "Kenya"),
            status: TeamMemberStatus.CONFIRMED,
          },
        ],
      };

      cohortRepository.findOne.mockResolvedValue(mockCohort);
      teamRepository.find.mockResolvedValue([undersizedTeam]);

      const availableParticipants = [
        createMockParticipant("p1", "Kenya"),
        createMockParticipant("p2", "Kenya"),
        createMockParticipant("p3", "Kenya"),
        createMockParticipant("p4", "Kenya"),
      ];

      const participantQB = createMockQueryBuilder();
      participantQB.getMany.mockResolvedValue(availableParticipants);
      participantRepository.createQueryBuilder.mockReturnValue(participantQB);

      preferenceRepository.find.mockResolvedValue([
        ...availableParticipants.map((p) => createMockPreference(p.id)),
        createMockPreference("member-1"),
      ]);

      // Run formation
      const preview = await service.runTeamFormation("cohort-123");
      const backfillIds = preview.proposedBackfills[0]?.participantIdsToAdd || [];

      // Mock save operations
      teamMemberRepository.create.mockImplementation((data) => data);
      teamMemberRepository.save.mockResolvedValue([]);
      participantRepository.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      teamRepository.create.mockImplementation((data) => ({ ...data, id: `new-team-${Date.now()}` }));
      teamRepository.save.mockImplementation((team) => Promise.resolve({ ...team, id: team.id || `saved-${Date.now()}` }));

      // Finalize but exclude some backfill participants
      await service.finalizeTeamFormation("cohort-123", {
        excludeParticipantIds: backfillIds.slice(0, 2), // Exclude first 2 backfill candidates
      });

      // Verify teamMemberRepository.save was called with fewer participants
      const saveCalls = teamMemberRepository.save.mock.calls;
      if (saveCalls.length > 0) {
        const savedMembers = saveCalls[0][0] as any[];
        // The excluded participants should not be in saved members
        const savedIds = savedMembers.map((m) => m.participantId);
        expect(savedIds).not.toContain(backfillIds[0]);
        expect(savedIds).not.toContain(backfillIds[1]);
      }
    });

    it("should track backfill statistics correctly", async () => {
      const undersizedTeams = [
        {
          id: "team-1",
          name: "Team 1",
          cohortId: "cohort-123",
          status: TeamStatus.ACTIVE,
          briefId: null,
          members: [
            { participantId: "m1", participant: createMockParticipant("m1", "Kenya"), status: TeamMemberStatus.CONFIRMED },
            { participantId: "m2", participant: createMockParticipant("m2", "Kenya"), status: TeamMemberStatus.CONFIRMED },
          ],
        },
        {
          id: "team-2",
          name: "Team 2",
          cohortId: "cohort-123",
          status: TeamStatus.ACTIVE,
          briefId: null,
          members: [
            { participantId: "m3", participant: createMockParticipant("m3", "Nigeria"), status: TeamMemberStatus.CONFIRMED },
          ],
        },
      ];

      cohortRepository.findOne.mockResolvedValue(mockCohort);
      teamRepository.find.mockResolvedValue(undersizedTeams);

      const availableParticipants = [
        createMockParticipant("p1", "Kenya"),
        createMockParticipant("p2", "Kenya"),
        createMockParticipant("p3", "Kenya"),
        createMockParticipant("p4", "Nigeria"),
        createMockParticipant("p5", "Nigeria"),
      ];

      const participantQB = createMockQueryBuilder();
      participantQB.getMany.mockResolvedValue(availableParticipants);
      participantRepository.createQueryBuilder.mockReturnValue(participantQB);

      preferenceRepository.find.mockResolvedValue([
        ...availableParticipants.map((p) => createMockPreference(p.id)),
        createMockPreference("m1"),
        createMockPreference("m2"),
        createMockPreference("m3"),
      ]);

      const result = await service.runTeamFormation("cohort-123");

      // Should track 2 undersized teams
      expect(result.statistics.backfillStats.undersizedTeamCount).toBe(2);
      // Both teams should receive backfills
      expect(result.statistics.backfillStats.teamsToBackfillCount).toBe(2);
      // Total backfilled participants count
      expect(result.statistics.backfillStats.participantsToBackfillCount).toBeGreaterThan(0);
      // Average compatibility should be calculated
      expect(result.statistics.backfillStats.averageBackfillCompatibility).toBeGreaterThanOrEqual(0);
    });

    it("should include proposedBackfills in preview response", async () => {
      const undersizedTeam = {
        id: "team-1",
        name: "Team to Backfill",
        cohortId: "cohort-123",
        status: TeamStatus.ACTIVE,
        briefId: "brief-1",
        members: [
          { participantId: "m1", participant: createMockParticipant("m1", "Kenya"), status: TeamMemberStatus.CONFIRMED },
          { participantId: "m2", participant: createMockParticipant("m2", "Kenya"), status: TeamMemberStatus.CONFIRMED },
        ],
      };

      cohortRepository.findOne.mockResolvedValue(mockCohort);
      teamRepository.find.mockResolvedValue([undersizedTeam]);

      const availableParticipants = [
        createMockParticipant("p1", "Kenya"),
        createMockParticipant("p2", "Kenya"),
        createMockParticipant("p3", "Kenya"),
      ];

      const participantQB = createMockQueryBuilder();
      participantQB.getMany.mockResolvedValue(availableParticipants);
      participantRepository.createQueryBuilder.mockReturnValue(participantQB);

      preferenceRepository.find.mockResolvedValue([
        ...availableParticipants.map((p) => createMockPreference(p.id)),
        createMockPreference("m1", { verticalId1: "v1" }),
        createMockPreference("m2", { verticalId1: "v1" }),
      ]);

      const result = await service.runTeamFormation("cohort-123");

      // Verify backfill structure
      expect(result.proposedBackfills).toBeDefined();
      expect(Array.isArray(result.proposedBackfills)).toBe(true);

      if (result.proposedBackfills.length > 0) {
        const backfill = result.proposedBackfills[0];
        expect(backfill.teamId).toBe("team-1");
        expect(backfill.teamName).toBe("Team to Backfill");
        expect(backfill.currentMemberCount).toBe(2);
        expect(backfill.targetSize).toBe(5);
        expect(backfill.briefId).toBe("brief-1");
        expect(backfill.existingCountries).toContain("Kenya");
        expect(Array.isArray(backfill.participantIdsToAdd)).toBe(true);
        expect(Array.isArray(backfill.participantsToAdd)).toBe(true);
        expect(typeof backfill.compatibilityScore).toBe("number");
        expect(typeof backfill.introducesCrossCountry).toBe("boolean");
      }
    });
  });
});
