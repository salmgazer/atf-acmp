# ACMP local code review — 2026-11-02

Reviewed revision: `3118cbf` on `develop`.

This report covers the API, web application, shared contracts, entities and migrations, local containers, and deployment definitions. It records 33 findings and a coordinated remediation plan. Application fixes are tracked below as they are implemented and verified.

## Resolution checklist

Checked means the implementation and its relevant local regression checks have passed. Staging verification is tracked separately and is not implied by a checked local fix.

- [x] R01 — Authentication and route authorization defaults
- [x] R02 — Secret-free API responses
- [x] R03 — Safe rich-text input and rendering
- [x] R04 — Atomic single-use magic codes
- [x] R05 — Atomic single-use password resets
- [x] R06 — Organization roles and ownership
- [x] R07 — Mentor session ownership and transitions
- [x] R08 — Channel and message authorization
- [x] R09 — Departed channel membership revocation
- [x] R10 — Confirmed participant membership
- [x] R11 — Session revocation and account access rules
- [x] R12 — Public organization submission isolation
- [x] R13 — Explicit forum roles and visibility
- [x] R14 — Partner login portal contract
- [x] R15 — Complete stage migrations
- [x] R16 — Submission eligibility and requirements
- [x] R17 — Transactional membership/capacity/booking invariants
- [x] R18 — Shared previews and distributed socket events
- [x] R19 — Production evaluation contract and evidence
- [x] R20 — Recoverable evaluation queue lifecycle
- [x] R21 — Correct leaderboard queries and ranking controls
- [x] R22 — Consistent timezone-aware scheduling
- [x] R23 — Private storage and runtime permissions
- [x] R24 — Reliable migration/startup/deployment configuration
- [x] R25 — Server-owned scoring rules and deadlines
- [x] R26 — Consistent frontend session lifecycle
- [x] R27 — Canonical notification/socket identities
- [x] R28 — Valid navigation, email, and notification links
- [x] R29 — Downloadable certificates and verification URLs
- [x] R30 — Full test/lint/build gates
- [x] R31 — Safe, useful audit records
- [x] R32 — Explicit participant restoration and nullable-field cleanup
- [x] R33 — Strict query parsing and pagination
- [ ] Staging — Migrated PostgreSQL/Redis, two API replicas, browser journeys, AWS storage/roles, and external integrations verified

## Verified remediation evidence

All 33 source fixes have been implemented. Checked items refer to local implementation and regression checks, with deployment verification tracked separately below.

| Findings | Implemented behavior and local evidence |
| --- | --- |
| R01, R06–R08, R10, R13 | Authentication by default; explicit staff, partner, participant, mentor, channel, claim/session, cohort and forum ownership policies. Guard regression matrix and real HTTP/socket authentication checks. |
| R02–R03 | Secret columns excluded by default, recursive response/audit redaction, restricted server HTML sanitization and browser DOMPurify rendering. PostgreSQL nested-relation checks and a real Chrome XSS regression. |
| R04–R05, R11 | Hashed codes/reset tokens, atomic consumption, SQL null cleanup, session-bound JWTs, domain-account checks and revocation. Concurrent PostgreSQL, replay, expiry, attempt-limit, logout and archived-cohort tests. |
| R09, R18, R27 | Explicit active membership filters; removal after transaction commit; canonical UUID identities; Redis previews and Socket.IO adapter. Two local replicas passed broadcast, session revocation, channel eviction and shared-cache tests. |
| R12, R14, R26, R28 | Public form cannot overwrite existing accounts; partner login/resend use the organization contract; HttpOnly refresh cookie, synchronized token state, server logout, validated return paths and legacy redirects. Unit, local HTTP and browser checks. |
| R15–R17, R21–R22, R32 | Forward migration, transaction-bound writes, capacity/uniqueness/booking constraints, submission policy and stored-file checks, corrected leaderboard queries, Luxon scheduling and explicit account restoration. Empty-database migration/parity and concurrent PostgreSQL checks; timezone and requirements tests. |
| R19–R20, R25 | Shared evaluation eligibility, persisted rubric/prompt, document extraction and actual uploads, repository source samples, explicit missing-provider failure, recoverable deterministic queue IDs, cancellation checks, server-owned bounded scoring and review deadlines. Deterministic processor/service/prompt/scoring fixtures. |
| R23–R24, R29–R31, R33 | Region-aware private signed assets, runtime IAM role, explicit migration owner and fail-closed workflow, readiness, PDF certificates, working full test/lint/build gates, safe before/after audits and strict query parsing. Presigning/PDF/audit/DTO tests, successful Terraform validation and shell/YAML checks. |

Final local verification: **261 tests passed across all 12 API suites, with zero failures or skips**, including PostgreSQL and Redis integration checks; **all four Chrome regressions passed** on Next.js 15.3.9. Workspace type checks, production builds, lint (zero errors; existing warnings remain), Terraform validation, merged Compose validation, and shell syntax checks passed. Final authentication checks cover missing/unverified Firebase email linking, replacement of existing identities, imported versus inactive mentors, archived cohorts, authenticated mutation actors, and ordinary members leaving their own teams.

The running Docker API and web containers were repaired and recreated with the dependency-sync startup script. Both compile/start, API readiness and partner login return HTTP 200, and the Linux API container passed generated-video duration probing and PDF generation/text extraction checks. The development database was backed up privately to `/tmp/acmp-local-before-remediation.dump`; its verified legacy schema was baselined and forward migrations applied. It now has zero entity/schema differences and successful stage queries. Other data, Redis, and storage volumes were retained.

