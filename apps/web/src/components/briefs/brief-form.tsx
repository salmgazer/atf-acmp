"use client";

import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useVerticals, type Vertical } from "@/lib/api/hooks/use-verticals";
import type { Brief, CreateBriefDto, UpdateBriefDto } from "@/lib/api/hooks/use-briefs";
import {
  Plus,
  Trash2,
  Loader2,
  X,
  Link as LinkIcon,
  FileText,
  Video,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Helper to strip HTML for character counting
const stripHtml = (html: string) => {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
};

const briefFormSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(200),
  description: z.string().min(50, "Description must be at least 50 characters").max(5000),
  problemStatement: z.string().min(50, "Problem statement must be at least 50 characters").max(5000),
  expectedOutcomes: z.string().min(50, "Expected outcomes must be at least 50 characters").max(3000),
  verticalId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  resources: z.array(z.object({
    name: z.string().min(1, "Resource name is required"),
    url: z.string().url("Please enter a valid URL"),
    type: z.string(),
  })).optional(),
  maxTeams: z.coerce.number().min(1).max(100).optional(),
});

type BriefFormData = z.infer<typeof briefFormSchema>;

interface BriefFormProps {
  brief?: Brief;
  cohortId: string;
  organizationId: string;
  onSubmit: (data: CreateBriefDto | UpdateBriefDto) => void;
  onCancel: () => void;
  isLoading?: boolean;
  verticals?: Vertical[];
  /** If true, shows brief count in vertical dropdown (for staff). Default: false */
  showVerticalStats?: boolean;
}

