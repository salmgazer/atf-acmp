import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { GitHubAnalysis } from "@/database/entities/github-analysis.entity";
import { GitHubService } from "./github.service";
import { GitHubAnalysisService } from "./github-analysis.service";
import { GitHubController, AdminGitHubController } from "./github.controller";

@Module({
  imports: [TypeOrmModule.forFeature([GitHubAnalysis])],
  controllers: [GitHubController, AdminGitHubController],
  providers: [GitHubService, GitHubAnalysisService],
  exports: [GitHubService, GitHubAnalysisService],
})
export class GitHubModule {}
