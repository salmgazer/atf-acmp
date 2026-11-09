import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { DataSource, MoreThan } from "typeorm";
import { Role } from "../../database/entities/user.entity";

export interface JwtPayload {
  sub: string;
  sid?: string;
  role: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedUser {
  id: string;
  sessionId: string;
  email: string;
  role: Role;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  isActive: boolean;
  participantId?: string;
  participantCode?: string;
  cohortId?: string;
  teamId?: string;
  mentorId?: string;
  organizationId?: string;
  mustChangePassword?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService, private readonly db: DataSource) {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), ignoreExpiration: false, secretOrKey: configService.getOrThrow<string>("jwt.secret") });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload.sub || !payload.sid) throw new UnauthorizedException("Please sign in again");
    const session = await this.db.getRepository("RefreshToken").findOne({ where: { id: payload.sid, isRevoked: false, expiresAt: MoreThan(new Date()) } });
    const participant = payload.role === Role.PARTICIPANT;
    if (!session || (participant ? session.participantId : session.userId) !== payload.sub) throw new UnauthorizedException("Session has ended");
    const account = await this.db.getRepository(participant ? "Participant" : "User").findOne({ where: { id: payload.sub }, ...(participant ? { relations: ["cohort"] } : {}) });
    if (!account || (participant ? account.status === "inactive" || account.programmeOptedOut : !account.isActive)) throw new UnauthorizedException("Account is deactivated");
    const principal: AuthenticatedUser = {
      id: account.id, sessionId: session.id, email: account.email,
      role: participant ? Role.PARTICIPANT : account.role,
      firstName: account.firstName, lastName: account.lastName,
      avatarUrl: account.avatarUrl || account.profileImageUrl,
      mustChangePassword: account.mustChangePassword, isActive: true,
    };
    let cohort = account.cohort;
    if (participant) {
      principal.participantId = account.id;
      principal.participantCode = account.participantId;
      principal.cohortId = account.cohortId;
      const membership = await this.db.getRepository("TeamMember").findOne({ where: { participantId: account.id, status: "confirmed" } });
      principal.teamId = membership?.teamId;
    } else if (account.role === Role.MENTOR) {
      const mentor = await this.db.getRepository("Mentor").findOne({ where: { email: account.email }, relations: ["cohort"] });
      if (!mentor || mentor.status === "inactive") throw new UnauthorizedException("Mentor is not active");
      principal.mentorId = mentor.id;
      principal.cohortId = mentor.cohortId;
      cohort = mentor.cohort;
    } else if (account.role === Role.ORGANIZATION) {
      const link = await this.db.getRepository("OrganizationUser").findOne({ where: { userId: account.id } });
      const org = await this.db.getRepository("Organization").findOne({ where: link ? { id: link.organizationId } : { email: account.email }, relations: ["cohort"] });
      if (!org || !org.isActive || org.status !== "approved") throw new UnauthorizedException("Organization is not approved and active");
      principal.organizationId = org.id;
      principal.cohortId = org.cohortId;
      cohort = org.cohort;
    }
    if (cohort && ["draft", "archived"].includes(cohort.status)) throw new UnauthorizedException("COHORT_NOT_ACCESSIBLE: Your cohort is no longer accessible");
    return principal;
  }
}
