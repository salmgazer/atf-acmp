import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User, Role } from "../../database/entities/user.entity";
import { Participant, ParticipantStatus } from "../../database/entities/participant.entity";

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  participantId?: string; // For participant tokens
  cohortId?: string; // For participant tokens
  iat: number;
  exp: number;
}

// Extended user type that can be either User or a participant-like object
interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  participantId?: string;
  cohortId?: string;
  mustChangePassword?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Participant)
    private readonly participantRepository: Repository<Participant>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("jwt.secret") || "default-secret",
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // Check if this is a participant token
    if (payload.role === Role.PARTICIPANT && payload.participantId) {
      return this.validateParticipant(payload);
    }

    // Otherwise, look up in users table
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    if (!user.isActive) {
      throw new UnauthorizedException("Account is deactivated");
    }

    return user;
  }

  private async validateParticipant(payload: JwtPayload): Promise<AuthenticatedUser> {
    const participant = await this.participantRepository.findOne({
      where: { id: payload.sub },
    });

    if (!participant) {
      throw new UnauthorizedException("Participant not found");
    }

    // Check for inactive status - participant status is never "inactive", it would be deleted or have a different status
    // For now, all non-deleted participants are considered active
    const isActive = participant.status !== ParticipantStatus.IMPORTED || participant.firebaseUid !== null;

    // Return participant as an AuthenticatedUser
    // Note: participantId here is the UUID (participant.id), NOT the human-readable code (participant.participantId)
    return {
      id: participant.id,
      email: participant.email,
      role: Role.PARTICIPANT,
      firstName: participant.firstName,
      lastName: participant.lastName,
      isActive: true, // If participant exists and is not deleted, they're active
      participantId: participant.id, // Use UUID, not the human-readable participantId code
      cohortId: participant.cohortId,
      mustChangePassword: participant.mustChangePassword,
    };
  }
}
