# ATF team workflow

Release: web **0.1.12**, API **0.1.9**.

## Implementation checklist

- [x] Five fixed programme steps; cohort dates remain editable in UTC.
- [x] Confirmed membership completes Step 1 without an upload.
- [x] Formation and brief assignment run independently; teams choosing their own problem are excluded from pool assignment.
- [x] Team and partner problems share `briefs`, distinguished by `source`.
- [x] Community problems do not require an organisation or create partner accounts.
- [x] PDF Form 1 covers problem context, evidence, external contact, suitability, impact, sensitivities and declarations.
- [x] Private contact/evidence/consent answers and revision history stay in `team_brief_details`.
- [x] A team brief enters the shared cohort pool only when approved and explicitly shared by its team.
- [x] Staff approve, request changes or decline team briefs with a reason and optional recorded contact verification.
- [x] Step 2 requires an assigned approved brief and team registration; it unlocks mentor access and booking.
- [x] PDF Form 2 covers the solution, data/permissions, milestones, testing, responsible AI, impact indicators, team capacity and declarations.
- [x] Proposals can be drafted and submitted while learning is being completed; learning eligibility blocks advancement and approval.
- [x] Step 4 requires staff assessment and explicit approval; no participant submission or completion button exists.
- [x] Proposal resubmission clears the earlier assessment. A changed assigned brief requires a new proposal and approval, preserving previous versions.
- [x] MVP submission requires a team-owned MP4 upload, PowerPoint slides, a GitHub repository and the code licence declaration. Additional documents are supported.
- [x] The final submission snapshots its repository and brief; later settings changes do not rewrite that submission's evidence.
- [x] Fourteen days without recorded build activity flags a team for staff follow-up.
- [x] Staff can record resources actually issued after proposal approval; this does not provision provider credits automatically.
- [x] Migration preserves existing stage and submission IDs/content. Rollback restores previous deadline bindings and refuses to discard new workflow submissions or team briefs.
- [ ] Deploy and verify staging and production when requested.

## Routes

Participants follow the steps at `/participant/submissions`. The own-problem form is at `/participant/briefs/own`; proposal and MVP forms use their cohort stage IDs under `/participant/submissions/:stageId`.

Staff configure the five dates and instructions at `/staff/cohorts/:id/stages`. The Step 1 deadline governs joining and registration; Step 3 governs learning certification. Windows can overlap. Historical stages are retained separately and cannot replace these fixed identities.

Staff review team briefs at `/staff/briefs/:id`. Proposals appear in `/staff/submissions/review`, with a dedicated assessment at `/staff/submissions/proposals/:id`. Team details also link to the brief, proposal and programme progress.

Only a confirmed lead can write the team's own brief. Leads and co-leads can write proposal/MVP submissions. Other confirmed members can read their team's material. Staff viewer accounts remain read-only; evaluators can review; managers can configure dates and record resource issuance. Staff continue to have access across cohorts.

## Eligibility and review

Existing team size, builder, non-computing background, programme opt-out, cohort group, cross-country consent and country rules continue to apply. Joining still requires halfway learning completion. All members must finish the learning programme, hold their learning certificate and meet the cohort certification deadline before proposal approval/building.

Partner and approved team problems use the same country scope: a problem must be in a confirmed member's country. Private team briefs are excluded from pool browsing, rankings and automatic assignment, even when an ID is supplied directly. Assigned mentors may read the approved problem; private contact/evidence answers remain restricted to the originating team and staff.

Fit is scored out of 100 and impact separately out of 9. Impact is no longer added to fit for the derived priority score. Existing derived priority values are normalised by the migration; the underlying fit/impact answers and scores are retained.

The draft's recommended consultation minimum is **3**, editable on the cohort's Step 2 configuration. Its new public-data and collectable-data answers currently use the proposed **25** and **12** points. Team sharing is opt-in. These defaults should be confirmed with ATF before rollout.

Proposal reviewers record six separate criterion scores from **0 to 5**. There is no automatic weighted pass threshold: ATF has not agreed weights. An evaluator explicitly approves or requests changes after scoring, and the server rechecks current learning/team eligibility. Approved proposals start the build phase automatically.

LLM requests are free text until ATF confirms its platforms and allocations. Staff provision resources through the relevant provider, then record issuance in team details. No provider credentials or provisioning integration were added.

The partner context call remains distinct from a mentor call. The participant guidance asks teams to arrange their partner/contact conversation before preparing the proposal. The platform does not infer attendance from a Zoom invitation. Prototype partner feedback remains outside the platform, as ATF's diagram specifies.

## Activity and uploads

The activity flag considers build start/opening time, journal updates, final-submission drafts and the latest recorded GitHub push from repository analysis. It is a follow-up flag, not disqualification. It does not claim to poll GitHub continuously.

Documents use the existing 25 MB limit; videos use 100 MB. Final videos must be stored under the team's upload prefix with MP4 content type and extension. A final submission needs a verified PPT/PPTX document. Supporting evidence can also be linked in the brief/proposal forms.

## Migration and rollout

`1794960000000-TeamBriefPreference` supplies the formation/own-brief preference. `1795020000000-AtfTeamWorkflow` adds source/private-detail fields and five fixed stage records for each existing cohort. New dates are derived from existing cohort/stage configuration, not ATF's proposed calendar dates. Existing legacy submissions stay linked to their original stage IDs.

The development API entrypoint runs migrations when `RUN_MIGRATIONS=true`. A currently running watcher needs the migrations applied or the API restarted before it can use the new columns. The local Docker daemon was not running during implementation; verification used disposable synthetic PostgreSQL databases.

Before release, review the inherited five dates per cohort, the consultation/data-score defaults and ATF's review process. Existing teams are not automatically marked proposal-approved merely because their older challenge-start flag is set. Their new proposal must be reviewed before the new build gate opens.

Tests cover migration/rollback preservation, private-pool access, role boundaries, partial drafts, learning gates, fresh assessment after changes, independent formation/assignment, MVP requirements and browser flows.

## Verification

- 861 API tests passed; 11 Redis-dependent tests skipped.
- 175 browser tests passed using installed Chrome and synthetic API responses.
- Workspace type checks and lint passed (lint warnings remain).
- API and web production builds passed.
- Database verification used disposable local databases, including migration/rollback and schema-drift checks; no application records were changed.
- Staging and production have not been deployed.
