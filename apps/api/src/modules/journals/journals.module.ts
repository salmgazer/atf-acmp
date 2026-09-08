import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JournalEntry } from "@/database/entities/journal.entity";
import { TeamMember } from "@/database/entities/team.entity";
import { JournalsService } from "./journals.service";
import { JournalsController, AdminJournalsController } from "./journals.controller";

@Module({
  imports: [TypeOrmModule.forFeature([JournalEntry, TeamMember])],
  controllers: [JournalsController, AdminJournalsController],
  providers: [JournalsService],
  exports: [JournalsService],
})
export class JournalsModule {}
