# Partner submissions import and brief event hosts

- [x] Add brief contact associations, import receipts and database migration.
- [x] Add staff-only CSV preview and transactional, repeatable import.
- [x] Add partner/brief import mode with cohort, source timezone and partner contact selection.
- [x] Preserve source content, scoring, missing impact answers and submission provenance.
- [x] Resolve event host from brief main contact, falling back to partner main contact.
- [x] Separate host permission from event scheduling/editing permission.
- [x] Notify the designated host without exposing Zoom host links in invitations.
- [x] Cover the public onboarding and brief editing flows.
- [x] Add selected-partner bulk approval with role checks, confirmation, transactional account provisioning and staff attribution.
- [x] Preserve normal JSON parsing alongside the importer's larger CSV payload limit, verified through the real HTTP routes.
- [x] Verify Ghana dry run and database/browser regressions without importing application data or sending real emails.
- [x] Populate partner Industry from Sector, including the specific Other-sector detail, on imports and public onboarding.
- [x] Add update-only imports with explicit field selections, before/after preview, stale-preview protection and audited receipts.

One partner represents an organization within a cohort and country. Every brief retains its main contact and submitter. Only the selected partner main contact becomes an organization owner; other contacts use member logins and brief-specific hosting permission. Partners remain Pending and briefs Submitted on import. Consent absent from the CSV remains unconfirmed.

Preview never writes application records. Apply requires an unchanged preview, validates live conflicts again and uses one serializable transaction for the entire CSV. Repeating the same source rows skips existing receipts; changed or conflicting source rows are reported rather than overwritten. The same authenticated staff flow is used locally, on staging and on production, with each environment's cohort selected explicitly.

That repeat/skip behavior applies to **Create new partners and briefs**, the default operation. **Update existing only** explicitly permits selected-field corrections using the same source identity. It never creates partners, briefs, users, memberships or invitations. Existing source receipts retain their original content/hash; each update batch records its field selections and before/after changes in the audit trail and downloadable receipt. Brief updates also add staff-attributed revisions. Approved brief-list caches refresh after commit.

## Industry mapping and selective updates

The CSV's sector describes the partner. The existing `organizations.industry` field is the Industry column shown on `/staff/partners`; it is distinct from `organizations.sector` and the brief's `verticalId`. No new database column or migration is needed. The prior importer saved sector but omitted Industry. Public `/onboard-partner` submissions now populate Industry through the same mapping.

| CSV input | System destination | Rule |
| --- | --- | --- |
| Sector; Sector (if Other) | Partner `industry` | Use Sector; for Other, use its supplied detail. Preserve wording, including Legal services and Telecommunication. |
| Sector; Sector (if Other) | Partner `sector`, `sectorOther` | Preserve public-intake fields; normalize Local / Municipal Government to Local/Municipal Government. |
| City or town | Partner `city` | Optional selected update. |
| Opportunity title | Brief `title` | Optional selected update; matching never relies on the title. |
| The opportunity and who it affects | Brief `description`, `problemStatement` | Update together when selected. |
| If addressed, what changes? | Brief `expectedOutcomes`, `whatChanges` | Update together when selected. |
| Roughly how many people? | Brief `affectedCount` | Optional selected update. |
| Records and data that exist | Brief `dataDescription` | Optional selected update. |
| Can data be shared? | Brief `dataAccess` | Optional selected update. |
| Country lead notes | Brief `countryLeadNotes` | Optional selected update. |
| Country | Brief `problemCountry` | Optional selected update; partner country remains part of identity validation. |

To backfill Industry:

1. Open `/staff/partners/import` → **Partners and briefs**.
2. Select **Update existing only**, the correct active cohort and source timezone.
3. Keep only **Partner industry** checked (the update-mode default) and upload the original full CSV.
4. Preview and review **Selected field changes**, then select **Update selected fields** and confirm.
5. Download the receipt. Rerunning the update reports unchanged rows once the values match.

Updates identify briefs by cohort + original Session ID + Opportunity #, using import receipts where available. Public-intake records without receipts can match the same exact source identity. Partner identity/country/cohort is verified before changes. Unknown source identities are skipped with warnings; deleted, reassigned or ambiguous matches block apply. Repeated partner rows are consolidated into one update. Conflicting selected values for the same partner block the import rather than choosing a submitter arbitrarily. Blank selected cells preserve existing data and cannot clear a field.

The original complete CSV format and its validation still apply. Updates allow only the listed fields, leaving partner ownership, contacts, emails, credentials, consent, scoring, approval states, brief vertical assignments and source provenance untouched. Changing fields, file, mode or target data invalidates the preview. Selecting a field explicitly authorizes replacing its nonblank current value; review the before/after comparison before confirming.

The Ghana reference has 31 brief rows representing 13 partners, with no conflicting sector values within a partner. Industries resolve to Healthcare (4 partners), Agriculture (3), Finance (2), and one each for Education, Legal services, Local/Municipal Government and Telecommunication. A disposable-database rehearsal backfilled exactly 13 Industry values while preserving all 31 briefs, accounts, contacts and original receipts. Its second preview reported 31 unchanged rows. No application records were changed and no real email was sent during verification.

