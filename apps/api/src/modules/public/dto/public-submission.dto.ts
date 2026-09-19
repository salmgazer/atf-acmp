import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsIn,
  IsBoolean,
  IsUUID,
  MinLength,
  MaxLength,
  ArrayMinSize,
  ArrayMaxSize,
} from "class-validator";
import { Type } from "class-transformer";

// Valid countries for the AI Challenge
export const VALID_COUNTRIES = ["Ghana", "Nigeria", "Kenya", "South Africa"] as const;
export type ValidCountry = (typeof VALID_COUNTRIES)[number];

// Scoring answer options
export const Q1_OPTIONS = ["routine", "judgement", "sense_making", "no_system", "new_capability"] as const;
export const Q2_OPTIONS = ["good_records", "partial", "very_little"] as const;
export const Q3_OPTIONS = ["straightforward", "mixed", "hard"] as const;
export const Q4_OPTIONS = ["yes", "no_exact"] as const;
export const Q5_OPTIONS = ["clear", "vague"] as const;
export const Q6_OPTIONS = ["very_often", "now_and_then"] as const;
export const Q7_OPTIONS = ["convenient", "meaningful", "transformative"] as const;
export const Q8_OPTIONS = ["local", "thousands", "national"] as const;

export class SecondaryContactDto {
  @ApiPropertyOptional({ description: "Contact person name" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: "Contact person role" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  role?: string;

  @ApiPropertyOptional({ description: "Contact person email" })
  @IsOptional()
  @IsEmail({}, { message: "Please enter a valid email address" })
  email?: string;

  @ApiPropertyOptional({ description: "Contact person phone" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
}

export class ScoringAnswersDto {
  @ApiProperty({ enum: Q1_OPTIONS, description: "Q1: What kind of work is this?" })
  @IsIn(Q1_OPTIONS)
  q1: string;

  @ApiPropertyOptional({ description: "Q1 display text" })
  @IsOptional()
  @IsString()
  q1_text?: string;

  @ApiProperty({ enum: Q2_OPTIONS, description: "Q2: What data exists?" })
  @IsIn(Q2_OPTIONS)
  q2: string;

  @ApiPropertyOptional({ description: "Q2 display text" })
  @IsOptional()
  @IsString()
  q2_text?: string;

  @ApiProperty({ enum: Q3_OPTIONS, description: "Q3: How clear are the rules?" })
  @IsIn(Q3_OPTIONS)
  q3: string;

  @ApiPropertyOptional({ description: "Q3 display text" })
  @IsOptional()
  @IsString()
  q3_text?: string;

  @ApiProperty({ enum: Q4_OPTIONS, description: "Q4: Do you know what good looks like?" })
  @IsIn(Q4_OPTIONS)
  q4: string;

  @ApiPropertyOptional({ description: "Q4 display text" })
  @IsOptional()
  @IsString()
  q4_text?: string;

  @ApiProperty({ enum: Q5_OPTIONS, description: "Q5: Is the outcome clear?" })
  @IsIn(Q5_OPTIONS)
  q5: string;

  @ApiPropertyOptional({ description: "Q5 display text" })
  @IsOptional()
  @IsString()
  q5_text?: string;

  @ApiProperty({ enum: Q6_OPTIONS, description: "Q6: How often is this done?" })
  @IsIn(Q6_OPTIONS)
  q6: string;

  @ApiPropertyOptional({ description: "Q6 display text" })
  @IsOptional()
  @IsString()
  q6_text?: string;

  @ApiProperty({ enum: Q7_OPTIONS, description: "Q7: Depth of impact" })
  @IsIn(Q7_OPTIONS)
  q7: string;

  @ApiPropertyOptional({ description: "Q7 display text" })
  @IsOptional()
  @IsString()
  q7_text?: string;

  @ApiProperty({ enum: Q8_OPTIONS, description: "Q8: Breadth of impact" })
  @IsIn(Q8_OPTIONS)
  q8: string;

  @ApiPropertyOptional({ description: "Q8 display text" })
  @IsOptional()
  @IsString()
  q8_text?: string;
}

export class OpportunityDto {
  @ApiProperty({ description: "Opportunity title" })
  @IsNotEmpty()
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  title: string;

  @ApiProperty({ description: "Description of the opportunity and who it affects" })
  @IsNotEmpty()
  @IsString()
  @MinLength(20)
  description: string;

  @ApiProperty({ description: "If addressed, what changes?" })
  @IsNotEmpty()
  @IsString()
  whatChanges: string;

  @ApiProperty({ description: "Roughly how many people affected?" })
  @IsNotEmpty()
  @IsString()
  howMany: string;

  @ApiProperty({ description: "Records and data that exist" })
  @IsNotEmpty()
  @IsString()
  dataDescription: string;

  @ApiProperty({ description: "Can data be shared?" })
  @IsNotEmpty()
  @IsString()
  dataAccess: string;

  @ApiPropertyOptional({ description: "Secondary contact information", type: SecondaryContactDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SecondaryContactDto)
  secondaryContact?: SecondaryContactDto;

  @ApiProperty({ description: "Scoring answers", type: ScoringAnswersDto })
  @ValidateNested()
  @Type(() => ScoringAnswersDto)
  scoringAnswers: ScoringAnswersDto;
}

export class OrganizationInfoDto {
  @ApiProperty({ description: "Organization name" })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  orgName: string;

  @ApiProperty({ description: "Sector", example: "Health" })
  @IsNotEmpty()
  @IsString()
  sector: string;

  @ApiPropertyOptional({ description: "Sector if 'Other' selected" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  sectorOther?: string;

  @ApiProperty({ enum: VALID_COUNTRIES, description: "Country" })
  @IsIn(VALID_COUNTRIES)
  country: ValidCountry;

  @ApiProperty({ description: "City or town" })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  city: string;

  @ApiProperty({ description: "Submitter name" })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  contactName: string;

  @ApiProperty({ description: "Designation/title" })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  designation: string;

  @ApiPropertyOptional({ description: "Department" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  department?: string;

  @ApiProperty({ description: "Email address" })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ description: "Phone number" })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  phone: string;
}

export class PublicSubmissionDto {
  @ApiProperty({ description: "Unique session ID for duplicate prevention" })
  @IsNotEmpty()
  @IsUUID()
  sessionId: string;

  @ApiProperty({ description: "Organization information", type: OrganizationInfoDto })
  @ValidateNested()
  @Type(() => OrganizationInfoDto)
  org: OrganizationInfoDto;

  @ApiProperty({
    description: "List of opportunities (1-3)",
    type: [OpportunityDto],
    minItems: 1,
    maxItems: 3,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => OpportunityDto)
  opportunities: OpportunityDto[];

  @ApiProperty({ description: "Consent given for data processing" })
  @IsBoolean()
  consentGiven: boolean;
}

export class PublicSubmissionResponseDto {
  @ApiProperty({ description: "Success status" })
  success: boolean;

  @ApiPropertyOptional({ description: "Whether this was a duplicate submission" })
  duplicate?: boolean;

  @ApiPropertyOptional({ description: "Organization ID created" })
  organizationId?: string;

  @ApiPropertyOptional({ description: "Brief IDs created" })
  briefIds?: string[];

  @ApiPropertyOptional({ description: "Error message if failed" })
  error?: string;
}
