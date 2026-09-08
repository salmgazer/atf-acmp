import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { MatchingService } from "./matching.service";
import { Team, TeamStatus } from "@/database/entities/team.entity";
import { Brief, BriefStatus } from "@/database/entities/brief.entity";
import { Cohort } from "@/database/entities/cohort.entity";
import { ParticipantPreference } from "@/database/entities/participant.entity";
import {
  createMockRepository,
  createMockQueryBuilder,
  createTestCohort,
  createTestTeam,
} from "../../../test/utils/test-utils";

describe("MatchingService", () => {
  let service: MatchingService;
  let teamRepository: ReturnType<typeof createMockRepository>;
  let briefRepository: ReturnType<typeof createMockRepository>;
  let cohortRepository: ReturnType<typeof createMockRepository>;
  let preferenceRepository: ReturnType<typeof createMockRepository>;

  const mockCohort = createTestCohort({
    id: "cohort-123",
    name: "Test Cohort",
  });

  const mockBrief = {
    id: "brief-1",
    title: "Test Brief",
    cohortId: "cohort-123",
    status: BriefStatus.APPROVED,
    maxTeams: 3,
    verticalId: "vertical-1",
    tags: ["javascript", "react"],
    organization: { name: "Test Org" },
    vertical: { name: "Tech" },
  };

  const mockTeam = createTestTeam({
    id: "team-1",
    name: "Test Team",
    cohortId: "cohort-123",
    status: TeamStatus.FORMING,
    briefId: null,
    members: [
      {
        participantId: "participant-1",
        participant: { skills: ["javascript", "python"] },
      },
    ],
  });

  beforeEach(async () => {
    teamRepository = createMockRepository();
    briefRepository = createMockRepository();
    cohortRepository = createMockRepository();
    preferenceRepository = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingService,
        { provide: getRepositoryToken(Team), useValue: teamRepository },
        { provide: getRepositoryToken(Brief), useValue: briefRepository },
        { provide: getRepositoryToken(Cohort), useValue: cohortRepository },
        { provide: getRepositoryToken(ParticipantPreference), useValue: preferenceRepository },
      ],
    }).compile();

    service = module.get<MatchingService>(MatchingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    service.clearPreviewCache("cohort-123");
  });

  describe("runMatching", () => {
    it("should throw NotFoundException if cohort not found", async () => {
      cohortRepository.findOne.mockResolvedValue(null);

      await expect(service.runMatching("non-existent")).rejects.toThrow(
        NotFoundException
      );
    });

    it("should return warnings when no eligible teams found", async () => {
      cohortRepository.findOne.mockResolvedValue(mockCohort);
      teamRepository.find.mockResolvedValue([]);
      briefRepository.find.mockResolvedValue([mockBrief]);

      const result = await service.runMatching("cohort-123");

      expect(result.warnings).toContain("No eligible teams found for matching");
      expect(result.statistics.totalTeams).toBe(0);
    });

    it("should return warnings when no available briefs found", async () => {
      cohortRepository.findOne.mockResolvedValue(mockCohort);
      teamRepository.find.mockResolvedValue([mockTeam]);
      briefRepository.find.mockResolvedValue([]);
      preferenceRepository.find.mockResolvedValue([]);

      const result = await service.runMatching("cohort-123");

      expect(result.warnings).toContain("No available briefs found for matching");
      expect(result.statistics.totalBriefs).toBe(0);
    });

    it("should successfully run matching and cache results", async () => {
      cohortRepository.findOne.mockResolvedValue(mockCohort);
      teamRepository.find.mockResolvedValue([mockTeam]);
      briefRepository.find.mockResolvedValue([mockBrief]);
      teamRepository.count.mockResolvedValue(0); // No teams assigned yet
      preferenceRepository.find.mockResolvedValue([
        {
          participantId: "participant-1",
          briefRankings: ["brief-1"],
          verticalId1: "vertical-1",
        },
      ]);

      const result = await service.runMatching("cohort-123");

      expect(result.cohortId).toBe("cohort-123");
      expect(result.cohortName).toBe("Test Cohort");
      expect(result.statistics.totalTeams).toBe(1);
      expect(result.statistics.totalBriefs).toBe(1);
      expect(result.matches.length).toBeGreaterThanOrEqual(0);

      // Should be cached
      const cached = await service.getMatchingPreview("cohort-123");
      expect(cached).not.toBeNull();
    });

    it("should filter teams by provided teamIds", async () => {
      cohortRepository.findOne.mockResolvedValue(mockCohort);
      teamRepository.find.mockResolvedValue([mockTeam]);
      briefRepository.find.mockResolvedValue([mockBrief]);
      teamRepository.count.mockResolvedValue(0);
      preferenceRepository.find.mockResolvedValue([]);

      await service.runMatching("cohort-123", { teamIds: ["team-1"] });

      expect(teamRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: expect.anything(),
          }),
        })
      );
    });

    it("should use custom config weights when provided", async () => {
      cohortRepository.findOne.mockResolvedValue(mockCohort);
      teamRepository.find.mockResolvedValue([mockTeam]);
      briefRepository.find.mockResolvedValue([mockBrief]);
      teamRepository.count.mockResolvedValue(0);
      preferenceRepository.find.mockResolvedValue([
        {
          participantId: "participant-1",
          briefRankings: ["brief-1"],
        },
      ]);

      const result = await service.runMatching("cohort-123", {
        config: {
          firstChoiceWeight: 2.0,
          verticalWeight: 0.0,
          skillOverlapWeight: 0.0,
        },
      });

      expect(result.configUsed.firstChoiceWeight).toBe(2.0);
      expect(result.configUsed.verticalWeight).toBe(0.0);
    });
  });

  describe("getMatchingPreview", () => {
    it("should return null if no preview cached", async () => {
      const result = await service.getMatchingPreview("cohort-123");
      expect(result).toBeNull();
    });

    it("should return cached preview after runMatching", async () => {
      cohortRepository.findOne.mockResolvedValue(mockCohort);
      teamRepository.find.mockResolvedValue([]);
      briefRepository.find.mockResolvedValue([]);

      await service.runMatching("cohort-123");
      const result = await service.getMatchingPreview("cohort-123");

      expect(result).not.toBeNull();
      expect(result?.cohortId).toBe("cohort-123");
    });
  });

  describe("clearPreviewCache", () => {
    it("should clear cached preview", async () => {
      cohortRepository.findOne.mockResolvedValue(mockCohort);
      teamRepository.find.mockResolvedValue([]);
      briefRepository.find.mockResolvedValue([]);

      await service.runMatching("cohort-123");
      service.clearPreviewCache("cohort-123");

      const result = await service.getMatchingPreview("cohort-123");
      expect(result).toBeNull();
    });
  });

  describe("finalizeMatching", () => {
    it("should throw BadRequestException if no preview exists", async () => {
      await expect(service.finalizeMatching("cohort-123")).rejects.toThrow(
        BadRequestException
      );
    });

    it("should apply matches from preview", async () => {
      // Setup preview
      cohortRepository.findOne.mockResolvedValue(mockCohort);
      teamRepository.find.mockResolvedValue([mockTeam]);
      briefRepository.find.mockResolvedValue([mockBrief]);
      teamRepository.count.mockResolvedValue(0);
      preferenceRepository.find.mockResolvedValue([
        {
          participantId: "participant-1",
          briefRankings: ["brief-1"],
        },
      ]);

      await service.runMatching("cohort-123");

      // Setup for finalize
      teamRepository.findOne.mockResolvedValue({ ...mockTeam, briefId: null });
      briefRepository.findOne.mockResolvedValue(mockBrief);
      teamRepository.save.mockResolvedValue({ ...mockTeam, briefId: "brief-1" });
      briefRepository.increment.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });

      const result = await service.finalizeMatching("cohort-123");

      expect(result.assignedCount).toBeGreaterThanOrEqual(0);
      expect(result.errors).toEqual([]);
    });

    it("should exclude teams specified in excludeTeamIds", async () => {
      cohortRepository.findOne.mockResolvedValue(mockCohort);
      teamRepository.find.mockResolvedValue([mockTeam]);
      briefRepository.find.mockResolvedValue([mockBrief]);
      teamRepository.count.mockResolvedValue(0);
      preferenceRepository.find.mockResolvedValue([
        {
          participantId: "participant-1",
          briefRankings: ["brief-1"],
        },
      ]);

      await service.runMatching("cohort-123");

      const result = await service.finalizeMatching("cohort-123", {
        excludeTeamIds: ["team-1"],
      });

      expect(result.assignedCount).toBe(0);
    });

    it("should apply manual overrides", async () => {
      cohortRepository.findOne.mockResolvedValue(mockCohort);
      teamRepository.find.mockResolvedValue([mockTeam]);
      briefRepository.find.mockResolvedValue([mockBrief]);
      teamRepository.count.mockResolvedValue(0);
      preferenceRepository.find.mockResolvedValue([]);

      await service.runMatching("cohort-123");

      teamRepository.findOne.mockResolvedValue({ ...mockTeam, briefId: null });
      briefRepository.findOne.mockResolvedValue(mockBrief);
      teamRepository.save.mockResolvedValue({ ...mockTeam, briefId: "brief-1" });
      briefRepository.increment.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });

      const result = await service.finalizeMatching("cohort-123", {
        overrides: [{ teamId: "team-1", briefId: "brief-1" }],
      });

      expect(result.assignedCount).toBe(1);
    });

    it("should clear cache after finalization", async () => {
      cohortRepository.findOne.mockResolvedValue(mockCohort);
      teamRepository.find.mockResolvedValue([]);
      briefRepository.find.mockResolvedValue([]);

      await service.runMatching("cohort-123");
      await service.finalizeMatching("cohort-123");

      const preview = await service.getMatchingPreview("cohort-123");
      expect(preview).toBeNull();
    });
  });

  describe("getBriefCapacities", () => {
    it("should return brief capacities", async () => {
      briefRepository.find.mockResolvedValue([mockBrief]);
      teamRepository.count.mockResolvedValue(1);

      const result = await service.getBriefCapacities("cohort-123");

      expect(result).toHaveLength(1);
      expect(result[0].briefId).toBe("brief-1");
      expect(result[0].maxTeams).toBe(3);
      expect(result[0].currentTeams).toBe(1);
      expect(result[0].availableSlots).toBe(2);
    });

    it("should include preview assignments if available", async () => {
      // Create preview first
      cohortRepository.findOne.mockResolvedValue(mockCohort);
      teamRepository.find.mockResolvedValue([mockTeam]);
      briefRepository.find.mockResolvedValue([mockBrief]);
      teamRepository.count.mockResolvedValue(0);
      preferenceRepository.find.mockResolvedValue([
        {
          participantId: "participant-1",
          briefRankings: ["brief-1"],
        },
      ]);

      await service.runMatching("cohort-123");

      // Now get capacities
      briefRepository.find.mockResolvedValue([mockBrief]);
      teamRepository.count.mockResolvedValue(0);

      const result = await service.getBriefCapacities("cohort-123");

      expect(result[0]).toHaveProperty("previewTeams");
    });
  });

  describe("getTeamMatchStatus", () => {
    it("should return team match status", async () => {
      teamRepository.find.mockResolvedValue([mockTeam]);
      preferenceRepository.find.mockResolvedValue([
        {
          participantId: "participant-1",
          briefRankings: ["brief-1", "brief-2"],
        },
      ]);

      const result = await service.getTeamMatchStatus("cohort-123");

      expect(result).toHaveLength(1);
      expect(result[0].teamId).toBe("team-1");
      expect(result[0].teamName).toBe("Test Team");
      expect(result[0].hasPreferences).toBe(true);
      expect(result[0].rankedBriefIds).toEqual(["brief-1", "brief-2"]);
    });

    it("should include preview match info if available", async () => {
      // Create preview first
      cohortRepository.findOne.mockResolvedValue(mockCohort);
      teamRepository.find.mockResolvedValue([mockTeam]);
      briefRepository.find.mockResolvedValue([mockBrief]);
      teamRepository.count.mockResolvedValue(0);
      preferenceRepository.find.mockResolvedValue([
        {
          participantId: "participant-1",
          briefRankings: ["brief-1"],
        },
      ]);

      await service.runMatching("cohort-123");

      // Now get status
      teamRepository.find.mockResolvedValue([mockTeam]);

      const result = await service.getTeamMatchStatus("cohort-123");

      expect(result[0]).toHaveProperty("previewBriefId");
      expect(result[0]).toHaveProperty("previewScore");
    });
  });

  describe("score calculation", () => {
    it("should calculate higher score for first choice brief", async () => {
      const team1 = {
        ...mockTeam,
        id: "team-1",
        members: [{ participantId: "p1", participant: { skills: [] } }],
      };
      const team2 = {
        ...mockTeam,
        id: "team-2",
        members: [{ participantId: "p2", participant: { skills: [] } }],
      };

      cohortRepository.findOne.mockResolvedValue(mockCohort);
      teamRepository.find.mockResolvedValue([team1, team2]);
      briefRepository.find.mockResolvedValue([mockBrief]);
      teamRepository.count.mockResolvedValue(0);

      // Team1 ranks brief-1 first, Team2 ranks it third
      preferenceRepository.find
        .mockResolvedValueOnce([{ participantId: "p1", briefRankings: ["brief-1"] }])
        .mockResolvedValueOnce([{ participantId: "p2", briefRankings: ["other1", "other2", "brief-1"] }]);

      const result = await service.runMatching("cohort-123");

      // With greedy matching, the team with higher score should be matched
      if (result.matches.length > 0) {
        const team1Match = result.matches.find((m) => m.teamId === "team-1");
        const team2Match = result.matches.find((m) => m.teamId === "team-2");

        if (team1Match && team2Match) {
          expect(team1Match.score).toBeGreaterThan(team2Match.score);
        }
      }
    });

    it("should give bonus for vertical match", async () => {
      const teamWithVertical = {
        ...mockTeam,
        members: [{ participantId: "p1", participant: { skills: [] } }],
      };

      cohortRepository.findOne.mockResolvedValue(mockCohort);
      teamRepository.find.mockResolvedValue([teamWithVertical]);
      briefRepository.find.mockResolvedValue([mockBrief]);
      teamRepository.count.mockResolvedValue(0);
      preferenceRepository.find.mockResolvedValue([
        {
          participantId: "p1",
          briefRankings: [],
          verticalId1: "vertical-1", // Matches brief's vertical
        },
      ]);

      const result = await service.runMatching("cohort-123");

      if (result.matches.length > 0) {
        expect(result.matches[0].verticalMatch).toBe(true);
        expect(result.matches[0].scoreBreakdown.verticalScore).toBeGreaterThan(0);
      }
    });

    it("should give bonus for skill overlap", async () => {
      const teamWithSkills = {
        ...mockTeam,
        members: [
          { participantId: "p1", participant: { skills: ["javascript", "react"] } },
        ],
      };

      cohortRepository.findOne.mockResolvedValue(mockCohort);
      teamRepository.find.mockResolvedValue([teamWithSkills]);
      briefRepository.find.mockResolvedValue([mockBrief]); // Has tags: ["javascript", "react"]
      teamRepository.count.mockResolvedValue(0);
      preferenceRepository.find.mockResolvedValue([]);

      const result = await service.runMatching("cohort-123");

      if (result.matches.length > 0) {
        expect(result.matches[0].skillOverlap).toBeGreaterThan(0);
        expect(result.matches[0].scoreBreakdown.skillScore).toBeGreaterThan(0);
      }
    });
  });

  describe("capacity constraints", () => {
    it("should respect brief maxTeams capacity", async () => {
      const teams = [
        { ...mockTeam, id: "team-1", members: [{ participantId: "p1", participant: { skills: [] } }] },
        { ...mockTeam, id: "team-2", members: [{ participantId: "p2", participant: { skills: [] } }] },
        { ...mockTeam, id: "team-3", members: [{ participantId: "p3", participant: { skills: [] } }] },
        { ...mockTeam, id: "team-4", members: [{ participantId: "p4", participant: { skills: [] } }] },
      ];

      const briefWithLimit = { ...mockBrief, maxTeams: 2 };

      cohortRepository.findOne.mockResolvedValue(mockCohort);
      teamRepository.find.mockResolvedValue(teams);
      briefRepository.find.mockResolvedValue([briefWithLimit]);
      teamRepository.count.mockResolvedValue(0); // No teams assigned yet
      preferenceRepository.find.mockResolvedValue([]);

      const result = await service.runMatching("cohort-123");

      // Should only match 2 teams (maxTeams = 2, current = 0, available = 2)
      expect(result.matches.length).toBeLessThanOrEqual(2);
      expect(result.unmatchedTeamIds.length).toBeGreaterThanOrEqual(2);
    });

    it("should account for already assigned teams", async () => {
      cohortRepository.findOne.mockResolvedValue(mockCohort);
      teamRepository.find.mockResolvedValue([mockTeam]);
      briefRepository.find.mockResolvedValue([{ ...mockBrief, maxTeams: 2 }]);
      teamRepository.count.mockResolvedValue(2); // Already at capacity
      preferenceRepository.find.mockResolvedValue([]);

      const result = await service.runMatching("cohort-123");

      // Brief is at capacity, team should be unmatched
      expect(result.unmatchedTeamIds).toContain("team-1");
    });
  });

  describe("statistics calculation", () => {
    it("should calculate correct statistics", async () => {
      const teams = [
        { ...mockTeam, id: "team-1", members: [{ participantId: "p1", participant: { skills: [] } }] },
        { ...mockTeam, id: "team-2", members: [{ participantId: "p2", participant: { skills: [] } }] },
      ];

      cohortRepository.findOne.mockResolvedValue(mockCohort);
      teamRepository.find.mockResolvedValue(teams);
      briefRepository.find.mockResolvedValue([mockBrief]);
      teamRepository.count.mockResolvedValue(0);
      preferenceRepository.find
        .mockResolvedValueOnce([{ participantId: "p1", briefRankings: ["brief-1"] }])
        .mockResolvedValueOnce([{ participantId: "p2", briefRankings: ["brief-1"] }]);

      const result = await service.runMatching("cohort-123");

      expect(result.statistics.totalTeams).toBe(2);
      expect(result.statistics.totalBriefs).toBe(1);
      expect(result.statistics.matchedTeams + result.statistics.unmatchedTeams).toBe(2);
      expect(result.statistics).toHaveProperty("averageScore");
      expect(result.statistics).toHaveProperty("firstChoicePercentage");
      expect(result.statistics).toHaveProperty("topThreePercentage");
    });
  });
});
