import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { User } from "../../database/entities/user.entity";
import { UsersService } from "./users.service";
import { UsersController, StaffController } from "./users.controller";
import { EmailModule } from "../../email/email.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    EmailModule,
    ConfigModule,
  ],
  controllers: [UsersController, StaffController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
