import "reflect-metadata";
import { TeamsService } from "./teams.service";
import { TeamsController } from "./teams.controller";
import { assertParticipantTeamAdmission } from "@/common/services/team-rules";

describe("Participant-compatible team discovery", () => {
  const person = (id: string, country = "Ghana", consent = false, group = "A") => ({ id, country, cohortId: "cohort", group, preference: { crossCountryWilling: consent } });
  const team = (id: string, members: ReturnType<typeof person>[], group = "A", pending: ReturnType<typeof person>[] = []) => ({ id, group, members: [...members.map(p => ({ participantId: p.id, status: "confirmed", participant: { id: p.id, firstName: p.id } })), ...pending.map(p => ({ participantId: p.id, status: "pending", participant: { id: p.id } }))] });
  function fixture(requester: ReturnType<typeof person>, teams: ReturnType<typeof team>[], profiles: ReturnType<typeof person>[], max = 5) {
    const qb: any = { getMany: jest.fn(async () => teams) };
    for (const key of ["leftJoinAndSelect", "where", "andWhere"]) qb[key] = jest.fn(() => qb);
    const participants = { findOne: jest.fn(async () => requester), find: jest.fn(async () => profiles) };
    const service: TeamsService = Object.assign(Object.create(TeamsService.prototype), {
      teamRepository: { createQueryBuilder: () => qb }, participantRepository: participants,
      cohortRepository: { findOne: async () => ({ id: "cohort", teamSizeMax: max }) },
    });
    return { service, participants, qb };
  }

  it("shows same-country teams without requiring cross-country consent and filters other groups/countries", async () => {
    const self = person("self"), local = person("local", "GH"), foreign = person("foreign", "Kenya", true), other = person("other", "Ghana", true, "B");
    const { service } = fixture(self, [team("local", [local]), team("foreign", [foreign]), team("other", [other], "B")], [local, foreign, other]);
    expect((await service.findOpenTeams("cohort", undefined, self.id)).map(t => t.id)).toEqual(["local"]);
  });
  it("requires the requester and every confirmed teammate to opt in, including already mixed teams", async () => {
    const self = person("self", "Ghana", true), foreign = person("foreign", "Kenya", true), unwilling = person("unwilling", "Ghana", false);
    const { service } = fixture(self, [team("eligible", [foreign]), team("mixed-unwilling", [foreign, unwilling])], [foreign, unwilling]);
    expect((await service.findOpenTeams("cohort", undefined, self.id)).map(t => t.id)).toEqual(["eligible"]);
    self.preference.crossCountryWilling = false;
    expect(await service.findOpenTeams("cohort", undefined, self.id)).toEqual([]);
  });
  it("ignores pending applicants in capacity/consent and does not expose loaded matching preferences", async () => {
    const self = person("self"), members = Array.from({ length: 4 }, (_, i) => person(`member${i}`)), pending = person("pending", "Kenya");
    const { service, participants } = fixture(self, [team("space", members, "A", [pending]), team("full", [...members, person("fifth")])], [...members, person("fifth")]);
    const result = await service.findOpenTeams("cohort", "space", self.id);
    expect(result.map(t => t.id)).toEqual(["space"]);
    expect(JSON.stringify(result)).not.toContain("crossCountryWilling");
    expect(participants.find).toHaveBeenCalledTimes(1);
  });
  it("honors a smaller cohort capacity and caps larger settings at five", async () => {
    const self = person("self"), members = Array.from({ length: 5 }, (_, i) => person(`member${i}`));
    const teams = [team("three", members.slice(0, 3)), team("four", members.slice(0, 4)), team("five", members)];
    expect((await fixture(self, teams, members, 4).service.findOpenTeams("cohort", undefined, self.id)).map(t => t.id)).toEqual(["three"]);
    expect((await fixture(self, teams, members, 8).service.findOpenTeams("cohort", undefined, self.id)).map(t => t.id)).toEqual(["three", "four"]);
  });
  it("fails closed for missing member profiles and legacy mixed-group rosters", async () => {
    const self = person("self"), other = person("other", "Ghana", false, "B");
    const { service } = fixture(self, [team("missing", [person("missing")]), team("mixed", [other])], [other]);
    expect(await service.findOpenTeams("cohort", undefined, self.id)).toEqual([]);
  });
  it("preserves staff discovery without applying a participant's personal preferences", async () => {
    const { service, participants } = fixture(person("self"), [team("other", [person("other", "Kenya")], "B")], []);
    expect((await service.findOpenTeams("cohort")).map(t => t.id)).toEqual(["other"]);
    expect(participants.findOne).not.toHaveBeenCalled();
  });
  it("derives the discovery identity from the authenticated controller principal", async () => {
    const service = { findOpenTeams: jest.fn() }, controller = new TeamsController(service as any);
    await controller.findOpenTeams("cohort", "search", { id: "self", role: "participant" });
    expect(service.findOpenTeams).toHaveBeenLastCalledWith("cohort", "search", "self");
    await controller.findOpenTeams("cohort", undefined, { id: "staff", role: "program_manager" });
    expect(service.findOpenTeams).toHaveBeenLastCalledWith("cohort", undefined, undefined);
  });
  it("prefers confirmed membership over a leftover pending request", async () => {
    const repo = { findOne: jest.fn(async () => ({ teamId: "confirmed-team" })) }, findOne = jest.fn(async id => ({ id }));
    const service = Object.assign(Object.create(TeamsService.prototype), { memberRepository: repo, findOne });
    expect(await service.findParticipantTeam("self")).toEqual({ id: "confirmed-team" });
    expect(repo.findOne).toHaveBeenCalledTimes(1);
    expect(repo.findOne).toHaveBeenCalledWith({ where: { participantId: "self", status: "confirmed" } });
  });

  it("withdraws a pending request without changing the confirmed team, chat or participant status", async () => {
    const pending = { participantId: "self", status: "pending", role: "member" };
    const memberRepository = { delete: jest.fn(async () => ({ affected: 1 })) }, participantRepository = { update: jest.fn() }, teamRepository = { softRemove: jest.fn() };
    const service = Object.assign(Object.create(TeamsService.prototype), {
      findOne: async () => ({ members: [{ participantId: "lead", role: "lead", status: "confirmed" }, pending] }),
      memberRepository, participantRepository, teamRepository, removeMemberFromTeamChat: jest.fn(), archiveTeamChat: jest.fn(),
    });
    await service.withdrawJoinRequest("team", "self");
    expect(memberRepository.delete).toHaveBeenCalledWith({ teamId: "team", participantId: "self", status: "pending" });
    expect(participantRepository.update).not.toHaveBeenCalled();
    expect(teamRepository.softRemove).not.toHaveBeenCalled();
    expect(service.removeMemberFromTeamChat).not.toHaveBeenCalled();
    expect(service.archiveTeamChat).not.toHaveBeenCalled();
  });

  it("does not withdraw a request that has already been confirmed or removed", async () => {
    const service = Object.assign(Object.create(TeamsService.prototype), { memberRepository: { delete: jest.fn(async () => ({ affected: 0 })) } });
    await expect(service.withdrawJoinRequest("team", "self")).rejects.toThrow("already approved or withdrawn");
  });

  it("does not resurrect a withdrawn request during a concurrent approval", async () => {
    const memberRepository = { update: jest.fn(async () => ({ affected: 0 })), save: jest.fn() };
    const service = Object.assign(Object.create(TeamsService.prototype), {
      findOne: async () => ({ id: "team", cohortId: "cohort", members: [{ id: "lead-member", participantId: "lead", role: "lead", status: "confirmed" }, { id: "pending", participantId: "self", role: "member", status: "pending" }] }),
      cohortRepository: { findOne: async () => ({ teamSizeMax: 5 }) },
      teamRepository: { manager: { findOne: async () => ({ id: "team", cohortId: "cohort", cohort: { id: "cohort", status: "active", teamJoiningStageId: "joining" }, members: [] }), find: async () => [{ id: "joining", deadline: new Date(Date.now() + 86400000), updatedAt: new Date() }] } }, memberRepository,
    });
    // Admission is tested above and through DB regressions; isolate the atomic transition here.
    const rules = jest.requireActual("@/common/services/team-rules");
    const admission = jest.spyOn(rules, "assertMemberAdmission").mockResolvedValue({} as any);
    try {
      await expect(service.confirmPendingMember("team", "pending", "lead")).rejects.toThrow("join request changed");
      expect(memberRepository.update).toHaveBeenCalledWith({ id: "pending", teamId: "team", status: "pending" }, expect.objectContaining({ status: "confirmed" }));
      expect(memberRepository.save).not.toHaveBeenCalled();
    } finally { admission.mockRestore(); }
  });

  it("still requires a confirmed lead to transfer leadership before leaving teammates", async () => {
    const service = Object.assign(Object.create(TeamsService.prototype), { findOne: async () => ({ members: [
      { participantId: "lead", role: "lead", status: "confirmed" }, { participantId: "member", role: "member", status: "confirmed" },
    ] }) });
    await expect(service.removeMember("team", "lead")).rejects.toThrow("Transfer leadership first");
  });

  it("explains group and cross-country failures separately without relaxing direct admission", async () => {
    const self = { ...person("self", "Kenya", true), status: "ready", onboardingComplete: true, learningHalfwayReached: true, preference: { crossCountryWilling: true, matchingProfileCompletedAt: new Date() } };
    const deadline = new Date(Date.now() + 86400000);
    const manager = { find: async () => [{ id: "joining", deadline, updatedAt: new Date() }], findOne: async () => self };
    const cohort = { id: "cohort", status: "active", groups: ["A", "B"], teamJoiningStageId: "joining" };
    await expect(assertParticipantTeamAdmission(manager as any, cohort as any, "self", [person("lead", "Ghana", true, "B")])).rejects.toThrow("same cohort group");
    await expect(assertParticipantTeamAdmission(manager as any, cohort as any, "self", [person("lead", "Ghana", false)])).rejects.toThrow("every member");
    await expect(assertParticipantTeamAdmission(manager as any, cohort as any, "self", [person("lead", "Ghana", true)])).resolves.toBe(self);
  });

  it.each(["join", "confirm", "add", "invite", "accept"])("uses confirmed-only capacity and the five-person hard cap on %s", async action => {
    const rules = jest.requireActual("@/common/services/team-rules");
    const admission = jest.spyOn(rules, "assertMemberAdmission").mockRejectedValue(new Error("admission reached"));
    function fixture(count: number) {
      const team = { id: "team", cohortId: "cohort", group: "A", status: "forming", members: [
        ...Array.from({ length: count }, (_, i) => ({ id: `member${i}`, participantId: i ? `member${i}` : "lead", role: i ? "member" : "lead", status: "confirmed" })),
        { id: "pending", participantId: "candidate", role: "member", status: "pending" },
      ] };
      const service = Object.assign(Object.create(TeamsService.prototype), {
        findOne: async () => team, findByInviteCode: async () => team, cohortRepository: { findOne: async () => ({ teamSizeMax: 8 }) },
        participantRepository: { findOne: async () => null }, memberRepository: { findOne: async () => null }, teamRepository: {},
        invitationRepository: { findOne: async () => ({ team, teamId: "team", participantId: "candidate", canRespond: () => true }) },
      });
      return () => ({ join: () => service.joinByInviteCode("CODE", "candidate"), confirm: () => service.confirmPendingMember("team", "pending", "lead"),
        add: () => service.addMember("team", { participantId: "candidate" }), invite: () => service.sendInvitation("team", { participantId: "candidate", invitedBy: "lead" }),
        accept: () => service.acceptInvitation("invitation") }[action]!());
    }
    try {
      await expect(fixture(4)()).rejects.toThrow(/Participant not found|admission reached/);
      await expect(fixture(5)()).rejects.toThrow("maximum capacity");
    } finally { admission.mockRestore(); }
  });
});
