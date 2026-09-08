import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { TeamsService } from "./teams.service";
import { Team, TeamStatus, TeamRole, TeamMember, TeamInvitation } from "@/database/entities/team.entity";
import { Participant, ParticipantStatus } from "@/database/entities/participant.entity";
import { Cohort } from "@/database/entities/cohort.entity";
import { Brief } from "@/database/entities/brief.entity";
import {
  createMockRepository,
  createMockQueryBuilder,
  createTestTeam,
  createTestCohort,
  createTestParticipant,
} from "../../../test/utils/test-utils";

describe("TeamsService", () => {
  let service: TeamsService;
  let teamRepository: ReturnType<typeof createMockRepository>;
  let memberRepository: ReturnType<typeof createMockRepository>;
  let invitationRepository: ReturnType<typeof createMockRepository>;
  let participantRepository: ReturnType<typeof createMockRepository>;
  let cohortRepository: ReturnType<typeof createMockRepository>;
  let briefRepository: ReturnType<typeof createMockRepository>;

  const mockCohort = createTestCohort({
    id: "cohort-123",
    name: "Test Cohort",
    teamSizeMin: 3,
    teamSizeMax: 5,
  });

  const mockParticipant = createTestParticipant({
    id: "participant-123",
    cohortId: "cohort-123",
    email: "participant@example.com",
  });

  const mockTeam = createTestTeam({
    id: "team-123",
    name: "Test Team",
    cohortId: "cohort-123",
    status: TeamStatus.FORMING,
    inviteCode: "ABC123",
    members: [],
  });

  beforeEach(async () => {
    teamRepository = createMockRepository();
    memberRepository = createMockRepository();
    invitationRepository = createMockRepository();
    participantRepository = createMockRepository();
    cohortRepository = createMockRepository();
    briefRepository = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: getRepositoryToken(Team), useValue: teamRepository },
        { provide: getRepositoryToken(TeamMember), useValue: memberRepository },
        { provide: getRepositoryToken(TeamInvitation), useValue: invitationRepository },
        { provide: getRepositoryToken(Participant), useValue: participantRepository },
        { provide: getRepositoryToken(Cohort), useValue: cohortRepository },
        { provide: getRepositoryToken(Brief), useValue: briefRepository },
      ],
    }).compile();

    service = module.get<TeamsService>(TeamsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a team with creator as lead", async () => {
      cohortRepository.findOne.mockResolvedValue(mockCohort);
      participantRepository.findOne.mockResolvedValue(mockParticipant);
      memberRepository.findOne.mockResolvedValue(null); // Not in any team
      teamRepository.create.mockReturnValue(mockTeam);
      teamRepository.save.mockResolvedValue(mockTeam);
      memberRepository.create.mockReturnValue({
        teamId: "team-123",
        participantId: "participant-123",
        role: TeamRole.LEAD,
      });
      memberRepository.save.mockResolvedValue({});
      participantRepository.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });

      // For findOne after creation
      teamRepository.findOne.mockResolvedValue({
        ...mockTeam,
        members: [{ participantId: "participant-123", role: TeamRole.LEAD }],
      });

      const result = await service.create({
        name: "New Team",
        cohortId: "cohort-123",
        creatorId: "participant-123",
      });

      expect(result.name).toBe("Test Team");
      expect(teamRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New Team",
          cohortId: "cohort-123",
          status: TeamStatus.FORMING,
        })
      );
      expect(memberRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: TeamRole.LEAD,
        })
      );
    });

    it("should throw NotFoundException if cohort not found", async () => {
      cohortRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create({
          name: "New Team",
          cohortId: "non-existent",
          creatorId: "participant-123",
        })
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException if participant not in cohort", async () => {
      cohortRepository.findOne.mockResolvedValue(mockCohort);
      participantRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create({
          name: "New Team",
          cohortId: "cohort-123",
          creatorId: "non-existent",
        })
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ConflictException if participant already in a team", async () => {
      cohortRepository.findOne.mockResolvedValue(mockCohort);
      participantRepository.findOne.mockResolvedValue(mockParticipant);
      memberRepository.findOne.mockResolvedValue({
        teamId: "existing-team",
        team: { id: "existing-team" },
      });

      await expect(
        service.create({
          name: "New Team",
          cohortId: "cohort-123",
          creatorId: "participant-123",
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("findAll", () => {
    it("should return paginated teams", async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockTeam], 1]);
      teamRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("should filter by cohortId", async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      teamRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll({ cohortId: "cohort-123" });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "team.cohortId = :cohortId",
        { cohortId: "cohort-123" }
      );
    });

    it("should filter by status", async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      teamRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll({ status: TeamStatus.ACTIVE });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "team.status = :status",
        { status: TeamStatus.ACTIVE }
      );
    });

    it("should search by team name", async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      teamRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll({ search: "test" });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "LOWER(team.name) LIKE :search",
        { search: "%test%" }
      );
    });
  });

  describe("findOne", () => {
    it("should return team with relations", async () => {
      teamRepository.findOne.mockResolvedValue({
        ...mockTeam,
        members: [],
        brief: null,
      });

      const result = await service.findOne("team-123");

      expect(result.id).toBe("team-123");
      expect(teamRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "team-123" },
        })
      );
    });

    it("should throw NotFoundException if team not found", async () => {
      teamRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne("non-existent")).rejects.toThrow(NotFoundException);
    });
  });

  describe("findByInviteCode", () => {
    it("should return team by invite code", async () => {
      teamRepository.findOne.mockResolvedValue(mockTeam);

      const result = await service.findByInviteCode("ABC123");

      expect(result.inviteCode).toBe("ABC123");
    });

    it("should throw NotFoundException for invalid invite code", async () => {
      teamRepository.findOne.mockResolvedValue(null);

      await expect(service.findByInviteCode("INVALID")).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("should update team", async () => {
      teamRepository.findOne.mockResolvedValue(mockTeam);
      teamRepository.save.mockResolvedValue({ ...mockTeam, name: "Updated Team" });

      const result = await service.update("team-123", { name: "Updated Team" });

      expect(result.name).toBe("Updated Team");
    });

    it("should throw NotFoundException if team not found", async () => {
      teamRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update("non-existent", { name: "Updated" })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateStatus", () => {
    it("should update team status", async () => {
      teamRepository.findOne.mockResolvedValue(mockTeam);
      teamRepository.save.mockResolvedValue({ ...mockTeam, status: TeamStatus.ACTIVE });

      const result = await service.updateStatus("team-123", TeamStatus.ACTIVE);

      expect(result.status).toBe(TeamStatus.ACTIVE);
    });
  });

  describe("findParticipantTeam", () => {
    it("should return team for participant", async () => {
      memberRepository.findOne.mockResolvedValue({
        teamId: "team-123",
        team: mockTeam,
      });
      teamRepository.findOne.mockResolvedValue(mockTeam);

      const result = await service.findParticipantTeam("participant-123");

      expect(result?.id).toBe("team-123");
    });

    it("should return null if participant not in team", async () => {
      memberRepository.findOne.mockResolvedValue(null);

      const result = await service.findParticipantTeam("participant-123");

      expect(result).toBeNull();
    });
  });

  describe("getStatistics", () => {
    it("should return statistics for cohort teams", async () => {
      // Mock the count calls
      teamRepository.count
        .mockResolvedValueOnce(15) // total
        .mockResolvedValueOnce(5)  // forming
        .mockResolvedValueOnce(10) // active
        .mockResolvedValueOnce(0)  // submitted
        .mockResolvedValueOnce(0)  // evaluated
        .mockResolvedValueOnce(0)  // disqualified
        .mockResolvedValueOnce(8)  // withBrief
        .mockResolvedValueOnce(7); // withoutBrief

      // Mock teamRepository.createQueryBuilder for avgResult
      const teamQueryBuilder = createMockQueryBuilder();
      teamQueryBuilder.getRawOne.mockResolvedValue({ avg: "3.5" });
      teamRepository.createQueryBuilder.mockReturnValue(teamQueryBuilder);

      // Mock memberRepository.createQueryBuilder for memberCounts
      const memberQueryBuilder = createMockQueryBuilder();
      memberQueryBuilder.getRawMany.mockResolvedValue([
        { teamId: "team-1", count: "3" },
        { teamId: "team-2", count: "4" },
        { teamId: "team-3", count: "5" },
      ]);
      memberRepository.createQueryBuilder.mockReturnValue(memberQueryBuilder);

      const result = await service.getStatistics("cohort-123");

      expect(result.total).toBe(15);
      expect(result.forming).toBe(5);
      expect(result.active).toBe(10);
      expect(result.averageMembers).toBe(4);
    });
  });
});
