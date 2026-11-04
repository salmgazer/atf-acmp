# Imported mentor invitations and email corrections

- [x] Super Admins and Program Managers can use **Resend Invite** from an imported mentor’s action menu on `/staff/mentors`.
- [x] The email field on `/staff/mentors/:id/edit` is editable while the mentor is **Imported** and read-only for Active/Inactive mentors.
- [x] The API checks the saved status before an email change; submitting `status: imported` together with a new email cannot bypass the restriction.
- [x] Corrections update the mentor and linked login account in one transaction, preserving the user/mentor identities and rejecting conflicting addresses.
- [x] Old login codes, password-reset credentials, Firebase links and sessions are invalidated when the email changes.
- [x] First-login activation uses a conditional status update, so a concurrent login cannot restore the old email.
- [x] Resends use the existing branded mentor welcome email and point to `/mentor/login`, where the mentor requests a fresh login code.
- [x] Missing delivery configuration or provider failures return an error instead of reporting a successful resend.
- [x] Imported mentor rows have selection checkboxes and a **Resend selected invites** bulk action.
- [x] **Resend imported invites** beside Import reaches imported mentors in the selected cohort matching the current filters across every page.
- [x] Bulk sends require confirmation, run in the background and show sent/failed/skipped counts. Progress survives a reload in the same browser tab.

Save an email correction first, then return to the mentor list and resend the invitation. Resending is available only for imported, non-deleted mentors with an active mentor login. Evaluators and Viewers can view mentors but cannot resend invitations or open editing screens. Mentor self-service cannot change the login email.

No database migration or new environment variables are required. Existing email provider settings are used. Tests mock email transports and browser requests, so verification does not send real invitations or modify the application’s mentor records.

## Bulk resend behavior

Only imported, non-deleted mentors can be selected. Selection is limited to the current page and clears when the page, cohort, status, search, capacity filter or view changes. Selected requests are limited to 500 IDs and reject stale or ineligible selections before creating a batch.

The all-imported action requires a cohort and applies search and capacity filters across all pages. It is disabled in Active, Inactive and Deleted views. Both bulk endpoints and progress lookup require Super Admin or Program Manager access.

Redis/BullMQ processes the `mentor-invites` queue with one batch globally across API replicas and approximately one recipient per second. The worker checks current status, uses the existing single-resend service and current email, skips activated/deleted mentors and checkpoints each recipient. Failed recipients are reported using their current email; up to 100 failures are included in the report. It does not automatically replay a failed batch. A process failure between email provider acceptance and checkpointing can produce a duplicate for that recipient on recovery.

Completed jobs are retained for 24 hours, failed jobs for seven days, with a maximum of 1,000 retained jobs per state. The requesting staff principal and queued batch are audit logged. No mentor passwords, email addresses or login sessions are changed by bulk resending.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/mentors/resend-invites` | Queue selected `mentorIds` |
| POST | `/mentors/resend-imported-invites` | Queue imported mentors matching a cohort and filters |
| GET | `/mentors/invite-resends/:jobId` | Get batch progress |

## Validation on 2026-11-04

- [x] All 413 API tests passed with no skips, including PostgreSQL and Redis suites running against disposable local services, filtered bulk selection and worker status checks.
- [x] All 50 browser tests passed, including selected/all-imported batches, filter and pagination behavior, progress recovery, imported-only resend actions, email corrections and role restrictions.
- [x] Workspace type checks and production API/web builds passed.
- [x] Local API readiness passed. The disposable regression database and Redis instance were removed after testing.
