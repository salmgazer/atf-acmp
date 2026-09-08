import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "../../database/entities/user.entity";
import { ROLES_KEY } from "../../common/decorators/roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException("Access denied");
    }

    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      throw new ForbiddenException(`Access denied. Required role: ${requiredRoles.join(" or ")}`);
    }

    return true;
  }
}
