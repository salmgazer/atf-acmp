import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Res,
} from "@nestjs/common";
import { Response } from "express";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Role } from "@/database/entities/user.entity";
import { CertificatesService } from "./certificates.service";
import {
  GenerateCertificatesDto,
  CertificateQueryDto,
  UpdateCertificateTierDto,
} from "./dto/certificate.dto";

/**
 * Public certificate verification controller
 */
@ApiTags("Certificates")
@Controller("certificates")
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Get("verify/:certificateId")
  @ApiOperation({ summary: "Verify a certificate by its ID" })
  async verifyCertificate(@Param("certificateId") certificateId: string) {
    return this.certificatesService.verifyCertificate(certificateId);
  }
}

/**
 * Participant certificate controller
 */
@ApiTags("Certificates")
@ApiBearerAuth()
@Controller("certificates/my")
@UseGuards(JwtAuthGuard)
export class ParticipantCertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Get()
  @ApiOperation({ summary: "Get current participant's certificates" })
  async getMyCertificates(@CurrentUser() user: any) {
    // User should have participantId from their JWT
    const participantId = user.participantId;
    if (!participantId) {
      return [];
    }
    return this.certificatesService.getParticipantCertificates(participantId);
  }

  @Get(":certificateId/download")
  @ApiOperation({ summary: "Download a certificate" })
  async downloadCertificate(
    @Param("certificateId") certificateId: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const certificate = await this.certificatesService.getCertificateByCertificateId(certificateId);

    // Verify the certificate belongs to the current user
    if (user.participantId && certificate.participantId !== user.participantId) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    // Record download
    await this.certificatesService.recordDownload(certificateId);

    // If PDF URL exists, redirect to it
    if (certificate.pdfUrl) {
      res.redirect(certificate.pdfUrl);
      return;
    }

    // Otherwise return certificate data for client-side rendering
    res.json({
      certificateId: certificate.certificateId,
      participantName: certificate.participantName,
      teamName: certificate.teamName,
      cohortName: certificate.cohortName,
      verticalName: certificate.verticalName,
      tier: certificate.tier,
      rank: certificate.rank,
      finalScore: certificate.finalScore,
      generatedAt: certificate.generatedAt,
      qrCodeData: certificate.qrCodeData,
    });
  }
}

/**
 * Admin certificate controller
 */
@ApiTags("Certificates")
@ApiBearerAuth()
@Controller("admin/certificates")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
export class AdminCertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Post("generate")
  @ApiOperation({ summary: "Generate certificates for a cohort" })
  async generateCertificates(
    @Body() dto: GenerateCertificatesDto,
    @CurrentUser() user: any,
  ) {
    return this.certificatesService.generateCertificates(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: "List all certificates" })
  async getCertificates(@Query() query: CertificateQueryDto) {
    return this.certificatesService.getCertificates(query);
  }

  @Get("stats/:cohortId")
  @ApiOperation({ summary: "Get certificate statistics for a cohort" })
  async getCohortStats(@Param("cohortId", ParseUUIDPipe) cohortId: string) {
    return this.certificatesService.getCohortCertificateStats(cohortId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a specific certificate" })
  async getCertificate(@Param("id", ParseUUIDPipe) id: string) {
    return this.certificatesService.getCertificate(id);
  }

  @Patch(":id/tier")
  @ApiOperation({ summary: "Update certificate tier" })
  async updateTier(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCertificateTierDto,
  ) {
    return this.certificatesService.updateTier(id, dto.tier);
  }

  @Post(":id/regenerate")
  @ApiOperation({ summary: "Regenerate a certificate" })
  async regenerateCertificate(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.certificatesService.regenerateCertificate(id, user.id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a certificate" })
  async deleteCertificate(@Param("id", ParseUUIDPipe) id: string) {
    await this.certificatesService.deleteCertificate(id);
    return { success: true };
  }
}
