import { Module, Global } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLog } from "@/database/entities/audit-log.entity";
import { AuditService } from "./audit.service";
import { AuditController } from "./audit.controller";
import { AuditInterceptor } from "@/common/interceptors/audit.interceptor";

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditController],
  providers: [AuditService, AuditInterceptor],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}
