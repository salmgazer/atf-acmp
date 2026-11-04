import { ConfigService } from '@nestjs/config';
import { of, lastValueFrom } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { CertificatesService } from '@/modules/certificates/certificates.service';
import { UploadService } from './services/upload.service';
import { SubmissionsService } from '@/modules/submissions/submissions.service';
import { PublicService } from '@/modules/public/public.service';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import { GeminiService } from '@/modules/evaluations/gemini.service';

describe('Workflow regression boundaries', () => {
  it('includes documents, text, source evidence, and stage instructions in the AI prompt', () => {
    const service = new GeminiService(new ConfigService()) as any;
    const prompt = service.buildSubmissionEvaluationPrompt({ teamName: 'Test', stageNumber: 1, stageName: 'Proposal', documents: [{ name: 'proposal.pdf', content: 'Extracted proposal evidence' }], additionalContent: { textContent: 'Submitted analysis' }, evaluationPrompt: 'Consider the target population', videoUrl: 'https://video.example.test/demo' }, { criteria: [{ id: 'impact', name: 'Impact', maxScore: 10, weight: 100 }] }, { repoUrl: 'https://github.com/example/repo', languages: ['TypeScript'], commits: [], sampleCode: ['export const evidence = 42;'], fileCount: 1, totalLines: 0 });
    for (const evidence of ['Extracted proposal evidence', 'Submitted analysis', 'Consider the target population', 'export const evidence = 42;', 'Never claim to have watched']) expect(prompt).toContain(evidence);
  });
  it('validates document ownership and uses stored sizes rather than client claims', async () => {
    const service = new UploadService(new ConfigService({ aws: { region: 'eu-central-1', s3Bucket: 'acmp-regression', accessKeyId: 'local', secretAccessKey: 'local' } }), {} as any);
    const send = jest.spyOn((service as any).s3Client, 'send').mockResolvedValue({ ContentLength: 2 * 1024 * 1024, ContentType: 'application/pdf' });
    const file = { url: 'https://acmp-regression.s3.eu-central-1.amazonaws.com/submissions/own/documents/work.pdf', name: 'work.pdf', size: 1, type: 'application/pdf' };
    await expect(service.validateSubmissionDocuments([file], 'foreign')).rejects.toThrow('uploaded by this team');
    expect(send).not.toHaveBeenCalled();
    await expect(service.validateSubmissionDocuments([file], 'own', 1)).rejects.toThrow('size limit');
    expect((await service.validateSubmissionDocuments([file], 'own', 3))[0].size).toBe(2 * 1024 * 1024);
  });
  it('enforces video ownership, stored size, and measured duration', async () => {
    const service = new UploadService(new ConfigService({ aws: { region: 'eu-central-1', s3Bucket: 'acmp-regression', accessKeyId: 'local', secretAccessKey: 'local' } }), {} as any);
    jest.spyOn((service as any).s3Client, 'send').mockResolvedValue({ ContentLength: 1024, ContentType: 'video/mp4', Metadata: { 'duration-seconds': '120' } });
    const url = 'https://acmp-regression.s3.eu-central-1.amazonaws.com/submissions/own/videos/work.mp4';
    await expect(service.validateSubmissionVideo(url, 'foreign', 10, 180)).rejects.toThrow('uploaded by this team');
    await expect(service.validateSubmissionVideo(url, 'own', 10, 60)).rejects.toThrow('duration limit');
    await expect(service.validateSubmissionVideo('https://video.example.test/demo', 'own', 10, 60)).rejects.toThrow('can be verified');
    await expect(service.validateSubmissionVideo(url, 'own', 10, 180)).resolves.toBeUndefined();
  });
  it('renders an actual PDF certificate', async () => {
    const service = new CertificatesService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, new ConfigService({ FRONTEND_URL: 'https://challenge.example.test' }));
    const pdf = await service.renderPdf({ tier: 'participation', participantName: 'Test Participant', cohortName: 'Test Cohort', certificateId: 'TEST-001', verificationUrl: 'https://challenge.example.test/verify/TEST-001' } as any);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1000);
  });
  it('signs private objects in the configured region and never signs a foreign origin', async () => {
    const uploads = new UploadService(new ConfigService({ aws: { region: 'eu-central-1', s3Bucket: 'acmp-regression', accessKeyId: 'local-test', secretAccessKey: 'local-secret' } }), {} as any);
    const base = 'https://acmp-regression.s3.eu-central-1.amazonaws.com';
    const signed = await uploads.signResponseUrls({ url: base + '/submissions/a.pdf', foreign: 'https://unrelated.example.test/a.pdf' });
    const url = new URL(signed.url);
    expect(url.searchParams.get('X-Amz-Credential')).toContain('/eu-central-1/s3/aws4_request');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(signed.foreign).toBe('https://unrelated.example.test/a.pdf');
    expect(await uploads.signResponseUrls(base + '.evil.example.test/a.pdf')).toBe(base + '.evil.example.test/a.pdf');
  });
  it('rejects inactive, cross-cohort, future, and disqualified submissions', () => {
    const service = Object.create(SubmissionsService.prototype) as any;
    const stage = { cohortId: 'c', isActive: true, isOpen: () => true };
    expect(() => service.assertSubmissionAllowed({ cohortId: 'c', status: 'active' }, stage, false)).not.toThrow();
    for (const [team, invalid] of [[{ cohortId: 'other' }, stage], [{ cohortId: 'c', status: 'disqualified' }, stage], [{ cohortId: 'c' }, { ...stage, isActive: false }], [{ cohortId: 'c' }, { ...stage, startDate: new Date('2999-01-01') }]]) expect(() => service.assertSubmissionAllowed(team, invalid, false)).toThrow();
  });
  it('enforces required text, URLs, document sizes, and document types', () => {
    const service = Object.create(SubmissionsService.prototype) as any;
    const data = { content: { textContent: 'Enough text', customUrl: 'https://example.test' }, fileUrls: [{ name: 'work.pdf', size: 1024 }] };
    const requirements = { textRequired: true, textMinLength: 5, textMaxLength: 100, urlRequired: true, documentRequired: true, documentMaxSize: 1, documentTypes: ['pdf'] };
    expect(() => service.validateRequirements(requirements, data)).not.toThrow();
    for (const invalid of [{ ...data, content: { textContent: '', customUrl: 'javascript:alert(1)' } }, { ...data, fileUrls: [{ name: 'payload.exe', size: 1024 }] }, { ...data, fileUrls: [{ name: 'work.pdf', size: 2 * 1024 * 1024 }] }]) expect(() => service.validateRequirements(requirements, invalid)).toThrow();
  });
  it('rejects an existing email in the public form without overwriting it', async () => {
    const runner = { connect: jest.fn(), startTransaction: jest.fn(), rollbackTransaction: jest.fn(), release: jest.fn(), manager: { findOne: jest.fn().mockResolvedValue({ id: 'existing' }), save: jest.fn(), create: jest.fn() } };
    const service = new PublicService({} as any, { findOne: jest.fn().mockResolvedValue(null) } as any, { findOne: jest.fn().mockResolvedValue({ id: 'c' }) } as any, {} as any, { createQueryRunner: () => runner } as any, {} as any, {} as any, new ConfigService());
    await expect(service.submitOrganizationBriefs({ sessionId: 'session', consentGiven: true, org: { email: 'existing@example.test' }, briefs: [] } as any)).rejects.toThrow('Sign in to the partner portal');
    expect(runner.manager.save).not.toHaveBeenCalled();
    expect(runner.rollbackTransaction).toHaveBeenCalled();
  });
  it('captures safe before/after state and the authenticated audit actor', async () => {
    const log = jest.fn().mockResolvedValue({});
    const metadata = { action: 'update', entityType: 'Team' };
    const reflector = { get: () => metadata } as unknown as Reflector;
    const db = { entityMetadatas: [{ name: 'Team', target: 'Team' }], getRepository: () => ({ findOne: async () => ({ name: 'Before', members: [{ passwordHash: 'secret' }] }) }) };
    const request = { user: { id: 'authenticated', role: 'program_manager', email: 'staff@example.test' }, params: { id: 'team' }, body: { actorId: 'forged' }, headers: {}, ip: '127.0.0.1' };
    const context = { getHandler: () => null, switchToHttp: () => ({ getRequest: () => request }) };
    const interceptor = new AuditInterceptor(reflector, { log } as any, db as any);
    expect(await lastValueFrom(interceptor.intercept(context as any, { handle: () => of({ name: 'After', nested: { passwordResetToken: 'reset' } }) }))).toEqual({ name: 'After', nested: { passwordResetToken: 'reset' } });
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'authenticated', before: { name: 'Before', members: [{}] }, after: { name: 'After', nested: {} } }));
  });
});
