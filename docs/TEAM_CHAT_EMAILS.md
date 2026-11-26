# Unread team chat email reminders

## Completed behavior

- [x] Notify current, confirmed participant members of a team about unread messages from other people.
- [x] Wait five minutes before sending and group messages into a reminder. Send at most one reminder per participant per hour, across conversations.
- [x] Cancel a pending reminder when its messages are read, the participant loses access, or their account, programme or cohort becomes ineligible.
- [x] Respect account email settings, the chat email preference, channel mute and quiet hours in the recipient's timezone.
- [x] Link directly to the conversation and its email settings. Use the ATF email branding without copying private messages or attachments into email.
- [x] Preserve delivery state in PostgreSQL, recover after restarts and prevent concurrent API replicas from sending the same job.
- [x] Start with new activity after enablement; do not send reminders for historical unread messages.

Participants can change these preferences using the mail button in participant chat. Email links also open that settings dialog. A reminder does not mark messages read; participants reply in the app.

## Read receipts

An open socket or background browser tab is not a read receipt. The client acknowledges the last displayed message only when the loaded conversation is visible, focused, scrolled to its end and the user has interacted within two minutes. Reading on another device cancels a queued reminder. Read cursors advance monotonically using the message's exact PostgreSQL timestamp.

## Delivery and recovery

The API scans every 30 seconds and on startup. Chat messages are the durable source; `chat_email_digests` records each recipient's message batch, cursor, next attempt and result. A PostgreSQL advisory lock serializes delivery across replicas. Each pass processes up to 20 due reminders with one second between jobs.

Resend requests reuse a persisted payload and stable idempotency key. If Resend times out, the job retries through Resend instead of switching providers and risking a duplicate. There are at most five attempts with exponential backoff. An uncertain request expires after 23 hours, within Resend's 24-hour idempotency window. Generic SMTP installations retain a stable Message-ID but do not provide Resend's duplicate suppression guarantee.

The worker rechecks unread state, preferences and membership before sending. Quiet hours and the hourly cooldown defer a job. A cancelled or failed batch is not replayed indefinitely; later new messages can create a new batch.

For operational checks, inspect aggregate job states without exposing message content or email addresses:

```sql
SELECT status, count(*), min(due_at) AS earliest_due
FROM chat_email_digests
GROUP BY status;
```

## Release

Deploy migration `1795737600000-TeamChatEmailFallback` before starting the updated API. It adds the outbox table and initializes each channel's email enablement timestamp. No new environment variables are required; use the existing email provider and `FRONTEND_URL` settings. API and web changes should ship together so background tabs no longer acknowledge incoming messages automatically.

Verification covers delayed delivery, grouping, read cancellation, exclusions, quiet hours, retry limits, restart recovery, concurrent workers, provider idempotency, database timestamp precision, browser visibility/focus/idle behavior and preference controls. Email delivery is mocked in regression tests; tests do not send messages to real participants.
