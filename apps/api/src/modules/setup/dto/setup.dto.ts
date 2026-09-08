import { IsEmail, IsString, MinLength, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SetupStatusDto {
  @ApiProperty({ description: "Whether initial setup is complete (super admin exists)" })
  isSetupComplete: boolean;
}

export class CreateInitialAdminDto {
  @ApiProperty({ description: "Admin email address" })
  @IsEmail()
  email: string;

  @ApiProperty({ description: "Admin password (min 8 characters)" })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ description: "Admin first name" })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: "Admin last name" })
  @IsOptional()
  @IsString()
  lastName?: string;
}

export class SetupCompleteDto {
  @ApiProperty({ description: "Success message" })
  message: string;

  @ApiProperty({ description: "Created admin user info" })
  user: {
    id: string;
    email: string;
    role: string;
    firstName?: string;
    lastName?: string;
  };
}
