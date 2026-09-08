import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { Certificate, CertificateTier, CertificateStatus } from "@/database/entities/certificate.entity";
import { Participant } from "@/database/entities/participant.entity";
import { Team, TeamMember } from "@/database/entities/team.entity";
import { Cohort } from "@/database/entities/cohort.entity";
import { Evaluation } from "@/database/entities/evaluation.entity";
import { Brief } from "@/database/entities/brief.entity";
import { LeaderboardService } from "@/modules/leaderboard/leaderboard.service";
import {
  GenerateCertificatesDto,
  CertificateQueryDto,
  CertificateResponse,
  GenerationResult,
  VerificationResponse,
  DEFAULT_TIER_THRESHOLDS,
  TierThresholds,
} from "./dto/certificate.dto";

@Injectable()
export class CertificatesService {
  private readonly appUrl: string;

  constructor(
    @InjectRepository(Certificate)
    private certificateRepo: Repository<Certificate>,
    @InjectRepository(Participant)
    private participantRepo: Repository<Participant>,
    @InjectRepository(Team)
    private teamRepo: Repository<Team>,
    @InjectRepository(TeamMember)
    private teamMemberRepo: Repository<TeamMember>,
    @InjectRepository(Cohort)
    private cohortRepo: Repository<Cohort>,
    @InjectRepository(Evaluation)
    private evaluationRepo: Repository<Evaluation>,
    @InjectRepository(Brief)
    private briefRepo: Repository<Brief>,
    private leaderboardService: LeaderboardService,
    private configService: ConfigService,
  ) {
    this.appUrl = this.configService.get<string>("app.url") || "https://acmp.atf.org";
  }

