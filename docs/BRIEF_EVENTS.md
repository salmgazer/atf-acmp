# Brief events and shared ATF Zoom hosting

- [x] Organization owners/admins schedule events from each brief's detail page.
- [x] Discussion agenda, date/time, timezone and duration are saved with the event.
- [x] ACMP creates the Zoom meeting in the configured shared ATF account.
- [x] Confirmed participants of all assigned, non-disqualified teams receive calendar invitation emails, in-app notifications and push notifications.
- [x] Teams assigned later receive invitations automatically; departed participants receive cancellations.
- [x] Rescheduling and cancellation update the same calendar invitation.
- [x] Protected hosting is available to organization owners/admins and program managers.
- [x] Pending deliveries persist in PostgreSQL and retry after failures or application restarts.
- [x] Pass Zoom settings from GitHub environment variables/secrets to the staging and production API deployments.
- [x] Configure the shared Zoom account variables and encrypted client secret in both GitHub environments.
- [ ] Deploy the feature to the target environment and verify live Zoom event creation.
- [ ] Configure OneSignal credentials in each target environment that needs browser push.

## Scheduling and attendance

Open **Partners → Briefs → a brief → Brief events → Schedule event**. Enter the event title, discussion agenda, date/time and duration. Times are entered in the organizer's browser timezone and stored as UTC timestamps with the event timezone for display.

The organization can use **Host event** to start the meeting; participants use **Join Zoom**. Staff can manage events on the staff brief detail page. Participant brief pages show events only when the participant has confirmed membership in a team currently assigned to that brief. Read-only organization members and other staff roles cannot manage or host events.

Host links are fetched fresh from Zoom after authorization, returned with `Cache-Control: private, no-store`, and never stored in the event, exposed in lists, or included in emails. The shared host uses a waiting room and does not allow participants to join before a host starts the meeting.

## Local configuration

Create and activate a Server-to-Server OAuth app in the shared ATF Zoom account. Grant these account-level granular scopes:

- `meeting:write:meeting:admin` — create meetings.
- `meeting:update:meeting:admin` — reschedule and update the agenda.
- `meeting:delete:meeting:admin` — cancel meetings.
- `meeting:read:meeting:admin` — fetch a fresh host URL.

Set these values in the root `.env` for Docker, or the API runtime environment:

```dotenv
ZOOM_ACCOUNT_ID=
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=
ZOOM_HOST_USER_ID=
ONESIGNAL_APP_ID=
ONESIGNAL_REST_API_KEY=
```

`ZOOM_HOST_USER_ID` is the shared host's Zoom user ID or email, rather than `me`. The host must belong to the authorized account. The web client uses the same OneSignal app ID through `NEXT_PUBLIC_ONESIGNAL_APP_ID`; Docker Compose supplies that value automatically. Browser push requires participant consent and a registered subscription. Push preferences and quiet hours are respected. Calendar invitation emails are transactional and use the configured email provider.

Apply migrations and recreate the services to load the environment:

```sh
docker compose up -d api web
```

The API development entrypoint applies pending migrations. Without Zoom configuration, the portal disables scheduling and explains that staff must connect the account. SMTP is already routed to Mailpit in the local stack; production requires a configured Resend, SMTP or Mandrill sender. Supply the same Zoom settings through the production runtime's secret and environment configuration before enabling the feature there.

## GitHub Actions deployment configuration

Configure the following in **Settings → Environments → staging / production** for the repository:

| Setting | GitHub type | API runtime variable |
| --- | --- | --- |
| `ZOOM_ACCOUNT_ID` | Environment variable | `ZOOM_ACCOUNT_ID` |
| `ZOOM_CLIENT_ID` | Environment variable | `ZOOM_CLIENT_ID` |
| `ZOOM_HOST_USER_ID` | Environment variable | `ZOOM_HOST_USER_ID` |
| `ZOOM_CLIENT_SECRET` | Environment secret | `ZOOM_CLIENT_SECRET` |

