import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Team, TeamStatus } from "@/database/entities/team.entity";
import { Participant } from "@/database/entities/participant.entity";
import { Mentor } from "@/database/entities/mentor.entity";
import { Organization } from "@/database/entities/organization.entity";
import { Brief } from "@/database/entities/brief.entity";
import { Submission, Stage, SubmissionStatus } from "@/database/entities/stage.entity";
import { Evaluation } from "@/database/entities/evaluation.entity";
import { Vertical } from "@/database/entities/vertical.entity";
import {
  DashboardQueryDto,
  OverviewMetrics,
  TeamStatistics,
  SubmissionStatistics,
  EvaluationStatistics,
  PerformanceHeatmap,
} from "./dto/dashboard.dto";

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Team)
    private teamRepo: Repository<Team>,
    @InjectRepository(Participant)
    private participantRepo: Repository<Participant>,
    @InjectRepository(Mentor)
    private mentorRepo: Repository<Mentor>,
    @InjectRepository(Organization)
    private organizationRepo: Repository<Organization>,
    @InjectRepository(Brief)
    private briefRepo: Repository<Brief>,
    @InjectRepository(Submission)
    private submissionRepo: Repository<Submission>,
    @InjectRepository(Stage)
    private stageRepo: Repository<Stage>,
    @InjectRepository(Evaluation)
    private evaluationRepo: Repository<Evaluation>,
    @InjectRepository(Vertical)
    private verticalRepo: Repository<Vertical>,
  ) {}

  async getOverview(query: DashboardQueryDto): Promise<OverviewMetrics> {
    const { cohortId, verticalId, country } = query;

    // Build team query with filters
    const teamQb = this.teamRepo
      .createQueryBuilder("team")
      .leftJoin("team.brief", "brief")
      .where("team.cohortId = :cohortId", { cohortId });

    if (verticalId) {
      teamQb.andWhere("brief.verticalId = :verticalId", { verticalId });
    }

    const teams = await teamQb.getMany();

    // Filter by country if needed (through participants)
    let filteredTeamIds = teams.map((t) => t.id);
    if (country && filteredTeamIds.length > 0) {
      const teamsWithCountry = await this.participantRepo
        .createQueryBuilder("p")
        .select("DISTINCT p.teamId", "teamId")
        .where("p.teamId IN (:...teamIds)", { teamIds: filteredTeamIds })
        .andWhere("p.country = :country", { country })
        .getRawMany();
      filteredTeamIds = teamsWithCountry.map((t) => t.teamId);
    }

    const filteredTeams = teams.filter((t) => filteredTeamIds.includes(t.id));

    // Count by status
    const activeTeams = filteredTeams.filter((t) => t.status === TeamStatus.ACTIVE).length;
    const submittedTeams = filteredTeams.filter((t) => t.status === TeamStatus.SUBMITTED).length;
    const evaluatedTeams = filteredTeams.filter((t) => t.status === TeamStatus.EVALUATED).length;
    const disqualifiedTeams = filteredTeams.filter((t) => t.status === TeamStatus.DISQUALIFIED).length;

    // Participants count
    const participantCount = await this.participantRepo.count({
      where: { cohortId },
    });

    // Mentors count (mentors don't have cohortId, count all)
    const mentorCount = await this.mentorRepo.count();

    // Organizations count (organizations don't have cohortId directly)
    const orgCount = await this.briefRepo
      .createQueryBuilder("brief")
      .select("COUNT(DISTINCT brief.organizationId)", "count")
      .where("brief.cohortId = :cohortId", { cohortId })
      .getRawOne()
      .then((r) => Number(r?.count || 0));

    // Calculate rates
    const totalTeams = filteredTeams.length;
    const submissionRate = totalTeams > 0 ? ((submittedTeams + evaluatedTeams) / totalTeams) * 100 : 0;
    const dropoutRate = totalTeams > 0 ? (disqualifiedTeams / totalTeams) * 100 : 0;

    // Average team size
    let avgTeamSize = 0;
    if (filteredTeamIds.length > 0) {
      const teamSizes = await this.participantRepo
        .createQueryBuilder("p")
        .select("p.teamId", "teamId")
        .addSelect("COUNT(*)", "size")
        .where("p.teamId IN (:...teamIds)", { teamIds: filteredTeamIds })
        .groupBy("p.teamId")
        .getRawMany();

      avgTeamSize =
        teamSizes.length > 0
          ? teamSizes.reduce((sum, t) => sum + Number(t.size), 0) / teamSizes.length
          : 0;
    }

    return {
      totalTeams,
      activeTeams,
      submittedTeams,
      evaluatedTeams,
      disqualifiedTeams,
      totalParticipants: participantCount,
      totalMentors: mentorCount,
      totalOrganizations: orgCount,
      submissionRate: Math.round(submissionRate * 10) / 10,
      averageTeamSize: Math.round(avgTeamSize * 10) / 10,
      dropoutRate: Math.round(dropoutRate * 10) / 10,
    };
  }

  async getTeamStatistics(query: DashboardQueryDto): Promise<TeamStatistics> {
    const { cohortId, verticalId, country, startDate, endDate } = query;

    // Get all teams for cohort with brief relation
    const teamQb = this.teamRepo
      .createQueryBuilder("team")
      .leftJoinAndSelect("team.brief", "brief")
      .where("team.cohortId = :cohortId", { cohortId });

    if (verticalId) {
      teamQb.andWhere("brief.verticalId = :verticalId", { verticalId });
    }

    const teams = await teamQb.getMany();
    let filteredTeamIds = teams.map((t) => t.id);

    // Filter by country through participants
    if (country && filteredTeamIds.length > 0) {
      const teamsWithCountry = await this.participantRepo
        .createQueryBuilder("p")
        .select("DISTINCT p.teamId", "teamId")
        .where("p.teamId IN (:...teamIds)", { teamIds: filteredTeamIds })
        .andWhere("p.country = :country", { country })
        .getRawMany();
      filteredTeamIds = teamsWithCountry.map((t) => t.teamId);
    }

    const filteredTeams = teams.filter((t) => filteredTeamIds.includes(t.id));

    // By Status
    const byStatus = {
      forming: filteredTeams.filter((t) => t.status === TeamStatus.FORMING).length,
      active: filteredTeams.filter((t) => t.status === TeamStatus.ACTIVE).length,
      submitted: filteredTeams.filter((t) => t.status === TeamStatus.SUBMITTED).length,
      evaluated: filteredTeams.filter((t) => t.status === TeamStatus.EVALUATED).length,
      disqualified: filteredTeams.filter((t) => t.status === TeamStatus.DISQUALIFIED).length,
    };

    // By Vertical (through briefs)
    const verticals = await this.verticalRepo.find({ where: { cohortId } });
    const byVertical = verticals.map((v) => {
      const count = filteredTeams.filter((t) => t.brief?.verticalId === v.id).length;
      return {
        verticalId: v.id,
        verticalName: v.name,
        count,
        percentage: filteredTeams.length > 0 ? Math.round((count / filteredTeams.length) * 1000) / 10 : 0,
      };
    });

    // By Country
    let byCountry: Array<{ country: string; count: number; percentage: number }> = [];
    if (filteredTeamIds.length > 0) {
      const countryStats = await this.participantRepo
        .createQueryBuilder("p")
        .select("p.country", "country")
        .addSelect("COUNT(DISTINCT p.teamId)", "count")
        .where("p.teamId IN (:...teamIds)", { teamIds: filteredTeamIds })
        .groupBy("p.country")
        .orderBy("count", "DESC")
        .getRawMany();

      const totalCountryTeams = countryStats.reduce((sum, c) => sum + Number(c.count), 0);
      byCountry = countryStats.map((c) => ({
        country: c.country || "Unknown",
        count: Number(c.count),
        percentage: totalCountryTeams > 0 ? Math.round((Number(c.count) / totalCountryTeams) * 1000) / 10 : 0,
      }));
    }

    // Team size distribution
    let teamSizeDistribution: Array<{ size: number; count: number }> = [];
    if (filteredTeamIds.length > 0) {
      const teamSizeData = await this.participantRepo
        .createQueryBuilder("p")
        .select("p.teamId", "teamId")
        .addSelect("COUNT(*)", "size")
        .where("p.teamId IN (:...teamIds)", { teamIds: filteredTeamIds })
        .groupBy("p.teamId")
        .getRawMany();

      const sizeMap = new Map<number, number>();
      teamSizeData.forEach((t) => {
        const size = Number(t.size);
        sizeMap.set(size, (sizeMap.get(size) || 0) + 1);
      });

      teamSizeDistribution = Array.from(sizeMap.entries())
        .map(([size, count]) => ({ size, count }))
        .sort((a, b) => a.size - b.size);
    }

    // Registration trend (last 30 days by default or custom range)
    const trendStartDate = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const trendEndDate = endDate ? new Date(endDate) : new Date();

    const registrationTrendData = await this.teamRepo
      .createQueryBuilder("team")
      .select("DATE(team.createdAt)", "date")
      .addSelect("COUNT(*)", "count")
      .where("team.cohortId = :cohortId", { cohortId })
      .andWhere("team.createdAt BETWEEN :start AND :end", {
        start: trendStartDate,
        end: trendEndDate,
      })
      .groupBy("DATE(team.createdAt)")
      .orderBy("date", "ASC")
      .getRawMany();

    const registrationTrend = registrationTrendData.map((r) => ({
      date: r.date,
      count: Number(r.count),
    }));

    return {
      byStatus,
      byVertical,
      byCountry,
      teamSizeDistribution,
      registrationTrend,
    };
  }

  async getSubmissionStatistics(query: DashboardQueryDto): Promise<SubmissionStatistics> {
    const { cohortId, verticalId, country, startDate, endDate } = query;

    // Get stages for cohort
    const stages = await this.stageRepo.find({
      where: { cohortId },
      order: { number: "ASC" },
    });

    // Get filtered team IDs
    let filteredTeamIds: string[] = [];
    const teamQb = this.teamRepo
      .createQueryBuilder("team")
      .leftJoin("team.brief", "brief")
      .select("team.id")
      .where("team.cohortId = :cohortId", { cohortId });

    if (verticalId) {
      teamQb.andWhere("brief.verticalId = :verticalId", { verticalId });
    }

    const teams = await teamQb.getMany();
    filteredTeamIds = teams.map((t) => t.id);

    if (country && filteredTeamIds.length > 0) {
      const teamsWithCountry = await this.participantRepo
        .createQueryBuilder("p")
        .select("DISTINCT p.teamId", "teamId")
        .where("p.teamId IN (:...teamIds)", { teamIds: filteredTeamIds })
        .andWhere("p.country = :country", { country })
        .getRawMany();
      filteredTeamIds = teamsWithCountry.map((t) => t.teamId);
    }

    const totalTeams = filteredTeamIds.length;

    // Stats by stage
    const byStage = await Promise.all(
      stages.map(async (stage) => {
        let submitted = 0;
        let late = 0;
        let avgScore: number | null = null;

        if (filteredTeamIds.length > 0) {
          const submissions = await this.submissionRepo
            .createQueryBuilder("sub")
            .where("sub.stageId = :stageId", { stageId: stage.id })
            .andWhere("sub.teamId IN (:...teamIds)", { teamIds: filteredTeamIds })
            .getMany();

          submitted = submissions.filter(
            (s) => s.status === SubmissionStatus.SUBMITTED || s.status === SubmissionStatus.EVALUATED
          ).length;
          late = submissions.filter((s) => s.isLate).length;

          // Get average score from evaluations
          const evalStats = await this.evaluationRepo
            .createQueryBuilder("eval")
            .select("AVG(eval.finalScore)", "avgScore")
            .where("eval.stageId = :stageId", { stageId: stage.id })
            .andWhere("eval.teamId IN (:...teamIds)", { teamIds: filteredTeamIds })
            .getRawOne();

          avgScore = evalStats?.avgScore ? Math.round(Number(evalStats.avgScore) * 10) / 10 : null;
        }

        const pending = totalTeams - submitted;

        return {
          stageId: stage.id,
          stageName: stage.name,
          stageNumber: stage.number,
          totalTeams,
          submitted,
          late,
          pending,
          submissionRate: totalTeams > 0 ? Math.round((submitted / totalTeams) * 1000) / 10 : 0,
          averageScore: avgScore,
        };
      })
    );

    // Overall submission rate
    const totalSubmitted = byStage.reduce((sum, s) => sum + s.submitted, 0);
    const totalPossible = totalTeams * stages.length;
    const overallSubmissionRate = totalPossible > 0 ? Math.round((totalSubmitted / totalPossible) * 1000) / 10 : 0;

    // Late submission rate
    const totalLate = byStage.reduce((sum, s) => sum + s.late, 0);
    const lateSubmissionRate = totalSubmitted > 0 ? Math.round((totalLate / totalSubmitted) * 1000) / 10 : 0;

    // Submission trend
    let submissionTrend: Array<{ date: string; count: number }> = [];
    if (filteredTeamIds.length > 0) {
      const trendStartDate = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const trendEndDate = endDate ? new Date(endDate) : new Date();

      const submissionTrendData = await this.submissionRepo
        .createQueryBuilder("sub")
        .select("DATE(sub.submittedAt)", "date")
        .addSelect("COUNT(*)", "count")
        .where("sub.teamId IN (:...teamIds)", { teamIds: filteredTeamIds })
        .andWhere("sub.submittedAt IS NOT NULL")
        .andWhere("sub.submittedAt BETWEEN :start AND :end", {
          start: trendStartDate,
          end: trendEndDate,
        })
        .groupBy("DATE(sub.submittedAt)")
        .orderBy("date", "ASC")
        .getRawMany();

      submissionTrend = submissionTrendData.map((r) => ({
        date: r.date,
        count: Number(r.count),
      }));
    }

    return {
      byStage,
      overallSubmissionRate,
      lateSubmissionRate,
      submissionTrend,
    };
  }

  async getEvaluationStatistics(query: DashboardQueryDto): Promise<EvaluationStatistics> {
    const { cohortId, verticalId, country } = query;

    // Get filtered team IDs
    let filteredTeamIds: string[] = [];
    const teamQb = this.teamRepo
      .createQueryBuilder("team")
      .leftJoin("team.brief", "brief")
      .select("team.id")
      .where("team.cohortId = :cohortId", { cohortId });

    if (verticalId) {
      teamQb.andWhere("brief.verticalId = :verticalId", { verticalId });
    }

    const teams = await teamQb.getMany();
    filteredTeamIds = teams.map((t) => t.id);

    if (country && filteredTeamIds.length > 0) {
      const teamsWithCountry = await this.participantRepo
        .createQueryBuilder("p")
        .select("DISTINCT p.teamId", "teamId")
        .where("p.teamId IN (:...teamIds)", { teamIds: filteredTeamIds })
        .andWhere("p.country = :country", { country })
        .getRawMany();
      filteredTeamIds = teamsWithCountry.map((t) => t.teamId);
    }

    // Handle empty case
    if (filteredTeamIds.length === 0) {
      const stages = await this.stageRepo.find({ where: { cohortId } });
      return {
        totalEvaluated: 0,
        pendingEvaluation: 0,
        averageAIScore: 0,
        averageHumanScore: 0,
        averageFinalScore: 0,
        scoreDistribution: [
          { range: "0-20", count: 0 },
          { range: "20-40", count: 0 },
          { range: "40-60", count: 0 },
          { range: "60-80", count: 0 },
          { range: "80-100", count: 0 },
        ],
        byStage: stages.map((s) => ({
          stageId: s.id,
          stageName: s.name,
          evaluated: 0,
          averageScore: 0,
        })),
      };
    }

    // Get evaluations
    const evaluations = await this.evaluationRepo
      .createQueryBuilder("eval")
      .where("eval.cohortId = :cohortId", { cohortId })
      .andWhere("eval.teamId IN (:...teamIds)", { teamIds: filteredTeamIds })
      .getMany();

    const totalEvaluated = evaluations.length;

    // Pending evaluations (submissions without evaluations)
    const submissionsWithStatus = await this.submissionRepo
      .createQueryBuilder("sub")
      .select("sub.teamId", "teamId")
      .addSelect("sub.stageId", "stageId")
      .where("sub.teamId IN (:...teamIds)", { teamIds: filteredTeamIds })
      .andWhere("sub.status = :status", { status: SubmissionStatus.SUBMITTED })
      .getRawMany();

    const evaluatedPairs = new Set(evaluations.map((e) => `${e.teamId}-${e.stageId}`));
    const pendingEvaluation = submissionsWithStatus.filter(
      (s) => !evaluatedPairs.has(`${s.teamId}-${s.stageId}`)
    ).length;

    // Average scores
    const avgScores = await this.evaluationRepo
      .createQueryBuilder("eval")
      .select("AVG(eval.aiOverallScore)", "avgAI")
      .addSelect("AVG(eval.humanOverallScore)", "avgHuman")
      .addSelect("AVG(eval.finalScore)", "avgFinal")
      .where("eval.cohortId = :cohortId", { cohortId })
      .andWhere("eval.teamId IN (:...teamIds)", { teamIds: filteredTeamIds })
      .getRawOne();

    // Score distribution (0-20, 20-40, 40-60, 60-80, 80-100)
    const scoreRanges = [
      { range: "0-20", min: 0, max: 20 },
      { range: "20-40", min: 20, max: 40 },
      { range: "40-60", min: 40, max: 60 },
      { range: "60-80", min: 60, max: 80 },
      { range: "80-100", min: 80, max: 100 },
    ];

    const scoreDistribution = scoreRanges.map((r) => ({
      range: r.range,
      count: evaluations.filter((e) => (e.finalScore ?? 0) >= r.min && (e.finalScore ?? 0) < (r.max === 100 ? 101 : r.max)).length,
    }));

    // By stage
    const stages = await this.stageRepo.find({ where: { cohortId } });
    const byStage = stages.map((stage) => {
      const stageEvals = evaluations.filter((e) => e.stageId === stage.id);
      const avgScore =
        stageEvals.length > 0
          ? stageEvals.reduce((sum, e) => sum + (e.finalScore || 0), 0) / stageEvals.length
          : 0;

      return {
        stageId: stage.id,
        stageName: stage.name,
        evaluated: stageEvals.length,
        averageScore: Math.round(avgScore * 10) / 10,
      };
    });

    return {
      totalEvaluated,
      pendingEvaluation,
      averageAIScore: avgScores?.avgAI ? Math.round(Number(avgScores.avgAI) * 10) / 10 : 0,
      averageHumanScore: avgScores?.avgHuman ? Math.round(Number(avgScores.avgHuman) * 10) / 10 : 0,
      averageFinalScore: avgScores?.avgFinal ? Math.round(Number(avgScores.avgFinal) * 10) / 10 : 0,
      scoreDistribution,
      byStage,
    };
  }

  async getPerformanceHeatmap(query: DashboardQueryDto): Promise<PerformanceHeatmap> {
    const { cohortId } = query;

    // Get all verticals
    const verticals = await this.verticalRepo.find({ where: { cohortId } });

    // Get all unique countries
    const countries = await this.participantRepo
      .createQueryBuilder("p")
      .select("DISTINCT p.country", "country")
      .where("p.cohortId = :cohortId", { cohortId })
      .andWhere("p.country IS NOT NULL")
      .getRawMany();

    const data: PerformanceHeatmap["data"] = [];

    for (const vertical of verticals) {
      for (const countryRow of countries) {
        const countryName = countryRow.country;

        // Get teams in this vertical (through briefs) from this country (through participants)
        const teamsInCell = await this.teamRepo
          .createQueryBuilder("team")
          .innerJoin("team.brief", "brief", "brief.verticalId = :verticalId", { verticalId: vertical.id })
          .innerJoin(
            "participants",
            "p",
            "p.teamId = team.id AND p.country = :country",
            { country: countryName }
          )
          .where("team.cohortId = :cohortId", { cohortId })
          .getMany();

        if (teamsInCell.length === 0) continue;

        const teamIds = teamsInCell.map((t) => t.id);

        // Get average score
        const evalStats = await this.evaluationRepo
          .createQueryBuilder("eval")
          .select("AVG(eval.finalScore)", "avgScore")
          .where("eval.teamId IN (:...teamIds)", { teamIds })
          .getRawOne();

        // Get submission rate
        const submissions = await this.submissionRepo
          .createQueryBuilder("sub")
          .where("sub.teamId IN (:...teamIds)", { teamIds })
          .andWhere("sub.status IN (:...statuses)", {
            statuses: [SubmissionStatus.SUBMITTED, SubmissionStatus.EVALUATED],
          })
          .getCount();

        const stageCount = await this.stageRepo.count({ where: { cohortId } });
        const possibleSubmissions = teamIds.length * stageCount;
        const submissionRate = possibleSubmissions > 0 ? (submissions / possibleSubmissions) * 100 : 0;

        data.push({
          verticalId: vertical.id,
          verticalName: vertical.name,
          country: countryName,
          teamCount: teamsInCell.length,
          averageScore: evalStats?.avgScore ? Math.round(Number(evalStats.avgScore) * 10) / 10 : 0,
          submissionRate: Math.round(submissionRate * 10) / 10,
        });
      }
    }

    return { data };
  }
}
