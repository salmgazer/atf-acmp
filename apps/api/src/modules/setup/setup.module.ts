import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../../database/entities/user.entity";
import { SetupController } from "./setup.controller";
import { SetupService } from "./setup.service";

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [SetupController],
  providers: [SetupService],
  exports: [SetupService],
})
export class SetupModule {}
