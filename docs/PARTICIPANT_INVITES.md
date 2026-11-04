# Resending participant invitations

On `/staff/participants`, Super Admins and Program Managers can:

- [x] Open each participant’s action menu to view the participant or resend an invitation.
- [x] Select pending participants with row checkboxes and use **Resend selected invites**.
- [x] Select all pending participants on the current page with the header checkbox.
- [x] Use **Resend pending invites** beside **Bulk Import** to reach matching participants across every page.
- [x] Review the cohort/filter scope and confirm bulk sends before queuing them.
- [x] See processed, sent, failed and skipped counts, including failed participant IDs.
- [x] Restore the latest batch’s progress after reloading the page in the same browser tab.

**Pending means the participant has not changed their initial password** (`mustChangePassword = true`). Inactive accounts, completed onboarding records, deleted accounts and inaccessible (draft/archived) cohorts are excluded. Participants who already changed their password cannot be selected for this action. Their profile remains available through the action menu.

The all-pending action requires a cohort and respects the current group/ungrouped, status and search filters across all pages. Selection is limited to the current page and clears when pagination, cohort or filters change. Selected requests accept up to 500 IDs and reject stale/ineligible selections before any email is queued. Eligibility is checked again immediately before each email.

Resends use the branded participant welcome email with logo, login URL, Participant ID and initial-password instructions. They do not reset passwords or revoke sessions. Sending requires a configured email provider; unconfigured or rejected delivery is reported as a failure.

The existing Redis/BullMQ infrastructure processes the `participant-invites` queue. A single batch runs globally across API replicas, with approximately one recipient per second. Progress checkpoints let a stalled worker resume from the last recorded recipient. As with other external email operations, a crash between provider acceptance and checkpointing can cause a duplicate email for that recipient. Email failures are recorded and do not automatically retry the entire batch.

Completed batches remain available for 24 hours and failed batches for seven days, each bounded to 1,000 retained jobs. Error details exposed to the portal are generic; provider diagnostics stay on the server. Queuing is audit logged against the requesting staff principal. Evaluators, Viewers and non-staff roles cannot queue batches or read their progress.

Endpoints:

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/participants/:id/resend-invite` | Queue one eligible participant |
| POST | `/participants/resend-invites` | Queue explicit `participantIds` |
| POST | `/participants/resend-pending-invites` | Queue all pending participants matching cohort/filter criteria |
| GET | `/participants/invite-resends/:jobId` | Inspect batch progress |

No new environment variables or database migrations are required.

## Validation on 2026-11-04

- [x] Workspace type checks and production API/web builds.
- [x] 327 API tests passed, including 27 new invitation selection, authorization, worker recovery and email-delivery cases.
- [x] All 35 browser tests passed, including 8 new invitation-menu, bulk-selection, filtering, progress and permission scenarios.
- [x] Local API readiness passed after the invitation queue was registered.
- [x] Dedicated database/Redis integration suites subsequently passed during mentor-invitation validation: all 395 API tests passed with no skips against disposable local services. Email tests use mocked transports and browser requests; no real participant invitations were sent during verification.
