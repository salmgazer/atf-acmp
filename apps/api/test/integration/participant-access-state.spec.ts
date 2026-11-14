import "reflect-metadata";
import { DataSource, Repository } from "typeorm";
import * as path from "path";
import { randomUUID } from "crypto";
import * as bcrypt from "bcrypt";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { Participant, ParticipantPreference, ParticipantStatus } from "@/database/entities/participant.entity";
import { Cohort, CohortStatus } from "@/database/entities/cohort.entity";
import { User } from "@/database/entities/user.entity";
import { Mentor } from "@/database/entities/mentor.entity";
import { RefreshToken } from "@/database/entities/refresh-token.entity";
import { ParticipantsService } from "@/modules/participants/participants.service";
import { AuthService } from "@/auth/auth.service";
import { PortalType } from "@/auth/dto/auth.dto";
import { ParticipantImportAccessState1794614400000 } from "@/database/migrations/1794614400000-ParticipantImportAccessState";

const url = process.env.ACMP_TEST_DATABASE_URL;
(url ? describe : describe.skip)("Imported participant access status", () => {
  let db: DataSource, cohort: Cohort, auth: AuthService, participants: ParticipantsService;
  const password = "Initial-password-123!";
  beforeAll(async () => {
    const target = new URL(url!);
    if (!/^\/acmp_regression_[a-z0-9_]+_test$/.test(target.pathname) || !["localhost", "127.0.0.1", "postgres"].includes(target.hostname)) throw new Error("Disposable local regression database required");
    db = new DataSource({ type: "postgres", url, entities: [path.join(__dirname, "../../src/database/entities/*.entity.ts")], migrations: [path.join(__dirname, "../../src/database/migrations/*.ts")], synchronize: false });
    await db.initialize();await db.runMigrations();
  }, 120000);
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });
  beforeEach(async () => {
    cohort = await db.getRepository(Cohort).save({ name: randomUUID(), status: CohortStatus.ACTIVE, countries: ["GH"], groups: ["Batch 1"] });
    auth = new AuthService(db.getRepository(User), db.getRepository(RefreshToken), db.getRepository(Participant), db.getRepository(Cohort), db.getRepository(Mentor), new JwtService({ secret: "local-access-status-test" }), {} as any, new ConfigService({}));
    participants = new ParticipantsService(db.getRepository(Participant), db.getRepository(ParticipantPreference), db.getRepository(Cohort), { create: jest.fn() } as any, {} as any, {} as any, {} as any);
  });
  const person = async (values: Partial<Participant> = {}) => db.getRepository(Participant).save({ participantId: randomUUID(), email: randomUUID() + "@example.test", firstName: "New", lastName: "Learner", country: "Ghana", cohortId: cohort.id, group: "Batch 1", passwordHash: await bcrypt.hash(password, 10), status: ParticipantStatus.IMPORTED, mustChangePassword: true, onboardingComplete: false, ...values });
  const signIn = (p: Participant, supplied = password) => auth.loginWithPassword(p.email, supplied, PortalType.PARTICIPANT);

  it("keeps imports pending, permits their first sign-in and marks them active only after a session succeeds", async () => {
    const p = await person();
    expect(await participants.getStatistics(cohort.id)).toMatchObject({ imported: 1, active: 0 });
    await expect(signIn(p, "Wrong-password")).rejects.toThrow("Invalid email or password");
    expect((await db.getRepository(Participant).findOneByOrFail({ id: p.id })).status).toBe(ParticipantStatus.IMPORTED);
    const result = await signIn(p);
    expect(result.user).toMatchObject({ id: p.id, mustChangePassword: true, role: "participant" });
    expect((await db.getRepository(Participant).findOneByOrFail({ id: p.id })).status).toBe(ParticipantStatus.ACTIVE);
    expect(await participants.getStatistics(cohort.id)).toMatchObject({ imported: 0, active: 1 });
    expect(await db.getRepository(RefreshToken).countBy({ participantId: p.id })).toBe(1);
  });

  it("does not mark an import active when session creation fails", async () => {
    const p = await person(), save = Repository.prototype.save;
    const spy = jest.spyOn(Repository.prototype, "save").mockImplementation(function(this: Repository<any>, ...args: any[]) { if (this.target === RefreshToken) throw new Error("Session unavailable");return (save as any).apply(this, args); });
    try { await expect(signIn(p)).rejects.toThrow("Session unavailable"); } finally { spy.mockRestore(); }
    expect((await db.getRepository(Participant).findOneByOrFail({ id: p.id })).status).toBe(ParticipantStatus.IMPORTED);
    expect(await db.getRepository(RefreshToken).countBy({ participantId: p.id })).toBe(0);
  });

  it("keeps deactivation, programme opt-out and archived-cohort blocks, and preserves ready/assigned states", async () => {
    const blocked = await person({ status: ParticipantStatus.INACTIVE });
    await expect(signIn(blocked)).rejects.toThrow("deactivated");
    const optedOut = await person({ programmeOptedOut: true });await expect(signIn(optedOut)).rejects.toThrow("deactivated");
    const p = await person();await db.getRepository(Cohort).update(cohort.id, { status: CohortStatus.ARCHIVED });
    await expect(signIn(p)).rejects.toThrow("COHORT_NOT_ACCESSIBLE");
    await db.getRepository(Cohort).update(cohort.id, { status: CohortStatus.ACTIVE });
    for (const status of [ParticipantStatus.READY, ParticipantStatus.ASSIGNED]) {
      await db.getRepository(Participant).update(p.id, { status });await signIn(p);
      expect((await db.getRepository(Participant).findOneByOrFail({ id: p.id })).status).toBe(status);
    }
  });

  it("uses the not-yet-accessed state for the legacy bulk importer as well", async () => {
    const externalId = randomUUID();
    await participants.bulkImport({ cohortId: cohort.id, group: "Batch 1", sendWelcomeEmail: false, participants: [{ participantId: externalId, email: randomUUID() + "@example.test", firstName: "Bulk", lastName: "Learner", country: "Ghana" }] });
    expect((await db.getRepository(Participant).findOneByOrFail({ participantId: externalId })).status).toBe(ParticipantStatus.IMPORTED);
  });

  it("corrects unused legacy imports while preserving access evidence, progress, deactivations and reversible history", async () => {
    const unused = await person({ status: ParticipantStatus.ACTIVE });
    const visited = await person({ status: ParticipantStatus.ACTIVE });
    await db.getRepository(RefreshToken).save({ token: randomUUID(), participantId: visited.id, expiresAt: new Date(0), isRevoked: true });
    const changedPassword = await person({ status: ParticipantStatus.ACTIVE, mustChangePassword: false });
    const onboarded = await person({ status: ParticipantStatus.READY, onboardingComplete: true });
    const assigned = await person({ status: ParticipantStatus.ASSIGNED });
    const deactivated = await person({ status: ParticipantStatus.INACTIVE });
    const fresh = await person();
    const q = db.createQueryRunner();await q.connect();await q.startTransaction();
    try {
      const migration = new ParticipantImportAccessState1794614400000();await migration.up(q);
      const status = async (id: string) => (await q.manager.getRepository(Participant).findOneByOrFail({ id })).status;
      expect(await status(unused.id)).toBe(ParticipantStatus.IMPORTED);
      expect(await status(visited.id)).toBe(ParticipantStatus.ACTIVE);
      expect(await status(changedPassword.id)).toBe(ParticipantStatus.ACTIVE);
      expect(await status(onboarded.id)).toBe(ParticipantStatus.READY);
      expect(await status(assigned.id)).toBe(ParticipantStatus.ASSIGNED);
      expect(await status(deactivated.id)).toBe(ParticipantStatus.INACTIVE);
      await migration.down(q);
      expect(await status(unused.id)).toBe(ParticipantStatus.ACTIVE);
      expect(await status(fresh.id)).toBe(ParticipantStatus.IMPORTED);
      expect(await status(deactivated.id)).toBe(ParticipantStatus.INACTIVE);
    } finally { await q.rollbackTransaction();await q.release(); }
  });
});