The dependency install reported a warning for the existing Next.js 15.3.2. The app and matching ESLint config were updated within the same 15.3 series to 15.3.9. No advisory registry audit was run, and this does not assert that all dependencies are free of vulnerabilities.

If dependencies change later, use `docker compose restart api web`; development startup compares the lockfile and manifests and installs missing locked dependencies before launching the watchers. A legacy synchronized development database can adopt migrations once with `npm run migration:baseline -w @acmp/api -- --acknowledge-existing-schema`, after a backup. That command refuses production/staging, existing migration history, or unrelated schema differences.

### Rollout requirements

- Run the forward migration once before starting the new API replicas. Existing conflicting memberships/claims/jobs must be reconciled if its unique indexes reject old data; no production records are automatically deleted.
- The scheduled-session migration treats existing timestamp values as UTC. Confirm that assumption against deployed data before rollout.
- Configure the Terraform output role ARNs, explicit migration subnet/security group, frontend origin and API URL (including `/api`), Redis, `GEMINI_API_KEY`/`GEMINI_MODEL`, GitHub and Google Calendar/SMTP secrets in the deployment environment. No cloud resources or secrets were changed by this local work.
- Existing access tokens without a session ID require sign-in again. Refresh credentials now use an HttpOnly cookie. Legacy blob-only submission attachments must be uploaded again.
- Evaluation extracts PDF/DOCX/text documents (maximum five, 25 MB each), includes bounded repository samples and explicitly labels linked videos as references; it does not claim to watch videos or execute submitted code. Review those limitations when setting stage rubrics.
- Staging browser journeys, external delivery/integrations, deployed storage permissions and multi-replica load-balancer behavior remain unchecked. Registry advisory auditing remains skipped as requested.

## Original review evidence and limits

Evidence comes from source inspection, Nest route metadata, TypeORM metadata and generated SQL, isolated service calls with in-memory dependencies, validation checks, linting, and the existing test suites. The isolated checks did not connect to a database or external integrations.

Live PostgreSQL/Redis, browser journeys, deployed AWS resources, email delivery, Google Calendar, S3, OneSignal, and Gemini were not exercised. Deployment findings describe the checked-in configuration; they do not assert that deployed resources have identical configuration. A dependency registry audit was skipped at the user's request. No dependency vulnerability conclusion is made.

The previous type-check passed in all four workspaces. The default Jest selection passed 148 tests in 5 suites. Running all 8 suites, including the explicitly excluded files, produced 161 passes and 46 failures out of 207 tests. Of the failures, 23 are in cohorts, 18 in teams, and 5 in the evaluation processor. Many failures are stale mocks or expectations, not independently established product defects.

The root lint command fails. API/shared/validators lack an ESLint 9 configuration. Web lint reports 85 errors and 260 warnings. CI runs type-checking and the default test selection, but not lint; Next.js disables build-time type and lint enforcement.

Severity indicates impact and repair priority: critical issues expose administration, credentials, or executable content to unauthorized users; high issues compromise access, results, data integrity, or a core workflow; medium issues affect reliability, usability, or assurance.

## Findings

### R01 — Critical: business administration routes have no authentication guard

Evidence: [application guards](../apps/api/src/app.module.ts), [teams and invitations](../apps/api/src/modules/teams/teams.controller.ts), [briefs](../apps/api/src/modules/briefs/briefs.controller.ts), [participants](../apps/api/src/modules/participants/participants.controller.ts), [mentors](../apps/api/src/modules/mentors/mentors.controller.ts), [mentor payments](../apps/api/src/modules/mentors/mentor-payments.controller.ts). The only global guard is throttling. A route inventory found 120 of 410 handlers without a JWT guard; 18 are intentionally public auth/health/setup/verification/leaderboard/form handlers, leaving 102 handlers in business controllers without JWT protection. Swagger bearer annotations do not enforce authentication.

Impact: unauthenticated callers can reach participant/mentor management, team membership and invitations, brief review, session administration, and payment-record mutations. Several methods trust actor or participant IDs supplied in the body.

Fix: establish authentication by default, explicitly mark intentional public endpoints, and define role and object-ownership rules for every business action. Derive the actor from the authenticated principal.

Regression: inventory every route; anonymous calls to protected routes must return 401, wrong roles 403, and intended public routes must remain usable. Include invitation acceptance and staff-only mutations.

### R02 — Critical: API responses expose authentication secrets

Evidence: [participant fields](../apps/api/src/database/entities/participant.entity.ts), [participant queries](../apps/api/src/modules/participants/participants.service.ts), [user fields](../apps/api/src/database/entities/user.entity.ts), [user endpoint](../apps/api/src/modules/users/users.controller.ts), [team member relation](../apps/api/src/database/entities/team.entity.ts). Password hashes and reset tokens are selected by default. Participant endpoints return entities directly; team members eagerly load participant entities. No global response serializer removes those fields. The TypeORM metadata check confirmed the sensitive participant fields are selected.

Impact: the unguarded participant list/detail routes expose password hashes and active password-reset tokens. A reset token can authorize a password change without access to the recipient's mailbox. Authenticated user lookups and nested relations also expose unnecessary secret fields.

