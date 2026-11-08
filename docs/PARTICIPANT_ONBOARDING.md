# Participant onboarding and matching profile

Page: `/participant/onboarding`.

## Completed

- [x] Preserve the password-change session renewal flow.
- [x] Prefill imported personal, contact, education, location and experience fields for confirmation or correction.
- [x] Show LMS email, participant ID, cohort group and learning completion/certificate information as read-only records.
- [x] Ask whether the participant can build and deploy: Yes, confidently / With support / No.
- [x] Collect preferred role: Builder / Sector specialist / Users, business and impact lead.
- [x] Collect a first-choice sector and a different backup from ATF's nine sectors.
- [x] Collect team status: Full team / Part of a team / Need a team.
- [x] Require an explicit Yes or No for cross-country teams.
- [x] Confirm or add a GitHub username, or record that the participant has no account yet. Include signup guidance and ATF's explanation of why GitHub is needed.
- [x] Require an explicit Yes or No for matching profile visibility; declining does not prevent completion.
- [x] Record profile confirmation, matching completion and consent timestamps, plus consent text version.
- [x] Allow participants to change their visibility choice on their own profile.
- [x] Restrict participant-facing teammate searches to consenting profiles, and return only the limited public matching fields.
- [x] Retain drafts in the same browser tab for 24 hours, including after a reload or failed submission. Passwords and session tokens are excluded from the draft.
- [x] Save profile and preferences atomically, preserving credentials, cohort/group, learning records and existing team membership/status.
- [x] Handle duplicate completion requests without duplicate welcome effects or overwriting confirmed answers.
- [x] Display matching answers in staff participant details and participant profiles.

## Behaviour

New participants without certificates can complete onboarding; the import's halfway admission policy still applies. This phase records matching answers without implementing the revised team formation or challenge-start eligibility rules.

Additional skill tags and interest tags are optional so that nontechnical participants can complete setup. Imported Python/Git/AI descriptions remain editable text, retaining ATF's original detail. The new build/deploy answer is separate from those imported descriptions.

Sectors are a fixed ATF taxonomy: Health, Education, Mining and Manufacturing, Agriculture, Finance, Public Service, Legal, Logistics and Other. They are stored separately from cohort-specific vertical IDs. Optional programme vertical preferences remain available for compatibility with current matching. No sector is silently mapped to an unrelated vertical.

A stated team status describes the participant's situation; it does not create, join or register a team. Weekly time commitment is not asked or imported.

Learning flags, certificate ID/date, LMS email, credentials and cohort/group are not self-editable through onboarding. The profile confirmation whitelist prevents those values from being changed by an onboarding request. Country of residence can be confirmed/corrected within the cohort's configured countries.

Already-completed participants retain access; this release does not reset their onboarding. They can open **Complete my matching profile** on their profile to answer the new questions without a password reset, access/status reset or repeat welcome notification. Their previous answers are not silently mapped to the new taxonomy. Matching consent defaults to unknown for legacy accounts, and such profiles remain absent from participant-facing teammate searches until the participant chooses to show them. Staff can still search and manage the cohort roster. Existing teammates and team assignments remain in place.

## Privacy controls

`POST /api/participants/:id/onboarding` requires all matching answers, including explicit boolean choices. `matching_profile_consent_at` records the choice date and `matching_profile_consent_version` identifies the onboarding text version.

`PATCH /api/participants/:id/matching-consent` accepts `{ "consent": true }` or `{ "consent": false }`. It is restricted to the participant's own account; staff cannot opt a participant in. The profile page provides show/hide controls.

`GET /api/teams/search/participants` uses the authenticated caller's role to enforce consent for participant searches. Results contain name, country, institution, skills/interests, group and role/sector preferences. They exclude email, phone, LMS certificate fields, credentials and other private demographic fields. Staff search retains authorized roster access.

## Database and release

Migration `1794052800000-AddParticipantMatchingOnboarding.ts` adds nullable matching preference fields and profile-confirmation/GitHub account-status fields. Apply it after the learning-import migration and before starting the updated API. It has been applied locally. Deployment workflows run migrations before updating the API.

Completion is restricted to the participant's own account. It uses one database transaction with a per-participant lock. Welcome notifications and forum setup run after commit. Existing passwords, learning certificate records and confirmed team memberships are retained. Replaying a completed onboarding request after the matching questions have been answered returns the existing profile.

Verification: 545 API tests passed, including validation, authorization, privacy projection, PostgreSQL rollback, concurrent completion and migration parity. Twenty browser tests passed across onboarding, password session renewal, consent controls, cohort groups and participant imports. Workspace type checks and production web build passed. Lint has no errors and retains repository warnings.

## Team formation follow-up

- [x] Implement ATF's revised team eligibility and ordered matching priorities. See [Team formation rules](TEAM_FORMATION_RULES.md).
- [x] Validate recorded opt-outs and the halfway/team-joining deadline.
- [x] Validate builder/non-computing coverage, country rules and team size; show sector/role mix as guidance.
- [x] Gate challenge start on every member's learning certificate.
- [ ] Load ATF's actual opt-outs/CodeLabs evidence when supplied. Staff controls and optional update-only CSV columns are available; stage-linked UTC cutoffs are documented in the team-rule checklist.
