import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { EmailModule } from "./email/email.module";
import { HealthModule } from "./health/health.module";
import { UsersModule } from "./modules/users/users.module";
import { CohortsModule } from "./modules/cohorts/cohorts.module";
import { VerticalsModule } from "./modules/verticals/verticals.module";
import { TeamsModule } from "./modules/teams/teams.module";
import { BriefsModule } from "./modules/briefs/briefs.module";
import { ParticipantsModule } from "./modules/participants/participants.module";
import { MentorsModule } from "./modules/mentors/mentors.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { MatchingModule } from "./modules/matching/matching.module";
import { ChatModule } from "./modules/chat/chat.module";
import { ForumModule } from "./modules/forum/forum.module";
import { SubmissionsModule } from "./modules/submissions/submissions.module";
import { GitHubModule } from "./modules/github/github.module";
import { JournalsModule } from "./modules/journals/journals.module";
import { ResourcesModule } from "./modules/resources/resources.module";
import { PeerReviewsModule } from "./modules/peer-reviews/peer-reviews.module";
import { EvaluationsModule } from "./modules/evaluations/evaluations.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { LeaderboardModule } from "./modules/leaderboard/leaderboard.module";
import { CertificatesModule } from "./modules/certificates/certificates.module";
import { AnnouncementsModule } from "./modules/announcements/announcements.module";
import { SetupModule } from "./modules/setup/setup.module";
import { AuditModule } from "./modules/audit/audit.module";
import { UploadModule } from "./common/services/upload.module";
import { GlobalExceptionFilter } from "./common/filters/http-exception.filter";
import configuration from "./config/configuration";
import { dataSourceOptions } from "./database/data-source";

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Rate limiting - default 100 requests per minute
    ThrottlerModule.forRoot([
      {
        name: "short",
        ttl: 1000, // 1 second
        limit: 10, // 10 requests per second
      },
      {
        name: "medium",
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
      {
        name: "long",
        ttl: 3600000, // 1 hour
        limit: 1000, // 1000 requests per hour
      },
    ]),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => dataSourceOptions,
      inject: [ConfigService],
    }),

    // Core modules
    EmailModule,
    HealthModule,

    // Feature modules
    AuthModule,
    UsersModule,
    CohortsModule,
    VerticalsModule,
    TeamsModule,
    BriefsModule,
    ParticipantsModule,
    MentorsModule,
    OrganizationsModule,
    NotificationsModule,
    MatchingModule,
    ChatModule,
    ForumModule,
    SubmissionsModule,
    GitHubModule,
    JournalsModule,
    ResourcesModule,
    PeerReviewsModule,
    EvaluationsModule,
    DashboardModule,
    LeaderboardModule,
    CertificatesModule,
    AnnouncementsModule,
    SetupModule,
    AuditModule,
    UploadModule,
  ],
  providers: [
    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