## Staff workflow

1. Open `/staff/partners/import` and select **Partners and briefs**.
2. Select the target active cohort and the original spreadsheet's timestamp timezone. Upload or paste the original country CSV (up to 500 KB and 500 brief rows).
3. Preview the import. Review partners, new accounts, briefs, duplicate/conflict messages, main contacts, submitters, original timestamps and scores.
4. For each new partner, choose one main contact from its submitters. The earliest submission is the initial suggestion. Existing partner contacts cannot be overwritten by import. Refresh the preview after changes.
5. Confirm **Import partners and briefs** and download the receipt. Review and approve partners/briefs separately; send invitations through the existing actions when ready.

Source rows are keyed by cohort, original session UUID and opportunity number. Raw CSV cell values, content hashes, source filename/timezone, row number, actor and created brief IDs are retained in `partner_import_records`. Audit records identify each import batch. Existing user credentials and existing partner records are not changed. Contact emails already used by staff, unavailable accounts or other partners block the import. Country/name matches outside the chosen cohort, deleted records, incomplete sessions and unrecognized scoring answers require resolution before apply.

The importer uses the public-intake fields and scoring rules. It preserves multiline/quoted content, country lead notes and missing Q7/Q8 impact answers. Supplied scores must agree with the answers. It does not manufacture consent or silently truncate text. The staff/partner brief editors accept the longer intake fields and synchronize their main-contact association when changed, cleared or restored from a new revision.

## Event hosting

The resolved host is the brief's main contact, or the partner's main contact when no brief contact email exists. Member logins can use **Host event** only for briefs where their email matches the resolved host. Partner owners/admins retain scheduling/editing/cancellation permission; program managers retain existing staff oversight. Public onboarding also creates the brief main-contact membership without granting partner administration rights.

Meetings remain in the shared ATF Zoom account. The host URL is fetched only through the authenticated start endpoint and is never stored or included in invitation email. Hosts receive a separate calendar invitation linking to the protected portal button. Reassigning a host cancels the old host invitation and sends a new one; failed host delivery retries without replaying checkpointed participant invitations. Existing events are baselined during migration, so deployment does not replay old host notifications.

## Environments and validation

Migration `AddPartnerSubmissionImports1793793600000` adds brief contacts, source receipts and host-invitation delivery state. Apply it before running the new API in each environment. It is applied locally. The automated rehearsal did not import Ghana records into the application database. No new environment variables or packages are required.

The Ghana CSV passed a read-only preview under the existing local Super Admin identity. A separate disposable-database rehearsal created 13 partners, 22 contact accounts and 31 briefs, retained all 31 brief main contacts and the two missing impact scores, and skipped all 31 briefs on rerun. No real emails were sent. The source CSV and contact data are not committed to the repository.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/organizations/submission-import/preview` | Read-only CSV validation, conflict checks and contact selection preview |
| POST | `/organizations/submission-import/apply` | Apply the reviewed input using `previewHash`; return a batch receipt |
| POST | `/organizations/bulk-approve` | Approve 1–500 selected pending, active partners atomically; provision portal access without sending invitations |

All routes require Super Admin or Program Manager access. Import requests include `cohortId`, `csv`, `sourceName`, `sourceTimezone` and optional `primaryContacts` keyed by country/organization. Optional `mode` is `create` (default) or `update_existing`; the latter requires a nonempty, unique `updateFields` allowlist (for example `["industry"]`). Apply also requires the latest `previewHash`. Changed data or conflicting concurrent operations require a refreshed preview. Bulk approval takes unique UUIDs in `organizationIds` and records the authenticated staff identity. A stale selection or conflicting account rolls back the entire approval.

## Verification on 2026-11-04

- [x] All 493 API tests passed without skips, including database migration consistency, transactions, concurrency, legacy owner access, contact login, hosting permissions, bulk approval and HTTP request parsing.
- [x] All 75 browser tests passed, including import preview, contact selection, confirmation, errors, receipts, read-only staff restrictions, contact hosting controls and mixed-selection bulk approval.
- [x] Workspace type checks and production API/web builds passed.
- [x] The local migration is applied, API readiness passes and the importer accepts its larger CSV payload while rejecting anonymous requests with HTTP 401.
- [x] Ghana passed both the read-only local preview and the disposable import/rerun rehearsal without changing application data.

## Selective-update verification on 2026-11-07

- [x] 575 API tests passed, including Industry-only backfill, selected brief fields, blank preservation, immutable source receipts, stale previews, HTTP field validation, conflicts and authorization.
- [x] 21 partner browser tests passed, including field selection, before/after review, confirmation, downloaded update receipts and unchanged/unmatched rows.
- [x] Ghana disposable rehearsal backfilled 13 partners, changed no briefs/accounts/contacts/receipts and reported 31 unchanged rows on repeat.
- [x] Workspace type checks, API/web builds and local API readiness passed. Lint has no errors; existing repository warnings remain.

The application's existing partner records have not been reimported by this verification; reimport remains a deliberate staff preview/confirm action in each environment.
