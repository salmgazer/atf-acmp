# ATF team formation, registration and challenge start

Team policy, matching, registration and challenge activation are enforced by the API and shown in staff/participant team checklists. Deployment workflows apply the schema migrations before updating the API.

## Completion checklist

- [x] Allow teams to assemble as drafts; require 3–5 confirmed members to register.
- [x] Require every member to have reached halfway and completed the matching questions.
- [x] Block opted-out/inactive participants from creation, joins, staff additions, invitations, acceptance and pending-member confirmation.
- [x] Remove opted-out participants from team rosters, cancel pending invitations, revoke sessions/chat access and select a replacement lead where needed.
- [x] Apply the saved team builder policy and require one confirmed non-computing field of study.
- [x] Let staff choose confirmed, recorded or potential builder eligibility, minimum/preferred builder counts, shortage handling and new-team/backfill scope.
- [x] Save cohort defaults, show candidate badges/outcomes and revalidate the reviewed preview before finalization.
- [x] Keep teams needing builders as drafts, or record an explicit staff exception allowing registration/progression.
- [x] Preserve cohort group boundaries across manual and automatic formation.
- [x] Reserve team names within each cohort, ignoring capitalization and extra whitespace, for manual creation, renaming and automatic formation.
- [x] Require every member's opt-in before mixing countries.
- [x] Require a competition country where at least one confirmed member lives, with the assigned problem based there.
- [x] Apply the ordered matching priorities: first-choice sector, backup sector, role coverage, country, then gender/institution mix.
- [x] Show role coverage and mix as guidance; recommend two builders in teams of four or five.
- [x] Keep brief assignment separate from challenge activation.
- [x] Allow challenge start only after all members complete all 40 lessons and have learning certificate IDs.
- [x] Enforce joining and certification deadlines from each cohort's selected stage records, in UTC, with no fixed-date defaults.
- [x] Recheck eligibility and source versions when finalizing automatic formation; roll back failed batches.
- [x] Provide eligibility/checklist and registration/start controls on participant and staff team pages.
- [x] Support staff-managed opt-outs and CodeLabs verification, including reviewed update-only CSVs.

## Policy decisions

Builder qualification is language-neutral: Development, Testing and Deployment must all be Yes. Any preferred language and proficiency level is accepted. Python level, technical skill tags, preferred role and CodeLabs completion alone do not qualify a builder.

On `/staff/teams`, open **Team formation** to choose:

- **Who counts:** confirmed builders only; include recorded builders awaiting confirmation; or also count potential builders who selected Builder and have unanswered experience questions. An explicit No answer never counts. Potential/awaiting labels remain distinct from confirmed status.
- **Minimum builders:** 0, 1 or 2. **Preferred builders:** 0–2, at least the selected minimum; the extra preferred coverage is guidance for teams of 4–5.
- **Shortage:** leave participants unassigned, form drafts needing builders, or authorize an exception allowing registration and progression.
- **Scope:** new teams, existing open slots or both. Backfills remain pending until the lead approves; existing members are never moved.

Defaults are recorded builders, minimum one, preferred two, draft teams on shortage, and both matching scopes. Staff can save cohort defaults or override them for a run. A zero minimum or an exception requires an explained staff reason of at least 10 characters.

Newly formed teams receive an immutable-at-creation builder-policy snapshot with the authorizing staff identity and timestamp. Drafts do not receive a registration timestamp until their saved builder requirement is met. An explained exception waives only that builder minimum; groups, country consent, team size, non-computing coverage, programme eligibility, cohort dates and certification still apply. Participant experience answers and `builder_confirm` are never rewritten by formation.

Existing teams retain their saved policy; legacy teams without a snapshot retain the original minimum of one recorded builder. Saving cohort defaults does not retroactively relax or tighten their requirements. Backfills do not grant exceptions to existing teams. Builder checks read current participant answers, so a draft can become eligible once someone completes/confirms their experience under its saved policy.

Builder candidates are spread across possible teams before surplus builders are added. Matching keeps the sector, role, country and mix priorities. The preview shows individual builder categories, counted coverage, draft/registration/exception outcomes and totals. Its receipt, source versions and cohort settings are checked at finalization; changed answers or defaults require a fresh preview. Decisions and saved defaults are audited.

