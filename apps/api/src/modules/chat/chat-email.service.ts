import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Interval } from "@nestjs/schedule";
import { DataSource, EntityManager, LessThanOrEqual } from "typeorm";
import { ChatEmailDigest } from "@/database/entities/chat-email-digest.entity";
import { EmailService } from "@/email/email.service";
import { withParticipantQueueLock } from "@/modules/participants/participant-queue-lock";
import { CHAT_EMAIL_COOLDOWN_MS, CHAT_EMAIL_DELAY_MS, CHAT_EMAIL_MAX_ATTEMPTS, quietHoursResumeAt } from "./chat-email-policy";

@Injectable()
export class ChatEmailService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ChatEmailService.name);
  private processing = false;
  constructor(private readonly db: DataSource, private readonly email: EmailService, private readonly config: ConfigService) {}

  onApplicationBootstrap() { void this.processDue(); }

  /** PostgreSQL messages are the durable source; no Redis enqueue can be lost. */
  @Interval(30000)
  async processDue(now?: Date) {
    if (this.processing) return;
    this.processing = true;
    const clock = () => now || new Date();
    try {
      await withParticipantQueueLock(this.db, "team-chat-email-delivery", async manager => {
        await this.prepare(manager, clock());
        const jobs = await manager.find(ChatEmailDigest, { where: { status: "queued", dueAt: LessThanOrEqual(clock()) }, order: { dueAt: "ASC", id: "ASC" }, take: 20 });
        for (const [index, job] of jobs.entries()) {
          await this.deliver(manager, job, clock(), clock);
          if (index < jobs.length - 1) await new Promise(resolve => setTimeout(resolve, 1000));
        }
      });
    } catch { this.logger.warn("Chat email processing deferred; unread messages and delivery checkpoints remain in PostgreSQL"); }
    finally { this.processing = false; }
  }

  async prepare(manager: EntityManager, now: Date) {
    await manager.query(`INSERT INTO chat_email_digests(participant_id,channel_id,message_ids,through_at,due_at)
      SELECT p.id,c.id,array_agg(m.id ORDER BY m.created_at,m.id),max(m.created_at),$1::timestamptz
      FROM channel_members cm
      JOIN participants p ON p.id::text=cm.member_id AND p.deleted_at IS NULL AND p.status<>'inactive' AND NOT p.programme_opted_out
      JOIN chat_channels c ON c.id=cm.channel_id AND c.type='team' AND c.deleted_at IS NULL AND NOT c.is_archived
      JOIN teams t ON t.id=c.team_id AND t.deleted_at IS NULL AND t.cohort_id=p.cohort_id AND t.status<>'disqualified'
      JOIN cohorts cohort ON cohort.id=t.cohort_id AND cohort.deleted_at IS NULL AND cohort.status NOT IN ('draft','archived')
      JOIN team_members tm ON tm.team_id=t.id AND tm.participant_id=p.id AND tm.status='confirmed' AND tm.deleted_at IS NULL
      LEFT JOIN LATERAL (SELECT max(d.through_at) AS through_at FROM chat_email_digests d WHERE d.participant_id=p.id AND d.channel_id=c.id) previous ON true
      JOIN chat_messages m ON m.channel_id=c.id AND m.deleted_at IS NULL AND NOT m.is_deleted AND m.message_type<>'system' AND m.sender_type<>'system'
        AND NOT (m.sender_id=p.id::text AND m.sender_type='participant')
        AND m.created_at>=greatest(cm.joined_at,c.email_notifications_start_at)
        AND m.created_at>coalesce(cm.last_read_at,'-infinity'::timestamp)
        AND m.created_at>coalesce(previous.through_at,'-infinity'::timestamp)
        AND m.created_at<=($1::timestamptz AT TIME ZONE 'UTC')
      WHERE cm.member_type='participant' AND cm.left_at IS NULL AND cm.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM chat_email_digests pending WHERE pending.participant_id=p.id AND pending.channel_id=c.id AND pending.status='queued')
      GROUP BY p.id,c.id HAVING min(m.created_at)<=($2::timestamptz AT TIME ZONE 'UTC')
      ON CONFLICT DO NOTHING`, [now, new Date(now.getTime() - CHAT_EMAIL_DELAY_MS)]);
  }

  async deliver(manager: EntityManager, job: ChatEmailDigest, now: Date, clock = () => now) {
    // Re-read access, read receipts, account state, mutes and preferences at send time.
    const [current] = await manager.query(`SELECT p.email,p.first_name,t.name AS team_name,cm.is_muted,cm.muted_until,
      pref.email_enabled,pref.type_settings,pref.quiet_hours_start,pref.quiet_hours_end,pref.timezone,
      (SELECT max(sent_at) FROM chat_email_digests WHERE participant_id=p.id AND status='sent') AS last_sent_at,
      (SELECT count(*)::int FROM chat_messages m WHERE m.id=ANY($3::uuid[]) AND m.channel_id=c.id
        AND m.deleted_at IS NULL AND NOT m.is_deleted AND m.message_type<>'system' AND m.sender_type<>'system'
        AND NOT(m.sender_id=p.id::text AND m.sender_type='participant')
        AND m.created_at>coalesce(cm.last_read_at,'-infinity'::timestamp)) AS unread
      FROM participants p
      JOIN channel_members cm ON cm.member_id=p.id::text AND cm.member_type='participant' AND cm.channel_id=$2 AND cm.left_at IS NULL AND cm.deleted_at IS NULL
      JOIN chat_channels c ON c.id=cm.channel_id AND c.type='team' AND NOT c.is_archived AND c.deleted_at IS NULL
      JOIN teams t ON t.id=c.team_id AND t.cohort_id=p.cohort_id AND t.status<>'disqualified' AND t.deleted_at IS NULL
      JOIN cohorts cohort ON cohort.id=t.cohort_id AND cohort.deleted_at IS NULL AND cohort.status NOT IN ('draft','archived')
      JOIN team_members tm ON tm.participant_id=p.id AND tm.team_id=t.id AND tm.status='confirmed' AND tm.deleted_at IS NULL
      LEFT JOIN notification_preferences pref ON pref.user_id=p.id::text AND pref.user_type='participant' AND pref.deleted_at IS NULL
      WHERE p.id=$1 AND p.deleted_at IS NULL AND p.status<>'inactive' AND NOT p.programme_opted_out`, [job.participantId, job.channelId, job.messageIds]);
    const muted = current?.is_muted && (!current.muted_until || new Date(current.muted_until) > now);
    if (!current || !current.unread || muted || current.email_enabled === false || current.type_settings?.chat_message?.email === false || (job.payload && job.payload.to !== current.email)) {
      await manager.update(ChatEmailDigest, job.id, { status: "cancelled" });
      return;
    }
    const quietUntil = quietHoursResumeAt({ quietHoursStart: current.quiet_hours_start, quietHoursEnd: current.quiet_hours_end, timezone: current.timezone }, now);
    const cooldownUntil = current.last_sent_at ? new Date(new Date(current.last_sent_at).getTime() + CHAT_EMAIL_COOLDOWN_MS) : null;
    const due = Math.max(quietUntil?.getTime() || 0, cooldownUntil?.getTime() || 0);
    if (due > now.getTime()) { await manager.update(ChatEmailDigest, job.id, { dueAt: new Date(due) }); return; }
    // Stay within Resend's 24-hour idempotency window after a first attempt.
    if (job.attempts >= CHAT_EMAIL_MAX_ATTEMPTS || job.firstAttemptAt && now.getTime() - job.firstAttemptAt.getTime() > 23 * 3600_000) {
      await manager.update(ChatEmailDigest, job.id, { status: "failed" }); return;
    }
    const root = this.config.get<string>("FRONTEND_URL", "https://build.atfchallenge.org").replace(/\/+$/, "");
    const chatUrl = `${root}/participant/chat?channelId=${encodeURIComponent(job.channelId)}`;
    const payload = job.payload || { to: current.email, firstName: current.first_name, teamName: current.team_name, chatUrl, preferencesUrl: `${chatUrl}&emailSettings=1` };
    const attempts = job.attempts + 1;
    await manager.update(ChatEmailDigest, job.id, { payload, attempts, firstAttemptAt: job.firstAttemptAt || now });
    await manager.query("SELECT 1"); // The global delivery lock must still be held.
    try {
      await this.email.sendMissedChatEmail({ ...payload, deliveryId: job.id });
    } catch {
      await manager.update(ChatEmailDigest, job.id, { status: attempts >= CHAT_EMAIL_MAX_ATTEMPTS ? "failed" : "queued", dueAt: new Date(clock().getTime() + 60_000 * 2 ** attempts) });
      this.logger.warn(`Chat email ${job.id} delivery deferred (attempt ${attempts})`);
      return;
    }
    // If this checkpoint fails after provider acceptance, retry with the same
    // persisted payload and idempotency key instead of sending another email.
    await manager.update(ChatEmailDigest, job.id, { status: "sent", sentAt: clock() });
  }
}
