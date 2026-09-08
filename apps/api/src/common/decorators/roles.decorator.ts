import { SetMetadata } from "@nestjs/common";
import { Role } from "../../database/entities/user.entity";

export const ROLES_KEY = "roles";

/**
 * Restrict route access to specific roles
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
