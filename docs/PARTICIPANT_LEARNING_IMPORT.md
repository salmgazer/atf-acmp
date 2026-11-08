# Participant learning-data imports

Staff import page: `/staff/participants/import`.
Branch: `feat/participant-learning-import`.

## Completed

- [x] Accept the 23 ATF learning-feed columns, including quoted CSV cells and UTF-8 BOMs.
- [x] Admit new participants with `halfway_reached = Yes`; certificates are optional at admission.
- [x] Store LMS certificate information separately from ACMP practice certificates.
- [x] Create new accounts and update existing accounts in one reviewed import, with create-only and update-only modes.
- [x] Default existing-account updates to the five learning fields; allow explicit selection of supported profile fields.
- [x] Preserve existing credentials, login address, onboarding, country, cohort, group, skills/interests, preferences and team memberships.
- [x] Provide row previews, differences, warnings, conflicts, confirmation, background progress and downloadable receipts.
- [x] Require explicit review for learning reversals or changes to an existing certificate ID/date.
- [x] Queue invitations only for new accounts, after database commit, when requested.
- [x] Show imported learning data on staff participant details and participant profiles; include it in staff CSV exports.
- [x] Verify database migrations, rollback, stale previews, role restrictions and repeat imports.
- [x] Rehearse the provided 1,793-row CSV in a disposable database with invitations disabled.

## Import procedure

1. Choose an active cohort, import mode, and group for new accounts when the cohort has groups. Existing participants retain their groups.
2. Keep the five learning fields selected for normal LMS updates. Open **Optional profile updates** only when those fields should replace existing profile values.
3. Upload the ATF CSV or paste CSV text. Download the template for the exact ATF header order. Update-only files can contain just `participant_id` and the fields to update.
4. Preview. Review conflicting rows and any warnings, and inspect before/after values. Any conflict blocks the whole batch; excluded rows are skipped. A missing halfway flag excludes new accounts, but does not prevent updates to existing accounts.
5. If correcting established learning status or certificate details, enable **Allow reviewed learning corrections** and preview again. Setting certificate issued to No clears its associated ID and date, shown in the differences.
6. Confirm and queue the import. The page shows progress and can restore its most recent batch after a reload in the same tab. Download the receipt when complete.
7. If invitation scheduling fails after accounts are committed, the receipt says so. Use the participant resend-invite controls after checking email configuration. Reimporting unchanged rows does not resend invitations.

Blank cells mean **leave unchanged**, rather than erase. Explicit `No`, `False` and `0` are meaningful false values; `Yes`, `True` and `1` mean true. Dates must be valid `YYYY-MM-DD` values. Certificate IDs are opaque, case-sensitive strings, not UUIDs.

Matching uses the external `participant_id`, with LMS email corroboration when supplied. Reused IDs, mismatched email identities, deleted accounts, records in another cohort, duplicate file identities or reused certificate IDs require correction. An email address is never used to silently reassign an external ID. A matching legacy account can acquire its LMS email anchor without changing its login email.

## Data mapping

| ATF column | Participant property / database column |
| --- | --- |
| participant_id | participantId / participant_id (existing external identifier) |
| first_name, last_name | firstName / first_name; lastName / last_name |
| lms_email | lmsEmail / lms_email; used as the login email for new accounts only |
| phone, whatsapp_number | phoneNumber / phone_number; whatsappNumber / whatsapp_number |
| country | country (normalized country name; new accounts only) |
| city_clean, location_type_clean | city; locationType / location_type |
| gender | gender |
| institution_name_clean | institution |
| education_level_clean | educationLevel / education_level |
| current_affiliation_clean | currentAffiliation / current_affiliation |
| field_of_study_clean | fieldOfStudy / field_of_study |
| python_skill, git_skill, ai_experience | pythonSkill / python_skill; gitSkill / git_skill; aiExperience / ai_experience |
| github_username | githubUsername / github_username |
| certificate | learningCertificateIssued / learning_certificate_issued |
| certificate_date | learningCertificateDate / learning_certificate_date |
| finished_all_lessons | learningFinishedAllLessons / learning_finished_all_lessons |
| halfway_reached | learningHalfwayReached / learning_halfway_reached |
| certificate_id | learningCertificateId / learning_certificate_id |

Nullable source fields distinguish missing data from explicit No. `learning_imported_at` records new or changed learning data. Source skill descriptions are retained separately from participant-entered skill tags. GitHub profile URLs and leading @ are normalized where unambiguous; other supplied text is preserved with a review warning. Inconsistent certificate/lesson flags are warned about and retained independently.

## API and operations

Program managers and super admins can use:

- `POST /api/participants/import/preview`: CSV plus cohort/options; returns counts, rows and preview hash, without writes.
- `POST /api/participants/import/apply`: same input plus preview hash; returns a queued batch (HTTP 202).
- `GET /api/participants/import/batches/:id`: progress or receipt, excluding the raw CSV input.

The old `POST /api/participants/bulk-import` HTTP route returns 410 with migration guidance. It cannot bypass review or reset an existing account. The staff page uses the new routes.

Limits: 5,000 source rows, 2 MB CSV, and a route-specific 3 MB JSON request limit. The normal JSON request limit remains unchanged. The existing Redis/BullMQ infrastructure runs the `participant-imports` queue with global concurrency one. Queue payloads contain only the database batch ID. Credentials for new accounts are prepared outside the write transaction. Application revalidates the reviewed source and participant versions inside a serializable transaction; a failed write rolls back the entire batch. Invitation jobs are queued after commit with stable IDs.

Apply migration `1794009600000-AddParticipantLearningImports.ts` before starting the updated API in another environment. It adds nullable participant columns and an import-batch table; it does not rewrite existing participant data or touch ACMP certificates. The local development migration has been applied. No real CSV has been imported into the application database by this implementation.

Participant import jobs and their welcome-invitation batches now have PostgreSQL-backed recovery if Redis jobs disappear. See [Participant queue durability](PARTICIPANT_QUEUE_DURABILITY.md) for the follow-up migration, recovery behavior and Redis rollout steps.

## Verification

- 519 API tests passed, including PostgreSQL integration tests and migration schema parity.
- 12 browser tests passed for imports and existing cohort group behavior.
- Workspace type checks and production web build passed. Lint passed with existing repository warnings; no errors.
- Disposable rehearsal: 1,793 created, 1,558 certified, 235 not certified; repeated source produced 1,793 unchanged; zero invitations. Disposable database and Redis were removed afterward.

## Subsequent phases

- [x] Prefill and confirm imported profile data during onboarding. See [Participant onboarding](PARTICIPANT_ONBOARDING.md).
- [x] Add ATF's build/deploy question, preferred role, first/backup sectors, team status, cross-country consent, GitHub guidance and matching-profile consent.
- [x] Implement revised team formation eligibility, ordered matching priorities, opt-outs handling and certificate checks before starting the challenge. See [Team formation rules](TEAM_FORMATION_RULES.md).
- [ ] Confirm opt-outs/CodeLabs input formats and deadline time zones/details with ATF.

Learning changes report affected team IDs for staff review. The subsequent team-rule implementation preserves ordinary learning-update assignments, removes participants when a reviewed programme opt-out is applied, and checks eligibility before challenge work. LMS learning certificates remain separate from ACMP practice certificates.
