// Generic API response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// Filter types
export interface BaseFilter {
  search?: string;
  status?: string;
  createdFrom?: string;
  createdTo?: string;
}

export interface TeamFilter extends BaseFilter {
  cohortId?: string;
  briefId?: string;
  mentorId?: string;
}

export interface ParticipantFilter extends BaseFilter {
  cohortId?: string;
  country?: string;
  hasTeam?: boolean;
}

export interface BriefFilter extends BaseFilter {
  cohortId?: string;
  organizationId?: string;
  vertical?: string;
}
