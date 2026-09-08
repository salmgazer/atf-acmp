import { IsEmail, IsEnum, IsOptional, IsString, MinLength, IsBoolean } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Role } from "@/database/entities/user.entity";

// Staff roles only (not organization, participant, mentor)
export const STAFF_ROLES = [
  Role.SUPER_ADMIN,
  Role.PROGRAM_MANAGER,
  Role.EVALUATOR,
  Role.VIEWER,
] as const;

export type StaffRole = typeof STAFF_ROLES[number];

export class CreateStaffDto {
  @ApiProperty({ example: "john.doe@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "John" })
  @IsString()
  @MinLength(1)
  firstName: string;

  @ApiProperty({ example: "Doe" })
  @IsString()
  @MinLength(1)
  lastName: string;

  @ApiProperty({ enum: STAFF_ROLES, example: Role.PROGRAM_MANAGER })
  @IsEnum(STAFF_ROLES)
  role: StaffRole;
}

export class UpdateStaffDto {
  @ApiPropertyOptional({ example: "John" })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: "Doe" })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ enum: STAFF_ROLES })
  @IsOptional()
  @IsEnum(STAFF_ROLES)
  role?: StaffRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class StaffQueryDto {
  @ApiPropertyOptional({ enum: STAFF_ROLES })
  @IsOptional()
  @IsEnum(STAFF_ROLES)
  role?: StaffRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class StaffResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ enum: STAFF_ROLES })
  role: StaffRole;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional()
  avatarUrl?: string;

  @ApiPropertyOptional()
  lastLoginAt?: Date;

  @ApiProperty()
  createdAt: Date;
}

export class InviteStaffDto {
  @ApiProperty({ example: "john.doe@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "John" })
  @IsString()
  @MinLength(1)
  firstName: string;

  @ApiProperty({ example: "Doe" })
  @IsString()
  @MinLength(1)
  lastName: string;

  @ApiProperty({ enum: STAFF_ROLES, example: Role.PROGRAM_MANAGER })
  @IsEnum(STAFF_ROLES)
  role: StaffRole;

  @ApiPropertyOptional({ example: "Welcome to the team!" })
  @IsOptional()
  @IsString()
  customMessage?: string;
}
