import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { CohortsService } from "./cohorts.service";
import { Cohort, CohortStatus } from "../../database/entities/cohort.entity";
import {
  createMockRepository,
  createMockQueryBuilder,
  createTestCohort,
} from "../../../test/utils/test-utils";

describe("CohortsService", () => {
  let service: CohortsService;
  let cohortRepository: ReturnType<typeof createMockRepository>;

  const mockCohort = createTestCohort({
    id: "cohort-123",
    name: "Test Cohort 2024",
    status: CohortStatus.DRAFT,
    teamSizeMin: 3,
    teamSizeMax: 5,
    countries: ["SA", "AE", "EG"],
  });

  beforeEach(async () => {
    cohortRepository = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CohortsService,
        { provide: getRepositoryToken(Cohort), useValue: cohortRepository },
      ],
    }).compile();

    service = module.get<CohortsService>(CohortsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a new cohort with DRAFT status", async () => {
      const createDto = {
        name: "New Cohort",
        teamSizeMin: 3,
        teamSizeMax: 5,
      };
      cohortRepository.create.mockReturnValue({ ...mockCohort, ...createDto });
      cohortRepository.save.mockResolvedValue({ ...mockCohort, ...createDto });

      const result = await service.create(createDto);

      expect(result.name).toBe("New Cohort");
      expect(cohortRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New Cohort",
          status: CohortStatus.DRAFT,
        })
      );
    });

    it("should throw BadRequestException if minSize > maxSize", async () => {
      const createDto = {
        name: "Invalid Cohort",
        teamSizeMin: 10,
        teamSizeMax: 5,
      };

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
    });

    it("should set default values for optional fields", async () => {
      const createDto = { name: "Minimal Cohort" };
      cohortRepository.create.mockReturnValue({ name: "Minimal Cohort", status: CohortStatus.DRAFT });
      cohortRepository.save.mockResolvedValue({ name: "Minimal Cohort", status: CohortStatus.DRAFT });

      await service.create(createDto);

      expect(cohortRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          deadlines: {},
          countries: [],
          verticals: [],
        })
      );
    });
  });

  describe("findAll", () => {
    it("should return paginated cohorts", async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.getCount.mockResolvedValue(25);
      mockQueryBuilder.getMany.mockResolvedValue([mockCohort]);
      cohortRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(25);
      expect(result.meta.totalPages).toBe(3);
    });

    it("should filter by status when provided", async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.getCount.mockResolvedValue(5);
      mockQueryBuilder.getMany.mockResolvedValue([mockCohort]);
      cohortRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll({ status: CohortStatus.ACTIVE });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "cohort.status = :status",
        { status: CohortStatus.ACTIVE }
      );
    });
  });

  describe("findOne", () => {
    it("should return cohort by id", async () => {
      cohortRepository.findOne.mockResolvedValue(mockCohort);

      const result = await service.findOne("cohort-123");

      expect(result).toEqual(mockCohort);
    });

    it("should throw NotFoundException if cohort not found", async () => {
      cohortRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne("non-existent")).rejects.toThrow(NotFoundException);
    });
  });

  describe("findActive", () => {
    it("should return active cohort", async () => {
      const activeCohort = { ...mockCohort, status: CohortStatus.ACTIVE };
      cohortRepository.findOne.mockResolvedValue(activeCohort);

      const result = await service.findActive();

      expect(result?.status).toBe(CohortStatus.ACTIVE);
      expect(cohortRepository.findOne).toHaveBeenCalledWith({
        where: { status: CohortStatus.ACTIVE },
      });
    });

    it("should return null if no active cohort", async () => {
      cohortRepository.findOne.mockResolvedValue(null);

      const result = await service.findActive();

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("should update cohort", async () => {
      cohortRepository.findOne.mockResolvedValue(mockCohort);
      cohortRepository.save.mockResolvedValue({ ...mockCohort, name: "Updated Name" });

      const result = await service.update("cohort-123", { name: "Updated Name" });

      expect(result.name).toBe("Updated Name");
    });

    it("should throw BadRequestException if updated minSize > maxSize", async () => {
      cohortRepository.findOne.mockResolvedValue(mockCohort);

      await expect(
        service.update("cohort-123", { teamSizeMin: 10 })
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw NotFoundException if cohort not found", async () => {
      cohortRepository.findOne.mockResolvedValue(null);

      await expect(service.update("non-existent", { name: "New" })).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("updateStatus", () => {
    it("should transition from DRAFT to ACTIVE", async () => {
      cohortRepository.findOne
        .mockResolvedValueOnce({ ...mockCohort, status: CohortStatus.DRAFT })
        .mockResolvedValueOnce(null); // No other active cohort
      cohortRepository.save.mockResolvedValue({ ...mockCohort, status: CohortStatus.ACTIVE });

      const result = await service.updateStatus("cohort-123", CohortStatus.ACTIVE);

      expect(result.status).toBe(CohortStatus.ACTIVE);
    });

    it("should transition from ACTIVE to EVALUATION", async () => {
      cohortRepository.findOne.mockResolvedValue({ ...mockCohort, status: CohortStatus.ACTIVE });
      cohortRepository.save.mockResolvedValue({ ...mockCohort, status: CohortStatus.EVALUATION });

      const result = await service.updateStatus("cohort-123", CohortStatus.EVALUATION);

      expect(result.status).toBe(CohortStatus.EVALUATION);
    });

    it("should throw BadRequestException for invalid transition", async () => {
      cohortRepository.findOne.mockResolvedValue({ ...mockCohort, status: CohortStatus.DRAFT });

      await expect(
        service.updateStatus("cohort-123", CohortStatus.COMPLETED)
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw ConflictException if another cohort is already active", async () => {
      cohortRepository.findOne
        .mockResolvedValueOnce({ ...mockCohort, status: CohortStatus.DRAFT })
        .mockResolvedValueOnce({ id: "other-cohort", name: "Other Active" }); // Another active cohort exists

      await expect(
        service.updateStatus("cohort-123", CohortStatus.ACTIVE)
      ).rejects.toThrow(ConflictException);
    });

    it("should not allow transition from ARCHIVED", async () => {
      cohortRepository.findOne.mockResolvedValue({ ...mockCohort, status: CohortStatus.ARCHIVED });

      await expect(
        service.updateStatus("cohort-123", CohortStatus.ACTIVE)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("remove", () => {
    it("should soft delete DRAFT cohort", async () => {
      cohortRepository.findOne.mockResolvedValue({ ...mockCohort, status: CohortStatus.DRAFT });
      cohortRepository.softRemove.mockResolvedValue(mockCohort);

      await service.remove("cohort-123");

      expect(cohortRepository.softRemove).toHaveBeenCalled();
    });

    it("should throw BadRequestException for non-DRAFT cohorts", async () => {
      cohortRepository.findOne.mockResolvedValue({ ...mockCohort, status: CohortStatus.ACTIVE });

      await expect(service.remove("cohort-123")).rejects.toThrow(BadRequestException);
    });
  });

  describe("duplicate", () => {
    it("should create a copy of cohort with new name", async () => {
      cohortRepository.findOne.mockResolvedValue(mockCohort);
      cohortRepository.create.mockReturnValue({ ...mockCohort, id: "new-id", name: "Cohort Copy" });
      cohortRepository.save.mockResolvedValue({ ...mockCohort, id: "new-id", name: "Cohort Copy" });

      const result = await service.duplicate("cohort-123", "Cohort Copy");

      expect(result.name).toBe("Cohort Copy");
      expect(result.id).not.toBe("cohort-123");
      expect(cohortRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Cohort Copy",
          status: CohortStatus.DRAFT,
          deadlines: {}, // Reset deadlines
        })
      );
    });

    it("should throw NotFoundException if source cohort not found", async () => {
      cohortRepository.findOne.mockResolvedValue(null);

      await expect(service.duplicate("non-existent", "Copy")).rejects.toThrow(NotFoundException);
    });
  });

  describe("getStatistics", () => {
    it("should return statistics for existing cohort", async () => {
      cohortRepository.findOne.mockResolvedValue(mockCohort);

      const result = await service.getStatistics("cohort-123");

      expect(result).toHaveProperty("participantCount");
      expect(result).toHaveProperty("teamCount");
      expect(result).toHaveProperty("briefCount");
      expect(result).toHaveProperty("organizationCount");
    });

    it("should throw NotFoundException if cohort not found", async () => {
      cohortRepository.findOne.mockResolvedValue(null);

      await expect(service.getStatistics("non-existent")).rejects.toThrow(NotFoundException);
    });
  });
});
