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
  useRegisterOrganization,
  useUpdateOrganization,
  type Organization,
} from "@/lib/api/hooks/use-organizations";
import { useCohorts } from "@/lib/api/hooks/use-cohorts";

const organizationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  website: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  description: z.string().optional(),
  industry: z.string().optional(),
  country: z.string().optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  cohortId: z.string().optional(),
});

type OrganizationFormData = z.infer<typeof organizationSchema>;

const industries = [
  "Technology",
  "Healthcare",
  "Finance",
  "Education",
  "Manufacturing",
  "Retail",
  "Agriculture",
  "Energy",
  "Transportation",
  "Construction",
  "Media & Entertainment",
  "Hospitality",
  "Non-profit",
  "Government",
  "Other",
];

const countries = [
  "Ghana",
  "Nigeria",
  "Kenya",
  "South Africa",
  "Rwanda",
  "Tanzania",
  "Uganda",
  "Ethiopia",
  "Senegal",
  "Côte d'Ivoire",
  "Cameroon",
  "Egypt",
  "Morocco",
  "Tunisia",
  "Other",
];

interface OrganizationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization?: Organization | null;
}

export function OrganizationFormDialog({
  open,
  onOpenChange,
  organization,
}: OrganizationFormDialogProps) {
  const isEditing = !!organization;
  const createMutation = useRegisterOrganization();
  const updateMutation = useUpdateOrganization();
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
  } = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: "",
      email: "",
      website: "",
      description: "",
      industry: "",
      country: "",
      contactPerson: "",
      contactPhone: "",
      cohortId: "",
    },
  });

  useEffect(() => {
    if (organization) {
      reset({
        name: organization.name,
        email: organization.email,
        website: organization.website || "",
        description: organization.description || "",
        industry: organization.industry || "",
        country: organization.country || "",
        contactPerson: organization.contactPerson || "",
        contactPhone: organization.contactPhone || "",
        cohortId: organization.cohortId || "",
      });
    } else {
      // For new organizations, default to active cohort if one exists
      const activeCohort = cohorts.find((c) => c.status === "active");
      reset({
        name: "",
        email: "",
        website: "",
        description: "",
        industry: "",
        country: "",
        contactPerson: "",
        contactPhone: "",
        cohortId: activeCohort?.id || "",
      });
    }
  }, [organization, reset, cohorts]);

  const onSubmit = async (data: OrganizationFormData) => {
    try {
      // Clean up empty strings
      const cleanedData = {
        ...data,
        website: data.website || undefined,
        description: data.description || undefined,
        industry: data.industry || undefined,
        country: data.country || undefined,
        contactPerson: data.contactPerson || undefined,
        contactPhone: data.contactPhone || undefined,
        cohortId: data.cohortId || undefined,
      };

      if (isEditing) {
        // Remove email from update payload - email cannot be changed
        const { email, ...updateData } = cleanedData;
        await updateMutation.mutateAsync({
          id: organization.id,
          data: updateData,
        });
      } else {
        await createMutation.mutateAsync(cleanedData);
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
            {isEditing ? "Edit Organization" : "Add Organization"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the organization details below."
              : "Add a new organization to the system. They will be created with pending status."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">
                Organization Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Acme Corporation"
                {...register("name")}
                disabled={isPending}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="contact@acme.com"
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contactPerson">Contact Person</Label>
              <Input
                id="contactPerson"
                placeholder="John Doe"
                {...register("contactPerson")}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Controller
                name="contactPhone"
                control={control}
                render={({ field }) => (
                  <PhoneInput
                    value={field.value || ""}
                    onChange={field.onChange}
                    disabled={isPending}
                    placeholder="Enter phone number"
                  />
                )}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Select
                value={watch("industry") || ""}
                onValueChange={(value) => setValue("industry", value)}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {industries.map((industry) => (
                    <SelectItem key={industry} value={industry}>
                      {industry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Select
                value={watch("country") || ""}
                onValueChange={(value) => setValue("country", value)}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((country) => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cohortId">Cohort</Label>
            <Select
              value={watch("cohortId") || ""}
              onValueChange={(value) => setValue("cohortId", value)}
              disabled={isPending}
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://www.acme.com"
              {...register("website")}
              disabled={isPending}
            />
            {errors.website && (
              <p className="text-sm text-destructive">{errors.website.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Brief description of the organization..."
              rows={3}
              {...register("description")}
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
              {isEditing ? "Save Changes" : "Add Organization"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
