import 'reflect-metadata';
import { Controller, Get, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ResourceAccessGuard } from './guards/resource-access.guard';
import { sanitizeRichText, redactSensitive } from './services/safe-content';
import { scoreAgainstRubric } from './services/rubric-scoring';
import { ParticipantQueryDto } from '@/modules/participants/dto/participant.dto';
import { JwtStrategy } from '@/auth/strategies/jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { MentorAvailabilityService } from '@/modules/mentors/mentor-availability.service';

describe('Security regression boundaries', () => {
  function policy(base: string, route: string, user: any, records: Record<string, any> = {}, method = 'GET', params: any = {}) {
    @Controller(base) class Endpoint { @Get(route) handler() {} }
    const request = { user, method, params, body: {}, query: {} };
    const database = { getRepository: jest.fn(name => ({ findOne: jest.fn(async () => records[name] || null) })) };
    const context = { getClass: () => Endpoint, getHandler: () => Endpoint.prototype.handler, switchToHttp: () => ({ getRequest: () => request }) };
    return { run: () => new ResourceAccessGuard(new Reflector(), database as any).canActivate(context as any), request, database };
  }

  it.each(['participant', 'mentor', 'organization', 'viewer'])('denies %s organization administration', async role => {
    await expect(policy('organizations', ':id/approve', { id: 'u', role }, {}, 'POST', { id: 'other' }).run()).rejects.toThrow(ForbiddenException);
  });
  it('rejects a missing identity before any database access', async () => {
    const check = policy('journals', '', { role: 'participant' });
    await expect(check.run()).rejects.toThrow(ForbiddenException);
    expect(check.database.getRepository).not.toHaveBeenCalled();
  });
  it('derives mutation actors from the authenticated principal', async () => {
    const check = policy('teams', ':id/disqualify', { id: 'staff', role: 'program_manager' }, {}, 'POST', { id: 'team' });
    check.request.body = { disqualifiedBy: 'forged' };
    await check.run();
    expect(check.request.body).toEqual({ disqualifiedBy: 'staff' });
  });
  it('denies foreign submissions and pending team membership', async () => {
    await expect(policy('submissions', ':id', { id: 'p', role: 'participant' }, {}, 'GET', { id: 'foreign' }).run()).rejects.toThrow(ForbiddenException);
    await expect(policy('submissions', ':id', { id: 'p', role: 'participant' }, { TeamMember: { teamId: 'own' } }, 'GET', { id: 'foreign' }).run()).rejects.toThrow(ForbiddenException);
  });
  it('allows confirmed ordinary members to leave their own team', async () => {
    await expect(policy('teams', ':id/members/:participantId', { id: 'p', role: 'participant' }, { TeamMember: { teamId: 'own', role: 'member' } }, 'DELETE', { id: 'own', participantId: 'p' }).run()).resolves.toBe(true);
    await expect(policy('teams', ':id/members/:participantId', { id: 'p', role: 'participant' }, { TeamMember: { teamId: 'own', role: 'member' } }, 'DELETE', { id: 'own', participantId: 'other' }).run()).rejects.toThrow(ForbiddenException);
  });
  it('denies foreign mentor sessions and mismatched parent/session IDs', async () => {
    await expect(policy('mentor-portal', 'sessions/:sessionId/complete', { id: 'u', role: 'mentor', mentorId: 'm' }, {}, 'POST', { sessionId: 'foreign' }).run()).rejects.toThrow(ForbiddenException);
    await expect(policy('mentor-claims', ':claimId/sessions/:sessionId', { id: 'p', role: 'participant' }, { TeamMember: { teamId: 't', role: 'lead' }, MentorClaim: { id: 'claim' } }, 'PATCH', { claimId: 'claim', sessionId: 'foreign' }).run()).rejects.toThrow(ForbiddenException);
  });
  it.each(['GET', 'PATCH', 'DELETE', 'POST'])('denies unrelated channel %s operations', async method => {
    await expect(policy('chat/channels', ':id', { id: 'p', role: 'participant' }, {}, method, { id: 'private' }).run()).rejects.toThrow(ForbiddenException);
  });
  it('denies organization forum access and hidden categories', async () => {
    await expect(policy('forum', 'categories', { id: 'u', role: 'organization' }).run()).rejects.toThrow(ForbiddenException);
    await expect(policy('forum', 'categories/:id', { id: 'p', role: 'participant', cohortId: 'c' }, { ForumCategory: { cohortId: 'c', isActive: true, staffOnly: true } }, 'GET', { id: 'staff' }).run()).rejects.toThrow(ForbiddenException);
  });
  it('removes nested credentials and executable HTML while preserving formatting', () => {
    const html = sanitizeRichText('<p onclick="alert(1)"><strong>Hello</strong><img src=x onerror="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">link</a></p>');
    expect(html).toContain('<strong>Hello</strong>');
    expect(html).not.toMatch(/onclick|onerror|script|javascript|<img/);
    expect(redactSensitive({ members: [{ participant: { passwordHash: 'secret', passwordResetToken: 'reset', name: 'Alice' } }], metadata: { refreshToken: 'refresh' } })).toEqual({ members: [{ participant: { name: 'Alice' } }], metadata: {} });
  });
  it('enforces a server-owned weighted rubric with exact criterion coverage', () => {
    const criteria = [{ id: 'a', name: 'A', maxScore: 10, weight: 80 }, { id: 'b', name: 'B', maxScore: 20, weight: 20 }];
    expect(scoreAgainstRubric(criteria, [{ criterionId: 'a', score: 5 }, { criterionId: 'b', score: 20 }])).toBe(60);
    for (const scores of [[{ criterionId: 'a', score: 1000 }, { criterionId: 'b', score: 20 }], [{ criterionId: 'a', score: 5, maxScore: 1 }, { criterionId: 'b', score: 20 }], [{ criterionId: 'a', score: 5 }, { criterionId: 'a', score: 5 }], [{ criterionId: 'a', score: NaN }, { criterionId: 'b', score: 20 }], []]) expect(() => scoreAgainstRubric(criteria, scores)).toThrow();
  });
  it('parses false literally and rejects invalid pagination', async () => {
    const query = plainToInstance(ParticipantQueryDto, { page: '0', limit: '1000000', onboardingComplete: 'false' }, { enableImplicitConversion: true });
    expect(query.onboardingComplete).toBe(false);
    expect((await validate(query)).some(error => error.property === 'page')).toBe(true);
    expect((await validate(query)).some(error => error.property === 'limit')).toBe(true);
  });
  it('rejects revoked sessions and enriches participant IDs independently of external codes', async () => {
    const session = { id: 's', participantId: 'uuid' };
    const db = { getRepository: (name: string) => ({ findOne: jest.fn(async () => ({ RefreshToken: session, Participant: { id: 'uuid', participantId: 'ATF-001', email: 'p@example.test', cohortId: 'c', status: 'active', cohort: { status: 'active' } }, TeamMember: null }[name])) }) };
    const strategy = new JwtStrategy(new ConfigService({ jwt: { secret: 'test-secret' } }), db as any);
    const principal = await strategy.validate({ sub: 'uuid', sid: 's', role: 'participant', iat: 1, exp: 9999999999 });
    expect(principal.participantId).toBe('uuid');
    expect(principal.participantCode).toBe('ATF-001');
    expect(principal.teamId).toBeUndefined();
    await expect(strategy.validate({ sub: 'other', sid: 's', role: 'participant', iat: 1, exp: 9999999999 })).rejects.toThrow('Session has ended');
    await expect(strategy.validate({ sub: 'uuid', role: 'participant', iat: 1, exp: 9999999999 })).rejects.toThrow('Please sign in again');
  });
  it('converts availability to the requested timezone and blocks pending bookings with buffer', async () => {
    const repo = (data: any) => ({ find: jest.fn().mockResolvedValue(data), findOne: jest.fn().mockResolvedValue(data) });
    const service = new MentorAvailabilityService(repo([{ dayOfWeek: 1, startTime: '09:00:00', endTime: '11:00:00', durationMinutes: 45, bufferMinutes: 15, timezone: 'Africa/Nairobi' }]) as any, repo([]) as any, repo({ id: 'm' }) as any, repo([{ id: 's', scheduledAt: new Date('2030-01-07T06:00:00Z'), durationMinutes: 45, status: 'scheduled' }]) as any);
    const result = await service.getAvailableSlots('m', { startDate: '2030-01-07', endDate: '2030-01-07', timezone: 'Africa/Accra' });
    expect(result.slots.map(slot => slot.startTime)).toEqual(['06:00', '07:00']);
    expect(result.slots.map(slot => slot.isAvailable)).toEqual([false, true]);
  });
});
