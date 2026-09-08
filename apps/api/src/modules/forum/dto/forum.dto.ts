import {
  IsString,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEnum,
  MinLength,
  MaxLength,
} from "class-validator";
import { ForumAuthorType } from "@/database/entities/forum.entity";

// ============ Category DTOs ============

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsUUID()
  cohortId: string;

  @IsOptional()
  @IsUUID()
  verticalId?: string;

  @IsOptional()
  @IsString()
  iconName?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  staffOnly?: boolean;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  iconName?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  staffOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;
}

// ============ Thread DTOs ============

export class CreateThreadDto {
  @IsUUID()
  categoryId: string;

  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title: string;

  @IsString()
  @MinLength(10)
  content: string;
}

export class UpdateThreadDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  content?: string;
}

export class ThreadQueryDto {
  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsBoolean()
  pinnedFirst?: boolean;
}

// ============ Reply DTOs ============

export class CreateReplyDto {
  @IsString()
  @MinLength(1)
  content: string;

  @IsOptional()
  @IsUUID()
  parentReplyId?: string;
}

export class UpdateReplyDto {
  @IsString()
  @MinLength(1)
  content: string;
}

// ============ Response DTOs ============

export class CategoryResponseDto {
  id: string;
  name: string;
  description?: string;
  cohortId: string;
  verticalId?: string;
  iconName?: string;
  sortOrder: number;
  isActive: boolean;
  staffOnly: boolean;
  isLocked: boolean;
  threadCount: number;
  lastActivity?: Date;
  createdAt: Date;
}

export class ThreadResponseDto {
  id: string;
  categoryId: string;
  title: string;
  content: string;
  authorId: string;
  authorType: ForumAuthorType;
  authorName: string;
  authorAvatarUrl?: string;
  isPinned: boolean;
  isLocked: boolean;
  isEdited: boolean;
  editedAt?: Date;
  replyCount: number;
  lastReplyAt?: Date;
  lastReplyAuthorName?: string;
  viewCount: number;
  createdAt: Date;
}

export class ReplyResponseDto {
  id: string;
  threadId: string;
  content: string;
  authorId: string;
  authorType: ForumAuthorType;
  authorName: string;
  authorAvatarUrl?: string;
  parentReplyId?: string;
  isEdited: boolean;
  editedAt?: Date;
  isSolution: boolean;
  createdAt: Date;
}

export class ThreadDetailResponseDto extends ThreadResponseDto {
  replies: ReplyResponseDto[];
  category: {
    id: string;
    name: string;
  };
}

export class PaginatedThreadsDto {
  data: ThreadResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
