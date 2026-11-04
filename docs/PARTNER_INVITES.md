# Partner invitation resends

- [x] Approved, active partners have **Resend Invite** in their action dropdown on `/staff/partners`.
- [x] Rounded grey checkboxes allow selecting eligible partners on the current page, with an indeterminate select-all state.
- [x] **Resend selected invites** confirms and queues the selected partner IDs.
- [x] **Resend approved invites** beside Import reaches approved, active partners in the selected cohort matching the current search/status filters across every page.
- [x] The table has pagination; changing page, search, cohort or status clears the selection.
- [x] Pending, rejected, inactive and deleted partners cannot receive resends, including through the existing single and legacy bulk endpoints.
- [x] Super Admins and Program Managers can send invitations and view batch progress; other roles cannot.
- [x] Background progress reports sent, failed and skipped recipients, with failure emails and recovery after a reload in the same tab.
- [x] The existing branded partner email uses the current organization address, escapes content and requires configured, successful delivery.

Partners use approval status rather than an Imported status. As agreed, only **Approved and active** partners are eligible; this matches the organization login eligibility check. Resending does not change approval status or reset credentials/sessions. It sends the existing organization login instructions at `/partners/login`, where the recipient requests a verification code.

Selected requests accept 1–500 unique UUIDs. If any selected partner is no longer eligible, the entire request is rejected before queueing. Resend-all requires a cohort and applies filters across all pages; country filtering is also supported by the API. No per-cohort staff access restrictions are introduced.

The `partner-invites` BullMQ queue runs one batch globally across API replicas and approximately one recipient per second. Each recipient's eligibility and current email are checked again before delivery. Partners rejected, deactivated or deleted after queueing are skipped. Each result is checkpointed; up to 100 failed recipient addresses are reported. A stopped batch is not automatically retried in full. A process failure after email provider acceptance but before checkpointing can repeat that recipient's invitation when the worker resumes.

Completed jobs are retained for 24 hours and failed jobs for seven days, with at most 1,000 retained jobs in each state. Staff identity and queued batch counts are audit logged. Missing email configuration, provider rejection and delivery exceptions do not count as successful sends. Existing Redis and email settings are used; no new environment variables, dependencies or database migrations are required.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/organizations/resend-invites` | Queue selected `organizationIds` |
| POST | `/organizations/resend-eligible-invites` | Queue approved, active partners matching cohort and filters |
| GET | `/organizations/invite-resends/:jobId` | View batch progress |
| POST | `/organizations/:id/send-invite` | Send a single eligible partner invitation |

Tests mock email delivery and browser API requests. Database integration tests use disposable local services and do not change application partner records.

## Validation on 2026-11-04

- [x] All 442 API tests passed with no skips, including the PostgreSQL and Redis integration suites.
- [x] All 59 browser tests passed, including nine partner invitation scenarios for selection, filtered batches, pagination, progress recovery, delivery errors and role restrictions.
- [x] Workspace type checks and production API/web builds passed.
- [x] The local API readiness check passed with database and Redis connected. Temporary test services were cleaned up.
