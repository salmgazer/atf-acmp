import { Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Role } from '@/database/entities/user.entity';
import { MatchingController } from './matching.controller';
import { SaveFormationDefaultsDto, RunTeamFormationDto } from './dto/team-formation.dto';
import { UpdateTeamDto } from '@/modules/teams/dto/team.dto';
describe('Formation policy access and request validation', () => {
  const guard = new RolesGuard(new Reflector());
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  it.each([Role.PARTICIPANT, Role.MENTOR, Role.VIEWER, Role.EVALUATOR, Role.ORGANIZATION])('denies %s access to formation defaults and finalization', role => {
    for (const method of ['saveFormationDefaults','finalizeTeamFormation'] as const) expect(() => guard.canActivate({ getHandler: () => MatchingController.prototype[method], getClass: () => MatchingController, switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }) } as any)).toThrow('Access denied');
  });
  it.each([Role.SUPER_ADMIN, Role.PROGRAM_MANAGER])('allows %s to choose formation policy', role => {
    expect(guard.canActivate({ getHandler: () => MatchingController.prototype.saveFormationDefaults, getClass: () => MatchingController, switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }) } as any)).toBe(true);
  });
  it('rejects invalid nested policy values, missing defaults and attempts to change a team policy through ordinary team editing', async () => {
    for (const config of [{ minimumBuilders: -1 }, { minimumBuilders: 3 }, { minimumBuilders: '0' }, { builderEligibility: 'everyone' }, { shortageAction: 'bypass_everything' }]) await expect(pipe.transform({ config }, { type: 'body', metatype: RunTeamFormationDto })).rejects.toThrow();
    await expect(pipe.transform({ expectedUpdatedAt: new Date().toISOString() }, { type: 'body', metatype: SaveFormationDefaultsDto })).rejects.toThrow();
    await expect(pipe.transform({ builderPolicy: { minimumBuilders: 0, exceptionGranted: true } }, { type: 'body', metatype: UpdateTeamDto })).rejects.toThrow();
  });
});