export function BriefForm({
  brief,
  cohortId,
  organizationId,
  onSubmit,
  onCancel,
  isLoading,
  verticals: propVerticals,
  showVerticalStats = false,
}: BriefFormProps) {
  // Use provided verticals if available, otherwise fetch them (for staff portal)
  const { data: fetchedVerticals } = useVerticals(propVerticals ? undefined : cohortId);
  const verticals = propVerticals || fetchedVerticals;
  
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BriefFormData>({
    resolver: zodResolver(briefFormSchema),
    defaultValues: {
      title: brief?.title || "",
      description: brief?.description || "",
      problemStatement: brief?.problemStatement || "",
      expectedOutcomes: brief?.expectedOutcomes || "",
      verticalId: brief?.verticalId || "",
      tags: brief?.tags || [],
      resources: brief?.resources || [],
      maxTeams: brief?.maxTeams || 25,
    },
  });

  const { fields: resourceFields, append: appendResource, remove: removeResource } = useFieldArray({
    control,
    name: "resources",
  });

  const tags = watch("tags") || [];
  const selectedVerticalId = watch("verticalId");

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const input = e.currentTarget;
      const value = input.value.trim();
      if (value && !tags.includes(value)) {
        setValue("tags", [...tags, value]);
        input.value = "";
      }
    }
  };

  const handleRemoveTag = (tag: string) => {
    setValue("tags", tags.filter((t) => t !== tag));
  };

  const handleFormSubmit = (data: BriefFormData) => {
    if (brief) {
      onSubmit(data as UpdateBriefDto);
    } else {
      onSubmit({
        ...data,
        cohortId,
        organizationId,
        verticalId: data.verticalId || undefined,
      } as CreateBriefDto);
    }
  };

  const selectedVertical = verticals?.find((v) => v.id === selectedVerticalId);

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-8">
      {/* Basic Information */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Basic Information</h3>
          <p className="text-sm text-muted-foreground">
            Provide a compelling title and description for your brief.
          </p>
        </div>
        <Separator />

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Brief Title *</Label>
            <Input
              id="title"
              placeholder="e.g., AI-Powered Customer Service Solution"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="verticalId">Vertical / Sector</Label>
              <select
                id="verticalId"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("verticalId")}
              >
                <option value="">Select a vertical</option>
                {verticals?.filter(v => v.isActive).map((vertical) => (
                  <option 
                    key={vertical.id} 
                    value={vertical.id}
                    disabled={showVerticalStats && vertical.briefCount >= vertical.briefCap}
                  >
                    {showVerticalStats 
                      ? `${vertical.name} (${vertical.briefCount}/${vertical.briefCap} briefs)`
                      : vertical.name
                    }
                  </option>
                ))}
              </select>
              {showVerticalStats && selectedVertical && selectedVertical.briefCount >= selectedVertical.briefCap && (
                <p className="text-sm text-destructive">This vertical has reached capacity</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxTeams">Max Teams</Label>
              <Input
                id="maxTeams"
                type="number"
                min={1}
                max={100}
                {...register("maxTeams")}
              />
              <p className="text-xs text-muted-foreground">Maximum teams that can work on this brief</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <RichTextEditor
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Provide a clear overview of the challenge..."
                  minHeight="150px"
                />
              )}
            />
            <p className="text-xs text-muted-foreground">
              {typeof window !== "undefined" ? stripHtml(watch("description") || "").length : 0}/5000 characters (min 50)
            </p>
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Challenge Details */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Challenge Details</h3>
          <p className="text-sm text-muted-foreground">
            Define the problem and what success looks like.
          </p>
        </div>
        <Separator />

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="problemStatement">Problem Statement *</Label>
            <Controller
              name="problemStatement"
              control={control}
              render={({ field }) => (
                <RichTextEditor
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Describe the specific problem or challenge that needs to be solved. Be as detailed as possible about the current pain points..."
                  minHeight="200px"
                />
              )}
            />
            <p className="text-xs text-muted-foreground">
              {typeof window !== "undefined" ? stripHtml(watch("problemStatement") || "").length : 0}/5000 characters (min 50)
            </p>
            {errors.problemStatement && (
              <p className="text-sm text-destructive">{errors.problemStatement.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="expectedOutcomes">Expected Outcomes *</Label>
            <Controller
              name="expectedOutcomes"
              control={control}
              render={({ field }) => (
                <RichTextEditor
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="What does a successful solution look like? What specific outcomes or deliverables do you expect..."
                  minHeight="150px"
                />
              )}
            />
            <p className="text-xs text-muted-foreground">
              {typeof window !== "undefined" ? stripHtml(watch("expectedOutcomes") || "").length : 0}/3000 characters (min 50)
            </p>
            {errors.expectedOutcomes && (
              <p className="text-sm text-destructive">{errors.expectedOutcomes.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Tags</h3>
          <p className="text-sm text-muted-foreground">
            Add keywords to help teams find your brief.
          </p>
        </div>
        <Separator />

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <Input
            placeholder="Type a tag and press Enter"
            onKeyDown={handleAddTag}
          />
        </div>
      </div>

      {/* Resources */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Resources (Optional)</h3>
            <p className="text-sm text-muted-foreground">
              Add helpful links, documents, or references for teams.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => appendResource({ name: "", url: "", type: "link" })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Resource
          </Button>
        </div>
        <Separator />

        {resourceFields.length > 0 && (
          <div className="space-y-3">
            {resourceFields.map((field, index) => (
              <div
                key={field.id}
                className="flex items-start gap-3 rounded-lg border p-3"
              >
                <select
                  className="h-10 w-24 rounded-md border border-input bg-background px-2 text-sm"
                  {...register(`resources.${index}.type`)}
                >
                  <option value="link">Link</option>
                  <option value="document">Document</option>
                  <option value="video">Video</option>
                  <option value="image">Image</option>
                </select>
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder="Resource name"
                    {...register(`resources.${index}.name`)}
                  />
                  <Input
                    placeholder="https://..."
                    {...register(`resources.${index}.url`)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeResource(index)}
                  className="shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {resourceFields.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No resources added yet. Resources can help teams understand your challenge better.
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
          {brief ? "Save Changes" : "Create Brief"}
        </Button>
      </div>
    </form>
  );
}
