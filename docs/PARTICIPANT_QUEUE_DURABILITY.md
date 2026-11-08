# Participant queue durability

## Completion checklist

- [x] Persist invitation recipients, batch status and per-recipient results in PostgreSQL.
- [x] Accept a durable batch before attempting Redis publication.
- [x] Restore missing participant import and invitation jobs at startup and every 30 seconds.
- [x] Restore BullMQ's global concurrency settings after Redis replacement.
- [x] Use PostgreSQL session locks to prevent old and recovered workers from sending concurrently.
- [x] Adopt unfinished pre-upgrade Redis batches with their saved progress.
- [x] Keep batch status available after Redis jobs expire or disappear.
- [x] Enable local Redis AOF with `appendfsync everysec` and `noeviction`.
- [x] Prepare cloud Redis `noeviction` and snapshot retention (production 7 days; staging 1 day).
- [x] Verify total Redis loss, interrupted delivery, competing workers, import handoff and legacy adoption using disposable PostgreSQL/Redis instances and mocked email delivery.

## How recovery works

`participant_import_batches` remains the durable source for participant imports. The new `participant_invite_batches` table stores an immutable recipient list, requester, status and progress for each invitation batch. Imported invitation batch IDs remain deterministic (`import-<import-batch-id>-<offset>`), so retrying the handoff cannot create a second logical batch.

The API saves a batch to PostgreSQL before attempting to enqueue its Redis job. A Redis publishing failure leaves a queued database record, and the request returns its durable batch ID. A recovery service runs at application startup and every 30 seconds. It republishes missing jobs, replaces finished/failed Redis jobs whose database batch is still unfinished, and restores the concurrency settings lost with Redis. Live Redis jobs are left to BullMQ's existing processing/stall recovery. PostgreSQL locks serialize recovery across API replicas.

Each invitation recipient is rechecked against current participant eligibility and their current email. After sending, failing or skipping, the result is saved in PostgreSQL before advancing. Redis progress is no longer authoritative. A replacement Redis instance can therefore resume at the database checkpoint. Completed batches and recipient failures are retained in PostgreSQL and are not automatically replayed. Staff can deliberately resend failed invitations through the existing actions.

A PostgreSQL session advisory lock covers participant email delivery across batches, independently of Redis locks. Each recipient also checks that session before sending. Import workers take a separate per-import PostgreSQL lock before revalidation and processing. No database transaction is held open across an email batch; the session lock uses one database connection until the worker finishes. A terminated process releases its session locks through PostgreSQL.

Import recovery also covers a crash after participants commit but before their invitation batches are fully recorded. A completed import with `invitationState = pending` is requeued to finish its idempotent handoff. Already committed participants are not imported again. Failed validation or revoked importing staff authorization remains a reported failure rather than being bypassed by recovery.

## Guarantees and limits

- Redis job loss, including a full Redis reset or replacement, does not erase batches already recorded in PostgreSQL under this implementation.
- Completed-recipient checkpoints are not replayed simply because Redis lost an older copy of progress.
- External email delivery is not exactly once. A process failure after a provider accepts an email but before its PostgreSQL checkpoint commits can duplicate that one recipient on recovery. SMTP and the current provider fallback path cannot make delivery and a database write atomic.
- PostgreSQL is the recovery source and must retain its own data/backups. A rollback of PostgreSQL to an older backup can also roll back delivery history.
- Before the upgrade, progress existed only in Redis. Startup/worker/status access adopts existing Redis jobs, but progress already lost before adoption cannot be reconstructed safely. Do not reset Redis during this upgrade.
- The database recovery layer covers participant imports and participant invitation batches. Mentor/partner queues benefit from the Redis persistence/eviction settings but do not acquire this participant-specific ledger.

## Rollout

1. Apply `1794124800000-DurableParticipantQueues.ts` before starting the updated API. It creates the invitation ledger and a recovery index; it does not import participants or send email. Normal deployment migrations include it.
2. Start the updated API against the existing Redis dataset. It adopts unfinished legacy batches and starts periodic reconciliation.
3. Apply the Terraform Redis configuration separately. This adds an ElastiCache parameter group using `noeviction` and increases snapshot retention; it does not provision replicas or replace the Redis cluster. Production parameter application follows the existing maintenance-window policy.
4. For an existing local Redis volume, enable AOF **online before recreating the container**: run `redis-cli CONFIG SET appendonly yes`, `CONFIG SET appendfsync everysec` and `CONFIG SET maxmemory-policy noeviction` against that Redis instance. Wait for `aof_rewrite_in_progress:0`, `aof_last_bgrewrite_status:ok`, `aof_last_write_status:ok` and `aof_enabled:1` in `INFO persistence`. The Compose command preserves these settings on later container recreation. Do not replace a populated Redis instance with an empty AOF dataset.
5. Verify batches through the existing staff import/invite status endpoints. Do not flush application Redis as a deployment check.

Local migration and online Redis AOF initialization were applied on 2026-11-08. Cloud infrastructure settings are managed in Terraform; the normal app deployment workflow does not apply them automatically. No application Redis data was reset and no real emails were sent by the verification.

## Verification

- 581 API tests passed, including six PostgreSQL/BullMQ/Redis durability integration scenarios; schema/migration consistency passed.
- Workspace type checks and API build passed. Terraform formatting and local provider-schema validation passed. Review a targeted Redis plan before applying the infrastructure configuration.
- Docker Compose configuration validates. The test's `FLUSHDB` is restricted to a dedicated disposable Redis container on a random local port, paired with a disposable regression database. Email delivery is mocked.

The persistence and eviction choices follow [BullMQ's production guidance](https://docs.bullmq.io/guide/going-to-production) and [Redis persistence guidance](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/). AOF reduces Redis-only loss; the PostgreSQL ledger supplies the participant recovery guarantee.

## Deployment email configuration

Staging and production workflows explicitly set every SMTP value to an empty string (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`, `SMTP_USER`, `SMTP_PASS`) and do not inject SMTP credentials from Secrets Manager. Personal SMTP environment variables are removed from the GitHub environments. Resend API key, sender email and sender name are required by deployment preflight checks. Local development can still use Mailpit through Compose.