Fix: return explicit response DTOs, make secret columns non-selectable by default, explicitly select them only in authentication code, and recursively exclude secrets from nested responses and logs.

Regression: inspect serialized responses across participant, user, team, journal, and organization routes; no password hash, reset token, or refresh token may appear.

### R03 — Critical: stored HTML is rendered without sanitization

Evidence: [brief writes](../apps/api/src/modules/briefs/briefs.service.ts), [public brief submission](../apps/api/src/modules/public/public.service.ts), [staff brief detail](<../apps/web/src/app/(staff)/staff/briefs/[id]/page.tsx>), [participant brief detail](<../apps/web/src/app/(participant)/participant/briefs/[id]/page.tsx>), [forum rendering](../apps/web/src/components/forum/thread-detail.tsx). These screens use `dangerouslySetInnerHTML` for persisted content. No HTML sanitizer is applied on these paths. The unused generic input-encoding interceptor is not a rich-text sanitizer. Tokens are available to browser JavaScript.

Impact: malicious persisted HTML can execute in another user's session, including staff sessions, and read browser-accessible tokens.

Fix: define a restricted rich-text HTML policy, sanitize persisted content on input and existing content on display, and prohibit executable attributes, unsafe URL schemes, and unsupported elements. Harden session storage as part of R26.

Regression: malicious event handlers and unsafe links must be removed from briefs, revisions, and forum content while supported formatting survives. Exercise this in a browser.

### R04 — High: a used magic code remains eligible for verification

Evidence: [magic code verification](../apps/api/src/auth/magic-link.service.ts), around lines 133–177. The query uses `usedAt: undefined`. Generated SQL from the installed TypeORM version omits that predicate rather than generating `used_at IS NULL`.

Impact: marking a code used does not prevent subsequent verification before expiry and the attempt limit. Parallel verification can also race the attempt counter and consumption.

Fix: use an explicit null predicate and atomically consume an unexpired, unused code. Make attempt updates concurrency-safe and generate codes with a cryptographic random source.

Regression: the first valid verification succeeds; every later or concurrent use fails; attempt limits and expiry remain enforced.

### R05 — High: password reset does not clear its token

Evidence: [password reset](../apps/api/src/auth/auth.service.ts), around lines 534–588. Both participant and staff resets assign `undefined` to the reset token and expiry before `save`. An isolated TypeORM persistence check confirmed that these assignments produce no column changes; assigning `null` does.

Impact: a successfully used reset link can be reused until its original expiry. Concurrent reset requests are also not consumed atomically.

Fix: clear nullable fields with actual SQL nulls, store a digest rather than the raw reset token, and consume the token with a conditional transactional update.

Regression: a reset succeeds once, fails on replay, fails after expiry, and has one winner under concurrent requests.

### R06 — High: authentication alone grants organization administration

Evidence: [organization controller](../apps/api/src/modules/organizations/organizations.controller.ts), particularly update/approve/reject/activate/deactivate/bulk-import. Only `JwtAuthGuard` runs. Imported role decorators/guards are not applied, and the service receives no actor ownership context. [Admin mentor sessions](../apps/api/src/modules/mentors/mentor-claims.controller.ts) similarly requires login without a staff role.

Impact: participants and other logged-in non-staff users can invoke staff organization workflows and read all mentor sessions.

Fix: add explicit staff roles to administrative operations, restrict partner changes to their own organization, and resolve organization membership through `OrganizationUser` rather than only matching the primary email.

Regression: exercise each operation as every role and as an owner/non-owner organization contact.

### R07 — High: mentor session actions do not verify ownership

Evidence: [session controllers](../apps/api/src/modules/mentors/mentor-claims.controller.ts), around lines 174–294; [booking/update/cancel/complete services](../apps/api/src/modules/mentors/mentor-claims.service.ts). Session actions pass a session or claim ID without the authenticated actor. Update/cancel/rate routes do not validate that a session belongs to the route's claim. Mentor confirmation/completion also does not verify the assigned mentor.

Impact: another logged-in user can read, book, reschedule, cancel, confirm, complete, or rate another team's sessions. Completing a session affects claims and mentor earnings.

Fix: require participant or mentor roles and validate the actor's confirmed team/mentor relationship to both the claim and session. Validate allowed state transitions; cancelled/declined sessions must not become completed directly.

Regression: cross-team and cross-mentor actions return 403; mismatched parent/session IDs fail; only valid transitions affect earnings and session counts.

### R08 — High: channel management and message reads lack authorization

Evidence: [channel controller](../apps/api/src/modules/chat/chat.controller.ts), around lines 98–181; [chat service](../apps/api/src/modules/chat/chat.service.ts). Channel lookup, message listing, archive/delete, and member additions/removals do not verify the requesting user's membership or administrative role. Membership checks in message creation do not protect these separate paths.

Impact: any logged-in user who obtains a channel ID can read its messages, modify its membership, or destroy the channel. Adding oneself can grant later message access.

Fix: centralize channel read/admin policy and apply it to every REST and socket action. Ensure message IDs belong to the supplied channel.

Regression: unrelated users cannot read or mutate private channels, add themselves, react across channels, or remove others.

### R09 — High: leaving a channel does not reliably remove access

Evidence: [membership queries](../apps/api/src/modules/chat/chat.service.ts), around lines 107–165, 260–280 and 409. Queries use `leftAt: null as any`. Generated SQL omits this filter in the installed TypeORM configuration.

