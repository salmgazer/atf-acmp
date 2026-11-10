"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCurrentParticipant, useCompleteOnboarding, type CompleteOnboardingDto, type Participant } from "@/lib/api/hooks/use-participants";
import { useVerticals } from "@/lib/api/hooks/use-verticals";
import { useChangePassword } from "@/lib/api/hooks/use-auth-api";
import { ArrowRight, ArrowLeft, Check, Loader2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { RateLimitNotice, useRateLimitCooldown } from "@/components/auth/rate-limit-notice";
import { BUILD_DEPLOY_OPTIONS, MATCHING_ROLE_OPTIONS, MATCHING_SECTOR_OPTIONS, MATCHING_TEAM_STATUS_OPTIONS, GITHUB_USERNAME_PATTERN, COUNTRY_NAMES, SKILL_NAMES, INTEREST_OPTIONS, matchingOptionLabel } from "@acmp/shared";

const passwordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters").regex(/[A-Z]/, "Password must contain at least one uppercase letter").regex(/[a-z]/, "Password must contain at least one lowercase letter").regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine(data => data.newPassword === data.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] });
type PasswordData = z.infer<typeof passwordSchema>;
const profileFields = [
  ["firstName", "First name", 255], ["lastName", "Last name", 255], ["phoneNumber", "Phone number", 50], ["whatsappNumber", "WhatsApp number", 50],
  ["city", "City", 150], ["locationType", "Location type", 150], ["gender", "Gender", 100], ["institution", "Institution / university", 255],
  ["educationLevel", "Education level", 150], ["currentAffiliation", "Current affiliation", 150], ["fieldOfStudy", "Field of study", 255],
] as const;
const skillsFields = [["pythonSkill", "Python skill"], ["gitSkill", "Git skill"], ["aiExperience", "AI experience"]] as const;
const steps = ["Security", "Profile", "Skills & GitHub", "Sectors", "Team preferences", "Review"];
const selectClass = "h-11 w-full rounded-md border border-input bg-background px-3 text-sm";
const countryName = (value: string) => Object.entries(COUNTRY_NAMES).find(([code, name]) => [code.toLowerCase(), name.toLowerCase()].includes(value.toLowerCase()))?.[1] || value;
const draftSchema = z.object({
  profile: z.object({ firstName: z.string().max(255), lastName: z.string().max(255), country: z.string().max(255), institution: z.string().max(255), phoneNumber: z.string().max(50), whatsappNumber: z.string().max(50), city: z.string().max(150), locationType: z.string().max(150), gender: z.string().max(100), educationLevel: z.string().max(150), currentAffiliation: z.string().max(150), fieldOfStudy: z.string().max(255), pythonSkill: z.string().max(255), gitSkill: z.string().max(255), aiExperience: z.string().max(255), githubUsername: z.string().max(255), githubAccountStatus: z.enum(["", "has_account", "no_account"]) }),
  skills: z.array(z.string().max(255)).max(100), interests: z.array(z.string().max(255)).max(100),
  buildDeployAbility: z.enum(["", "confident", "with_support", "no"]), preferredRole: z.enum(["", "builder", "sector_specialist", "business_impact_lead"]),
  firstChoiceSector: z.string().max(50), backupSector: z.string().max(50), teamStatus: z.enum(["", "full_team", "partial_team", "need_team"]),
  crossCountry: z.enum(["", "yes", "no"]), consent: z.enum(["", "yes", "no"]), verticalId1: z.string().max(50), verticalId2: z.string().max(50),
});
type Draft = z.infer<typeof draftSchema>;
function initialDraft(p: Participant): Draft {
  const preference = p.preference;
  const profile = Object.fromEntries([...profileFields, ...skillsFields].map(([field]) => [field, p[field] || ""]));
  return { profile: { ...profile, country: countryName(p.country), githubUsername: p.githubUsername || "", githubAccountStatus: p.githubAccountStatus || (p.githubUsername ? "has_account" : "") } as Draft["profile"],
    skills: p.skills || [], interests: p.interests || [], buildDeployAbility: preference?.buildDeployAbility || "", preferredRole: MATCHING_ROLE_OPTIONS.find(option => option.value === preference?.preferredRole)?.value || "", firstChoiceSector: preference?.firstChoiceSector || "", backupSector: preference?.backupSector || "", teamStatus: preference?.teamStatus || "", crossCountry: preference?.matchingProfileCompletedAt ? preference.crossCountryWilling ? "yes" : "no" : "", consent: preference?.matchingProfileConsent == null ? "" : preference.matchingProfileConsent ? "yes" : "no", verticalId1: preference?.verticalId1 || "", verticalId2: preference?.verticalId2 || "" };
}
function validateStep(draft: Draft, step: number) {
  if (step === 2 && (!draft.profile.firstName.trim() || !draft.profile.lastName.trim() || !draft.profile.country)) return "Confirm your first name, last name and country.";
  if (step === 3) {
    if (!draft.buildDeployAbility) return "Tell us whether you can build and deploy an application.";
    if (!draft.profile.githubAccountStatus) return "Tell us whether you have a GitHub account.";
    if (draft.profile.githubAccountStatus === "has_account" && !GITHUB_USERNAME_PATTERN.test(draft.profile.githubUsername.trim())) return "Enter a valid GitHub username, without a URL or @ prefix, or choose that you do not have an account yet.";
  }
  if (step === 4 && (!MATCHING_SECTOR_OPTIONS.some(option => option.value === draft.firstChoiceSector) || !MATCHING_SECTOR_OPTIONS.some(option => option.value === draft.backupSector) || draft.firstChoiceSector === draft.backupSector)) return "Choose a first-choice sector and a different backup sector.";
  if (step === 4 && draft.verticalId1 && draft.verticalId1 === draft.verticalId2) return "Choose different programme verticals.";
  if (step === 5 && (!draft.preferredRole || !draft.teamStatus || !draft.crossCountry || !draft.consent)) return "Answer each team preference question. You can choose No for profile visibility and cross-country teams.";
  return null;
}
function Choices({ title, value, onChange, options, description }: { title: string; value: string; onChange: (value: string) => void; options: readonly { value: string; label: string }[]; description?: string }) {
  const id = title.toLowerCase().replace(/[^a-z]+/g, "-");
  return <fieldset className="space-y-3"><legend className="text-sm font-medium">{title}</legend>{description && <p className="text-sm text-muted-foreground">{description}</p>}<RadioGroup aria-label={title} value={value} onValueChange={onChange} className="gap-2">{options.map(option => <label htmlFor={`${id}-${option.value}`} key={option.value} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm", value === option.value && "border-primary bg-primary/5")}><RadioGroupItem id={`${id}-${option.value}`} value={option.value} />{option.label}</label>)}</RadioGroup></fieldset>;
}
function OnboardingContent() {
  const router = useRouter();
  const { data: participant, isLoading, isError, error: profileError, refetch } = useCurrentParticipant();
  const { seconds: retrySeconds, capture: captureRateLimit } = useRateLimitCooldown();
  useEffect(() => { if (profileError) captureRateLimit(profileError); }, [profileError, captureRateLimit]);
  const { data: verticals } = useVerticals(participant?.cohortId);
  const complete = useCompleteOnboarding(), password = useChangePassword();
  const [draft, setDraft] = useState<Draft | null>(null), [step, setStep] = useState(1), [error, setError] = useState<string | null>(null), [finished, setFinished] = useState(false);
  const storageKey = participant ? `acmp-onboarding-v2:${participant.id}` : null;
  useEffect(() => {
    if (!participant) return;
    if (participant.onboardingComplete && participant.preference?.matchingProfileCompletedAt) { router.replace("/participant/dashboard"); return; }
    if (draft) { if (!participant.mustChangePassword && step === 1) setStep(2); return; }
    let initial = initialDraft(participant), nextStep = participant.mustChangePassword ? 1 : 2;
    if (storageKey) try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      if (saved?.expires > Date.now() && saved.version === 2) {
        const parsed = draftSchema.safeParse(saved.draft);
        if (parsed.success) { initial = parsed.data; if (!participant.mustChangePassword && Number.isInteger(saved.step)) nextStep = Math.max(2, Math.min(6, saved.step)); }
      }
    } catch { /* A draft is optional. */ }
    setDraft(initial); setStep(nextStep);
  }, [participant, draft, router, step, storageKey]);
  useEffect(() => {
    if (!storageKey || !draft || step === 1 || finished || participant?.preference?.matchingProfileCompletedAt) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify({ version: 2, draft, step, expires: Date.now() + 86400000 })); } catch { /* A draft is optional. */ }
  }, [storageKey, draft, step, finished, participant?.preference?.matchingProfileCompletedAt]);
  const changePassword = async (values: PasswordData) => {
    if (!participant || retrySeconds) return;
    try { await password.mutateAsync({ currentPassword: participant.participantId, newPassword: values.newPassword }); await refetch(); setStep(2); } catch (failure) { if (!captureRateLimit(failure)) toast.error(failure instanceof Error ? failure.message : "Could not change your password. Please try again."); }
  };
  if (isLoading || (!draft && !isError)) return <div className="flex min-h-screen items-center justify-center"><Loader2 aria-label="Loading profile" className="h-8 w-8 animate-spin" /></div>;
  if (!participant || !draft) return <div className="mx-auto max-w-lg space-y-3 p-8"><p role="alert">Could not load your profile.</p><RateLimitNotice seconds={retrySeconds} /><Button disabled={retrySeconds > 0} onClick={() => refetch()}>Try again</Button></div>;
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => { setDraft(current => current ? { ...current, [key]: value } : current); setError(null); };
  const updateProfile = (key: keyof Draft["profile"], value: string) => { setDraft(current => current ? { ...current, profile: { ...current.profile, [key]: value } } : current); setError(null); };
  const next = (event: FormEvent) => { event.preventDefault(); const message = validateStep(draft, step); setError(message); if (!message) { setStep(current => current + 1); window.scrollTo(0, 0); } };
  const back = () => { setStep(current => Math.max(2, current - 1)); setError(null); };
  const submit = async () => {
    if (retrySeconds) return;
    for (let current = 2; current <= 5; current++) { const message = validateStep(draft, current); if (message) { setStep(current); setError(message); return; } }
    const data: CompleteOnboardingDto = {
      profile: { ...draft.profile, githubAccountStatus: draft.profile.githubAccountStatus as "has_account" | "no_account", githubUsername: draft.profile.githubAccountStatus === "has_account" ? draft.profile.githubUsername.trim() : undefined },
      skills: { skills: draft.skills, interests: draft.interests },
      preferences: { verticalId1: draft.verticalId1 || undefined, verticalId2: draft.verticalId2 || undefined, briefRankings: participant.preference?.briefRankings || [], crossCountryWilling: draft.crossCountry === "yes", preferredRole: draft.preferredRole as CompleteOnboardingDto["preferences"]["preferredRole"], buildDeployAbility: draft.buildDeployAbility as CompleteOnboardingDto["preferences"]["buildDeployAbility"], firstChoiceSector: draft.firstChoiceSector as CompleteOnboardingDto["preferences"]["firstChoiceSector"], backupSector: draft.backupSector as CompleteOnboardingDto["preferences"]["backupSector"], teamStatus: draft.teamStatus as CompleteOnboardingDto["preferences"]["teamStatus"], matchingProfileConsent: draft.consent === "yes" },
    };
    try { await complete.mutateAsync({ id: participant.id, data }); setFinished(true); if (storageKey) try { sessionStorage.removeItem(storageKey); } catch { /* Optional cache. */ } router.push("/participant/dashboard"); } catch (failure) { if (!captureRateLimit(failure)) setError("Could not complete setup. Your answers have been kept; check the error message and try again."); }
  };
  const countries = [...new Set((participant.cohort?.countries?.length ? participant.cohort.countries : Object.values(COUNTRY_NAMES)).map(countryName))];
  if (draft.profile.country && !countries.includes(draft.profile.country)) countries.unshift(draft.profile.country);
  const activeVerticals = verticals?.filter(vertical => vertical.isActive) || [];
  const yesNo = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }];
  return <div className="min-h-screen bg-background"><header className="border-b px-4 py-4"><div className="flex items-center justify-center gap-3"><img src="/logos/image_only/Brand-Mark_Red.png" alt="ATF" className="h-8 w-8" /><h1 className="text-lg font-semibold">Complete Your Profile</h1></div></header>
    <main className="mx-auto max-w-2xl space-y-7 px-4 py-8"><nav aria-label="Onboarding progress"><ol className="grid grid-cols-6 gap-2">{steps.map((title, index) => <li key={title} aria-current={step === index + 1 ? "step" : undefined} className={cn("border-t-4 pt-2 text-xs text-muted-foreground", step >= index + 1 && "border-primary", step === index + 1 && "font-semibold text-foreground")}><span className="block">{index + 1}</span><span className="hidden sm:block">{title}</span></li>)}</ol><p className="mt-3 text-sm text-muted-foreground">Step {step} of 6 · {steps[step - 1]}</p></nav>
      <RateLimitNotice seconds={retrySeconds} />
      {step === 1 ? <PasswordResetStep onSubmit={changePassword} isSubmitting={password.isPending} retrySeconds={retrySeconds} /> : <form onSubmit={next} className="space-y-6">
      {step === 2 && <><div><h2 className="text-xl font-bold">Personal Information</h2><p className="mt-1 text-sm text-muted-foreground">We have prefilled the details supplied by ATF. Confirm or correct them before continuing.</p></div>
        <dl className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Participant ID</dt><dd>{participant.participantId}</dd></div><div><dt className="text-muted-foreground">LMS email</dt><dd className="break-all">{participant.lmsEmail || participant.email}</dd></div><div><dt className="text-muted-foreground">Group</dt><dd>{participant.group || "Not assigned"}</dd></div></dl>
        <div className="grid gap-4 sm:grid-cols-2">{profileFields.map(([field, title, length]) => <div key={field} className="space-y-2"><Label htmlFor={field}>{title}{field === "firstName" || field === "lastName" ? " *" : ""}</Label><Input id={field} type={field === "phoneNumber" || field === "whatsappNumber" ? "tel" : "text"} value={draft.profile[field]} maxLength={length} required={field === "firstName" || field === "lastName"} onChange={event => updateProfile(field, event.target.value)} /></div>)}<div className="space-y-2"><Label htmlFor="country">Country of residence *</Label><select id="country" className={selectClass} value={draft.profile.country} required onChange={event => updateProfile("country", event.target.value)}><option value="">Choose your country</option>{countries.map(country => <option key={country}>{country}</option>)}</select></div></div>
        <LearningRecord participant={participant} />
      </>}
      {step === 3 && <><div><h2 className="text-xl font-bold">Skills & GitHub</h2><p className="mt-1 text-sm text-muted-foreground">Confirm your imported experience and tell us how you can contribute.</p></div>
        <div className="grid gap-4 sm:grid-cols-3">{skillsFields.map(([field, title]) => <div key={field} className="space-y-2"><Label htmlFor={field}>{title}</Label><Input id={field} value={draft.profile[field]} maxLength={255} onChange={event => updateProfile(field, event.target.value)} /></div>)}</div>
        <Choices title="Can you build and deploy an application?" value={draft.buildDeployAbility} options={BUILD_DEPLOY_OPTIONS} onChange={value => update("buildDeployAbility", value as Draft["buildDeployAbility"])} />
        <div className="space-y-4 rounded-lg border p-4"><Choices title="Do you have a GitHub account?" value={draft.profile.githubAccountStatus} options={[{ value: "has_account", label: "Yes, I have an account" }, { value: "no_account", label: "I do not have an account yet" }]} onChange={value => updateProfile("githubAccountStatus", value)} />
        {draft.profile.githubAccountStatus === "has_account" && <div className="space-y-2"><Label htmlFor="githubUsername">GitHub username *</Label><Input id="githubUsername" placeholder="Your username, without @ or a URL" value={draft.profile.githubUsername} maxLength={39} onChange={event => updateProfile("githubUsername", event.target.value)} /></div>}
        <p className="text-sm text-muted-foreground">GitHub is where teams store and share their code, and where we track build progress.</p><a href="https://github.com/signup" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary underline">Create a GitHub account</a>{draft.profile.githubAccountStatus === "no_account" && <p className="text-sm text-muted-foreground">You can finish onboarding now and create your account before your team starts building.</p>}</div>
        <details><summary className="cursor-pointer text-sm font-medium">Additional skills and interests (optional)</summary><div className="mt-4 space-y-4">{([['skills', SKILL_NAMES], ['interests', INTEREST_OPTIONS]] as const).map(([key, options]) => <fieldset key={key}><legend className="mb-2 text-sm capitalize">{key}</legend><div className="flex flex-wrap gap-2">{options.map(option => <Button key={option} type="button" variant={draft[key].includes(option) ? "default" : "outline"} aria-pressed={draft[key].includes(option)} size="sm" onClick={() => update(key, draft[key].includes(option) ? draft[key].filter(value => value !== option) : [...draft[key], option])}>{option}</Button>)}</div></fieldset>)}</div></details>
      </>}
      {step === 4 && <><div><h2 className="text-xl font-bold">Preferred Sectors</h2><p className="mt-1 text-sm text-muted-foreground">Choose the sector you want to work in and a different backup.</p></div>{([['firstChoiceSector', 'First-choice sector'], ['backupSector', 'Backup sector']] as const).map(([field, title]) => <div key={field} className="space-y-2"><Label htmlFor={field}>{title} *</Label><select id={field} className={selectClass} value={draft[field]} required onChange={event => update(field, event.target.value)}><option value="">Choose a sector</option>{MATCHING_SECTOR_OPTIONS.map(option => <option key={option.value} value={option.value} disabled={field === 'backupSector' && option.value === draft.firstChoiceSector}>{option.label}</option>)}</select></div>)}
        {activeVerticals.length > 0 && <details><summary className="cursor-pointer text-sm font-medium">Programme vertical preferences (optional)</summary><p className="mt-2 text-sm text-muted-foreground">You can also keep your preferences for this cohort&apos;s configured programme verticals.</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{([['verticalId1', 'First programme vertical'], ['verticalId2', 'Second programme vertical']] as const).map(([field, title]) => <div key={field} className="space-y-2"><Label htmlFor={field}>{title}</Label><select id={field} className={selectClass} value={draft[field]} onChange={event => update(field, event.target.value)}><option value="">No preference</option>{activeVerticals.map(vertical => <option key={vertical.id} value={vertical.id}>{vertical.name}</option>)}</select></div>)}</div></details>}
      </>}
      {step === 5 && <><div><h2 className="text-xl font-bold">Team Preferences</h2><p className="mt-1 text-sm text-muted-foreground">These answers help us suggest teams that suit you.</p></div><Choices title="Preferred team role" value={draft.preferredRole} options={MATCHING_ROLE_OPTIONS} onChange={value => update("preferredRole", value as Draft["preferredRole"])} /><Choices title="Team status" value={draft.teamStatus} options={MATCHING_TEAM_STATUS_OPTIONS} onChange={value => update("teamStatus", value as Draft["teamStatus"])} description="Tell us your current situation. This answer does not register or create a team." /><Choices title="Open to a cross-country team?" value={draft.crossCountry} options={yesNo} onChange={value => update("crossCountry", value as Draft["crossCountry"])} /><Choices title="Show your matching profile to other participants?" value={draft.consent} options={yesNo} onChange={value => update("consent", value as Draft["consent"])} description="If you choose Yes, other participants can find your profile when looking for teammates. This includes your name, country, institution, skills, role and sectors. Your phone, email and learning certificate details are not part of this matching profile. Choosing No still lets you complete onboarding; you can change this choice on your profile." /></>}
      {step === 6 && <><div><h2 className="text-xl font-bold">Review Your Profile</h2><p className="mt-1 text-sm text-muted-foreground">Completing setup confirms the details below.</p></div><dl className="grid gap-4 rounded-lg border p-5 text-sm sm:grid-cols-2">{[...profileFields.map(([field, title]) => [title, draft.profile[field]]), ["Country", draft.profile.country], ...skillsFields.map(([field, title]) => [title, draft.profile[field]]), ["GitHub username", draft.profile.githubAccountStatus === "has_account" ? draft.profile.githubUsername : "No account yet"], ["Build and deploy", matchingOptionLabel(BUILD_DEPLOY_OPTIONS, draft.buildDeployAbility)], ["Preferred team role", matchingOptionLabel(MATCHING_ROLE_OPTIONS, draft.preferredRole)], ["First-choice sector", matchingOptionLabel(MATCHING_SECTOR_OPTIONS, draft.firstChoiceSector)], ["Backup sector", matchingOptionLabel(MATCHING_SECTOR_OPTIONS, draft.backupSector)], ["Team status", matchingOptionLabel(MATCHING_TEAM_STATUS_OPTIONS, draft.teamStatus)], ["Cross-country team", draft.crossCountry === "yes" ? "Yes" : "No"], ["Matching profile visible", draft.consent === "yes" ? "Yes" : "No"]].map(([title, value]) => <div key={title}><dt className="text-muted-foreground">{title}</dt><dd className="break-words font-medium">{value || "Not provided"}</dd></div>)}</dl><LearningRecord participant={participant} /></>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-3">{step > 2 && <Button type="button" variant="outline" onClick={back} disabled={complete.isPending}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>}{step === 6 ? <Button type="button" className="flex-1" onClick={submit} disabled={complete.isPending || retrySeconds > 0}>{complete.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Complete Setup</Button> : <Button type="submit" className="flex-1">{step === 5 ? "Review" : "Continue"}<ArrowRight className="ml-2 h-4 w-4" /></Button>}</div>
      </form>}
    </main></div>;
}
function LearningRecord({ participant }: { participant: Participant }) {
  const status = (value?: boolean | null) => value == null ? "Not recorded" : value ? "Yes" : "No";
  return <section className="space-y-3 rounded-lg border p-4"><h3 className="font-medium">Learning programme record</h3><p className="text-sm text-muted-foreground">ATF supplies this record. Contact staff if it needs correcting.</p><dl className="grid gap-3 text-sm sm:grid-cols-2">{[["Halfway reached", status(participant.learningHalfwayReached)], ["All lessons finished", status(participant.learningFinishedAllLessons)], ["Learning certificate issued", status(participant.learningCertificateIssued)], ["Learning certificate ID", participant.learningCertificateId || "Not recorded"], ["Learning certificate date", participant.learningCertificateDate || "Not recorded"]].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="break-all">{value}</dd></div>)}</dl></section>;
}
function PasswordResetStep({
  onSubmit,
  isSubmitting,
  retrySeconds,
}: {
  onSubmit: (data: PasswordData) => void;
  isSubmitting: boolean;
  retrySeconds: number;
}) {
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<PasswordData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const watchedPassword = form.watch("newPassword");
  
  // Password criteria checks
  const passwordCriteria = {
    minLength: (watchedPassword?.length || 0) >= 8,
    hasUppercase: /[A-Z]/.test(watchedPassword || ""),
    hasLowercase: /[a-z]/.test(watchedPassword || ""),
    hasNumber: /[0-9]/.test(watchedPassword || ""),
  };

  const handleSubmit = form.handleSubmit((values) => {
    onSubmit(values);
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Secure Your Account</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Create a new password to secure your account.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="newPassword">New Password *</Label>
          <div className="relative">
            <Input
              id="newPassword"
              type={showNewPassword ? "text" : "password"}
              placeholder="Create a strong password"
              {...form.register("newPassword")}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowNewPassword(!showNewPassword)}
            >
              {showNewPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          {form.formState.errors.newPassword && (
            <p className="text-xs text-destructive">
              {form.formState.errors.newPassword.message}
            </p>
          )}
          <ul className="text-xs space-y-1 mt-2">
            <li className={cn(
              "flex items-center gap-1.5",
              passwordCriteria.minLength ? "text-green-600" : "text-muted-foreground"
            )}>
              {passwordCriteria.minLength ? (
                <Check className="h-3 w-3" />
              ) : (
                <span className="w-3">•</span>
              )}
              At least 8 characters
            </li>
            <li className={cn(
              "flex items-center gap-1.5",
              passwordCriteria.hasUppercase ? "text-green-600" : "text-muted-foreground"
            )}>
              {passwordCriteria.hasUppercase ? (
                <Check className="h-3 w-3" />
              ) : (
                <span className="w-3">•</span>
              )}
              At least one uppercase letter
            </li>
            <li className={cn(
              "flex items-center gap-1.5",
              passwordCriteria.hasLowercase ? "text-green-600" : "text-muted-foreground"
            )}>
              {passwordCriteria.hasLowercase ? (
                <Check className="h-3 w-3" />
              ) : (
                <span className="w-3">•</span>
              )}
              At least one lowercase letter
            </li>
            <li className={cn(
              "flex items-center gap-1.5",
              passwordCriteria.hasNumber ? "text-green-600" : "text-muted-foreground"
            )}>
              {passwordCriteria.hasNumber ? (
                <Check className="h-3 w-3" />
              ) : (
                <span className="w-3">•</span>
              )}
              At least one number
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm New Password *</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm your new password"
              {...form.register("confirmPassword")}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          {form.formState.errors.confirmPassword && (
            <p className="text-xs text-destructive">
              {form.formState.errors.confirmPassword.message}
            </p>
          )}
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting || retrySeconds > 0}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Updating Password...
          </>
        ) : (
          <>
            Change Password & Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}

export default function OnboardingPage() {
  return <ProtectedRoute portal="participant"><OnboardingContent /></ProtectedRoute>;
}
