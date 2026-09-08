import { Test, TestingModule } from "@nestjs/testing";
import { Repository, ObjectLiteral } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";

/**
 * Creates a mock repository with common methods
 */
export function createMockRepository<T extends ObjectLiteral>(): jest.Mocked<Repository<T>> {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    findAndCount: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
    softRemove: jest.fn(),
    createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
    manager: {
      transaction: jest.fn((cb) => cb({
        save: jest.fn(),
        findOne: jest.fn(),
      })),
    },
  } as unknown as jest.Mocked<Repository<T>>;
}

/**
 * Creates a mock query builder
 */
export function createMockQueryBuilder() {
  const qb: any = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getMany: jest.fn(),
    getManyAndCount: jest.fn(),
    getCount: jest.fn(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
    execute: jest.fn(),
    setParameter: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
  };
  return qb;
}

/**
 * Creates a mock ConfigService
 */
export function createMockConfigService(config: Record<string, any> = {}) {
  return {
    get: jest.fn((key: string, defaultValue?: any) => {
      const keys = key.split(".");
      let value: any = config;
      for (const k of keys) {
        value = value?.[k];
      }
      return value ?? defaultValue;
    }),
  };
}

/**
 * Creates a mock JwtService
 */
export function createMockJwtService() {
  return {
    sign: jest.fn().mockReturnValue("mock-jwt-token"),
    verify: jest.fn().mockReturnValue({ sub: "user-id", email: "test@example.com" }),
    decode: jest.fn().mockReturnValue({ sub: "user-id", email: "test@example.com" }),
  };
}

/**
 * Test user factory
 */
export function createTestUser(overrides: Partial<any> = {}) {
  return {
    id: "test-user-id",
    email: "test@example.com",
    role: "participant",
    firstName: "Test",
    lastName: "User",
    isActive: true,
    mustChangePassword: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Test cohort factory
 */
export function createTestCohort(overrides: Partial<any> = {}) {
  return {
    id: "test-cohort-id",
    name: "Test Cohort 2024",
    status: "active",
    teamSizeMin: 3,
    teamSizeMax: 5,
    countries: ["SA", "AE", "EG"],
    verticals: [],
    deadlines: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Test team factory
 */
export function createTestTeam(overrides: Partial<any> = {}) {
  return {
    id: "test-team-id",
    name: "Test Team",
    status: "active",
    cohortId: "test-cohort-id",
    inviteCode: "ABC123",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Test participant factory
 */
export function createTestParticipant(overrides: Partial<any> = {}) {
  return {
    id: "test-participant-id",
    participantId: "PART001",
    email: "participant@example.com",
    firstName: "Test",
    lastName: "Participant",
    country: "SA",
    institution: "Test University",
    onboardingComplete: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Helper to provide mock repositories in test module
 */
export function provideMockRepository<T extends ObjectLiteral>(
  entity: new () => T,
  mockRepo?: jest.Mocked<Repository<T>>
) {
  return {
    provide: getRepositoryToken(entity),
    useValue: mockRepo || createMockRepository<T>(),
  };
}
