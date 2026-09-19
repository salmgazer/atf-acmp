"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, X, Loader2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Cohort, CreateCohortDto } from "@/lib/api/hooks/use-cohorts";
import { useState } from "react";

// Popular African countries for the challenge
const AFRICAN_COUNTRIES = [
  "Nigeria",
  "Kenya",
  "South Africa",
  "Ghana",
  "Egypt",
  "Rwanda",
  "Ethiopia",
  "Tanzania",
  "Uganda",
  "Morocco",
  "Senegal",
  "Cameroon",
  "Cote d'Ivoire",
  "Zimbabwe",
  "Zambia",
  "Botswana",
  "Mauritius",
  "Tunisia",
  "Algeria",
  "Namibia",
];

const cohortFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  description: z.string().max(500, "Description is too long").optional(),
  teamSizeMin: z.coerce.number().min(1).max(10),
  teamSizeMax: z.coerce.number().min(1).max(15),
  briefCap: z.coerce.number().min(1).max(500),
  maxTeamsPerBrief: z.coerce.number().min(1).max(100),
  sessionRate: z.coerce.number().min(0).optional(),
  countries: z.array(z.string()).min(1, "Select at least one country"),
  deadlines: z.object({
    registrationEnd: z.string().optional(),
    teamFormationEnd: z.string().optional(),
    briefSelectionEnd: z.string().optional(),
  }),
  rubric: z.object({
    criteria: z.array(
      z.object({
        name: z.string().min(1, "Criterion name is required"),
        weight: z.coerce.number().min(0).max(100),
        description: z.string().optional(),
      })
    ),
  }).optional(),
}).refine((data) => data.teamSizeMin <= data.teamSizeMax, {
  message: "Minimum team size must be less than or equal to maximum",
  path: ["teamSizeMax"],
});

type CohortFormData = z.infer<typeof cohortFormSchema>;