Unknown or blank fields of study cannot establish a non-computing background.

There are **no fixed calendar dates or fallback cutoffs**. On `/staff/cohorts/:id/stages`, choose the existing stage supplying the **team joining/registration deadline** and the stage supplying the **learning certification deadline**. The cohort stores `teamJoiningStageId` and `learningCertificationStageId`; every rule check reads the referenced stage rows in that same cohort. The selected stage's exact timestamp is respected in UTC, including times that are not end-of-day.

Closing a stage does not erase its deadline: an inactive stage remains a valid historical cutoff. A missing/deleted stage or unset binding produces a configuration message and blocks the corresponding action. Stage deadlines can change without editing the cohort; those edits immediately affect eligibility and invalidate old formation previews. No dates are inferred from stage names, stage numbers, legacy cohort JSON dates or another cohort.

Existing cohorts need the two stage selections configured explicitly. The local cohort currently contains generic Stage 1, Stage 2, Stage 3 and Demo Day entries, so the migration leaves the selections unset. Staff can create/rename milestones and select their intended deadline stages; a single stage can supply both cutoffs if appropriate.

## Team lifecycle

Team names are unique within a cohort, including across its groups and countries. Names are trimmed and repeated whitespace is collapsed; capitalization is preserved for display. Manual duplicates return a clear conflict. Automatic previews skip occupied names and reserve distinct names within the batch; finalization checks again and chooses the next available name if a manual creator has taken it meanwhile.

Database name claims protect simultaneous requests, including direct database writers. Renaming or deleting the last team with a name releases it; restoring a deleted team checks availability again. The migration preserves pre-existing duplicate names and reserves them until their last owner leaves. Editing an existing team's other details does not require renaming it.

- **Draft:** people may assemble and recruit; automatically formed teams of 3–5 can also remain drafts while awaiting builders. Admission still requires halfway learning, matching answers, active participation, the same group and mutual cross-country consent. A declared onboarding “Full team” is not an actual registered team; these participants are excluded from automatic regrouping and can assemble manually.
- **Registered:** the lead/co-lead or staff manager selects a valid competition country and passes all hard registration checks. `registered_at` is recorded; the team remains `forming` until challenge start.
- **Challenge started:** an approved brief is assigned and all confirmed members pass certification checks. `challenge_started_at` is recorded and status becomes `active`.

Confirmed roster changes clear registration/start and return a team to forming, so the roster is reviewed again. Pending automatic backfills do not alter the confirmed roster until approved. Opt-outs also invalidate registration/start. Removing a pending request alone does not invalidate an otherwise registered team.

A timely registered team may start after the joining cutoff. A team need not wait until the certification cutoff if everyone is certified earlier. Certificates dated after the certification cutoff or in the future are rejected. Starting after the certification cutoff requires certificate dates proving timely issuance, unless a prior start already establishes that the certificates were held before the cutoff. All 40 lessons and issued IDs are required independently; an inconsistent feed cannot bypass these checks.

Brief assignment does not activate a team. Direct status changes cannot bypass Register/Start. Submission drafts, submission posting, journals and participant peer-review mutations check challenge eligibility. Certificate withdrawals or other later eligibility changes therefore block new challenge work even when a historical team status says active.

Existing teams and participants are not silently deleted or certified by migration. Teams with incomplete learning or matching data need those records corrected before registering/starting under this policy.

## Countries and briefs

`teams.competition_country` is chosen from resident member countries. If a brief is already assigned, the problem country must match. Country codes for ATF's four countries are normalized to names.

`briefs.problem_country` records where the problem is based and can be edited in the staff/partner brief form. Existing briefs are initially populated from the partner's country; a blank value falls back to the partner country. Staff must correct exceptions where a problem is based elsewhere. Automatic assignments and registered-team brief matching respect country boundaries.

## Manual programme data

Staff participant details include **Programme eligibility**, with a confirmation dialog for opt-outs and CodeLabs verification. Verification attribution and dates are written by the server; participants cannot self-verify these fields or alter their learning certificate through onboarding.