Impact: departed members can still be considered members, receive messages/notifications, and rejoin through sockets. Existing sockets also need explicit room removal when access changes.

Fix: use `IsNull()` for active membership, reject departed users consistently, and evict revoked memberships from socket rooms across replicas.

Regression: after leave/removal, REST access, socket joins/sends, broadcasts, and push delivery all stop.

### R10 — High: pending membership grants confirmed-team privileges

Evidence: [JWT participant lookup](../apps/api/src/auth/strategies/jwt.strategy.ts), [submission team lookup](../apps/api/src/modules/submissions/submissions.service.ts), [peer-review lookups](../apps/api/src/modules/peer-reviews/peer-reviews.service.ts), and [journal lookups](../apps/api/src/modules/journals/journals.service.ts). Team membership is selected without `status = confirmed`. Participant-facing handlers frequently lack a participant role guard; an undefined participant ID can also broaden a TypeORM query.

Impact: someone merely waiting for approval to join a team can receive its `teamId`, submissions, reviews, journals, and mentor-claim privileges. Non-participant principals can reach participant handlers with missing identity fields.

Fix: resolve one canonical confirmed team membership for an authenticated participant; reject missing IDs and wrong roles before database queries.

Regression: pending members and non-participant users cannot read or mutate confirmed-team resources; confirmation grants the expected access.

### R11 — High: session revocation and account access rules are inconsistent

Evidence: [JWT validation](../apps/api/src/auth/strategies/jwt.strategy.ts), [logout/session methods](../apps/api/src/auth/auth.service.ts), [organization deactivation](../apps/api/src/modules/organizations/organizations.service.ts), [magic cohort checks](../apps/api/src/auth/magic-link.service.ts). Access JWT validation does not compare issuance time to password changes or consult session revocation. Participant validation always returns active and does not check cohort access. `logoutAllSessions` and session listing query `userId` only, while participant tokens use `participantId`. Organization deactivation changes the organization, not its login user, and magic-link checks do not enforce organization active/approval status.

Impact: password change/logout-all does not immediately invalidate access tokens, participant logout-all misses refresh sessions, and archived/deactivated domain accounts may retain access through some authentication paths.

Fix: use explicit principal and session types, enforce status/cohort/session policy consistently in HTTP and sockets, and implement a deliberate access-token invalidation strategy.

Regression: password reset/change, logout-all, archive, and deactivation revoke the intended access across both token types and sockets.

### R12 — High: a public form overwrites an existing organization by email

Evidence: [public submission service](../apps/api/src/modules/public/public.service.ts), around lines 81–108. An unauthenticated submission matching an existing email updates the organization name, contacts, location, sector, and cohort.

Impact: knowledge of an organization's email is enough to overwrite its profile and move it into the current active cohort without mailbox verification or ownership.

Fix: keep public submissions as pending applications; require verified ownership before updating an existing organization and preserve historical cohort associations.

Regression: submitting another organization's email cannot alter its existing record; a verified owner can follow an explicit update flow.

### R13 — High: organization accounts become forum staff

Evidence: [forum author mapping](../apps/api/src/modules/forum/forum.controller.ts), around lines 187–209; [thread editing/deletion](../apps/api/src/modules/forum/forum.service.ts), around lines 195–215 and 307–320. Every role other than participant or mentor is mapped to `STAFF`. An isolated call confirmed that `organization` maps to staff.

Impact: partner users can edit/delete other users' threads and post in staff-only categories using the ordinary forum API.

Fix: map only explicit staff roles to staff privileges; represent or reject other roles intentionally. Apply cohort visibility rules to category/thread reads as well.

Regression: partners and other non-staff roles cannot use staff-only forum privileges or access another cohort's restricted discussions.

### R14 — High: partner login sends an invalid portal value

Evidence: [partner login](<../apps/web/src/app/(partner)/partners/login/page.tsx>), [magic form](../apps/web/src/components/auth/magic-link-form.tsx), [API portal enum](../apps/api/src/auth/dto/auth.dto.ts). The page passes `partner`; the form sends it unchanged; the API accepts `organization`. A local DTO validation check rejected `partner` and accepted `organization`.

Impact: requesting or resending the login code from the partner portal fails validation.

Fix: use a shared API contract or explicit UI-to-API portal mapping consistently across login, code resend, and reset flows.

Regression: complete partner request-code, resend, verify, redirect, logout, and relogin flows through the UI and API.

### R15 — High: stage entity columns are missing from migrations

Evidence: [stage entity](../apps/api/src/database/entities/stage.entity.ts), [initial schema](../apps/api/src/database/migrations/1720540000000-InitialSchema.sql), and all three migration classes. Comparing entity metadata against the baseline found `requires_ai_evaluation` and `evaluation_prompt` absent from the schema. Unlike password-reset fields, no later migration adds them. Development uses [schema synchronization](../apps/api/src/database/data-source.ts), which can hide this drift.

Impact: a database created only from committed migrations lacks columns that ordinary stage queries select; fresh deployments can fail even when development works.

Fix: add a forward migration for the missing columns, verify the complete migration chain against an empty database, and stop using synchronization as a substitute for migrations.

Regression: migrate an empty PostgreSQL database, inspect schema parity, then create/read/update stages with synchronization disabled.

### R16 — High: final submissions bypass stage and cohort rules