interface CohortFormProps {
  cohort?: Cohort;
  onSubmit: (data: CreateCohortDto) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function CohortForm({ cohort, onSubmit, onCancel, isLoading }: CohortFormProps) {
  const [countryInput, setCountryInput] = useState("");

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CohortFormData>({
    resolver: zodResolver(cohortFormSchema),
    defaultValues: {
      name: cohort?.name || "",
      description: cohort?.description || "",
      teamSizeMin: cohort?.teamSizeMin || 3,
      teamSizeMax: cohort?.teamSizeMax || 5,
      briefCap: cohort?.briefCap || 50,
      maxTeamsPerBrief: cohort?.maxTeamsPerBrief || 25,
      sessionRate: cohort?.sessionRate || 0,
      countries: cohort?.countries || [],
      deadlines: {
        registrationEnd: cohort?.deadlines?.registrationEnd?.split("T")[0] || "",
        teamFormationEnd: cohort?.deadlines?.teamFormationEnd?.split("T")[0] || "",
        briefSelectionEnd: cohort?.deadlines?.briefSelectionEnd?.split("T")[0] || "",
      },
      rubric: cohort?.rubric || { criteria: [] },
    },
  });

  const { fields: criteriaFields, append: appendCriteria, remove: removeCriteria } = useFieldArray({
    control,
    name: "rubric.criteria",
  });

  const selectedCountries = watch("countries");

  const handleAddCountry = (country: string) => {
    if (country && !selectedCountries.includes(country)) {
      setValue("countries", [...selectedCountries, country]);
    }
    setCountryInput("");
  };

  const handleRemoveCountry = (country: string) => {
    setValue("countries", selectedCountries.filter((c) => c !== country));
  };

  const handleFormSubmit = (data: CohortFormData) => {
    // Convert date strings to ISO format
    const formattedDeadlines: Record<string, string> = {};
    Object.entries(data.deadlines).forEach(([key, value]) => {
      if (value) {
        formattedDeadlines[key] = new Date(value).toISOString();
      }
    });

    onSubmit({
      ...data,
      deadlines: formattedDeadlines as any,
    });
  };

  const totalWeight = criteriaFields.reduce((sum, _, index) => {
    const weight = watch(`rubric.criteria.${index}.weight`) || 0;
    return sum + Number(weight);
  }, 0);

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-8">
      {/* Basic Information */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Basic Information</h3>
          <p className="text-sm text-muted-foreground">
            General information about the cohort
          </p>
        </div>
        <Separator />
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Cohort Name *</Label>
            <Input
              id="name"
              placeholder="e.g., AI Challenge 2026"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Brief description of this cohort..."
              rows={3}
              {...register("description")}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Team Configuration */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Team Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Set team size limits and capacity settings
          </p>
        </div>
        <Separator />
        
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="teamSizeMin">Min Team Size</Label>
            <Input
              id="teamSizeMin"
              type="number"
              min={1}
              max={10}
              {...register("teamSizeMin")}
            />
            {errors.teamSizeMin && (
              <p className="text-sm text-destructive">{errors.teamSizeMin.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="teamSizeMax">Max Team Size</Label>
            <Input
              id="teamSizeMax"
              type="number"
              min={1}
              max={15}
              {...register("teamSizeMax")}
            />
            {errors.teamSizeMax && (
              <p className="text-sm text-destructive">{errors.teamSizeMax.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="briefCap">Brief Cap</Label>
            <Input
              id="briefCap"
              type="number"
              min={1}
              {...register("briefCap")}
            />
            <p className="text-xs text-muted-foreground">Max briefs for this cohort</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxTeamsPerBrief">Teams per Brief</Label>
            <Input
              id="maxTeamsPerBrief"
              type="number"
              min={1}
              {...register("maxTeamsPerBrief")}
            />
            <p className="text-xs text-muted-foreground">Max teams assigned to each brief</p>
          </div>
        </div>

        {/* Mentor Session Rate */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="sessionRate">Mentor Session Rate ($)</Label>
            <Input
              id="sessionRate"
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              {...register("sessionRate")}
            />
            <p className="text-xs text-muted-foreground">Default payment per mentor session</p>
          </div>
        </div>
      </div>

      {/* Countries */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Participating Countries</h3>
          <p className="text-sm text-muted-foreground">
            Select countries that can participate in this cohort
          </p>
        </div>
        <Separator />

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {selectedCountries.map((country) => (
              <Badge key={country} variant="secondary" className="gap-1">
                {country}
                <button
                  type="button"
                  onClick={() => handleRemoveCountry(country)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {selectedCountries.length === 0 && (
              <p className="text-sm text-muted-foreground">No countries selected</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {AFRICAN_COUNTRIES.filter((c) => !selectedCountries.includes(c)).map(
              (country) => (
                <Button
                  key={country}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddCountry(country)}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  {country}
                </Button>
              )
            )}
          </div>

          {errors.countries && (
            <p className="text-sm text-destructive">{errors.countries.message}</p>
          )}
        </div>
      </div>

      {/* Deadlines */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Deadlines</h3>
          <p className="text-sm text-muted-foreground">
            Set registration and team formation deadlines. Stage deadlines are configured separately.
          </p>
        </div>
        <Separator />

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="registrationEnd">Registration End</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="registrationEnd"
                type="date"
                className="pl-10"
                {...register("deadlines.registrationEnd")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="teamFormationEnd">Team Formation End</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="teamFormationEnd"
                type="date"
                className="pl-10"
                {...register("deadlines.teamFormationEnd")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="briefSelectionEnd">Brief Selection End</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="briefSelectionEnd"
                type="date"
                className="pl-10"
                {...register("deadlines.briefSelectionEnd")}
              />
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
          💡 Stage deadlines (Stage 1, Stage 2, Stage 3, Demo Day) are managed in the Stages section after creating the cohort.
        </p>
      </div>

      {/* Rubric Criteria */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Evaluation Rubric</h3>
            <p className="text-sm text-muted-foreground">
              Define criteria for evaluating submissions (optional)
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => appendCriteria({ name: "", weight: 0, description: "" })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Criterion
          </Button>
        </div>
        <Separator />

        {criteriaFields.length > 0 && (
          <div className="space-y-4">
            {criteriaFields.map((field, index) => (
              <div
                key={field.id}
                className="flex items-start gap-4 rounded-lg border p-4"
              >
                <div className="flex-1 grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Criterion Name</Label>
                    <Input
                      placeholder="e.g., Innovation"
                      {...register(`rubric.criteria.${index}.name`)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Weight (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      {...register(`rubric.criteria.${index}.weight`)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      placeholder="Brief description"
                      {...register(`rubric.criteria.${index}.description`)}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeCriteria(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <div
              className={cn(
                "text-sm",
                totalWeight === 100
                  ? "text-green-600"
                  : totalWeight > 100
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
            >
              Total weight: {totalWeight}%{" "}
              {totalWeight !== 100 && "(should equal 100%)"}
            </div>
          </div>
        )}

        {criteriaFields.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No criteria defined yet. Add criteria to create an evaluation rubric.
          </p>
        )}
      </div>

      {/* Form Actions */}
      <Separator />
      <div className="flex items-center justify-end gap-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {cohort ? "Update Cohort" : "Create Cohort"}
        </Button>
      </div>
    </form>
  );
}