The participant CSV importer additionally accepts optional `opt_out` (alias `programme_opted_out`) and `code_labs_completed` columns. For existing records choose **Update existing only**, then select the relevant fields in **Programme status updates**. The ordinary default still updates only the five learning fields. Preview and review the changes before applying them. An opted-out source record never creates a new account.

An opt-out removes confirmed and pending memberships, removes pending invitations, marks programme chat memberships as left, deactivates the account, revokes its sessions and disconnects live sockets after commit. Clearing the flag does not restore prior memberships or automatically reactivate the account. Staff may review/reactivate separately. CodeLabs verification and opt-outs are audited.

No opt-outs tab or CodeLabs feed is automatically synced. The actual ATF lists must be supplied and loaded through these controls; no real programme records were imported by this implementation.

## Automatic formation

The former weighted tech/non-tech algorithm is replaced by a deterministic candidate matcher with hard builder/non-computing seeds and lexicographic priorities. Required builders are reserved for remaining potential teams where possible. Groups never combine to fill an undersized team. Cross-country preference cannot be overridden by `forceCrossCountry`.

Role/gender/institution guidance is displayed per proposed team and on saved teams. The compatibility number is a display guide; it does not reorder the specified matching priorities. Legacy weight parameters remain accepted for compatibility but do not override ATF's priorities. Lead-selection strategy remains configurable.

Finalization requires a current-policy preview. It checks cohort, participant and preference versions, membership conflicts, eligibility, country, brief approval/capacity and overrides before committing. A stale or invalid write rolls back the batch; notifications are deferred until commit. Backfill additions stay pending and are rechecked again at lead confirmation.

## API and migration

- `GET /api/teams/:id/eligibility`
- `POST /api/teams/:id/register` with `{ "competitionCountry": "Ghana" }`
- `POST /api/teams/:id/start-challenge`
- `PATCH /api/participants/:id/programme-status` with reviewed programme flags and optional reason; managers/super admins only.

Participant registration/start is restricted to that team's lead/co-lead. Staff managers can manage teams across all cohorts.

Migration `1794056400000-AddAtfTeamRules.ts` follows the learning-import and matching-onboarding migrations. It adds programme verification, registration/start and problem-country fields; it also enforces an absolute five-member capacity and blocks opted-out members at the database membership write boundary. It is applied locally, and the API health endpoint returns 200.

Deadline-source follow-up adds `1794078000000-UseCohortStageTeamDeadlines.ts`: nullable stage references, with deletion clearing the reference, plus explicit UTC timestamp storage for stage start/deadline values. It does not choose dates or map existing stages automatically. Cohort read responses derive the displayed team dates from those stages; legacy JSON date copies cannot bypass the rules. Stage editing explicitly sends UTC timestamps, and stage/team/cohort deadline displays use UTC regardless of the browser timezone.

Verification passed: 567 API tests and 29 browser tests. Coverage includes pure-policy/ordered-priority tests, PostgreSQL lifecycle and rollback tests, staff authorization/session revocation checks, browser registration/start/opt-out/preview flows, stage deadline changes, and UTC editing from a browser outside UTC. Workspace type checks and the production web build passed. Lint completed with no errors and existing repository warnings.

## Flexible formation API

- `GET /api/admin/cohorts/:cohortId/matching/formation/defaults`
- `PATCH /api/admin/cohorts/:cohortId/matching/formation/defaults` with `expectedUpdatedAt` and `config`.
- Formation preview accepts `config.builderEligibility`, `minimumBuilders`, `preferredBuilders`, `shortageAction`, `matchingScope` and `exceptionReason`.
- Finalization accepts the reviewed `previewId`. A replacement preview cannot silently finalize different choices in the new staff interface.

These endpoints remain restricted to programme managers and super admins. Ordinary participant/team updates cannot set `builderPolicy`.

Migration `1795737700000-FlexibleFormationPolicy` adds nullable `cohorts.formation_defaults` and `teams.builder_policy`; existing team policies and participant answers are not backfilled or changed.