Evidence: [submission service](../apps/api/src/modules/submissions/submissions.service.ts), around lines 164–368. Draft saving checks `stage.isOpen()`, while final submission primarily checks the deadline. Neither path verifies that stage and team belong to the same cohort. Final submission ignores inactive/future stages and disqualified teams. Required text/URL constraints and configured document restrictions are only partially enforced.

Impact: an isolated service call accepted a submission to an inactive future stage in a different cohort. Client-side restrictions do not prevent API submissions.

Fix: share one server-side submission policy covering confirmed membership, team eligibility, cohort match, start/active/deadline rules, resubmission exceptions, and all configured requirements.

Regression: test the policy matrix, including direct final submission without a draft, wrong cohort, future/inactive stage, rejected resubmission, text length, and required URL/file constraints.

### R17 — High: capacity checks and multi-record writes are not atomic

Evidence: [team membership and brief assignment](../apps/api/src/modules/teams/teams.service.ts), [matching finalization](../apps/api/src/modules/matching/matching.service.ts), [team creation](../apps/api/src/modules/matching/team-formation.service.ts), [mentor claims and bookings](../apps/api/src/modules/mentors/mentor-claims.service.ts), and [team constraints](../apps/api/src/database/entities/team.entity.ts). These paths check counts/existence and write later without locks/transactions. Team membership uniqueness is only the team/participant pair, so it does not enforce one confirmed team per participant. Scheduled-session indexes do not prevent overlapping bookings.

Impact: concurrent requests can exceed capacities or create conflicting memberships/claims/bookings. Failure between team, member, participant-status, and counter writes leaves partial state.

Fix: define invariants in database constraints, serialize capacity-sensitive operations with appropriate locks, and wrap related changes in transactions. Make finalization idempotent and revalidate current eligibility.

Regression: run concurrent membership, last-slot brief assignment, mentor claim, and booking tests against PostgreSQL; inject mid-operation failures and verify rollback.

### R18 — High: deployment replicas do not share matching previews or socket events

Evidence: [matching preview map](../apps/api/src/modules/matching/matching.service.ts), [formation preview map](../apps/api/src/modules/matching/team-formation.service.ts), [chat gateway](../apps/api/src/modules/chat/chat.gateway.ts), [notification gateway](../apps/api/src/modules/notifications/notifications.gateway.ts), and [production replica settings](../.github/workflows/deploy-production.yml). Production declares at least two API tasks. Previews and socket presence are process-local; no distributed Socket.io adapter is configured.

Impact: a preview generated by one task may not exist on the task handling finalize. Restarts lose it. Socket broadcasts from one task do not reach clients connected to another.

Fix: store versioned previews with expiry in shared storage, coordinate finalization, and configure a distributed socket adapter/presence strategy. Account for transport routing requirements.

Regression: generate/preview/finalize across two API processes; connect clients to different processes and verify messages, notifications, removal, and reconnect behavior.

### R19 — High: AI evaluation still follows incomplete demo behavior

Evidence: [Gemini prompt](../apps/api/src/modules/evaluations/gemini.service.ts), around lines 140–210; [processor](../apps/api/src/modules/evaluations/evaluation.processor.ts); [batch selection](../apps/api/src/modules/evaluations/evaluations.service.ts), around lines 57–143. Documents are commented out of the prompt; additional submission content and video are not evaluated there. The processor fetches repository metadata/README/tree/commits but no sample source code. It looks for `evaluationCriteria`, which is not a persisted Stage field, and ignores `evaluationPrompt`. Batch selection chooses teams with repositories without requiring approved submissions. If Gemini is unavailable, the worker can still mark the job completed without AI results. The deployment workflows do not supply `GEMINI_API_KEY`.

Impact: configured stage evaluation behavior is not honored; submitted work can be omitted; the system can report completed evaluation without a score. Batch and single-team eligibility differ. The AI path does not update submission status to evaluated, while mentor unlocking checks submission status.

Fix: define one production evaluation contract for eligibility, rubric/prompt source, submitted artifacts, repository evidence, missing integrations, and resulting submission/evaluation states. Wire required secrets through deployment.

Regression: use deterministic AI fixtures to verify the exact submitted evidence and stage settings in the prompt, approval gating, failed/missing-provider behavior, publication, and mentor unlocking.

### R20 — High: queue cancellation and enqueue failure leave inconsistent jobs

Evidence: [evaluation enqueue/cancel](../apps/api/src/modules/evaluations/evaluations.service.ts), around lines 111–129, 182–201 and 237–256; [worker job ID assignment](../apps/api/src/modules/evaluations/evaluation.processor.ts). The returned BullMQ job ID is not stored when enqueueing; `bullJobId` is first set when processing starts. Cancellation removes from the queue only when that ID exists. An isolated pending-job cancellation changed the database state while making zero queue calls.

Impact: a supposedly cancelled waiting job can still run. Redis enqueue failure leaves a pending database job that future attempts skip. Parallel triggers have no deterministic queue ID/active-job uniqueness guarantee.

Fix: persist or derive a deterministic queue job ID at enqueue, make database/queue transitions recoverable, and have workers respect cancellation and retry state.

Regression: cancel waiting/delayed jobs, simulate enqueue failure, retry safely, and trigger concurrent evaluation requests without duplicate work.

### R21 — High: leaderboard queries an absent column and ignores ranking controls

