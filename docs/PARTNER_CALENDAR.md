# Staff partner event calendar

- [x] `/staff/partners` has List and Calendar view controls matching the mentor page.
- [x] The calendar includes all partners' brief events for the selected cohort and displayed dates, independently of list pagination and approval filters.
- [x] Staff can move between months, return to Today, choose a cohort and search by partner name.
- [x] Event cards identify the event, partner and brief. Every event is visible, including cancelled events and events crossing midnight.
- [x] Clicking an event shows its agenda, duration, local time, original event timezone, partner and brief links.
- [x] Scheduled events provide their existing Zoom join link. Calendar invitations can be downloaded; cancelled events have no join link.
- [x] All staff roles can read events across cohorts. Organization, participant and mentor accounts cannot access the staff calendar endpoint.
- [x] Loading, empty and retry states are provided. The calendar refreshes every 15 seconds while open.
- [x] Existing partner list actions and bulk invitation features remain available in List view; changing views clears row selection.

`GET /brief-events/calendar` requires `cohortId`, `startAt` and exclusive `endAt`, and accepts optional partner-name `search`. Dates require timezone offsets, a positive range and a maximum span of 62 days. The query returns events overlapping the displayed range, including events starting before it. Deleted events, briefs and organizations are excluded.

The response includes only display fields and existing attendee join URLs. It does not expose Zoom host URLs, host account IDs, meeting IDs, delivery diagnostics or attendee details. Browsing the calendar does not contact Zoom or send notifications. No database migrations, new dependencies or environment variables are required.

Dates are grouped in the staff browser's local timezone, which is displayed beside the calendar. Event details also show the original event timezone. Calendar downloads use the existing invitation endpoint and permissions.

## Validation on 2026-11-04

- [x] All 457 API tests passed without skips, including PostgreSQL and Redis integration suites.
- [x] All 66 browser tests passed, including calendar navigation, cohort/search filters, overnight events, timezone placement, cancellation, event details, invitation downloads, error recovery and read-only staff access.
- [x] Workspace type checks and production API/web builds passed.
- [x] Local API readiness passed with database and Redis connected. Disposable test services were removed, and email/Zoom interactions were mocked.
