"use client";

import { useState, useRef } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { PhoneInput } from "@/components/ui/phone-input";
import { useVerticals, type Vertical } from "@/lib/api/hooks/use-verticals";
import type { Brief, CreateBriefDto, UpdateBriefDto, SecondaryContact, ScoringAnswers } from "@/lib/api/hooks/use-briefs";
import { uploadFile } from "@/lib/api/client";
import {
  Plus,
  Trash2,
  Loader2,
  X,
  Upload,
  CheckCircle,
  Lightbulb,
  Users,
  Database,
  HelpCircle,
  UserPlus,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Scoring question options (from onboard-organization types)
const Q1_OPTIONS = [
  { value: "routine", label: "It's routine work—the same steps every time" },
  { value: "judgement", label: "It requires judgement—weighing options and making calls" },
  { value: "sense_making", label: "It's sense-making—spotting patterns in messy information" },
  { value: "no_system", label: "There's no system in place yet" },
  { value: "new_capability", label: "It's something we can't do at all today" },
] as const;

const Q2_OPTIONS = [
  { value: "good_records", label: "We have good digital records" },
  { value: "partial", label: "We have partial or paper-based records" },
  { value: "very_little", label: "We have very little data" },
] as const;

const Q3_OPTIONS = [
  { value: "straightforward", label: "Straightforward—clear rules exist" },
  { value: "mixed", label: "Mixed—some rules, some grey areas" },
  { value: "hard", label: "Hard—often unclear or context-dependent" },
] as const;

const Q4_OPTIONS = [
  { value: "yes", label: "Yes, we can tell good from bad outcomes" },
  { value: "no_exact", label: "Not exactly—quality is subjective" },
] as const;

const Q5_OPTIONS = [
  { value: "clear", label: "Clear and measurable" },
  { value: "vague", label: "Vague or hard to pin down" },
] as const;

const Q6_OPTIONS = [
  { value: "very_often", label: "Very often (daily or weekly)" },
  { value: "now_and_then", label: "Now and then (monthly or less)" },
] as const;

const Q7_OPTIONS = [
  { value: "convenient", label: "Convenient—saves time or effort" },
  { value: "meaningful", label: "Meaningful—noticeably improves quality of life" },
  { value: "transformative", label: "Transformative—life-changing impact" },
] as const;

const Q8_OPTIONS = [
  { value: "local", label: "Local—a community or district" },
  { value: "thousands", label: "Thousands—a city or region" },
  { value: "national", label: "National or beyond" },
] as const;

// Helper to strip HTML for character counting
const stripHtml = (html: string) => {
  if (typeof window === "undefined") return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
};

const secondaryContactSchema = z.object({
  name: z.string().max(200).optional(),
  role: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
});

const scoringAnswersSchema = z.object({
  q1: z.string().optional(),
  q1_text: z.string().optional(),
  q2: z.string().optional(),
  q2_text: z.string().optional(),
  q3: z.string().optional(),
  q3_text: z.string().optional(),
  q4: z.string().optional(),
  q4_text: z.string().optional(),
  q5: z.string().optional(),
  q5_text: z.string().optional(),
  q6: z.string().optional(),
  q6_text: z.string().optional(),
  q7: z.string().optional(),
  q7_text: z.string().optional(),
  q8: z.string().optional(),
  q8_text: z.string().optional(),
});

const briefFormSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(200),
  description: z.string().min(50, "Description must be at least 50 characters").max(5000),
  problemStatement: z.string().min(50, "Problem statement must be at least 50 characters").max(5000),
  expectedOutcomes: z.string().min(50, "Expected outcomes must be at least 50 characters").max(3000),
  verticalId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  resources: z.array(z.object({
    name: z.string().min(1, "Resource name is required"),
    url: z.string(),
    type: z.string(),
  })).optional(),
  maxTeams: z.coerce.number().min(1).max(100).optional(),
  // New fields from onboard-organization form
  whatChanges: z.string().max(5000).optional(),
  affectedCount: z.string().max(100).optional(),
  dataDescription: z.string().max(5000).optional(),
  dataAccess: z.string().max(1000).optional(),
  secondaryContact: secondaryContactSchema.optional(),
  scoringAnswers: scoringAnswersSchema.optional(),
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

interface QuestionConfig {
  id: keyof ScoringAnswers;
  question: string;
  helpText?: string;
  options: readonly { value: string; label: string }[];
}

const FIT_QUESTIONS: QuestionConfig[] = [
  {
    id: "q1",
    question: "What kind of work is this opportunity about?",
    helpText: "Think about how decisions are made today in this area.",
    options: Q1_OPTIONS,
  },
  {
    id: "q2",
    question: "What data exists related to this opportunity?",
    helpText: "AI solutions need data to learn from.",
    options: Q2_OPTIONS,
  },
  {
    id: "q3",
    question: "How clear are the rules or criteria for making decisions?",
    options: Q3_OPTIONS,
  },
  {
    id: "q4",
    question: "Do you know what 'good' looks like?",
    helpText: "Can you tell a good outcome from a bad one?",
    options: Q4_OPTIONS,
  },
  {
    id: "q5",
    question: "How clear is the desired outcome?",
    options: Q5_OPTIONS,
  },
  {
    id: "q6",
    question: "How often is this task performed?",
    options: Q6_OPTIONS,
  },
];

const IMPACT_QUESTIONS: QuestionConfig[] = [
  {
    id: "q7",
    question: "How deep would the impact be for each person affected?",
    helpText: "Think about how much it would change their experience.",
    options: Q7_OPTIONS,
  },
  {
    id: "q8",
    question: "How many people would be affected?",
    options: Q8_OPTIONS,
  },
];

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
  // Track upload status per resource index
  const [uploadingResources, setUploadingResources] = useState<Record<number, boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});
  
  // Initialize uploadedUrls with existing resource URLs (for editing)
  const initialUrls: Record<number, string> = {};
  brief?.resources?.forEach((r, i) => {
    if (r.url) initialUrls[i] = r.url;
  });
  
  const [uploadedUrls, setUploadedUrls] = useState<Record<number, string>>(initialUrls);
  // Use a ref to persist URLs across re-renders (backup)
  const uploadedUrlsRef = useRef<Record<number, string>>(initialUrls);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Use provided verticals if available, otherwise fetch them (for staff portal)
  const { data: fetchedVerticals } = useVerticals(propVerticals ? undefined : cohortId);
  const verticals = propVerticals || fetchedVerticals;
  
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    getValues,
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
      // New fields
      whatChanges: brief?.whatChanges || "",
      affectedCount: brief?.affectedCount || "",
      dataDescription: brief?.dataDescription || "",
      dataAccess: brief?.dataAccess || "",
      secondaryContact: brief?.secondaryContact || {
        name: "",
        role: "",
        email: "",
        phone: "",
      },
      scoringAnswers: brief?.scoringAnswers || {
        q1: "",
        q2: "",
        q3: "",
        q4: "",
        q5: "",
        q6: "",
        q7: "",
        q8: "",
      },
    },
  });

  const { fields: resourceFields, append: appendResource, remove: removeResource } = useFieldArray({
    control,
    name: "resources",
  });

  const tags = watch("tags") || [];
  const resources = watch("resources") || [];
  const selectedVerticalId = watch("verticalId");
  const scoringAnswers = watch("scoringAnswers") || {};

  const handleFileUpload = async (index: number, file: File, resourceType: string) => {
    setUploadingResources(prev => ({ ...prev, [index]: true }));
    setUploadProgress(prev => ({ ...prev, [index]: 0 }));

    try {
      // Determine the upload endpoint based on resource type
      let endpoint = "/briefs/upload-resource";
      if (resourceType === "image") {
        endpoint = "/briefs/upload-resource-image";
      } else if (resourceType === "video") {
        endpoint = "/briefs/upload-resource-video";
      }

      const result = await uploadFile(
        endpoint,
        file,
        (progress) => setUploadProgress(prev => ({ ...prev, [index]: progress }))
      );

      if (result) {
        const { url, name } = result as unknown as { url: string; name: string };
        
        // Update the URL field directly
        setValue(`resources.${index}.url`, url, { shouldDirty: true });
        
        // If name is empty, use the uploaded file name
        const currentName = getValues(`resources.${index}.name`);
        if (!currentName) {
          setValue(`resources.${index}.name`, name, { shouldDirty: true });
        }
        
        // Track uploaded URL for display and submit
        setUploadedUrls(prev => ({ ...prev, [index]: url }));
        uploadedUrlsRef.current[index] = url;
      }
    } catch (error) {
      console.error("Failed to upload resource:", error);
    } finally {
      setUploadingResources(prev => ({ ...prev, [index]: false }));
      setUploadProgress(prev => ({ ...prev, [index]: 0 }));
    }
  };

  // Get file accept types and upload label based on resource type
  const getFileConfig = (type: string) => {
    switch (type) {
      case "document":
        return {
          accept: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv",
          label: "Upload document (PDF, DOC, XLS, PPT, etc.)",
        };
      case "image":
        return {
          accept: ".png,.jpg,.jpeg",
          label: "Upload image (PNG, JPG, JPEG)",
        };
      case "video":
        return {
          accept: ".mp4",
          label: "Upload video (MP4)",
        };
      default:
        return null;
    }
  };

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

  const updateScoringAnswer = (questionId: keyof ScoringAnswers, value: string, label: string) => {
    const textKey = `${questionId}_text` as keyof ScoringAnswers;
    setValue("scoringAnswers", {
      ...scoringAnswers,
      [questionId]: value,
      [textKey]: label,
    });
  };

  const handleFormSubmit = (data: BriefFormData) => {
    // Use ref for reliable URL access (state might be stale)
    const urlsToUse = uploadedUrlsRef.current;
    
    // Merge uploadedUrls into resources (for file uploads that may not have updated form state)
    const resourcesWithUrls = data.resources?.map((resource, index) => ({
      ...resource,
      url: resource.url || urlsToUse[index] || "",
    })).filter(r => r.name && r.url); // Filter out incomplete resources

    // Clean up secondaryContact - only include if at least one field has a value
    const hasSecondaryContact = data.secondaryContact && (
      data.secondaryContact.name?.trim() ||
      data.secondaryContact.role?.trim() ||
      data.secondaryContact.email?.trim() ||
      data.secondaryContact.phone?.trim()
    );

    // Clean up verticalId - don't send empty string
    const cleanedData = {
      ...data,
      verticalId: data.verticalId || undefined,
      resources: resourcesWithUrls,
      secondaryContact: hasSecondaryContact ? {
        name: data.secondaryContact?.name?.trim() || undefined,
        role: data.secondaryContact?.role?.trim() || undefined,
        email: data.secondaryContact?.email?.trim() || undefined,
        phone: data.secondaryContact?.phone?.trim() || undefined,
      } : undefined,
    };
    
    if (brief) {
      onSubmit(cleanedData as UpdateBriefDto);
    } else {
      onSubmit({
        ...cleanedData,
        cohortId,
        organizationId,
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
              {stripHtml(watch("description") || "").length}/5000 characters (min 50)
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
              {stripHtml(watch("problemStatement") || "").length}/5000 characters (min 50)
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
              {stripHtml(watch("expectedOutcomes") || "").length}/3000 characters (min 50)
            </p>
            {errors.expectedOutcomes && (
              <p className="text-sm text-destructive">{errors.expectedOutcomes.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Expected Impact */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-emerald-600" />
          <div>
            <h3 className="text-lg font-medium">Expected Impact</h3>
            <p className="text-sm text-muted-foreground">
              Describe the potential impact of solving this challenge.
            </p>
          </div>
        </div>
        <Separator />

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="whatChanges">If this were addressed, what would change?</Label>
            <Textarea
              id="whatChanges"
              placeholder="Describe the ideal outcome if AI could help solve this"
              rows={3}
              {...register("whatChanges")}
            />
            {errors.whatChanges && (
              <p className="text-sm text-destructive">{errors.whatChanges.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="affectedCount">Roughly how many people would be affected?</Label>
            <Input
              id="affectedCount"
              type="text"
              placeholder="e.g., 5000"
              {...register("affectedCount")}
            />
            {errors.affectedCount && (
              <p className="text-sm text-destructive">{errors.affectedCount.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Data Availability */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-rose-600" />
          <div>
            <h3 className="text-lg font-medium">Data Availability</h3>
            <p className="text-sm text-muted-foreground">
              Information about the data available for this challenge.
            </p>
          </div>
        </div>
        <Separator />

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dataDescription">What records and data exist related to this?</Label>
            <Textarea
              id="dataDescription"
              placeholder="Describe the data you have: spreadsheets, databases, paper records, etc."
              rows={3}
              {...register("dataDescription")}
            />
            {errors.dataDescription && (
              <p className="text-sm text-destructive">{errors.dataDescription.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataAccess">Can this data be shared with a project team?</Label>
            <Input
              id="dataAccess"
              placeholder="e.g., Yes with anonymisation, or No due to policy restrictions"
              {...register("dataAccess")}
            />
            {errors.dataAccess && (
              <p className="text-sm text-destructive">{errors.dataAccess.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Secondary Contact */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-blue-600" />
          <div>
            <h3 className="text-lg font-medium">Secondary Contact (Optional)</h3>
            <p className="text-sm text-muted-foreground">
              Add another person who can speak to this opportunity.
            </p>
          </div>
        </div>
        <Separator />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="secondaryContact.name">Name</Label>
            <Input
              id="secondaryContact.name"
              placeholder="Contact person name"
              {...register("secondaryContact.name")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="secondaryContact.role">Role</Label>
            <Input
              id="secondaryContact.role"
              placeholder="Their role or title"
              {...register("secondaryContact.role")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="secondaryContact.email">Email</Label>
            <Input
              id="secondaryContact.email"
              type="email"
              placeholder="email@example.com"
              {...register("secondaryContact.email")}
            />
            {errors.secondaryContact?.email && (
              <p className="text-sm text-destructive">{errors.secondaryContact.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="secondaryContact.phone">Phone</Label>
            <Controller
              name="secondaryContact.phone"
              control={control}
              render={({ field }) => (
                <PhoneInput
                  id="secondaryContact.phone"
                  value={field.value || ""}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
        </div>
      </div>

      {/* AI-Challenge Fit Assessment */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-purple-600" />
          <div>
            <h3 className="text-lg font-medium">AI-Challenge Fit Assessment (Optional)</h3>
            <p className="text-sm text-muted-foreground">
              Answer these questions to assess how well this opportunity fits the AI Challenge criteria.
            </p>
          </div>
        </div>
        <Separator />

        {/* Fit Questions */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground border-b pb-2">
            Fit Questions (determines AI-Challenge suitability)
          </h4>

          {FIT_QUESTIONS.map((q, index) => (
            <QuestionCard
              key={q.id}
              number={index + 1}
              question={q.question}
              helpText={q.helpText}
              options={q.options}
              value={scoringAnswers[q.id] || ""}
              onChange={(value, label) => updateScoringAnswer(q.id, value, label)}
            />
          ))}
        </div>

        {/* Impact Questions */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground border-b pb-2">
            Impact Questions (measures potential reach)
          </h4>

          {IMPACT_QUESTIONS.map((q, index) => (
            <QuestionCard
              key={q.id}
              number={index + 7}
              question={q.question}
              helpText={q.helpText}
              options={q.options}
              value={scoringAnswers[q.id] || ""}
              onChange={(value, label) => updateScoringAnswer(q.id, value, label)}
            />
          ))}
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
            {resourceFields.map((field, index) => {
              const resourceType = resources[index]?.type || 'link';
              const isUploading = uploadingResources[index];
              const progress = uploadProgress[index] || 0;
              const fileConfig = getFileConfig(resourceType);
              const isFileUpload = fileConfig !== null;
              // Check both uploadedUrls (for newly uploaded) and resources (for existing)
              const uploadedUrl = uploadedUrls[index] || resources[index]?.url;
              const hasUploadedFile = isFileUpload && uploadedUrl;

              return (
                <div
                  key={field.id}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <Controller
                    name={`resources.${index}.type`}
                    control={control}
                    render={({ field: typeField }) => (
                      <select
                        className="h-10 w-24 rounded-md border border-input bg-background px-2 text-sm"
                        value={typeField.value}
                        onChange={(e) => {
                          typeField.onChange(e.target.value);
                          // Clear URL when switching types
                          setValue(`resources.${index}.url`, "");
                          setUploadedUrls(prev => {
                            const newUrls = { ...prev };
                            delete newUrls[index];
                            return newUrls;
                          });
                          delete uploadedUrlsRef.current[index];
                        }}
                      >
                        <option value="link">Link</option>
                        <option value="document">Document</option>
                        <option value="video">Video</option>
                        <option value="image">Image</option>
                      </select>
                    )}
                  />
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Resource name"
                      {...register(`resources.${index}.name`)}
                    />
                    {isFileUpload && fileConfig ? (
                      <div className="space-y-2">
                        <input
                          type="file"
                          ref={(el) => { fileInputRefs.current[index] = el; }}
                          className="hidden"
                          accept={fileConfig.accept}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleFileUpload(index, file, resourceType);
                            }
                          }}
                        />
                        {hasUploadedFile ? (
                          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 p-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="flex-1 text-sm text-green-700 dark:text-green-400 truncate">
                              File uploaded
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => fileInputRefs.current[index]?.click()}
                              disabled={isUploading}
                            >
                              Replace
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-start gap-2"
                            onClick={() => fileInputRefs.current[index]?.click()}
                            disabled={isUploading}
                          >
                            {isUploading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Uploading... {progress}%
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4" />
                                {fileConfig.label}
                              </>
                            )}
                          </Button>
                        )}
                        <Controller
                          name={`resources.${index}.url`}
                          control={control}
                          render={({ field: urlField }) => (
                            <input type="hidden" value={urlField.value || ""} onChange={urlField.onChange} />
                          )}
                        />
                      </div>
                    ) : (
                      <Input
                        placeholder="https://..."
                        {...register(`resources.${index}.url`)}
                      />
                    )}
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
              );
            })}
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

interface QuestionCardProps {
  number: number;
  question: string;
  helpText?: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string, label: string) => void;
}

function QuestionCard({
  number,
  question,
  helpText,
  options,
  value,
  onChange,
}: QuestionCardProps) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3">
        <div className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
            {number}
          </span>
          <div>
            <p className="font-medium">{question}</p>
            {helpText && (
              <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1">
                <HelpCircle className="h-3 w-3" />
                {helpText}
              </p>
            )}
          </div>
        </div>
      </div>

      <RadioGroup
        value={value}
        onValueChange={(v) => {
          const option = options.find((o) => o.value === v);
          onChange(v, option?.label || "");
        }}
        className="space-y-2 ml-9"
      >
        {options.map((option) => (
          <div key={option.value} className="flex items-center space-x-3">
            <RadioGroupItem value={option.value} id={`q${number}-${option.value}`} />
            <Label
              htmlFor={`q${number}-${option.value}`}
              className="font-normal cursor-pointer"
            >
              {option.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
