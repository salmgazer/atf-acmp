---
inclusion: fileMatch
fileMatchPattern: "**/*.controller.ts,**/*.service.ts,**/api/**/*.ts"
---

# API Conventions

## RESTful Endpoints

### URL Patterns

```
GET    /api/{resource}          # List (paginated)
GET    /api/{resource}/:id      # Get single
POST   /api/{resource}          # Create
PATCH  /api/{resource}/:id      # Update
DELETE /api/{resource}/:id      # Delete
POST   /api/{resource}/:id/{action}  # Custom action
```

### Examples

```
GET    /api/cohorts
GET    /api/cohorts/:id
POST   /api/cohorts
PATCH  /api/cohorts/:id
POST   /api/cohorts/:id/activate

GET    /api/teams?cohortId=xxx&status=active
POST   /api/teams/:id/invite
POST   /api/teams/:id/submit
```

## Response Format

### Success Response

```json
{
  "data": { ... },
  "message": "Operation successful"
}
```

### List Response (Paginated)

```json
{
  "data": [ ... ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

### Error Response

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Invalid email format" }
  ]
}
```

## HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (not logged in) |
| 403 | Forbidden (no permission) |
| 404 | Not Found |
| 409 | Conflict (duplicate, etc.) |
| 500 | Server Error |

## Authentication

### Participant & Staff (Firebase)

```typescript
// Request header
Authorization: Bearer <firebase_id_token>

// Backend validates with Firebase Admin SDK
const decodedToken = await auth().verifyIdToken(token);
```

### Organization & Mentor (Magic Link)

```typescript
// Step 1: Request code
POST /api/auth/magic-link
{ "email": "user@example.com", "portal": "organization" }

// Step 2: Verify code
POST /api/auth/verify-code
{ "email": "user@example.com", "code": "123456" }

// Response includes session token
{ "data": { "token": "...", "user": { ... } } }
```

## Authorization (RBAC)

### Roles

```typescript
enum Role {
  SUPER_ADMIN = 'super_admin',
  PROGRAM_MANAGER = 'program_manager',
  EVALUATOR = 'evaluator',
  VIEWER = 'viewer',
  ORGANIZATION = 'organization',
  PARTICIPANT = 'participant',
  MENTOR = 'mentor',
}
```

### Route Protection

```typescript
@UseGuards(AuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.PROGRAM_MANAGER)
@Post('cohorts')
async createCohort(@Body() dto: CreateCohortDto) { ... }
```

## Request Validation

Use `class-validator` decorators:

```typescript
export class CreateTeamDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name: string;

  @IsUUID()
  cohortId: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  memberIds?: string[];
}
```

## Pagination

### Request

```
GET /api/teams?page=1&limit=20&sort=createdAt&order=desc
```

### Service Implementation

```typescript
async findAll(options: PaginationOptions) {
  const [data, total] = await this.repo.findAndCount({
    skip: (options.page - 1) * options.limit,
    take: options.limit,
    order: { [options.sort]: options.order },
  });
  
  return {
    data,
    meta: {
      total,
      page: options.page,
      limit: options.limit,
      totalPages: Math.ceil(total / options.limit),
    },
  };
}
```

## Audit Logging

Log all mutations with:

```typescript
interface AuditLog {
  actor: string;       // User ID
  action: string;      // CREATE, UPDATE, DELETE
  entityType: string;  // 'cohort', 'team', etc.
  entityId: string;
  before: object;      // Previous state (for UPDATE/DELETE)
  after: object;       // New state (for CREATE/UPDATE)
  timestamp: Date;
}
```
