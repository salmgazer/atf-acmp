# Staff role permissions

All four staff roles can access **every cohort**. The cohort selector is a filter, not an access restriction. There are no staff assignments by cohort, group or vertical.

| Capability | Super Admin | Program Manager | Evaluator | Viewer |
| --- | --- | --- | --- | --- |
| Read cohorts, teams, participants, mentors, partners and briefs | Yes | Yes | Yes | Yes |
| Read dashboards, evaluations, submissions and reports | Yes | Yes | Yes | Yes |
| Review briefs and approve/reject submissions | Yes | Yes | Yes | No |
| Submit human evaluation scores | Yes | Yes | Yes | No |
| Manage cohorts, participants, teams, mentors, partners, stages and events | Yes | Yes | No | No |
| Trigger AI evaluations, manage the queue, change AI weights or publish scores | Yes | Yes | No | No |
| Post chat/forum messages; edit own posts | Yes | Yes | Yes | No |
| Moderate another author’s forum posts | Yes | Yes | No | No |
| View audit logs and staff statistics | Yes | Yes | No | No |
| View staff directory | Yes | Yes | Yes | Yes |
| Create/update/activate/deactivate staff or change their roles | Yes | No | No | No |
| Delete cohorts and verticals | Yes | No | No | No |

Viewers may still change their own password, manage personal notification preferences and mark messages/notifications as read.

## Implementation checklist

- [x] Keep every cohort available to every staff role.
- [x] Deny Viewer business mutations by default, including routes without explicit role metadata.
- [x] Apply Viewer restrictions to chat WebSocket messages and typing; refresh roles before each packet.
- [x] Restrict forum moderation to Super Admins and Program Managers; Evaluators retain ownership-based editing.
- [x] Give Evaluators access to submission review and human scoring, while retaining manager-only operational controls.
- [x] Allow staff to read dashboards and reports without granting configuration permissions.
- [x] Filter navigation and hide unauthorized controls, dialogs and import links.
- [x] Block direct navigation to restricted action pages before their forms/data requests mount.
- [x] Refresh persisted staff permissions from `/auth/me`, including session role changes.
- [x] Add API and browser regression coverage for the role matrix.

The API remains the authorization boundary. `StaffOnly` controls presentation; it does not authorize requests. API guards read current roles from the database through JWT validation. Socket middleware revalidates the principal for each packet. Forum moderation is an explicit server-derived capability, rather than a consequence of having a generic `staff` author type.

Run `npm run type-check`, `npm run test --workspace=@acmp/api -- --runInBand`, and `npm run test:browser --workspace=@acmp/web`. Browser tests require a production web build and Chromium. PostgreSQL/Redis integration suites require their dedicated disposable test services, as documented by the test configuration.

## Validation on 2026-11-04

- [x] Workspace TypeScript checks.
- [x] Production API and web builds.
- [x] 300 API tests passed, including 27 new staff authorization and WebSocket cases.
- [x] All 27 browser tests passed, including 7 new staff-role scenarios and the existing onboarding, cohort-group and Zoom-event regressions.
- [x] Dedicated PostgreSQL/Redis integration suites subsequently passed during mentor-invitation validation: 395 API tests passed in total with no skips, using a disposable local database and Redis instance. No schema or migration changes are part of these fixes.
