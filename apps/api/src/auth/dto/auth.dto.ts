import { IsEmail, IsString, IsNotEmpty, MinLength, IsEnum, IsOptional, Length } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export enum PortalType {
  STAFF = "staff",
  ORGANIZATION = "organization",
  PARTICIPANT = "participant",
  MENTOR = "mentor",
}

export class FirebaseVerifyDto {
  @ApiProperty({ description: "Firebase ID token" })
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @ApiPropertyOptional({ description: "Portal type for role validation", enum: PortalType })
  @IsEnum(PortalType)
  @IsOptional()
  portal?: PortalType;
}

export class LoginDto {
  @ApiProperty({ description: "User email address" })
  @IsEmail()
  email: string;

  @ApiProperty({ description: "User password" })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ description: "Portal type", enum: PortalType })
  @IsEnum(PortalType)
  portal: PortalType;
}

export class MagicLinkRequestDto {
  @ApiProperty({ description: "User email address" })
  @IsEmail()
  email: string;

  @ApiProperty({ description: "Portal type (organization or mentor)", enum: [PortalType.ORGANIZATION, PortalType.MENTOR] })
  @IsEnum(PortalType)
  portal: PortalType;
}

export class VerifyMagicCodeDto {
  @ApiProperty({ description: "User email address" })
  @IsEmail()
  email: string;

  @ApiProperty({ description: "6-digit verification code" })
  @IsString()
  @Length(6, 6)
  code: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: "Current password" })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ description: "New password (min 8 characters)" })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: "Refresh token" })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class AuthResponseDto {
  @ApiProperty({ description: "JWT access token" })
  accessToken: string;

  @ApiProperty({ description: "Refresh token for obtaining new access tokens" })
  refreshToken: string;

  @ApiProperty({ description: "Access token expiry in seconds" })
  expiresIn: number;

  @ApiProperty({ description: "User information" })
  user: {
    id: string;
    email: string;
    role: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    mustChangePassword?: boolean;
    onboardingComplete?: boolean;
    participantId?: string; // For participant users
    participant?: {
      id: string;
      participantId: string;
      cohortId?: string;
      teamId?: string;
    };
  };
}

// Legacy response for backward compatibility
export class LegacyAuthResponseDto {
  @ApiProperty({ description: "JWT access token (deprecated, use accessToken)" })
  token: string;

  @ApiProperty({ description: "User information" })
  user: AuthResponseDto["user"];
}