Evidence: [leaderboard service](../apps/api/src/modules/leaderboard/leaderboard.service.ts), around lines 106–155 and 165–202. Membership/country queries reference `p.teamId`, but Participant has no such field or database column. Generated SQL retains the invalid reference. The accepted `stageId` filter is not used to select the ranking stage, and `Number(stage.weightPercentage) || 1` converts a configured zero weight into a contributing weight.

Impact: a non-empty leaderboard fails its membership query, also blocking certificate generation that depends on it. After that query is repaired, stage filters and zero weights would still produce incorrect rankings. The public team-rank method also calls an administrative leaderboard path, bypassing the normal visibility decision.

Fix: join through confirmed `TeamMember` records, implement stage-filter semantics, preserve zero weights, define missing-score behavior, and enforce public visibility consistently.

Regression: use a real database with non-empty teams; verify country/member counts, selected-stage ranking, zero weights, hidden leaderboard access, ties, and certificate ranking inputs.

### R22 — High: mentor availability and scheduling disagree

Evidence: [available slots](../apps/api/src/modules/mentors/mentor-availability.service.ts), around lines 419–545; [booking and rescheduling](../apps/api/src/modules/mentors/mentor-claims.service.ts), around lines 529–772. Available slots exclude only scheduled sessions, not confirmed ones. Timezone is returned as a label without conversion. Booking uses server-local `setHours`, overlap assumes 45 minutes, duration selection uses the first weekly slot, and rescheduling does not repeat availability/conflict validation. The window check validates start time but not that the full session fits.

Impact: the UI can offer occupied slots; bookings can shift across timezones, exceed availability, overlap sessions of other lengths, or be rescheduled into conflicts. Past-date validation is also absent from these service checks.

Fix: use one timezone-aware slot calculation and validation path for viewing, booking, confirming, and rescheduling. Use actual duration/buffers and all blocking statuses, with database concurrency protection from R17.

Regression: test multiple timezones, end-of-range dates, confirmed sessions, custom durations, window boundaries, buffers, past slots, and reschedule conflicts.

### R23 — High: checked-in storage configuration cannot serve returned upload URLs

Evidence: [upload configuration](../apps/api/src/common/services/upload.service.ts), around lines 50–94; [private S3 bucket](../deploy/terraform/s3.tf); [S3 IAM policy](../deploy/terraform/iam.tf); [production workflow](../.github/workflows/deploy-production.yml). `S3_REGION` is defaulted to `us-east-1` before the legacy AWS region fallback, so `AWS_REGION` alone cannot supply the intended region. Terraform blocks all public bucket access while the app returns unsigned public object URLs. The S3 policy is attached to the execution role, and the workflow does not specify a runtime task role for the SDK.

Impact: the declared AWS configuration can reject uploads or return inaccessible files. The local S3 emulator does not exercise these production conditions.

Fix: resolve region consistently, assign least-privilege runtime credentials, and use authorized downloads/signed URLs or a deliberate asset-distribution policy compatible with bucket privacy.

Regression: validate an uploaded private document and a public profile image under the intended AWS role and region, including unauthorized access denial.

### R24 — High: migration/startup behavior can report success with an invalid schema

Evidence: [container entrypoint](../apps/api/docker-entrypoint.sh), around lines 29–41; [API Docker health check](../apps/api/Dockerfile), around lines 92–94; [migration workflow](../.github/workflows/deploy-production.yml). The entrypoint continues after migration failure. Every non-development API replica runs migrations even though CI also runs a migration task. The workflow exits successfully when no running task is available to derive migration networking. The Docker health check calls `/health`, while the API uses `/api/health`; Compose also overrides the API port to 3001 while the health check hard-codes 3000.

Impact: first deployment/migration failure can be hidden, parallel startup can race migrations, and Docker marks a functioning API unhealthy. Production deployment also omits Google Calendar credentials that are present in staging.

Fix: give migrations one explicit, failing-on-error owner, supply networking independently of an existing running service, gate deployment on migration success, and align health route/port and environment contracts.

Regression: empty-environment deployment, failed migration, two-task rollout, container health, and production configuration checks must produce the expected success/failure status.

### R25 — High: scoring trusts submitted denominators and incomplete criteria

Evidence: [peer-review calculation](../apps/api/src/modules/peer-reviews/peer-reviews.service.ts), around lines 245–325; [peer-review DTO](../apps/api/src/modules/peer-reviews/dto/peer-review.dto.ts); [human scoring](../apps/api/src/modules/evaluations/evaluations.service.ts), around lines 458–490; [AI parsing](../apps/api/src/modules/evaluations/gemini.service.ts), around lines 311–367. Submitted `maxScore` values drive normalization instead of the stored rubric. Criteria are not checked for complete/unique coverage or bounded scores; peer-review submission does not enforce `dueDate`. A DTO check accepted a peer score of 1000 with a max of 1.

Impact: scores above the intended range, duplicate/missing criteria, invalid denominators, and late reviews can be persisted. AI output can also omit criteria or supply invalid scores. Human scoring does not apply rubric criterion weights.

Fix: resolve names, maxima, and weights from the server-owned rubric; validate every criterion exactly once, reject invalid ranges/non-finite results, and enforce due dates and assignment state.

Regression: reject excessive scores, zero/negative denominators, duplicates/missing/unknown criteria, late submissions, and malformed AI results; verify weighted results numerically.

