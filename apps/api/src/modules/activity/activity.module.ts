import { Module, Global } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ActivityLog } from "@/database/entities/activity-log.entity";
import { ActivityService } from "./activity.service";
import { ActivityController } from "./activity.controller";

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ActivityLog])],
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
