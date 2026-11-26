"use client";
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_FORMATION_SETTINGS, type FormationSettings } from '@acmp/shared';
import { useFormationDefaults, useSaveFormationDefaults } from '@/lib/api/hooks/use-matching';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
export const BUILDER_ELIGIBILITY_LABELS = { confirmed: 'Confirmed builders only', recorded: 'Include builders awaiting confirmation', potential: 'Also include potential builders with unanswered questions' };
export const SHORTAGE_LABELS = { leave_unassigned: 'Leave participants unassigned', draft: 'Create draft teams needing builders', exception: 'Allow teams to register and progress with a staff exception' };
export function FormationSettingsPanel({ cohortId, onRun, running }: { cohortId: string; onRun: (settings: FormationSettings) => Promise<void>; running: boolean }) {
  const defaults = useFormationDefaults(cohortId), save = useSaveFormationDefaults(cohortId);
  const [settings, setSettings] = useState<FormationSettings>(DEFAULT_FORMATION_SETTINGS), [error, setError] = useState(''), [expectedUpdatedAt, setExpectedUpdatedAt] = useState('');
  const initialized = useRef('');
  useEffect(() => { if (defaults.data && initialized.current !== cohortId) { setSettings({ ...DEFAULT_FORMATION_SETTINGS, ...defaults.data.settings }); initialized.current = cohortId; setExpectedUpdatedAt(defaults.data.updatedAt); setError(''); } }, [cohortId, defaults.data]);
  const change = <K extends keyof FormationSettings>(key: K, value: FormationSettings[K]) => setSettings(previous => ({ ...previous, [key]: value, ...(key === 'minimumBuilders' ? { preferredBuilders: Math.max(Number(value), previous.preferredBuilders) } : {}) }));
  const exception = settings.minimumBuilders === 0 || settings.shortageAction === 'exception';
  const busy = running || save.isPending;
  async function act(action: 'save' | 'run') {
    setError('');
    if (exception && settings.exceptionReason.trim().length < 10) { setError('Explain the builder exception in at least 10 characters.'); return; }
    try {
      if (action === 'save') { const result = await save.mutateAsync({ config: settings, expectedUpdatedAt }); setExpectedUpdatedAt(result.updatedAt); toast.success('Formation defaults saved'); }
      else await onRun(settings);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not apply formation settings'); }
  }
  if (defaults.isPending) return <p role="status" className="mt-4 text-sm">Loading formation settings…</p>;
  if (defaults.isError) return <div role="alert" className="mt-4"><p>Could not load formation defaults.</p><Button variant="outline" onClick={() => defaults.refetch()}>Retry settings</Button></div>;
  return <section aria-label="Formation settings" className="mt-4 space-y-4 rounded-xl border p-4">
    <h3 className="font-semibold">Formation settings</h3>
    <p className="text-sm text-muted-foreground">Preview these choices before creating teams. A preferred language or proficiency level does not decide builder eligibility. Explicit No answers never count as builder experience.</p>
    <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
      <label className="space-y-1 text-sm">Who counts as a builder?<select aria-label="Who counts as a builder?" className="w-full rounded-lg border bg-background p-2" value={settings.builderEligibility} onChange={e => change('builderEligibility', e.target.value as FormationSettings['builderEligibility'])}>{Object.entries(BUILDER_ELIGIBILITY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="space-y-1 text-sm">What to match<select aria-label="What to match" className="w-full rounded-lg border bg-background p-2" value={settings.matchingScope} onChange={e => change('matchingScope', e.target.value as FormationSettings['matchingScope'])}><option value="both">New teams and existing open slots</option><option value="new">Create new teams only</option><option value="backfill">Fill existing open slots only</option></select></label>
      <label className="space-y-1 text-sm">Minimum builders per team<select aria-label="Minimum builders per team" className="w-full rounded-lg border bg-background p-2" value={settings.minimumBuilders} onChange={e => change('minimumBuilders', Number(e.target.value))}>{[0, 1, 2].map(n => <option key={n} value={n}>{n}{n === 0 ? ' — builders optional' : ''}</option>)}</select></label>
      <label className="space-y-1 text-sm">Preferred builders in teams of 4–5<select aria-label="Preferred builders in teams of 4–5" className="w-full rounded-lg border bg-background p-2" value={settings.preferredBuilders} onChange={e => change('preferredBuilders', Number(e.target.value))}>{[0, 1, 2].filter(n => n >= settings.minimumBuilders).map(n => <option key={n} value={n}>{n}</option>)}</select></label>
      {settings.minimumBuilders > 0 && <label className="space-y-1 text-sm sm:col-span-2">If there are not enough builders<select aria-label="If there are not enough builders" className="w-full rounded-lg border bg-background p-2" value={settings.shortageAction} onChange={e => change('shortageAction', e.target.value as FormationSettings['shortageAction'])}>{Object.entries(SHORTAGE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
      {exception && <label className="space-y-1 text-sm sm:col-span-2">Reason for builder exception<textarea aria-label="Reason for builder exception" className="min-h-20 w-full rounded-lg border bg-background p-2" value={settings.exceptionReason} minLength={10} maxLength={1000} onChange={e => change('exceptionReason', e.target.value)} /><span className="block text-xs text-muted-foreground">Recorded with the staff identity on each applicable new team. Those teams may register and progress without meeting the usual builder minimum; all other eligibility checks still apply.</span></label>}
    </fieldset>
    <p className="text-xs text-muted-foreground">Backfills await team-lead approval. Existing teams retain their saved registration policy. No existing members are moved, and this step does not assign briefs.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-2"><Button disabled={busy || initialized.current !== cohortId} onClick={() => act('run')}>{running ? 'Generating preview…' : 'Run Team Formation'}</Button><Button variant="outline" disabled={busy || initialized.current !== cohortId} onClick={() => act('save')}>{save.isPending ? 'Saving…' : 'Save as cohort defaults'}</Button><Button variant="ghost" disabled={busy} onClick={async () => { const result = await defaults.refetch(); if (result.data) { setSettings(result.data.settings); setExpectedUpdatedAt(result.data.updatedAt); setError(''); } }}>Reload saved defaults</Button></div>
  </section>;
}
export function FormationPolicySummary({ settings }: { settings: Partial<FormationSettings> }) {
  const config = { ...DEFAULT_FORMATION_SETTINGS, ...settings };
  return <div className="rounded-lg border p-3 text-sm"><p>{BUILDER_ELIGIBILITY_LABELS[config.builderEligibility]} · Minimum {config.minimumBuilders} · Preferred {config.preferredBuilders}</p><p className="mt-1">Scope: {{ new: "New teams only", backfill: "Existing open slots only", both: "New teams and existing open slots" }[config.matchingScope]}</p><p className="mt-1 text-muted-foreground">{config.minimumBuilders === 0 ? 'Builders optional: staff exception allows registration and progression.' : SHORTAGE_LABELS[config.shortageAction]}</p>{(config.minimumBuilders === 0 || config.shortageAction === 'exception') && <p className="mt-1">Staff reason: {config.exceptionReason}</p>}</div>;
}
