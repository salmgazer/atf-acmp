import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";
import { Role } from "../../database/entities/user.entity";
import { ROLES_KEY } from "../../common/decorators/roles.decorator";

describe("RolesGuard", () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  const createMockExecutionContext = (user: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new RolesGuard(reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("canActivate", () => {
    describe("when no roles are required", () => {
      it("should allow access when requiredRoles is null", () => {
        reflector.getAllAndOverride.mockReturnValue(null);
        const context = createMockExecutionContext({ role: Role.VIEWER });

        const result = guard.canActivate(context);

        expect(result).toBe(true);
      });

      it("should allow access when requiredRoles is empty array", () => {
        reflector.getAllAndOverride.mockReturnValue([]);
        const context = createMockExecutionContext({ role: Role.VIEWER });

        const result = guard.canActivate(context);

        expect(result).toBe(true);
      });

      it("should allow access when requiredRoles is undefined", () => {
        reflector.getAllAndOverride.mockReturnValue(undefined);
        const context = createMockExecutionContext({ role: Role.PARTICIPANT });

        const result = guard.canActivate(context);

        expect(result).toBe(true);
      });
    });

    describe("when user is not authenticated", () => {
      it("should throw ForbiddenException when user is null", () => {
        reflector.getAllAndOverride.mockReturnValue([Role.SUPER_ADMIN]);
        const context = createMockExecutionContext(null);

        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
        expect(() => guard.canActivate(context)).toThrow("Access denied");
      });

      it("should throw ForbiddenException when user is undefined", () => {
        reflector.getAllAndOverride.mockReturnValue([Role.SUPER_ADMIN]);
        const context = createMockExecutionContext(undefined);

        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      });
    });

    describe("when checking single role requirement", () => {
      it("should allow SUPER_ADMIN to access SUPER_ADMIN route", () => {
        reflector.getAllAndOverride.mockReturnValue([Role.SUPER_ADMIN]);
        const context = createMockExecutionContext({ role: Role.SUPER_ADMIN });

        const result = guard.canActivate(context);

        expect(result).toBe(true);
      });

      it("should allow PROGRAM_MANAGER to access PROGRAM_MANAGER route", () => {
        reflector.getAllAndOverride.mockReturnValue([Role.PROGRAM_MANAGER]);
        const context = createMockExecutionContext({ role: Role.PROGRAM_MANAGER });

        const result = guard.canActivate(context);

        expect(result).toBe(true);
      });

      it("should allow EVALUATOR to access EVALUATOR route", () => {
        reflector.getAllAndOverride.mockReturnValue([Role.EVALUATOR]);
        const context = createMockExecutionContext({ role: Role.EVALUATOR });

        const result = guard.canActivate(context);

        expect(result).toBe(true);
      });

      it("should deny VIEWER access to SUPER_ADMIN route", () => {
        reflector.getAllAndOverride.mockReturnValue([Role.SUPER_ADMIN]);
        const context = createMockExecutionContext({ role: Role.VIEWER });

        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
        expect(() => guard.canActivate(context)).toThrow(/Required role: super_admin/);
      });

      it("should deny PARTICIPANT access to PROGRAM_MANAGER route", () => {
        reflector.getAllAndOverride.mockReturnValue([Role.PROGRAM_MANAGER]);
        const context = createMockExecutionContext({ role: Role.PARTICIPANT });

        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      });
    });

    describe("when checking multiple roles requirement", () => {
      it("should allow access if user has any of the required roles", () => {
        reflector.getAllAndOverride.mockReturnValue([
          Role.SUPER_ADMIN,
          Role.PROGRAM_MANAGER,
        ]);
        const context = createMockExecutionContext({ role: Role.PROGRAM_MANAGER });

        const result = guard.canActivate(context);

        expect(result).toBe(true);
      });

      it("should allow SUPER_ADMIN access when SUPER_ADMIN or EVALUATOR required", () => {
        reflector.getAllAndOverride.mockReturnValue([
          Role.SUPER_ADMIN,
          Role.EVALUATOR,
        ]);
        const context = createMockExecutionContext({ role: Role.SUPER_ADMIN });

        const result = guard.canActivate(context);

        expect(result).toBe(true);
      });

      it("should deny access if user has none of the required roles", () => {
        reflector.getAllAndOverride.mockReturnValue([
          Role.SUPER_ADMIN,
          Role.PROGRAM_MANAGER,
        ]);
        const context = createMockExecutionContext({ role: Role.PARTICIPANT });

        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
        expect(() => guard.canActivate(context)).toThrow(
          /Required role: super_admin or program_manager/
        );
      });
    });

    describe("role-specific access tests", () => {
      const allRoles = [
        Role.SUPER_ADMIN,
        Role.PROGRAM_MANAGER,
        Role.EVALUATOR,
        Role.VIEWER,
        Role.ORGANIZATION,
        Role.PARTICIPANT,
        Role.MENTOR,
      ];

      it.each(allRoles)("should allow %s to access their own role route", (role) => {
        reflector.getAllAndOverride.mockReturnValue([role]);
        const context = createMockExecutionContext({ role });

        const result = guard.canActivate(context);

        expect(result).toBe(true);
      });

      it("should allow staff roles (SUPER_ADMIN, PROGRAM_MANAGER, EVALUATOR) to staff routes", () => {
        const staffRoles = [Role.SUPER_ADMIN, Role.PROGRAM_MANAGER, Role.EVALUATOR];
        reflector.getAllAndOverride.mockReturnValue(staffRoles);

        for (const role of staffRoles) {
          const context = createMockExecutionContext({ role });
          expect(guard.canActivate(context)).toBe(true);
        }
      });

      it("should deny non-staff roles from staff routes", () => {
        const staffRoles = [Role.SUPER_ADMIN, Role.PROGRAM_MANAGER, Role.EVALUATOR];
        const nonStaffRoles = [Role.VIEWER, Role.ORGANIZATION, Role.PARTICIPANT, Role.MENTOR];
        reflector.getAllAndOverride.mockReturnValue(staffRoles);

        for (const role of nonStaffRoles) {
          const context = createMockExecutionContext({ role });
          expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
        }
      });
    });

    describe("reflector interaction", () => {
      it("should call reflector with correct parameters", () => {
        const mockHandler = jest.fn();
        const mockClass = jest.fn();
        reflector.getAllAndOverride.mockReturnValue([Role.SUPER_ADMIN]);

        const context = {
          switchToHttp: () => ({
            getRequest: () => ({ user: { role: Role.SUPER_ADMIN } }),
          }),
          getHandler: () => mockHandler,
          getClass: () => mockClass,
        } as unknown as ExecutionContext;

        guard.canActivate(context);

        expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
          mockHandler,
          mockClass,
        ]);
      });
    });

    describe("error messages", () => {
      it("should include single required role in error message", () => {
        reflector.getAllAndOverride.mockReturnValue([Role.SUPER_ADMIN]);
        const context = createMockExecutionContext({ role: Role.PARTICIPANT });

        try {
          guard.canActivate(context);
          fail("Should have thrown ForbiddenException");
        } catch (error) {
          expect(error).toBeInstanceOf(ForbiddenException);
          expect(error.message).toContain("super_admin");
        }
      });

      it("should include multiple required roles in error message with 'or'", () => {
        reflector.getAllAndOverride.mockReturnValue([
          Role.SUPER_ADMIN,
          Role.PROGRAM_MANAGER,
          Role.EVALUATOR,
        ]);
        const context = createMockExecutionContext({ role: Role.PARTICIPANT });

        try {
          guard.canActivate(context);
          fail("Should have thrown ForbiddenException");
        } catch (error) {
          expect(error).toBeInstanceOf(ForbiddenException);
          expect(error.message).toContain("super_admin");
          expect(error.message).toContain("or");
        }
      });
    });
  });
});
