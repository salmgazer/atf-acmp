import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { ResourceAccessGuard } from './guards/resource-access.guard';
import { EvaluationsController } from '@/modules/evaluations/evaluations.controller';
import { AdminSubmissionsController, AdminStagesController } from '@/modules/submissions/submissions.controller';
import { StaffController } from '@/modules/users/users.controller';
import { CohortsController } from '@/modules/cohorts/cohorts.controller';
import { ParticipantsController } from '@/modules/participants/participants.controller';
import { TeamsController } from '@/modules/teams/teams.controller';
import { ForumController } from '@/modules/forum/forum.controller';
import { ForumService } from '@/modules/forum/forum.service';
import { Role } from '@/database/entities/user.entity';
import { hasStaffPermission } from '@acmp/shared';

const staff = [Role.SUPER_ADMIN, Role.PROGRAM_MANAGER, Role.EVALUATOR, Role.VIEWER];

describe('Staff role boundaries', () => {
  const reflector = new Reflector();
  async function authorize(controller: any, handler: string, role: Role, method = 'GET', params = {}, body = {}) {
    const request = { user: { id: 'staff-id', role }, method, params, body, query: {} };
    const context = { getClass: () => controller, getHandler: () => controller.prototype[handler], switchToHttp: () => ({ getRequest: () => request }) } as any;
    if (!context.getHandler()) throw new Error(`Unknown test handler ${handler}`);
    const database = { getRepository: jest.fn(() => { throw new Error('Staff cohort access should not require an assignment lookup'); }) };
    new RolesGuard(reflector).canActivate(context);
    await new ResourceAccessGuard(reflector, database as any).canActivate(context);
    return request;
  }

  it.each(staff)('%s can read any cohort without an assignment', async role => {
    for (const id of ['cohort-one', 'cohort-two']) {
      await expect(authorize(CohortsController, 'findOne', role, 'GET', { id })).resolves.toBeDefined();
    }
    await expect(authorize(CohortsController, 'findAll', role)).resolves.toBeDefined();
  });

  it.each(staff)('%s can read evaluations, submissions and stage reports', async role => {
    await expect(authorize(EvaluationsController, 'getEvaluations', role)).resolves.toBeDefined();
    await expect(authorize(EvaluationsController, 'getEvaluation', role, 'GET', { id: 'evaluation' })).resolves.toBeDefined();
    await expect(authorize(AdminSubmissionsController, 'getSubmissions', role)).resolves.toBeDefined();
    await expect(authorize(AdminStagesController, 'getStagesWithStats', role)).resolves.toBeDefined();
  });

  it.each([Role.SUPER_ADMIN, Role.PROGRAM_MANAGER, Role.EVALUATOR])('%s can review submissions and score evaluations', async role => {
    for (const method of ['approveSubmission', 'rejectSubmission', 'evaluateSubmission']) {
      await expect(authorize(AdminSubmissionsController, method, role, 'POST', { id: 'submission' })).resolves.toBeDefined();
    }
    await expect(authorize(EvaluationsController, 'submitHumanScore', role, 'POST', { id: 'evaluation' })).resolves.toBeDefined();
  });

  it.each([Role.EVALUATOR, Role.VIEWER])('%s cannot run queues, publish, change weights or manage the program', async role => {
    for (const method of ['triggerBatchEvaluation', 'pauseQueue', 'resumeQueue', 'clearQueue', 'retryJob', 'cancelJob', 'publishEvaluations', 'unpublishEvaluations', 'updateAIWeight']) {
      await expect(authorize(EvaluationsController, method, role, 'POST')).rejects.toThrow(ForbiddenException);
    }
    await expect(authorize(ParticipantsController, 'bulkImport', role, 'POST')).rejects.toThrow(ForbiddenException);
    await expect(authorize(TeamsController, 'create', role, 'POST')).rejects.toThrow(ForbiddenException);
    await expect(authorize(CohortsController, 'update', role, 'PATCH', { id: 'cohort' })).rejects.toThrow(ForbiddenException);
  });

  it('viewer cannot score or modify forum content even if role metadata is absent', async () => {
    await expect(authorize(EvaluationsController, 'submitHumanScore', Role.VIEWER, 'POST')).rejects.toThrow(ForbiddenException);
    for (const [handler, method] of [['createThread', 'POST'], ['updateThread', 'PATCH'], ['deleteThread', 'DELETE'], ['createReply', 'POST'], ['updateReply', 'PATCH'], ['deleteReply', 'DELETE']]) {
      await expect(authorize(ForumController, handler, Role.VIEWER, method, { id: 'thread' })).rejects.toThrow(ForbiddenException);
    }
  });

  it.each([Role.PROGRAM_MANAGER, Role.EVALUATOR, Role.VIEWER])('%s cannot administer staff or delete cohorts', async role => {
    for (const handler of ['create', 'update', 'activate', 'deactivate', 'resendInvite', 'delete']) {
      await expect(authorize(StaffController, handler, role, 'POST')).rejects.toThrow(ForbiddenException);
    }
    await expect(authorize(CohortsController, 'remove', role, 'DELETE')).rejects.toThrow(ForbiddenException);
  });

  it('super admin retains staff administration and managers retain program changes', async () => {
    await expect(authorize(StaffController, 'create', Role.SUPER_ADMIN, 'POST')).resolves.toBeDefined();
    await expect(authorize(ParticipantsController, 'bulkImport', Role.PROGRAM_MANAGER, 'POST')).resolves.toBeDefined();
  });

  it.each([Role.EVALUATOR, Role.VIEWER])('%s cannot moderate somebody else’s forum content through the ordinary API', async role => {
    const threads = { save: jest.fn(async value => value) };
    const replies = { save: jest.fn(async value => value) };
    const service = new ForumService({} as any, threads as any, replies as any, {} as any);
    jest.spyOn(service, 'findThreadById').mockResolvedValue({ id: 'thread', authorId: 'another-user' } as any);
    jest.spyOn(service, 'findReplyById').mockResolvedValue({ id: 'reply', authorId: 'another-user' } as any);
    const controller = new ForumController(service);
    const req = { user: { id: 'staff-id', role, email: 'staff@example.test' } };
    await expect(controller.updateThread('thread', { content: 'Forged edit' }, req)).rejects.toThrow(ForbiddenException);
    await expect(controller.deleteThread('thread', req)).rejects.toThrow(ForbiddenException);
    await expect(controller.updateReply('reply', { content: 'Forged edit' }, req)).rejects.toThrow(ForbiddenException);
    await expect(controller.deleteReply('reply', req)).rejects.toThrow(ForbiddenException);
    expect(threads.save).not.toHaveBeenCalled();
    expect(replies.save).not.toHaveBeenCalled();
  });

  it('an evaluator can edit their own post and a manager can moderate another author', async () => {
    const threads = { save: jest.fn(async value => value) };
    const service = new ForumService({} as any, threads as any, {} as any, {} as any);
    jest.spyOn(service, 'findThreadById').mockResolvedValue({ id: 'thread', authorId: 'evaluator' } as any);
    const controller = new ForumController(service);
    await expect(controller.updateThread('thread', { content: 'Own edit' }, { user: { id: 'evaluator', role: Role.EVALUATOR } })).resolves.toMatchObject({ content: 'Own edit' });
    await expect(controller.deleteThread('thread', { user: { id: 'manager', role: Role.PROGRAM_MANAGER } })).resolves.toEqual({ success: true });
  });

  it('the shared UI policy does not grant permissions to unknown or non-staff roles', () => {
    for (const role of [undefined, 'organization', 'mentor', 'participant', 'admin', '__proto__']) {
      for (const permission of ['read', 'manage', 'review', 'admin', 'communicate'] as const) expect(hasStaffPermission(role, permission)).toBe(false);
    }
  });
});
