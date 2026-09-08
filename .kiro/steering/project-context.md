---
inclusion: always
---

# ATF ACMP — Project Context

## Overview

**Project:** ATF AI-Challenge Management Platform (ACMP)  
**Client:** African Technology Forum (ATF)  
**Purpose:** Manage ATF's cohort-based AI innovation program with 2,500+ teams per cohort

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui (new-york style) |
| State | Zustand (client), TanStack React Query (server) |
| Forms | React Hook Form + Zod |
| Backend | NestJS, TypeORM, PostgreSQL |
| Real-time | Socket.io |
| Queue | BullMQ + Redis |
| Auth | Firebase (participants/staff), Magic Link (orgs/mentors) |
| Storage | AWS S3 |
| AI | Google Gemini |
| Email | Mailchimp Transactional (Mandrill) |

## Portal Structure

| Portal | URL | Users | Mobile |
|--------|-----|-------|--------|
| Staff | `/portal/*` | ATF admins, evaluators | Desktop-first |
| Organization | `/org/*` | Companies submitting briefs | Desktop-first |
| Participant | `/app/*` | Challenge participants | **Mobile-first** |
| Mentor | `/mentor/*` | Assigned mentors | **Mobile-first** |

## Brand Colors

- **Primary:** `#F70035` (ATF Red)
- **Text:** `#000000` (Black)
- **Background:** `#FFFFFF` (White)

## Key Documents

Planning documents are in `/Users/salm/Documents/projects/atf/pmp/`:
- `WIREFRAMES.md` — UI wireframes for all portals
- `TASK_BREAKDOWN.md` — Granular implementation tasks
- `DESIGN_SYSTEM.md` — Colors, typography, components
- `STATEMENT_OF_WORK.md` — Project scope and deliverables

## Architecture Decisions

1. **Monorepo** — `/apps/api` (NestJS), `/apps/web` (Next.js), `/packages/shared`
2. **Portal route groups** — `(staff)`, `(organization)`, `(participant)`, `(mentor)`
3. **TypeORM entities** — Not Prisma, use decorators and migrations
4. **PWA** — Participant and Mentor portals with offline support
5. **Bottom navigation** — Mobile participant/mentor portals only
