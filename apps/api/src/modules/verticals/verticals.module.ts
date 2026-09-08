import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Vertical } from "../../database/entities/vertical.entity";
import { Cohort } from "../../database/entities/cohort.entity";
import { VerticalsController } from "./verticals.controller";
import { VerticalsService } from "./verticals.service";

@Module({
  imports: [TypeOrmModule.forFeature([Vertical, Cohort])],
  controllers: [VerticalsController],
  providers: [VerticalsService],
  exports: [VerticalsService],
})
export class VerticalsModule {}
