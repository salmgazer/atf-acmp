import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UseGuards,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
} from "@nestjs/swagger";
import { OrganizationsService } from "./organizations.service";
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  ApproveOrganizationDto,
  RejectOrganizationDto,
  OrganizationQueryDto,
  BulkImportOrganizationsDto,
  SendInviteDto,
  BulkSendInvitesDto,
} from "./dto/organization.dto";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { UploadService } from "@/common/services/upload.service";
import { Audit } from "@/common/decorators/audit.decorator";
import { AuditInterceptor } from "@/common/interceptors/audit.interceptor";
import { AuditAction } from "@/database/entities/audit-log.entity";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { RolesGuard } from "@/auth/guards/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import { Role } from "@/database/entities/user.entity";

@ApiTags("organizations")
@Controller("organizations")
@UseInterceptors(AuditInterceptor)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly uploadService: UploadService,
  ) {}

  @Get("me")
  @ApiOperation({ summary: "Get the current organization (for logged-in org users)" })
  @ApiResponse({ status: 200, description: "Current organization details" })
  @ApiResponse({ status: 404, description: "Organization not found" })
  async getCurrentOrganization(@CurrentUser("email") email: string) {
    // Look up organization by the user's email
    const org = await this.organizationsService.findByEmail(email);
    
    if (!org) {
      throw new Error("Organization not found");
    }
    return org;
  }

  @Get("me/verticals")
  @ApiOperation({ summary: "Get verticals for the current organization's cohort" })
  @ApiResponse({ status: 200, description: "List of verticals for the org's cohort" })
  @ApiResponse({ status: 404, description: "Organization not found or no cohort assigned" })
  async getMyVerticals(@CurrentUser("email") email: string) {
    return this.organizationsService.getVerticalsForOrganization(email);
  }

  @Post()
  @Audit({
    action: AuditAction.CREATE,
    entityType: "Organization",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => result?.name,
    getDescription: (result) => `Created organization: ${result?.name}`,
  })
  @ApiOperation({ summary: "Create a new organization" })
  @ApiResponse({ status: 201, description: "Organization created" })
  @ApiResponse({ status: 400, description: "Validation error" })
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "Get all organizations with filters" })
  @ApiResponse({ status: 200, description: "Paginated organizations" })
  findAll(@Query() query: OrganizationQueryDto) {
    return this.organizationsService.findAll(query);
  }

  @Get("statistics")
  @ApiOperation({ summary: "Get organization statistics" })
  @ApiResponse({ status: 200, description: "Organization statistics" })
  getStatistics() {
    return this.organizationsService.getStatistics();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get an organization by ID" })
  @ApiParam({ name: "id", description: "Organization ID" })
  @ApiResponse({ status: 200, description: "Organization details" })
  @ApiResponse({ status: 404, description: "Organization not found" })
  findOne(@Param("id") id: string) {
    return this.organizationsService.findOne(id);
  }

  @Patch(":id")
  @Audit({
    action: AuditAction.UPDATE,
    entityType: "Organization",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => result?.name,
    getDescription: (result) => `Updated organization: ${result?.name}`,
  })
  @ApiOperation({ summary: "Update an organization" })
  @ApiParam({ name: "id", description: "Organization ID" })
  @ApiResponse({ status: 200, description: "Organization updated" })
  update(@Param("id") id: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizationsService.update(id, dto);
  }

  @Post(":id/approve")
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: AuditAction.STATUS_CHANGE,
    entityType: "Organization",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => result?.name,
    getDescription: (result) => `Approved organization: ${result?.name}`,
  })
  @ApiOperation({ summary: "Approve an organization" })
  @ApiParam({ name: "id", description: "Organization ID" })
  @ApiResponse({ status: 200, description: "Organization approved" })
  @ApiResponse({ status: 400, description: "Organization cannot be approved" })
  approve(@Param("id") id: string, @Body() dto: ApproveOrganizationDto) {
    return this.organizationsService.approve(id, dto);
  }

  @Post(":id/reject")
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: AuditAction.STATUS_CHANGE,
    entityType: "Organization",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => result?.name,
    getDescription: (result) => `Rejected organization: ${result?.name}`,
  })
  @ApiOperation({ summary: "Reject an organization" })
  @ApiParam({ name: "id", description: "Organization ID" })
  @ApiResponse({ status: 200, description: "Organization rejected" })
  reject(@Param("id") id: string, @Body() dto: RejectOrganizationDto) {
    return this.organizationsService.reject(id, dto);
  }

  @Post(":id/deactivate")
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: AuditAction.STATUS_CHANGE,
    entityType: "Organization",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => result?.name,
    getDescription: (result) => `Deactivated organization: ${result?.name}`,
  })
  @ApiOperation({ summary: "Deactivate an organization" })
  @ApiParam({ name: "id", description: "Organization ID" })
  @ApiResponse({ status: 200, description: "Organization deactivated" })
  deactivate(@Param("id") id: string) {
    return this.organizationsService.deactivate(id);
  }

  @Post(":id/activate")
  @HttpCode(HttpStatus.OK)
  @Audit({
    action: AuditAction.STATUS_CHANGE,
    entityType: "Organization",
    getEntityId: (result) => result?.id,
    getEntityName: (result) => result?.name,
    getDescription: (result) => `Activated organization: ${result?.name}`,
  })
  @ApiOperation({ summary: "Activate an organization" })
  @ApiParam({ name: "id", description: "Organization ID" })
  @ApiResponse({ status: 200, description: "Organization activated" })
  activate(@Param("id") id: string) {
    return this.organizationsService.activate(id);
  }

  @Patch(":id/logo")
  @ApiOperation({ summary: "Update organization logo" })
  @ApiParam({ name: "id", description: "Organization ID" })
  @ApiResponse({ status: 200, description: "Logo updated" })
  updateLogo(@Param("id") id: string, @Body("logoUrl") logoUrl: string) {
    return this.organizationsService.updateLogo(id, logoUrl);
  }

  @Post(":id/logo/upload")
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload organization logo" })
  @ApiParam({ name: "id", description: "Organization ID" })
  @ApiResponse({ status: 200, description: "Logo uploaded and updated" })
  @ApiResponse({ status: 400, description: "Invalid file" })
  async uploadLogo(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    // Upload image to S3
    const result = await this.uploadService.uploadProfilePicture(
      file,
      "organizations",
      id,
    );

    // Update organization with new logo URL
    return this.organizationsService.updateLogo(id, result.url);
  }

  @Get(":id/users")
  @ApiOperation({ summary: "Get users associated with an organization" })
  @ApiParam({ name: "id", description: "Organization ID" })
  @ApiResponse({ status: 200, description: "List of organization users" })
  getUsers(@Param("id") id: string) {
    return this.organizationsService.getOrganizationUsers(id);
  }

  // ============ Bulk Import ============

  @Post("bulk-import")
  @Audit({
    action: AuditAction.BULK_IMPORT,
    entityType: "Organization",
    getDescription: (result) => `Bulk imported ${result?.created || 0} organizations`,
  })
  @ApiOperation({ summary: "Bulk import organizations" })
  @ApiResponse({ status: 201, description: "Import results" })
  @ApiResponse({ status: 400, description: "Validation error" })
  bulkImport(@Body() dto: BulkImportOrganizationsDto) {
    return this.organizationsService.bulkImport(dto);
  }

  // ============ Invite Emails ============

  @Post(":id/send-invite")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Send invite email to an organization" })
  @ApiParam({ name: "id", description: "Organization ID" })
  @ApiResponse({ status: 200, description: "Invite sent" })
  @ApiResponse({ status: 404, description: "Organization not found" })
  sendInvite(@Param("id") id: string, @Body() dto: SendInviteDto) {
    return this.organizationsService.sendInvite(id, dto.customMessage);
  }

  @Post("bulk-send-invites")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Send invite emails to multiple organizations" })
  @ApiResponse({ status: 200, description: "Bulk invite results" })
  bulkSendInvites(@Body() dto: BulkSendInvitesDto) {
    return this.organizationsService.bulkSendInvites(
      dto.organizationIds,
      dto.customMessage
    );
  }
}
