import { assertChallengeStarted } from "../services/team-rules";
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PATH_METADATA } from "@nestjs/common/constants";
import { DataSource, IsNull } from "typeorm";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { ROLES_KEY } from "../decorators/roles.decorator";

const STAFF = ["super_admin", "program_manager", "evaluator", "viewer"];
const MANAGERS = ["super_admin", "program_manager"];

/** Object authorization runs after JWT authentication, before validation/controllers. */
@Injectable()
export class ResourceAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly db: DataSource) {}

  private deny(): never { throw new ForbiddenException("You do not have access to this resource"); }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user?.id) return this.deny();
    const base = String(this.reflector.get(PATH_METADATA, context.getClass()) || "");
    const route = String(this.reflector.get(PATH_METADATA, context.getHandler()) || "");
    const read = ["GET", "HEAD"].includes(req.method);
    const staff = STAFF.includes(user.role);
    const params = req.params || {};
    const body = req.body || {};
    const query = req.query || {};
    // Read-only staff may update their own account, notification preferences and read receipts.
    // Deny all business mutations by default, including routes with missing role metadata.
    if (user.role === "viewer" && !read && !["auth", "notifications"].includes(base)
      && !(base === "chat/channels" && route === ":id/read")) return this.deny();
    Object.defineProperty(req, "query", { value: query, writable: true, configurable: true });
    if (!read) for (const key of ["actorId", "approvedBy", "reviewedBy", "resolvedBy", "disqualifiedBy", "confirmedBy", "declinedBy", "requestedBy", "invitedBy", "cancelledBy"]) {
      if (key in body) body[key] = user.id;
      if (key in query) query[key] = user.id;
    }
    const repo = (name: string) => this.db.getRepository(name);
    const find = (name: string, where: any) => repo(name).findOne({ where });
    const ownCohort = (id?: string) => { if (!id || id !== user.cohortId) this.deny(); };
    const teamId = async () => {
      if (user.role !== "participant") return this.deny();
      const member = await find("TeamMember", { participantId: user.id, status: "confirmed" });
      if (!member) return this.deny();
      return member;
    };
    const allowedVerticals = async (): Promise<string[]> => {
      if (user.role === "mentor") return (await find("Mentor", { id: user.mentorId }))?.verticalScope || [];
      const preference = await find("ParticipantPreference", { participantId: user.id });
      const member = await find("TeamMember", { participantId: user.id, status: "confirmed" });
      const team = member ? await find("Team", { id: member.teamId }) : null;
      const brief = team?.briefId ? await find("Brief", { id: team.briefId }) : null;
      return [preference?.verticalId1, preference?.verticalId2, brief?.verticalId].filter(Boolean);
    };
    const staffOnly = () => {
      if (!staff || (!read && !MANAGERS.includes(user.role))) this.deny();
    };
    const organization = async () => {
      if (user.role !== "organization") return this.deny();
      const link = await find("OrganizationUser", { userId: user.id });
      const org = link ? await find("Organization", { id: link.organizationId }) : await find("Organization", { email: user.email });
      if (!org || !org.isActive || org.status !== "approved") return this.deny();
      if (!read && link && !["owner", "admin"].includes(link.role)) return this.deny();
      return org;
    };

    // Existing role metadata is enforced by the global RolesGuard. Guard admin
    // namespaces even when a controller accidentally omits that metadata.
    if (base.startsWith("admin/")) {
      if (!staff) return this.deny();
      const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
      if (!read && !roles?.length && !MANAGERS.includes(user.role)) return this.deny();
      for (const key of ["actorId", "approvedBy", "reviewedBy", "resolvedBy"]) {
        if (key in body) body[key] = user.id;
        if (key in query) query[key] = user.id;
      }
      return true;
    }

    if (base === "users") {
      if (!staff && params.id !== user.id) return this.deny();
    } else if (base === "participants") {
      if (staff) staffOnly();
      else {
        if (user.role !== "participant" || (params.id && params.id !== user.id) || (!params.id && !route.startsWith("me"))) return this.deny();
        if (["status", "bulk-import"].some(x => route.includes(x)) || req.method === "DELETE") return this.deny();
      }
    } else if (base === "organizations") {
      if (staff) staffOnly();
      else {
        const org = await organization();
        if (!route.startsWith("me") && (params.id !== org.id || (!read && ![":id", ":id/logo", ":id/logo/upload"].includes(route)))) return this.deny();
        if (body.cohortId && body.cohortId !== org.cohortId) return this.deny();
      }
    } else if (base === "briefs") {
      if (staff) {
        if (!read && ![...MANAGERS, "evaluator"].includes(user.role)) return this.deny();
        if (!read && !MANAGERS.includes(user.role) && ![":id/review", ":id/start-review"].includes(route)) return this.deny();
        for (const key of ["actorId", "reviewerId"]) if (key in query) query[key] = user.id;
        if ("reviewedBy" in body) body.reviewedBy = user.id;
      } else if (user.role === "organization") {
        const org = await organization();
        if (params.id) {
          const brief = await find("Brief", { id: params.id, organizationId: org.id });
          if (!brief) return this.deny();
        } else if (read) {
          query.organizationId = org.id;
          query.cohortId = org.cohortId;
        } else if (!route) {
          body.organizationId = org.id;
          body.cohortId = org.cohortId;
        }
        if (["staff", "review", "revisions"].some(x => route.includes(x))) return this.deny();
      } else {
        if (!read || !["participant", "mentor"].includes(user.role)) return this.deny();
        if (params.id) {
          if (!await find("Brief", { id: params.id, cohortId: user.cohortId, status: "approved" })) return this.deny();
        } else if (params.cohortId) ownCohort(params.cohortId);
        else { query.cohortId = user.cohortId; query.status = "approved"; }
      }
    } else if (base === "teams") {
      if (staff) staffOnly();
      else if (user.role === "participant") {
        if (!route && req.method === "POST") { body.creatorId = user.id; ownCohort(body.cohortId); }
        else if (route === "join") { body.participantId = user.id; }
        else if (route === "my/:participantId") { if (params.participantId !== user.id) return this.deny(); }
        else if (route.startsWith("invite/")) {
          if (!await find("Team", { inviteCode: params.inviteCode, cohortId: user.cohortId })) return this.deny();
        } else if (route.startsWith("open/")) ownCohort(params.cohortId);
        else if (route === "search/participants") { query.cohortId = user.cohortId; }
        else {
          const member = await teamId();
          if (!params.id || member.teamId !== params.id || route.startsWith("admin/")) return this.deny();
          if (!read) {
            const selfLeave = req.method === "DELETE" && route === ":id/members/:participantId" && params.participantId === user.id;
            if (!selfLeave && !["lead", "co_lead"].includes(member.role)) return this.deny();
            if ([":id/status", ":id/assign-brief", ":id/unassign-brief", ":id/disqualify", ":id/members", ":id/members/:participantId/role"].includes(route)) return this.deny();
            if (req.method === "DELETE" && params.participantId && params.participantId !== user.id) return this.deny();
            for (const key of ["confirmedBy", "declinedBy", "requestedBy", "invitedBy", "cancelledBy"]) if (key in body) body[key] = user.id;
          }
        }
      } else {
        if (!read) return this.deny();
        if (user.role === "organization") {
          const org = await organization();
          if (!params.id) query.organizationId = org.id;
          else {
            const team = await find("Team", { id: params.id });
            if (!team?.briefId || !await find("Brief", { id: team.briefId, organizationId: org.id })) return this.deny();
          }
        } else if (user.role === "mentor" && params.id) {
          const assignment = await find("MentorAssignment", { mentorId: user.mentorId, teamId: params.id, isActive: true });
          const claim = await find("MentorClaim", { mentorId: user.mentorId, teamId: params.id, status: "active" });
          if (!assignment && !claim) return this.deny();
        } else return this.deny();
      }
    } else if (base === "invitations") {
      if (user.role !== "participant") return this.deny();
      if (params.participantId) { if (params.participantId !== user.id) return this.deny(); }
      else {
        const invitation = await find("TeamInvitation", { id: params.id });
        if (!invitation) return this.deny();
        if (route.endsWith("cancel")) {
          const member = await teamId();
          if (member.teamId !== invitation.teamId || !["lead", "co_lead"].includes(member.role)) return this.deny();
          body.cancelledBy = user.id;
        } else if (invitation.participantId !== user.id) return this.deny();
      }
    } else if (["mentor-payments", "sessions"].includes(base)) staffOnly();
    else if (base === "mentors") {
      if (staff) staffOnly();
      else {
        if (!read || !["participant", "mentor"].includes(user.role)) return this.deny();
        if (params.id) { const mentor = await find("Mentor", { id: params.id }); ownCohort(mentor?.cohortId); }
        else query.cohortId = user.cohortId;
      }
    } else if (base === "chat/channels") {
      if (!params.id) { if (!read && !MANAGERS.includes(user.role)) return this.deny(); }
      else {
        const type = staff ? "staff" : user.role;
        const id = user.role === "mentor" ? user.mentorId : user.role === "organization" ? user.organizationId : user.id;
        if (!id) return this.deny();
        const member = await find("ChannelMember", { channelId: params.id, memberId: id, memberType: type, leftAt: IsNull() });
        if (!staff && !member) return this.deny();
        const management = route === ":id" || route === ":id/archive" || route === ":id/members";
        if (!read && management && !MANAGERS.includes(user.role) && !member?.isAdmin) return this.deny();
        if (params.messageId && !await find("ChatMessage", { id: params.messageId, channelId: params.id })) return this.deny();
      }
    } else if (["submissions", "journals", "peer-reviews", "certificates/my", "evaluations"].includes(base)) {
      if (user.role !== "participant") return this.deny();
      if (["submissions", "journals"].includes(base) && params.id) {
        const member = await teamId();
        if (!await find(base === "submissions" ? "Submission" : "JournalEntry", { id: params.id, teamId: member.teamId })) return this.deny();
      }
      if (!read && ["submissions", "journals", "peer-reviews"].includes(base)) {
        const member = await teamId();
        await assertChallengeStarted(this.db.manager, member.teamId);
      }
      if (params.cohortId) ownCohort(params.cohortId);
    } else if (base === "stages") {
      if (!staff) {
        if (params.id) { const stage = await find("Stage", { id: params.id }); ownCohort(stage?.cohortId); }
        else query.cohortId = user.cohortId;
      }
    } else if (base.startsWith("mentor-claims")) {
      const member = await teamId();
      if (!read && !["lead", "co_lead"].includes(member.role)) return this.deny();
      if (params.claimId && !await find("MentorClaim", { id: params.claimId, teamId: member.teamId })) return this.deny();
      if (params.sessionId && !await find("ScheduledSession", { id: params.sessionId, claimId: params.claimId, teamId: member.teamId })) return this.deny();
      if (read && route === "browse") query.cohortId = user.cohortId;
    } else if (base.startsWith("mentor-portal") || base === "mentor/availability") {
      if (user.role !== "mentor" || !user.mentorId) return this.deny();
      if (params.sessionId && !await find("ScheduledSession", { id: params.sessionId, mentorId: user.mentorId })) return this.deny();
      if (params.slotId && !await find("MentorAvailability", { id: params.slotId, mentorId: user.mentorId })) return this.deny();
      if (params.exceptionId && !await find("MentorAvailabilityException", { id: params.exceptionId, mentorId: user.mentorId })) return this.deny();
    } else if (base === "mentors/:mentorId/availability") {
      if (!staff) { const mentor = await find("Mentor", { id: params.mentorId }); ownCohort(mentor?.cohortId); }
    } else if (base === "forum") {
      if (!staff && !["participant", "mentor"].includes(user.role)) return this.deny();
      if (!staff) {
        let categoryId = params.categoryId || body.categoryId;
        const threadId = params.threadId || (route.startsWith("threads/") ? params.id : undefined);
        if (threadId) categoryId = (await find("ForumThread", { id: threadId }))?.categoryId;
        if (route.startsWith("replies/") && params.id) {
          const reply = await find("ForumReply", { id: params.id });
          categoryId = reply ? (await find("ForumThread", { id: reply.threadId }))?.categoryId : undefined;
        }
        if (route === "categories") { query.cohortId = user.cohortId; if (query.verticalId && !(await allowedVerticals()).includes(query.verticalId)) return this.deny(); }
        else {
          if (route === "categories/:id") categoryId = params.id;
          const category = categoryId ? await find("ForumCategory", { id: categoryId }) : null;
          if (!category || category.staffOnly || !category.isActive) return this.deny();
          ownCohort(category.cohortId);
          if (category.verticalId && !(await allowedVerticals()).includes(category.verticalId)) return this.deny();
        }
      }
    }
    return true;
  }
}
