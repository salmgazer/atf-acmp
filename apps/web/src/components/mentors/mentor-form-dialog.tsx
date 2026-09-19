"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateMentor,
  useUpdateMentor,
  type Mentor,
  type MentorStatus,
} from "@/lib/api/hooks/use-mentors";
import { useCohorts } from "@/lib/api/hooks/use-cohorts";

const mentorSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  bio: z.string().optional(),
  expertise: z.string().optional(), // comma-separated
  linkedinUrl: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  maxTeams: z.coerce.number().min(1, "Must be at least 1").max(20, "Cannot exceed 20"),
  sessionRateOverride: z.coerce.number().min(0).optional().nullable(),
  status: z.enum(["imported", "active", "inactive"]).optional(),
  cohortId: z.string().min(1, "Please select a cohort"),
});

type MentorFormData = z.infer<typeof mentorSchema>;

interface MentorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mentor?: Mentor | null;
}

export function MentorFormDialog({
  open,
  onOpenChange,
  mentor,
}: MentorFormDialogProps) {
  const isEditing = !!mentor;
  const createMutation = useCreateMentor();
  const updateMutation = useUpdateMentor();
  const { data: cohortsData } = useCohorts({ limit: 100 });
  const cohorts = cohortsData?.data || [];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<MentorFormData>({
    resolver: zodResolver(mentorSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      company: "",
      title: "",
      bio: "",
      expertise: "",
      linkedinUrl: "",
      maxTeams: 3,
      sessionRateOverride: null,
      status: "imported",
      cohortId: "",
    },
  });

  useEffect(() => {
    if (mentor) {
      reset({
        firstName: mentor.firstName,
        lastName: mentor.lastName,
        email: mentor.email,
        phone: mentor.phone || "",
        company: mentor.company || "",
        title: mentor.title || "",
        bio: mentor.bio || "",
        expertise: mentor.expertise?.join(", ") || "",
        linkedinUrl: mentor.linkedinUrl || "",
        maxTeams: mentor.maxTeams,
        sessionRateOverride: mentor.sessionRateOverride ?? null,
        status: mentor.status,
        cohortId: mentor.cohortId,
      });
    } else {
      // For new mentors, default to active cohort if one exists
      const activeCohort = cohorts.find((c) => c.status === "active");
      reset({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        company: "",
        title: "",
        bio: "",
        expertise: "",
        linkedinUrl: "",
        maxTeams: 3,
        sessionRateOverride: null,
        status: "imported",
        cohortId: activeCohort?.id || "",
      });
    }
  }, [mentor, reset, cohorts]);

  const onSubmit = async (data: MentorFormData) => {
    try {
      // Parse expertise from comma-separated string
      const expertiseArray = data.expertise
        ? data.expertise.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      // Handle session rate - convert empty/0 to undefined (use cohort default)
      const sessionRate = data.sessionRateOverride && data.sessionRateOverride > 0 
        ? data.sessionRateOverride 
        : undefined;

      if (isEditing) {
        await updateMutation.mutateAsync({
          id: mentor.id,
          dto: {
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone || undefined,
            company: data.company || undefined,
            title: data.title || undefined,
            bio: data.bio || undefined,
            expertise: expertiseArray.length > 0 ? expertiseArray : undefined,
            linkedinUrl: data.linkedinUrl || undefined,
            maxTeams: data.maxTeams,
            sessionRateOverride: sessionRate,
            status: data.status,
          },
        });
      } else {
        await createMutation.mutateAsync({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone || undefined,
          company: data.company || undefined,
          title: data.title || undefined,
          bio: data.bio || undefined,
          expertise: expertiseArray.length > 0 ? expertiseArray : undefined,
          linkedinUrl: data.linkedinUrl || undefined,
          maxTeams: data.maxTeams,
          sessionRateOverride: sessionRate,
          cohortId: data.cohortId,
        });
      }
      onOpenChange(false);
      reset();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Mentor" : "Add Mentor"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the mentor details below."
              : "Add a new mentor to the system."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="firstName"
                placeholder="John"
                {...register("firstName")}
                disabled={isPending}
              />
              {errors.firstName && (
                <p className="text-sm text-destructive">{errors.firstName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lastName"
                placeholder="Doe"
                {...register("lastName")}
                disabled={isPending}
              />
              {errors.lastName && (
                <p className="text-sm text-destructive">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="john.doe@example.com"
                {...register("email")}
                disabled={isPending || isEditing}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
              {isEditing && (
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed after creation
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Controller
                name="phone"
                control={control}
                render={({ field }) => (
                  <PhoneInput
                    id="phone"
                    value={field.value || ""}
                    onChange={field.onChange}
                    disabled={isPending}
                  />
                )}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                placeholder="Company Name"
                {...register("company")}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Software Engineer"
                {...register("title")}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cohortId">
                Cohort <span className="text-destructive">*</span>
              </Label>
              <Select
                value={watch("cohortId") || ""}
                onValueChange={(value) => setValue("cohortId", value)}
                disabled={isPending || isEditing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select cohort" />
                </SelectTrigger>
                <SelectContent>
                  {cohorts.map((cohort) => (
                    <SelectItem key={cohort.id} value={cohort.id}>
                      {cohort.name}
                      {cohort.status === "active" && (
                        <span className="ml-2 text-xs text-emerald-600">(Active)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.cohortId && (
                <p className="text-sm text-destructive">{errors.cohortId.message}</p>
              )}
              {isEditing && (
                <p className="text-xs text-muted-foreground">
                  Cohort cannot be changed after creation
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxTeams">
                Max Teams <span className="text-destructive">*</span>
              </Label>
              <Input
                id="maxTeams"
                type="number"
                min={1}
                max={20}
                {...register("maxTeams")}
                disabled={isPending}
              />
              {errors.maxTeams && (
                <p className="text-sm text-destructive">{errors.maxTeams.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sessionRateOverride">Session Rate Override ($)</Label>
              <Input
                id="sessionRateOverride"
                type="number"
                min={0}
                step="0.01"
                placeholder="Use cohort default"
                {...register("sessionRateOverride")}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use cohort default rate
              </p>
            </div>
          </div>

          {isEditing && (
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={watch("status") || "imported"}
                onValueChange={(value) => setValue("status", value as MentorStatus)}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="imported">Imported</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="expertise">Expertise</Label>
            <Input
              id="expertise"
              placeholder="Machine Learning, Python, Data Science (comma-separated)"
              {...register("expertise")}
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Enter skills separated by commas
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
            <Input
              id="linkedinUrl"
              type="url"
              placeholder="https://linkedin.com/in/johndoe"
              {...register("linkedinUrl")}
              disabled={isPending}
            />
            {errors.linkedinUrl && (
              <p className="text-sm text-destructive">{errors.linkedinUrl.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              placeholder="Brief bio about the mentor..."
              rows={3}
              {...register("bio")}
              disabled={isPending}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Add Mentor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