Both API workflows validate that all four settings exist before building the image and pass them to ECS at deployment, following the existing Resend/OneSignal pattern. The client secret stays in GitHub secrets; do not commit it or pass it as a Docker build argument. Workflow changes also count as API changes, so changing runtime configuration redeploys the API.

Configuration changes take effect on the next API deployment. Merge the feature into `staging` or `main`, or dispatch the appropriate workflow on the feature branch with `deploy_api=true`, `deploy_web=true`, and `run_migrations=true` for the initial release. The initial release includes the cohort group and brief event migrations and the matching portal changes. Subsequent configuration-only deployments can select just the API. Verify event creation in the deployed partner portal after the workflow completes.

Custom-domain routing reads the active ECS Express Gateway configuration, service revision and gateway listener rule to select the serving target group. The deployment role needs ECS read access and `elasticloadbalancing:DescribeRules`, plus `elasticloadbalancing:ModifyRule` scoped to that environment's custom-domain listener-rule ARNs. Staging's `staging-custom-domain-routing` inline policy grants updates to its two custom-domain rules. The script can be checked without changing traffic using `DRY_RUN=true bash scripts/update-alb-rules.sh staging`; it fails on missing rules or ambiguous active targets.

## Calendar investigation

The mentor workflow uses a delegated Google service account. On mentor confirmation, it creates a Google Calendar event with `conferenceData.createRequest` set to `hangoutsMeet`, includes the mentor and team members as attendees, and requests invitation email delivery with `sendUpdates: all`.

Google Calendar is the invitation/calendar provider, while Google Meet is the conferencing provider. Google Calendar can hold a Zoom link in an event's description or location, but requesting a Google Meet conference does not create a Zoom meeting. Zoom meetings require a separate Zoom API call.

For brief events, the chosen implementation uses Zoom Server-to-Server OAuth for the shared account and standard iCalendar email invitations for attendees. The invitations work with Google Calendar, Outlook and Apple Calendar and do not require a Google account or calendar integration. Existing mentor calendar behavior remains in place.

Stable event UIDs and increasing iCalendar sequence numbers let email clients update or cancel the original invitation. Initial invitations, changes and cancellations are sent through all three supported email providers with an `.ics` attachment. Participants can also download the invitation from the event card.

References: [Zoom Server-to-Server OAuth](https://developers.zoom.us/docs/internal-apps/s2s-oauth/), [Zoom Meetings API](https://developers.zoom.us/docs/api/meetings/), [Google Calendar event creation](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert).

## Delivery and limits

The worker attempts delivery after event changes and runs every minute to reconcile current team membership and retry pending channels. Delivery checkpoints are stored separately for email, in-app notifications and push. A PostgreSQL advisory lock prevents two application instances from processing the same event simultaneously. In-app notification IDs are deterministic for each invitation revision. Provider acceptance is tracked; this does not imply that a recipient has read a message or that their calendar has accepted the invitation. Email and push are delivered at least once: a crash after provider acceptance but before its checkpoint is saved can cause a retry.

ACMP prevents overlapping brief events for the configured shared host. Meetings created directly in Zoom are outside that check; Zoom account capacity and duration policies still apply. Changing to several shared hosts would require an explicit host allocation policy.

Cancellation notices are sent when team members leave, their team is unassigned or disqualified, or an event is cancelled. Deleting a brief with events preserves the records so the worker can cancel the Zoom meeting and invitations. Failed Zoom updates do not prevent participants receiving cancellation notices.

## Verification

API tests cover Zoom OAuth, creation, updates, deletion, protected host access, organization isolation, participant eligibility, concurrent host scheduling, failed-delivery retries, quiet hours, late team assignment, cancellation and MIME calendar attachments. Browser tests cover scheduling/editing/cancelling from the partner portal, protected hosting, participant joining/calendar downloads and the unconfigured state. External Zoom, email and push calls are mocked in these tests.