  async generateCertificates(
    dto: GenerateCertificatesDto,
    generatedBy: string,
  ): Promise<GenerationResult> {
    const { cohortId, participantIds, overrideTier } = dto;

    // Get cohort
    const cohort = await this.cohortRepo.findOne({ where: { id: cohortId } });
    if (!cohort) {
      throw new NotFoundException("Cohort not found");
    }

    // Get participants to generate certificates for
    let participants: Participant[];
    if (participantIds && participantIds.length > 0) {
      participants = await this.participantRepo.find({
        where: { id: In(participantIds), cohortId },
      });
    } else {
      // Get all participants in the cohort
      participants = await this.participantRepo.find({
        where: { cohortId },
      });
    }

    // Get team memberships for all participants
    const participantIdList = participants.map((p) => p.id);
    const teamMembers = participantIdList.length > 0
      ? await this.teamMemberRepo.find({
          where: { participantId: In(participantIdList) },
          relations: ["team"],
        })
      : [];
    const participantTeamMap = new Map<string, TeamMember>();
    teamMembers.forEach((tm) => participantTeamMap.set(tm.participantId, tm));

    // Filter to only participants with teams
    const participantsWithTeams = participants.filter((p) => participantTeamMap.has(p.id));

    // Get leaderboard for ranking info
    const leaderboard = await this.leaderboardService.getLeaderboard(
      { cohortId, limit: 10000 },
      true,
    );
    const teamRankMap = new Map<string, { rank: number; score: number }>();
    leaderboard.entries.forEach((e) => {
      teamRankMap.set(e.teamId, { rank: e.rank, score: e.finalScore });
    });

    // Get team info with briefs
    const teamIds = [...new Set(teamMembers.map((tm) => tm.teamId))];
    const teams = teamIds.length > 0
      ? await this.teamRepo.find({
          where: { id: In(teamIds) },
          relations: ["brief", "brief.vertical"],
        })
      : [];
    const teamMap = new Map(teams.map((t) => [t.id, t]));

    const result: GenerationResult = {
      total: participantsWithTeams.length,
      generated: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    for (const participant of participantsWithTeams) {
      try {
        // Check if certificate already exists
        const existing = await this.certificateRepo.findOne({
          where: { cohortId, participantId: participant.id },
        });

        if (existing && existing.status === CertificateStatus.GENERATED) {
          result.skipped++;
          continue;
        }

        // Get team and ranking info
        const teamMember = participantTeamMap.get(participant.id);
        const team = teamMember ? teamMap.get(teamMember.teamId) : undefined;
        const rankInfo = teamMember ? teamRankMap.get(teamMember.teamId) : undefined;

        // Determine tier
        const tier = overrideTier || this.determineTier(rankInfo, DEFAULT_TIER_THRESHOLDS);

        // Generate certificate ID
        const certificateId = this.generateCertificateId(cohort.name);

        // Build participant name
        const participantName = `${participant.firstName || ""} ${participant.lastName || ""}`.trim() || participant.email;

        // Create or update certificate record
        const certificateData: Partial<Certificate> = {
          certificateId,
          cohortId,
          participantId: participant.id,
          teamId: teamMember?.teamId,
          tier,
          status: CertificateStatus.GENERATED,
          participantName,
          teamName: team?.name,
          cohortName: cohort.name,
          verticalName: team?.brief?.vertical?.name,
          finalScore: rankInfo?.score,
          rank: rankInfo?.rank,
          generatedAt: new Date(),
          generatedBy,
          verificationUrl: `${this.appUrl}/certificates/verify/${certificateId}`,
          qrCodeData: this.generateQRCodeData(certificateId),
        };

        if (existing) {
          await this.certificateRepo.update(existing.id, certificateData);
        } else {
          await this.certificateRepo.save(this.certificateRepo.create(certificateData));
        }

        result.generated++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          participantId: participant.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return result;
  }

  private determineTier(
    rankInfo: { rank: number; score: number } | undefined,
    thresholds: TierThresholds,
  ): CertificateTier {
    if (!rankInfo) {
      return CertificateTier.PARTICIPATION;
    }

    const { rank, score } = rankInfo;

    // Winner tier - top ranks
    if (rank <= thresholds.winner.maxRank) {
      return CertificateTier.WINNER;
    }

    // Excellence tier - high scores
    if (score >= thresholds.excellence.minScore) {
      return CertificateTier.EXCELLENCE;
    }

    // Completion tier - passing scores
    if (score >= thresholds.completion.minScore) {
      return CertificateTier.COMPLETION;
    }

    // Default to participation
    return CertificateTier.PARTICIPATION;
  }

  private generateCertificateId(cohortName: string): string {
    const year = new Date().getFullYear();
    const prefix = cohortName
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 4)
      .toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ACMP-${prefix}-${year}-${random}`;
  }

  private generateQRCodeData(certificateId: string): string {
    // Return the verification URL as QR data
    return `${this.appUrl}/certificates/verify/${certificateId}`;
  }

  async getCertificate(id: string): Promise<Certificate> {
    const certificate = await this.certificateRepo.findOne({
      where: { id },
      relations: ["participant", "team", "cohort"],
    });

    if (!certificate) {
      throw new NotFoundException("Certificate not found");
    }

    return certificate;
  }

  async getCertificateByCertificateId(certificateId: string): Promise<Certificate> {
    const certificate = await this.certificateRepo.findOne({
      where: { certificateId },
      relations: ["participant", "team", "cohort"],
    });

    if (!certificate) {
      throw new NotFoundException("Certificate not found");
    }

    return certificate;
  }

  async getParticipantCertificates(participantId: string): Promise<CertificateResponse[]> {
    const certificates = await this.certificateRepo.find({
      where: { participantId, status: CertificateStatus.GENERATED },
      order: { generatedAt: "DESC" },
    });

    return certificates.map(this.mapToResponse);
  }

  async getCertificates(query: CertificateQueryDto): Promise<{
    data: CertificateResponse[];
    meta: { total: number; limit: number; offset: number };
  }> {
    const { cohortId, tier, limit = 50, offset = 0 } = query;

    const qb = this.certificateRepo.createQueryBuilder("cert");

    if (cohortId) {
      qb.andWhere("cert.cohortId = :cohortId", { cohortId });
    }

    if (tier) {
      qb.andWhere("cert.tier = :tier", { tier });
    }

    const [certificates, total] = await qb
      .orderBy("cert.generatedAt", "DESC")
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return {
      data: certificates.map(this.mapToResponse),
      meta: { total, limit, offset },
    };
  }

  async verifyCertificate(certificateId: string): Promise<VerificationResponse> {
    const certificate = await this.certificateRepo.findOne({
      where: { certificateId },
    });

    if (!certificate || certificate.status !== CertificateStatus.GENERATED) {
      return { valid: false };
    }

    return {
      valid: true,
      certificate: {
        certificateId: certificate.certificateId,
        participantName: certificate.participantName,
        teamName: certificate.teamName,
        cohortName: certificate.cohortName,
        tier: certificate.tier,
        generatedAt: certificate.generatedAt,
        rank: certificate.rank,
      },
    };
  }

  async updateTier(id: string, tier: CertificateTier): Promise<Certificate> {
    const certificate = await this.getCertificate(id);
    certificate.tier = tier;
    return this.certificateRepo.save(certificate);
  }

  async recordDownload(certificateId: string): Promise<void> {
    await this.certificateRepo.update(
      { certificateId },
      {
        downloadCount: () => "download_count + 1",
        lastDownloadedAt: new Date(),
      },
    );
  }

  async deleteCertificate(id: string): Promise<void> {
    const certificate = await this.getCertificate(id);
    await this.certificateRepo.remove(certificate);
  }

  async regenerateCertificate(id: string, generatedBy: string): Promise<Certificate> {
    const certificate = await this.getCertificate(id);

    // Reset status and regenerate
    certificate.status = CertificateStatus.PENDING;
    certificate.errorMessage = undefined;
    await this.certificateRepo.save(certificate);

    // Regenerate for this specific participant
    await this.generateCertificates(
      {
        cohortId: certificate.cohortId,
        participantIds: [certificate.participantId],
      },
      generatedBy,
    );

    return this.getCertificate(id);
  }

  async getCohortCertificateStats(cohortId: string): Promise<{
    total: number;
    byTier: Record<CertificateTier, number>;
    byStatus: Record<CertificateStatus, number>;
  }> {
    const certificates = await this.certificateRepo.find({ where: { cohortId } });

    const byTier = {
      [CertificateTier.WINNER]: 0,
      [CertificateTier.EXCELLENCE]: 0,
      [CertificateTier.COMPLETION]: 0,
      [CertificateTier.PARTICIPATION]: 0,
    };

    const byStatus = {
      [CertificateStatus.PENDING]: 0,
      [CertificateStatus.GENERATED]: 0,
      [CertificateStatus.FAILED]: 0,
    };

    certificates.forEach((c) => {
      byTier[c.tier]++;
      byStatus[c.status]++;
    });

    return {
      total: certificates.length,
      byTier,
      byStatus,
    };
  }

  private mapToResponse(certificate: Certificate): CertificateResponse {
    return {
      id: certificate.id,
      certificateId: certificate.certificateId,
      tier: certificate.tier,
      status: certificate.status,
      participantName: certificate.participantName,
      teamName: certificate.teamName,
      cohortName: certificate.cohortName,
      verticalName: certificate.verticalName,
      finalScore: certificate.finalScore ? Number(certificate.finalScore) : undefined,
      rank: certificate.rank,
      pdfUrl: certificate.pdfUrl,
      verificationUrl: certificate.verificationUrl,
      generatedAt: certificate.generatedAt,
      downloadCount: certificate.downloadCount,
    };
  }
}
