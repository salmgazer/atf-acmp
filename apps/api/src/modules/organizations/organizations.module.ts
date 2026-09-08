import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Organization, OrganizationUser } from "@/database/entities/organization.entity";
import { User } from "@/database/entities/user.entity";
import { Vertical } from "@/database/entities/vertical.entity";
import { OrganizationsService } from "./organizations.service";
import { OrganizationsController } from "./organizations.controller";
import { UploadModule } from "@/common/services/upload.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, OrganizationUser, User, Vertical]),
    UploadModule,
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
