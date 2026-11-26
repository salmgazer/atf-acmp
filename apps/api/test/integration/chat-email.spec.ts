import "reflect-metadata";
import { DataSource } from "typeorm";
import { randomUUID } from "crypto";
import * as path from "path";
import { ConfigService } from "@nestjs/config";
import { Cohort, CohortStatus } from "@/database/entities/cohort.entity";
import { Participant, ParticipantStatus } from "@/database/entities/participant.entity";
import { Team, TeamMember, TeamMemberStatus } from "@/database/entities/team.entity";
import { ChannelMember, ChannelType, ChatChannel, ChatMessage, MessageType, MessageReaction, SenderType } from "@/database/entities/chat.entity";
import { NotificationPreference, NotificationRecipientType } from "@/database/entities/notification.entity";
import { ChatEmailDigest } from "@/database/entities/chat-email-digest.entity";
import { ChatEmailService } from "@/modules/chat/chat-email.service";
import { ChatService } from "@/modules/chat/chat.service";

const databaseUrl = process.env.ACMP_TEST_DATABASE_URL;
(databaseUrl ? describe : describe.skip)("Missed team-chat emails in PostgreSQL", () => {
  let db: DataSource, service: ChatEmailService, chat: ChatService, cohort: Cohort, team: Team, channel: ChatChannel, sender: Participant, recipient: Participant;
  const now = new Date("2040-05-01T12:00:00Z");
  const earlier = new Date("2040-05-01T10:00:00Z");
  const email = { sendMissedChatEmail: jest.fn() };
  const config = new ConfigService({ FRONTEND_URL: "https://portal.example.test" });
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!/^\/acmp_regression_[a-z0-9_]+_test$/.test(url.pathname) || !["localhost", "127.0.0.1", "postgres"].includes(url.hostname)) throw new Error("A disposable local regression database is required");
    db = await new DataSource({ type: "postgres", url: databaseUrl, entities: [path.join(__dirname, "../../src/database/entities/*.entity.ts")], migrations: [path.join(__dirname, "../../src/database/migrations/*.ts")] }).initialize();
    await db.runMigrations();
    service = new ChatEmailService(db, email as any, config);
    chat = new ChatService(db.getRepository(ChatChannel), db.getRepository(ChatMessage), db.getRepository(ChannelMember), db.getRepository(MessageReaction), db.getRepository(Team), { sendToExternalUserIds: async () => {} } as any);
  }, 120000);
  beforeEach(async () => {
    jest.restoreAllMocks(); email.sendMissedChatEmail.mockReset().mockResolvedValue(undefined);
    cohort = await db.getRepository(Cohort).save({ name: randomUUID(), status: CohortStatus.ACTIVE });
    team = await db.getRepository(Team).save({ name: "Digest test team", cohortId: cohort.id, inviteCode: randomUUID() });
    const createPerson = () => db.getRepository(Participant).save({ participantId: randomUUID(), email: `${randomUUID()}@example.test`, firstName: "Synthetic", lastName: "Member", country: "Ghana", cohortId: cohort.id, status: ParticipantStatus.ASSIGNED, onboardingComplete: true, mustChangePassword: false });
    sender = await createPerson(); recipient = await createPerson();
    for (const p of [sender, recipient]) await db.getRepository(TeamMember).save({ teamId: team.id, participantId: p.id, status: TeamMemberStatus.CONFIRMED });
    channel = await db.getRepository(ChatChannel).save({ name: "Team conversation", type: ChannelType.TEAM, teamId: team.id, cohortId: cohort.id, emailNotificationsStartAt: earlier });
    for (const p of [sender, recipient]) await db.getRepository(ChannelMember).save({ channelId: channel.id, memberId: p.id, memberType: SenderType.PARTICIPANT, memberName: p.firstName, joinedAt: earlier });
  });
  afterEach(async () => { if (team) await db.getRepository(ChatChannel).delete({ teamId: team.id }); });
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });
  const message = (extra: Partial<ChatMessage> = {}) => db.getRepository(ChatMessage).save({ channelId: channel.id, senderId: sender.id, senderType: SenderType.PARTICIPANT, senderName: "Synthetic sender", content: "Private chat content must stay out of email", messageType: MessageType.TEXT, createdAt: new Date(now.getTime() - 6 * 60_000), ...extra });
  const prefs = (extra: Partial<NotificationPreference>) => db.getRepository(NotificationPreference).save({ userId: recipient.id, userType: NotificationRecipientType.PARTICIPANT, ...extra });

  it("waits five minutes, groups messages, omits the sender, and never repeats unchanged unread activity", async () => {
    await message({ createdAt: new Date(now.getTime() - 4 * 60_000) });
    await service.processDue(now); expect(email.sendMissedChatEmail).not.toHaveBeenCalled();
    await message({ createdAt: new Date(now.getTime() - 60_000) });
    await service.processDue(new Date(now.getTime() + 60_000));
    expect(email.sendMissedChatEmail).toHaveBeenCalledTimes(1);
    expect(email.sendMissedChatEmail).toHaveBeenCalledWith(expect.objectContaining({ to: recipient.email, teamName: team.name, chatUrl: `https://portal.example.test/participant/chat?channelId=${channel.id}` }));
    const jobs = await db.getRepository(ChatEmailDigest).findBy({ channelId: channel.id });
    expect(jobs).toMatchObject([{ participantId: recipient.id, status: "sent", messageIds: expect.any(Array) }]);
    expect(jobs[0].messageIds).toHaveLength(2);
    await service.processDue(new Date(now.getTime() + 2 * 3600_000));
    expect(email.sendMissedChatEmail).toHaveBeenCalledTimes(1);
  });

  it("cancels a queued email when messages are read on another device before delivery", async () => {
    const m = await message(); await service.prepare(db.manager, now);
    await chat.markChannelAsRead(channel.id, recipient.id, SenderType.PARTICIPANT, m.id);
    await service.processDue(now);
    expect(email.sendMissedChatEmail).not.toHaveBeenCalled();
    expect(await db.getRepository(ChatEmailDigest).findOneBy({ channelId: channel.id })).toMatchObject({ status: "cancelled" });
  });

  it("acknowledges only the displayed message, rejects foreign messages and never moves read receipts backwards", async () => {
    const first = await message({ createdAt: new Date(now.getTime() - 10 * 60_000) });
    const latest = await message();
    await chat.markChannelAsRead(channel.id, recipient.id, SenderType.PARTICIPANT, first.id);
    expect(await chat.getUnreadCount(channel.id, recipient.id, SenderType.PARTICIPANT)).toBe(1);
    await chat.markChannelAsRead(channel.id, recipient.id, SenderType.PARTICIPANT, latest.id);
    await chat.markChannelAsRead(channel.id, recipient.id, SenderType.PARTICIPANT, first.id);
    expect(await chat.getUnreadCount(channel.id, recipient.id, SenderType.PARTICIPANT)).toBe(0);
    const other = await db.getRepository(ChatChannel).save({ type: ChannelType.TEAM, name: "Another conversation", teamId: team.id, cohortId: cohort.id });
    const foreign = await message({ channelId: other.id });
    await expect(chat.markChannelAsRead(channel.id, recipient.id, SenderType.PARTICIPANT, foreign.id)).rejects.toThrow("must belong");
  });

  it("limits subsequent new activity to one email per person per hour", async () => {
    await message(); await service.processDue(now);
    await message({ createdAt: new Date(now.getTime() + 60_000) });
    await service.processDue(new Date(now.getTime() + 6 * 60_000));
    expect(email.sendMissedChatEmail).toHaveBeenCalledTimes(1);
    expect(await db.getRepository(ChatEmailDigest).findOneBy({ channelId: channel.id, status: "queued" })).toMatchObject({ dueAt: new Date(now.getTime() + 3600_000) });
    await service.processDue(new Date(now.getTime() + 3600_000));
    expect(email.sendMissedChatEmail).toHaveBeenCalledTimes(2);
  });

  it("keeps PostgreSQL microsecond read precision so acknowledged messages are not counted or emailed again", async () => {
    const m = await message();
    await db.query("UPDATE chat_messages SET created_at='2040-05-01T11:54:00.123456'::timestamp WHERE id=$1", [m.id]);
    await chat.markChannelAsRead(channel.id, recipient.id, SenderType.PARTICIPANT, m.id);
    expect(await chat.getUnreadCount(channel.id, recipient.id, SenderType.PARTICIPANT)).toBe(0);
    await service.processDue(now); expect(email.sendMissedChatEmail).not.toHaveBeenCalled();
  });

  it("defers during recipient quiet hours and rechecks read state before resuming", async () => {
    await message(); await prefs({ quietHoursStart: "11:00", quietHoursEnd: "13:00", timezone: "UTC" });
    await service.processDue(now); expect(email.sendMissedChatEmail).not.toHaveBeenCalled();
    expect(await db.getRepository(ChatEmailDigest).findOneBy({ channelId: channel.id })).toMatchObject({ dueAt: new Date("2040-05-01T13:00:00Z") });
    await service.processDue(new Date("2040-05-01T13:00:00Z")); expect(email.sendMissedChatEmail).toHaveBeenCalledTimes(1);
  });

  it.each(["email-disabled", "chat-disabled", "muted", "removed", "deactivated", "opted-out", "channel-left", "archived", "pending", "team-disqualified", "cohort-archived", "recipient-deleted", "message-deleted"])("does not email a recipient who is %s", async reason => {
    await message(); await service.prepare(db.manager, now);
    if (reason === "email-disabled") await prefs({ emailEnabled: false });
    if (reason === "chat-disabled") await prefs({ typeSettings: { chat_message: { email: false } } });
    if (reason === "muted") await db.getRepository(ChannelMember).update({ channelId: channel.id, memberId: recipient.id }, { isMuted: true });
    if (reason === "channel-left") await db.getRepository(ChannelMember).update({ channelId: channel.id, memberId: recipient.id }, { leftAt: now });
    if (reason === "removed") await db.getRepository(TeamMember).softDelete({ teamId: team.id, participantId: recipient.id });
    if (reason === "pending") await db.getRepository(TeamMember).update({ teamId: team.id, participantId: recipient.id }, { status: TeamMemberStatus.PENDING });
    if (reason === "deactivated") await db.getRepository(Participant).update(recipient.id, { status: ParticipantStatus.INACTIVE });
    if (reason === "opted-out") await db.getRepository(Participant).update(recipient.id, { programmeOptedOut: true });
    if (reason === "archived") await db.getRepository(ChatChannel).update(channel.id, { isArchived: true });
    if (reason === "team-disqualified") await db.getRepository(Team).update(team.id, { status: "disqualified" as any });
    if (reason === "cohort-archived") await db.getRepository(Cohort).update(cohort.id, { status: CohortStatus.ARCHIVED });
    if (reason === "recipient-deleted") await db.getRepository(Participant).softDelete(recipient.id);
    if (reason === "message-deleted") await db.getRepository(ChatMessage).update({ channelId: channel.id }, { isDeleted: true });
    await service.processDue(now); expect(email.sendMissedChatEmail).not.toHaveBeenCalled();
    expect(await db.getRepository(ChatEmailDigest).findOneBy({ channelId: channel.id })).toMatchObject({ status: "cancelled" });
  });

  it("does not email old history, system events, deleted messages, or non-team channels", async () => {
    await db.getRepository(ChatChannel).update(channel.id, { emailNotificationsStartAt: now });
    await message(); await service.processDue(now); expect(email.sendMissedChatEmail).not.toHaveBeenCalled();
    await db.getRepository(ChatChannel).update(channel.id, { emailNotificationsStartAt: earlier });
    await db.getRepository(ChatMessage).delete({ channelId: channel.id });
    await message({ messageType: MessageType.SYSTEM }); await message({ senderType: SenderType.SYSTEM }); await message({ isDeleted: true });
    await service.processDue(now); expect(email.sendMissedChatEmail).not.toHaveBeenCalled();
    await db.getRepository(ChatChannel).update(channel.id, { type: ChannelType.ANNOUNCEMENT });
    await message(); await service.processDue(now); expect(email.sendMissedChatEmail).not.toHaveBeenCalled();
  });

  it("recovers queued messages after a restart, retries failures and reuses a stable provider idempotency key", async () => {
    await message(); await service.prepare(db.manager, now);
    email.sendMissedChatEmail.mockRejectedValueOnce(new Error("Provider unavailable"));
    service = new ChatEmailService(db, email as any, config); await service.processDue(now);
    expect(await db.getRepository(ChatEmailDigest).findOneBy({ channelId: channel.id })).toMatchObject({ status: "queued", attempts: 1 });
    service = new ChatEmailService(db, email as any, config); await service.processDue(new Date(now.getTime() + 2 * 60_000));
    expect(await db.getRepository(ChatEmailDigest).findOneBy({ channelId: channel.id })).toMatchObject({ status: "sent", attempts: 2 });
    expect(email.sendMissedChatEmail.mock.calls[0][0]).toEqual(email.sendMissedChatEmail.mock.calls[1][0]);
  });

  it("recovers from an interrupted delivery checkpoint with the same email request and no provider duplicate", async () => {
    await message(); const accepted = new Set<string>();
    email.sendMissedChatEmail.mockImplementation(async params => { accepted.add(params.deliveryId); });
    const runner = db.createQueryRunner(); const update = runner.manager.update.bind(runner.manager);
    jest.spyOn(runner.manager, "update").mockImplementation(async (...args: any[]) => {
      if (args[2]?.status === "sent") throw new Error("Database disconnected after provider accepted email");
      return (update as any)(...args);
    });
    jest.spyOn(db, "createQueryRunner").mockReturnValueOnce(runner);
    await service.processDue(now); jest.restoreAllMocks();
    await new ChatEmailService(db, email as any, config).processDue(now);
    expect(email.sendMissedChatEmail).toHaveBeenCalledTimes(2); expect(accepted.size).toBe(1);
    expect(email.sendMissedChatEmail.mock.calls[0][0]).toEqual(email.sendMissedChatEmail.mock.calls[1][0]);
  });

  it("serializes concurrent workers across API replicas and has no schema drift", async () => {
    await message(); await Promise.all([service.processDue(now), new ChatEmailService(db, email as any, config).processDue(now)]);
    expect(email.sendMissedChatEmail).toHaveBeenCalledTimes(1);
    expect((await db.driver.createSchemaBuilder().log()).upQueries.map(q => q.query)).toEqual([]);
  });

  it("stops after bounded delivery retries and does not resend an expired uncertain request", async () => {
    await message(); email.sendMissedChatEmail.mockRejectedValue(new Error("Delivery unavailable"));
    let clock = now;
    for (let attempt = 1; attempt <= 5; attempt++) {
      await service.processDue(clock); clock = new Date(clock.getTime() + 60_000 * 2 ** attempt);
    }
    expect(email.sendMissedChatEmail).toHaveBeenCalledTimes(5);
    expect(await db.getRepository(ChatEmailDigest).findOneBy({ channelId: channel.id })).toMatchObject({ status: "failed", attempts: 5 });
    await service.processDue(new Date(now.getTime() + 2 * 86400_000));
    expect(email.sendMissedChatEmail).toHaveBeenCalledTimes(5);
  });
});