### R26 — Medium: frontend token refresh and logout leave divergent session state

Evidence: [Axios refresh](../apps/web/src/lib/api/client.ts), [auth store](../apps/web/src/lib/stores/auth-store.ts), [auth helpers](../apps/web/src/lib/auth/index.ts), and portal layouts. The Axios refresh path updates localStorage/cookie but not Zustand's token/user, while sockets use the Zustand token. Layout logout calls the store directly, which leaves `refresh_token` behind and does not invoke server logout. Magic login returns an empty refresh token and claims 24-hour expiry while the access token is signed for one hour; the form does not consistently clear old refresh credentials.

Impact: REST can refresh successfully while sockets or direct fetches retain an expired token. Logout does not consistently terminate the server session, and a previous refresh credential can survive account/portal switching.

Fix: centralize session issuance/refresh/logout, synchronize every consumer, clear all credentials on identity changes, and use a consistent secure cookie/session strategy. Report the actual token lifetime.

Regression: force expiry while HTTP and sockets are active; log out/in as another role; verify no old credential, socket identity, or session can be reused.

### R27 — Medium: notification and socket identities use different ID domains

Evidence: [notification gateway](../apps/api/src/modules/notifications/notifications.gateway.ts), [notification recipient mapping](../apps/api/src/modules/notifications/notifications.controller.ts), [JWT generation](../apps/api/src/auth/auth.service.ts), and [chat REST mentor ID mapping](../apps/api/src/modules/chat/chat.controller.ts). Participant JWT `participantId` is the external participant code, but stored notification recipients use the participant UUID. An isolated socket connection joined `participant:ATF-001` instead of `participant:<UUID>`. Mentor/organization JWT subjects are User IDs, while some domain notifications and channel memberships use Mentor/Organization IDs; JWT validation does not enrich those IDs. The chat gateway also omits the mentor ID resolution used by REST.

Impact: real-time delivery and mentor chat can fail despite successful login and working REST requests. Identity/presence checks can disagree between transports.

Fix: use typed principal, participant, mentor, and organization identifiers with one canonical resolver shared by REST, sockets, storage, and push delivery.

Regression: send and receive chat/notifications for each role with deliberately different User and domain IDs, including after refresh and reconnect.

### R28 — Medium: navigation and messages still use retired routes

Evidence: [notification links](../apps/api/src/modules/notifications/notification-triggers.service.ts), [email templates](../apps/api/src/email/email.service.ts), [participant imports](../apps/api/src/modules/participants/participants.service.ts), [public welcome](../apps/api/src/modules/public/public.service.ts), and participant dashboard/team/mentor/journal/peer-review components. Links still use `/app/*` and `/org/*`; those routes no longer exist in source. Evaluation push links use `/participant/evaluations`, which also has no page. Only the newer portal paths are implemented.

Impact: welcome emails, team invitations, submission cards, mentor actions, journal/review navigation, and notifications can lead to 404s.

Fix: centralize route builders, update all producers/consumers, and add deliberate redirects for already-sent legacy links.

Regression: crawl internal links and click generated email/notification destinations for every portal, including legacy URLs.

### R29 — Medium: certificate download has no matching output contract

Evidence: [certificate generation](../apps/api/src/modules/certificates/certificates.service.ts), [download endpoint](../apps/api/src/modules/certificates/certificates.controller.ts), and [participant download handler](<../apps/web/src/app/(participant)/participant/certificates/page.tsx>). Generation sets status to generated but creates no PDF URL. Without a PDF, the API returns certificate metadata; the client only opens `response.pdfUrl`, so nothing happens. If a PDF exists, the endpoint redirects rather than returning that JSON shape. Verification URLs use `app.url`, which is not defined in configuration, and fall back to a different host.

Impact: a generated certificate can display a working-looking Download button that produces no document, and verification links can target the wrong site. Download authorization should also reject missing participant context instead of conditionally skipping ownership checks.

Fix: define a real document generation/download contract, use the configured public frontend URL, and enforce explicit certificate ownership/role rules.

Regression: generate a certificate, download a valid document in a browser, verify its public URL, and deny unauthorized downloads.

### R30 — Medium: CI and local checks do not cover the declared behavior

Evidence: [Jest exclusions](../apps/api/jest.config.js), [Next build bypasses](../apps/web/next.config.ts), [workflow gates](../.github/workflows/deploy-production.yml), workspace lint scripts, and the observed results above. Three suites are explicitly excluded; there are no frontend journey tests. Many critical paths such as authorization, actual SQL generation, and migration parity are not exercised by the current passing suite.

Impact: green checks currently coexist with the verified login/schema/authorization failures. Ordinary build success does not establish application correctness.

Fix: repair outdated mocks/expectations, re-enable suites, restore working lint configuration, add authorization/DB/browser coverage for the findings, and enforce those checks in CI before deployment.

Regression: run every suite without exclusions, lint all workspaces, type-check, build, and exercise representative portal journeys against migrated PostgreSQL/Redis.

### R31 — Medium: audit redaction is shallow and omits reset secrets

Evidence: [audit interceptor](../apps/api/src/common/interceptors/audit.interceptor.ts), around lines 78–102. Redaction only removes a small list of top-level fields. It does not remove `passwordResetToken` or secrets inside relations/arrays. The interceptor stores returned entities as audit `after` data. It records no previous state for updates/deletes, and caller-supplied actor fields exist in several mutation DTOs.

