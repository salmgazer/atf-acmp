"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  useCurrentParticipant,
  useCompleteOnboarding,
  type CompleteOnboardingDto,
} from "@/lib/api/hooks/use-participants";
import { useVerticals, type Vertical } from "@/lib/api/hooks/use-verticals";
import { useChangePassword } from "@/lib/api/hooks/use-auth-api";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  User,
  Sparkles,
  Layers,
  FileText,
  Globe,
  Loader2,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Skills options
const SKILL_OPTIONS = [
  "Python",
  "JavaScript/TypeScript",
  "Machine Learning",
  "Data Science",
  "Mobile Development",
  "UI/UX Design",
  "Project Management",
  "Business Strategy",
  "Research",
  "Content Writing",
  "Marketing",
  "Public Speaking",
];

const INTEREST_OPTIONS = [
  "Artificial Intelligence",
  "Climate & Sustainability",
  "Healthcare & Medicine",
  "Education",
  "FinTech",
  "Agriculture",
  "E-commerce",
  "Social Impact",
  "Entertainment",
  "Transportation",
];

const ROLE_OPTIONS = [
  { value: "leader", label: "Team Leader", description: "Lead and coordinate the team" },
  { value: "co-leader", label: "Co-Leader", description: "Support leadership and fill gaps" },
  { value: "member", label: "Team Member", description: "Contribute expertise to the team" },
  { value: "flexible", label: "Flexible", description: "Open to any role based on team needs" },
];

// Steps configuration
const STEPS = [
  { id: 1, title: "Security", icon: Lock },
  { id: 2, title: "Profile", icon: User },
  { id: 3, title: "Skills", icon: Sparkles },
  { id: 4, title: "Verticals", icon: Layers },
  { id: 5, title: "Preferences", icon: Globe },
  { id: 6, title: "Complete", icon: Check },
];

// Password validation schema for onboarding (no current password needed)
const passwordSchema = z.object({
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type PasswordData = z.infer<typeof passwordSchema>;

// Validation schemas
const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  institution: z.string().optional(),
  phoneNumber: z.string().optional(),
});

const skillsSchema = z.object({
  skills: z.array(z.string()).min(1, "Select at least one skill"),
  interests: z.array(z.string()).min(1, "Select at least one interest"),
});

const verticalsSchema = z.object({
  verticalId1: z.string().optional(),
  verticalId2: z.string().optional(),
});

const preferencesSchema = z.object({
  crossCountryWilling: z.boolean(),
  preferredRole: z.string().optional(),
  availabilityNotes: z.string().optional(),
});

