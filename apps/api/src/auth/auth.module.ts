import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { FirebaseService } from "./firebase.service";
import { MagicLinkService } from "./magic-link.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { User } from "../database/entities/user.entity";
import { VerificationCode } from "../database/entities/verification-code.entity";
import { RefreshToken } from "../database/entities/refresh-token.entity";
import { Participant } from "../database/entities/participant.entity";
import { TeamMember } from "../database/entities/team.entity";
import { Cohort } from "../database/entities/cohort.entity";
import { Organization } from "../database/entities/organization.entity";
import { Mentor } from "../database/entities/mentor.entity";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("jwt.secret") || "fallback-secret-change-in-production",
        signOptions: {
          expiresIn: "1h", // Access token expires in 1 hour
        },
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([User, VerificationCode, RefreshToken, Participant, TeamMember, Cohort, Organization, Mentor]),
  ],
  controllers: [AuthController],
  providers: [AuthService, FirebaseService, MagicLinkService, JwtStrategy],
  exports: [AuthService, FirebaseService, JwtModule],
})
export class AuthModule {}