Impact: credential material from nested participant/user records can be retained in audit logs and exposed to log readers; audit records do not consistently provide the actor/change history expected for incident analysis.

Fix: redact recursively with an explicit safe audit payload, use authenticated actor context, and capture before/after or deliberate field diffs where required.

Regression: nested objects and arrays containing every sensitive field are redacted, actor spoofing fails, and update/delete records retain useful safe change evidence.

### R32 — Medium: soft-deleted participants are not restored by assigning undefined

Evidence: [participant create/import restore paths](../apps/api/src/modules/participants/participants.service.ts), around lines 80–117 and 343–386. They assign `deletedAt: undefined` and clear some credentials with `undefined`. The installed TypeORM behavior demonstrated in R05 skips such values.

Impact: a reimport may report success while the participant remains soft-deleted, and stale credentials can remain in place. The same null-clearing mistake appears in other domain cleanup paths.

Fix: use TypeORM restore or explicit null updates in a transaction, define credential-reset behavior, and audit all intentional nullable-field clears across the project.

Regression: delete, reimport, and log in with the intended new credentials; verify the old credentials and old associations cannot survive unexpectedly.

### R33 — Medium: query boolean coercion treats false as true

Evidence: [evaluation query DTO](../apps/api/src/modules/evaluations/dto/evaluation.dto.ts), [global implicit conversion](../apps/api/src/main.ts), and similar query DTOs. A local `plainToInstance` check converted `{ isPublished: 'false' }` to `isPublished: true` because `@Type(() => Boolean)` uses JavaScript truthiness.

Impact: filters for unpublished evaluations or other false-valued states can select the opposite records. Several numeric pagination fields also lack integer/minimum/maximum constraints.

Fix: parse booleans explicitly, validate bounded positive integer pagination, and use shared tested query conversion rules.

Regression: test `true`, `false`, absent, invalid strings, zero/negative/fractional pages, and excessive limits through actual HTTP requests.

## Coordinated remediation plan

1. **Access and secret containment — R01–R13, R25, R31.** Create a route/role/ownership matrix; close public and authenticated authorization gaps; stop secret serialization and stored script execution; repair one-time credentials and membership/null handling. These changes need negative authorization tests across roles and resources.
2. **Contracts and persistent state — R14–R17, R21, R32–R33.** Align partner portal values, add forward migrations, centralize confirmed membership and submission policies, replace invalid leaderboard queries, and enforce transactional invariants. Validate against a database created only from migrations.
3. **Workers, replicas, scheduling, and sessions — R18–R20, R22, R26–R27.** Make previews/events shared across tasks, repair queue lifecycle and AI evidence/settings, unify identity/session handling, and use one timezone-aware booking policy. Test failure and concurrent paths.
4. **Deployment and complete user journeys — R23–R24, R28–R30.** Align runtime roles/private assets/integration secrets/health checks, fix generated links and certificate documents, repair test/lint gates, and run end-to-end journeys before rollout.

Keep these as one coordinated remediation effort with reviewable changes in dependency order. A single deployment can be considered after all required checks pass; combining every change into one unreviewable patch would make regressions harder to isolate. Schema migrations must preserve existing production data.

## Completion criteria for the fix effort

- Every route has an intentional public/authenticated/role/ownership policy with negative tests.
- API responses and logs contain no credentials; malicious rich text does not execute.
- Codes and reset tokens are single-use; logout/status changes behave consistently across transports.
- The migration chain creates a schema matching the entities without synchronization.
- Team/capacity/booking invariants hold under concurrency and rollback.
- All portal login and core program journeys work against PostgreSQL/Redis, including two API processes.
- Evaluation input, scoring, queue state, publication, rankings, and certificates agree with configured program rules.
- Private files, runtime permissions, required integrations, migration failure handling, and health checks work in staging.
- Full tests, lint, type-checking, production builds, and browser journeys pass before release.

## Reproducing the local checks

Run commands from the `acmp` directory. Watchman was disabled to avoid its attempt to write outside the workspace.

```sh
npm run type-check
npm test -w @acmp/api -- --runInBand --watchman=false
npm test -w @acmp/api -- --runInBand --watchman=false --testPathIgnorePatterns=/node_modules/
npm run lint
```

Additional read-only diagnostics loaded TypeORM metadata without initializing a database connection, inspected generated SQL, inspected Nest guard metadata, and invoked service methods with in-memory repositories. The observed results included omitted null/undefined predicates, unchanged reset fields when cleared with undefined, absent stage/membership columns, a rejected partner portal DTO, an accepted inactive cross-cohort submission, a cancelled database job with no queue operation, a notification room using an external participant code, an organization mapped to forum staff, an accepted peer score of 1000/1, and a false query value converted to true.

## Operational follow-up requiring environment verification

`deploy/terraform/production.tfplan` is tracked, while local Terraform state and tfvars are ignored. A plan can contain sensitive values. Its contents were not dumped during this review. Inspect its sensitivity in a controlled environment and decide whether it should remain in repository history; do not assume that deleting the working file removes prior exposure.

Existing production schema, runtime roles, secret injection, asset delivery, backups/restore, integration credentials, and deployment health must be verified against the actual environment. This local review cannot establish their deployed state. Dependency advisory scanning remains intentionally outside the completed local scope.