type ProfileData = z.infer<typeof profileSchema>;
type SkillsData = z.infer<typeof skillsSchema>;
type VerticalsData = z.infer<typeof verticalsSchema>;
type PreferencesData = z.infer<typeof preferencesSchema>;

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="mx-4 overflow-x-auto py-4">
      <div className="flex items-center justify-start gap-1 min-w-max px-1">
        {STEPS.map((step, index) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          const StepIcon = step.icon;

          return (
            <div key={step.id} className="flex items-center shrink-0">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors",
                  isCompleted && "border-primary bg-primary text-primary-foreground",
                  isCurrent && "border-primary bg-primary/10",
                  !isCompleted && !isCurrent && "border-muted"
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <StepIcon className={cn("h-4 w-4", isCurrent && "text-primary")} />
                )}
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-6 mx-1",
                    currentStep > step.id ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [formData, setFormData] = useState<{
    profile: ProfileData;
    skills: SkillsData;
    verticals: VerticalsData;
    preferences: PreferencesData;
  }>({
    profile: { firstName: "", lastName: "", institution: "", phoneNumber: "" },
    skills: { skills: [], interests: [] },
    verticals: { verticalId1: undefined, verticalId2: undefined },
    preferences: { crossCountryWilling: true, preferredRole: "flexible", availabilityNotes: "" },
  });

  const { data: participant, isLoading: participantLoading, refetch: refetchParticipant } = useCurrentParticipant();
  const { data: verticals } = useVerticals(participant?.cohortId);
  const completeMutation = useCompleteOnboarding();
  const changePasswordMutation = useChangePassword();

  // Track if form data has been initialized
  const [initialized, setInitialized] = useState(false);

  // Initialize form data from participant (only once)
  useEffect(() => {
    if (participant && !initialized) {
      setFormData((prev) => ({
        ...prev,
        profile: {
          firstName: participant.firstName || "",
          lastName: participant.lastName || "",
          institution: participant.institution || "",
          phoneNumber: participant.phoneNumber || "",
        },
        skills: {
          skills: participant.skills || [],
          interests: participant.interests || [],
        },
      }));
      setInitialized(true);
    }

    if (participant) {
      // If password already changed, skip to step 2
      if (!participant.mustChangePassword) {
        setPasswordChanged(true);
        if (currentStep === 1) {
          setCurrentStep(2);
        }
      }

      // If onboarding is already complete, redirect
      if (participant.onboardingComplete) {
        router.push("/app/dashboard");
      }
    }
  }, [participant, router, currentStep, initialized]);

  const handlePasswordChange = async (data: PasswordData) => {
    if (!participant?.participantId) {
      toast.error("Unable to change password. Please try again.");
      return;
    }
    
    try {
      await changePasswordMutation.mutateAsync({
        currentPassword: participant.participantId, // Use participant ID as current password
        newPassword: data.newPassword,
      });
      setPasswordChanged(true);
      toast.success("Password changed successfully!");
      // Refetch participant to update mustChangePassword status
      await refetchParticipant();
      setCurrentStep(2);
    } catch (error: any) {
      toast.error(error.message || "Failed to change password");
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      // Don't go back to password step if already changed
      if (currentStep === 2 && passwordChanged) {
        return;
      }
      setCurrentStep((s) => s - 1);
    }
  };

  const handleSubmit = async () => {
    if (!participant) return;

    const data: CompleteOnboardingDto = {
      profile: formData.profile,
      skills: formData.skills,
      preferences: {
        verticalId1: formData.verticals.verticalId1,
        verticalId2: formData.verticals.verticalId2,
        briefRankings: [], // Will be set later when browsing briefs
        crossCountryWilling: formData.preferences.crossCountryWilling,
        preferredRole: formData.preferences.preferredRole,
        availabilityNotes: formData.preferences.availabilityNotes,
      },
    };

    await completeMutation.mutateAsync({ id: participant.id, data });
    router.push("/app/dashboard");
  };

  if (participantLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background px-4 py-3">
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-2">
            <img 
              src="/logos/image_only/Brand-Mark_Red.png" 
              alt="ATF" 
              className="h-8 w-8 rounded-md"
            />
            <span className="font-semibold">Complete Your Profile</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-6">
        <StepIndicator currentStep={currentStep} />

        <div className="mt-6">
          {/* Step 1: Password Reset */}
          {currentStep === 1 && (
            <PasswordResetStep
              onSubmit={handlePasswordChange}
              isSubmitting={changePasswordMutation.isPending}
              participantId={participant?.participantId}
            />
          )}

          {/* Step 2: Profile */}
          {currentStep === 2 && (
            <ProfileStep
              data={formData.profile}
              onUpdate={(data) => setFormData((prev) => ({ ...prev, profile: data }))}
              onNext={handleNext}
            />
          )}

          {/* Step 3: Skills */}
          {currentStep === 3 && (
            <SkillsStep
              data={formData.skills}
              onUpdate={(data) => setFormData((prev) => ({ ...prev, skills: data }))}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}

          {/* Step 4: Verticals */}
          {currentStep === 4 && (
            <VerticalsStep
              data={formData.verticals}
              verticals={verticals || []}
              onUpdate={(data) => setFormData((prev) => ({ ...prev, verticals: data }))}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}

          {/* Step 5: Preferences */}
          {currentStep === 5 && (
            <PreferencesStep
              data={formData.preferences}
              onUpdate={(data) => setFormData((prev) => ({ ...prev, preferences: data }))}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}

          {/* Step 6: Complete */}
          {currentStep === 6 && (
            <CompleteStep
              formData={formData}
              verticals={verticals || []}
              isSubmitting={completeMutation.isPending}
              onSubmit={handleSubmit}
              onBack={handleBack}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Step Components

function PasswordResetStep({
  onSubmit,
  isSubmitting,
  participantId,
}: {
  onSubmit: (data: PasswordData) => void;
  isSubmitting: boolean;
  participantId?: string;
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

      <Button type="submit" className="w-full" disabled={isSubmitting}>
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

function ProfileStep({
  data,
  onUpdate,
  onNext,
}: {
  data: ProfileData;
  onUpdate: (data: ProfileData) => void;
  onNext: () => void;
}) {
  const form = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues: data,
    values: data, // This will update form values when data changes
  });

  const handleSubmit = form.handleSubmit((values) => {
    onUpdate(values);
    onNext();
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Personal Information</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Verify and update your basic details
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name *</Label>
            <Input id="firstName" {...form.register("firstName")} />
            {form.formState.errors.firstName && (
              <p className="text-xs text-destructive">
                {form.formState.errors.firstName.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name *</Label>
            <Input id="lastName" {...form.register("lastName")} />
            {form.formState.errors.lastName && (
              <p className="text-xs text-destructive">
                {form.formState.errors.lastName.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="institution">Institution / University</Label>
          <Input
            id="institution"
            placeholder="e.g. University of Nairobi"
            {...form.register("institution")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phoneNumber">Phone Number</Label>
          <Input
            id="phoneNumber"
            type="tel"
            placeholder="+254 700 000 000"
            {...form.register("phoneNumber")}
          />
        </div>
      </div>

      <Button type="submit" className="w-full">
        Continue
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </form>
  );
}

function SkillsStep({
  data,
  onUpdate,
  onNext,
  onBack,
}: {
  data: SkillsData;
  onUpdate: (data: SkillsData) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [skills, setSkills] = useState<string[]>(() => data.skills || []);
  const [interests, setInterests] = useState<string[]>(() => data.interests || []);

  const toggleSkill = (skill: string) => {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const handleNext = () => {
    if (skills.length === 0 || interests.length === 0) return;
    onUpdate({ skills, interests });
    onNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Skills & Interests</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Help us match you with the right team
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-base">Your Skills *</Label>
          <p className="text-xs text-muted-foreground mb-3">Select all that apply</p>
          <div className="flex flex-wrap gap-2">
            {SKILL_OPTIONS.map((skill) => (
              <Badge
                key={skill}
                variant={skills.includes(skill) ? "default" : "outline"}
                className="cursor-pointer px-3 py-1.5 text-sm"
                onClick={() => toggleSkill(skill)}
              >
                {skill}
              </Badge>
            ))}
          </div>
          {skills.length === 0 && (
            <p className="text-xs text-destructive mt-2">Select at least one skill</p>
          )}
        </div>

        <div>
          <Label className="text-base">Your Interests *</Label>
          <p className="text-xs text-muted-foreground mb-3">What domains excite you?</p>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((interest) => (
              <Badge
                key={interest}
                variant={interests.includes(interest) ? "default" : "outline"}
                className="cursor-pointer px-3 py-1.5 text-sm"
                onClick={() => toggleInterest(interest)}
              >
                {interest}
              </Badge>
            ))}
          </div>
          {interests.length === 0 && (
            <p className="text-xs text-destructive mt-2">Select at least one interest</p>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          type="button"
          onClick={handleNext}
          disabled={skills.length === 0 || interests.length === 0}
          className="flex-1"
        >
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function VerticalsStep({
  data,
  verticals,
  onUpdate,
  onNext,
  onBack,
}: {
  data: VerticalsData;
  verticals: Vertical[];
  onUpdate: (data: VerticalsData) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(
    [data.verticalId1, data.verticalId2].filter(Boolean) as string[]
  );

  const toggleVertical = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) {
        return prev.filter((v) => v !== id);
      }
      if (prev.length >= 2) {
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });
  };

  const handleNext = () => {
    onUpdate({
      verticalId1: selected[0],
      verticalId2: selected[1],
    });
    onNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Preferred Verticals</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Select up to 2 verticals you're interested in
        </p>
      </div>

      <div className="space-y-3">
        {verticals.filter((v) => v.isActive).map((vertical) => (
          <div
            key={vertical.id}
            onClick={() => toggleVertical(vertical.id)}
            className={cn(
              "p-4 rounded-lg border cursor-pointer transition-colors",
              selected.includes(vertical.id)
                ? "border-primary bg-primary/5"
                : "border-muted hover:border-muted-foreground/50"
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium">{vertical.name}</h3>
                {vertical.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {vertical.description}
                  </p>
                )}
              </div>
              {selected.includes(vertical.id) && (
                <Badge variant="default" className="ml-2">
                  {selected.indexOf(vertical.id) + 1}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button type="button" onClick={handleNext} className="flex-1">
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function PreferencesStep({
  data,
  onUpdate,
  onNext,
  onBack,
}: {
  data: PreferencesData;
  onUpdate: (data: PreferencesData) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [crossCountryWilling, setCrossCountryWilling] = useState(data.crossCountryWilling);
  const [preferredRole, setPreferredRole] = useState(data.preferredRole || "flexible");
  const [availabilityNotes, setAvailabilityNotes] = useState(data.availabilityNotes || "");

  const handleNext = () => {
    onUpdate({ crossCountryWilling, preferredRole, availabilityNotes });
    onNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Team Preferences</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Help us find the best team for you
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <Label className="text-base">Preferred Team Role</Label>
          <RadioGroup
            value={preferredRole}
            onValueChange={setPreferredRole}
            className="mt-3 space-y-3"
          >
            {ROLE_OPTIONS.map((role) => (
              <div
                key={role.value}
                className={cn(
                  "flex items-start space-x-3 p-3 rounded-lg border cursor-pointer",
                  preferredRole === role.value
                    ? "border-primary bg-primary/5"
                    : "border-muted"
                )}
                onClick={() => setPreferredRole(role.value)}
              >
                <RadioGroupItem value={role.value} id={role.value} className="mt-1" />
                <div>
                  <Label htmlFor={role.value} className="cursor-pointer font-medium">
                    {role.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{role.description}</p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="p-4 rounded-lg border">
          <div className="flex items-start gap-3">
            <Checkbox
              id="cross-country"
              checked={crossCountryWilling}
              onCheckedChange={(checked) => setCrossCountryWilling(checked as boolean)}
            />
            <div>
              <Label htmlFor="cross-country" className="cursor-pointer">
                <Globe className="inline h-4 w-4 mr-1" />
                Open to cross-country collaboration
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Work with participants from different countries
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="availability">Availability Notes (Optional)</Label>
          <Textarea
            id="availability"
            placeholder="e.g. Available evenings and weekends, timezone is EAT..."
            value={availabilityNotes}
            onChange={(e) => setAvailabilityNotes(e.target.value)}
            rows={3}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button type="button" onClick={handleNext} className="flex-1">
          Review
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function CompleteStep({
  formData,
  verticals,
  isSubmitting,
  onSubmit,
  onBack,
}: {
  formData: {
    profile: ProfileData;
    skills: SkillsData;
    verticals: VerticalsData;
    preferences: PreferencesData;
  };
  verticals: Vertical[];
  isSubmitting: boolean;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const selectedVerticals = verticals.filter(
    (v) =>
      v.id === formData.verticals.verticalId1 || v.id === formData.verticals.verticalId2
  );
  const role = ROLE_OPTIONS.find((r) => r.value === formData.preferences.preferredRole);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Review Your Profile</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Make sure everything looks good
        </p>
      </div>

      <div className="space-y-4">
        {/* Profile Summary */}
        <div className="p-4 rounded-lg border space-y-3">
          <h3 className="font-medium flex items-center gap-2">
            <User className="h-4 w-4" />
            Personal Info
          </h3>
          <div className="text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Name:</span>{" "}
              {formData.profile.firstName} {formData.profile.lastName}
            </p>
            {formData.profile.institution && (
              <p>
                <span className="text-muted-foreground">Institution:</span>{" "}
                {formData.profile.institution}
              </p>
            )}
            {formData.profile.phoneNumber && (
              <p>
                <span className="text-muted-foreground">Phone:</span>{" "}
                {formData.profile.phoneNumber}
              </p>
            )}
          </div>
        </div>

        {/* Skills Summary */}
        <div className="p-4 rounded-lg border space-y-3">
          <h3 className="font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Skills & Interests
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Skills</p>
              {formData.skills?.skills?.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {formData.skills.skills.map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No skills selected</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Interests</p>
              {formData.skills?.interests?.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {formData.skills.interests.map((interest) => (
                    <Badge key={interest} variant="outline" className="text-xs">
                      {interest}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No interests selected</p>
              )}
            </div>
          </div>
        </div>

        {/* Verticals Summary */}
        {selectedVerticals.length > 0 && (
          <div className="p-4 rounded-lg border space-y-3">
            <h3 className="font-medium flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Preferred Verticals
            </h3>
            <div className="space-y-1">
              {selectedVerticals.map((v, i) => (
                <p key={v.id} className="text-sm">
                  {i + 1}. {v.name}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Preferences Summary */}
        <div className="p-4 rounded-lg border space-y-3">
          <h3 className="font-medium flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Team Preferences
          </h3>
          <div className="text-sm space-y-1">
            {role && (
              <p>
                <span className="text-muted-foreground">Preferred Role:</span> {role.label}
              </p>
            )}
            <p>
              <span className="text-muted-foreground">Cross-country:</span>{" "}
              {formData.preferences.crossCountryWilling ? "Yes" : "No"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="flex-1"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Complete Setup
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <ProtectedRoute portal="participant">
      <OnboardingContent />
    </ProtectedRoute>
  );
}
