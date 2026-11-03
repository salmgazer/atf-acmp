import { IsInt as QueryIsInt, Min as QueryMin, Max as QueryMax } from "class-validator";
import { StrictBoolean } from "@/common/decorators/query-value.decorator";
import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsArray,
  IsUrl,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";
import { ResourceType, ResourceVisibility } from "@/database/entities/resource.entity";

export class CreateResourceDto {
  @IsOptional()
  @IsUUID()
  cohortId?: string;

  @IsOptional()
  @IsUUID()
  verticalId?: string;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsEnum(ResourceType)
  type: ResourceType;

  @IsOptional()
  @IsUrl()
  fileUrl?: string;

  @IsOptional()
  @IsUrl()
  externalUrl?: string;

  @IsOptional()
  @IsUrl()
  videoEmbedUrl?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @IsOptional()
  @IsString()
  fileType?: string;

  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(ResourceVisibility)
  visibility?: ResourceVisibility;

  @IsOptional()
  @IsBoolean()
  @StrictBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsBoolean()
  @StrictBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateResourceDto {
  @IsOptional()
  @IsUUID()
  cohortId?: string;

  @IsOptional()
  @IsUUID()
  verticalId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(ResourceType)
  type?: ResourceType;

  @IsOptional()
  @IsUrl()
  fileUrl?: string;

  @IsOptional()
  @IsUrl()
  externalUrl?: string;

  @IsOptional()
  @IsUrl()
  videoEmbedUrl?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @IsOptional()
  @IsString()
  fileType?: string;

  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(ResourceVisibility)
  visibility?: ResourceVisibility;

  @IsOptional()
  @IsBoolean()
  @StrictBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsBoolean()
  @StrictBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class ResourceQueryDto {
  @IsOptional()
  @IsUUID()
  cohortId?: string;

  @IsOptional()
  @IsUUID()
  verticalId?: string;

  @IsOptional()
  @IsEnum(ResourceType)
  type?: ResourceType;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsBoolean()
  @StrictBoolean()
  featuredOnly?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @QueryIsInt()
  @QueryMin(1)
  @QueryMax(1000000)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @QueryIsInt()
  @QueryMin(1)
  @QueryMax(500)
  limit?: number;
}

export class ResourceResponseDto {
  id: string;
  cohortId?: string;
  verticalId?: string;
  title: string;
  description?: string;
  type: ResourceType;
  fileUrl?: string;
  externalUrl?: string;
  videoEmbedUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  thumbnailUrl?: string;
  tags: string[];
  visibility: ResourceVisibility;
  isPublished: boolean;
  isFeatured: boolean;
  sortOrder: number;
  downloadCount: number;
  viewCount: number;
  uploadedBy: string;
  accessUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  vertical?: {
    id: string;
    name: string;
  };
}
