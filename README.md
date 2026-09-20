# ATF AI-Challenge Management Platform (ACMP)

Cohort-based innovation program management platform supporting 2,500+ teams per cohort.

## Quick Start (Docker)

```bash
# 1. Copy environment file and add your credentials
cp .env.example .env

# 2. Start all services
docker compose up -d

# 3. View logs
docker compose logs -f
```

Services will be available at:
- **Web App:** http://localhost:3000
- **API:** http://localhost:3001
- **API Docs:** http://localhost:3001/api/docs
- **PostgreSQL:** localhost:5432
- **Redis:** localhost:6379

## Local Development (without Docker)

```bash
# 1. Install dependencies
npm install

# 2. Copy environment files
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 3. Start PostgreSQL and Redis (or use Docker for just these)
docker compose up -d postgres redis

# 4. Start development servers
npm run dev:api   # API on :3001
npm run dev:web   # Web on :3000
```

## Project Structure

```
acmp/
├── apps/
│   ├── api/          # NestJS backend
│   └── web/          # Next.js frontend
├── packages/
│   ├── shared/       # Shared types, constants, utils
│   └── validators/   # Zod validation schemas
├── docker-compose.yml
└── package.json      # npm workspaces root
```

## Portals

| Portal | URL | Auth | Layout |
|--------|-----|------|--------|
| Staff | `/portal/*` | Firebase | Desktop (sidebar) |
| Organization | `/org/*` | Magic link | Desktop (sidebar) |
| Participant | `/app/*` | Firebase | Mobile (bottom nav) |
| Mentor | `/mentor/*` | Magic link | Mobile (bottom nav) |

## Tech Stack

- **Frontend:** Next.js 15, React 19, Tailwind v4, shadcn/ui
- **Backend:** NestJS, TypeORM, PostgreSQL
- **Cache/Queue:** Redis, BullMQ
- **Auth:** Firebase + Magic Links
- **Email:** Mailchimp Transactional

## Scripts

```bash
npm run dev          # Start both API and web
npm run dev:api      # Start API only
npm run dev:web      # Start web only
npm run build        # Build all packages
npm run lint         # Lint all packages
npm run type-check   # Type check all packages
npm run docker:up    # Start Docker services
npm run docker:down  # Stop Docker services
npm run docker:logs  # View Docker logs
```
# Trigger deployment
