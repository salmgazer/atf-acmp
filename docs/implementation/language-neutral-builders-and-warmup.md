# Language-neutral builders and Team warmup

- [x] Language selection, Other language and proficiency for onboarding and profile editing.
- [x] Development, Testing and Deployment answers with explanations; all three must be Yes to qualify. Language, level, role preference and confirmation state do not change that predicate.
- [x] Database migration retains existing builders under the previous Python/CodeLabs rule: three Yes answers and `builder_confirm=false`. Imported Python learning records remain intact.
- [x] Mandatory review modal for all returning participants, including beginners and intermediate programmers, with version checks and audit records. Participants can correct answers; confirmation is recorded only after successful validation and save.
- [x] Six programme steps, with Team warmup immediately after Submit a proposal, shown on the dashboard and submissions page.
- [x] Cohort configuration for warmup instructions, exercise URL and dates. Existing stage IDs, deadlines, learning/registration bindings and submissions are preserved.
- [x] Team leads/co-leads submit a public HTTPS deployment and a separate warmup GitHub repository. Every member must meet the learning and team rules first.
- [x] AI evaluation uses an independently fetched live HTML page and repository source evidence. Private/internal addresses, unsafe redirects, oversized responses and stale results cannot unlock the build stage.
- [x] Submitted proposal plus passed warmup unlocks evaluation/build progression. Proposal scoring is available for staff feedback but is not an extra passing requirement.
- [x] A PostgreSQL evaluation-job record is saved in the submission transaction; Redis enqueue failures remain pending for reconciliation. Failed evaluations are visible to staff for retry.
- [x] Final local regression and production-build verification (215 browser tests; full API regressions plus targeted language-mapping tests).
- [ ] Deploy to staging and production when requested.
- [ ] Add the ATF exercise URL and confirm warmup dates for each live cohort once supplied.

Gemini generation was verified with the existing local key. `GEMINI_API_KEY` and the supported project model `gemini-3.6-flash` are configured through both GitHub deployment environments. Existing Zoom/Resend settings and empty SMTP settings must be retained.

## Release notes

Web 0.1.20; API 0.1.14. Branch: `feat/language-neutral-builders-and-team-warmup`.

The migration runs through the existing deployment migration process. It backfills only participants who meet the **previous** builder predicate, sets all three experiences to true, and leaves confirmation false. A missing language for a CodeLabs-only builder is left unanswered for that participant to supply. A read-only production audit found 160 JavaScript/TypeScript tags, 58 C/C++ tags, 53 Java tags, 23 R tags and 146 SQL tags. A single explicit language tag prefills that language. Combined or multiple languages remain unselected for participant confirmation. Python levels are never copied to other languages. Production data changes occur only through the deployment migration.

The AI assessment checks reachability and reviews page/source evidence. It does not execute interactive browser tests or guarantee bug-free functionality. The exercise URL must be configured before teams can submit; no external exercise requirements or dates are invented. New warmup deadlines inherit the later of the existing proposal/evaluation deadlines until staff configure them. The evaluation stage has no participant form. Existing proposal approvals remain recorded; the warmup gate applies to the six-step workflow.
