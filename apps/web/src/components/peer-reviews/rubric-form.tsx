"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import {
  Plus,
  Trash2,
  GripVertical,
  AlertCircle,
  Loader2,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PeerReviewRubric, PeerReviewRubricCriterion } from "@/lib/api/hooks/use-peer-reviews";

interface RubricFormProps {
  rubric?: PeerReviewRubric;
  cohortId: string;
  stages?: Array<{ id: string; name: string; number: number }>;
  onSave: (data: RubricFormValues) => Promise<void>;
  onCancel: () => void;
}

interface CriterionFormValues {
  id: string;
  name: string;
  description: string;
  weight: number;
  maxScore: number;
  levels: Array<{
    score: number;
    label: string;
    description: string;
  }>;
}

interface RubricFormValues {
  name: string;
  description: string;
  stageId: string;
  criteria: CriterionFormValues[];
}

const defaultLevels = (maxScore: number) => [
  { score: 1, label: "Poor", description: "Does not meet expectations" },
  { score: Math.ceil(maxScore * 0.4), label: "Below Average", description: "Partially meets expectations" },
  { score: Math.ceil(maxScore * 0.6), label: "Average", description: "Meets expectations" },
  { score: Math.ceil(maxScore * 0.8), label: "Good", description: "Exceeds expectations" },
  { score: maxScore, label: "Excellent", description: "Far exceeds expectations" },
];

export function RubricForm({ rubric, cohortId, stages, onSave, onCancel }: RubricFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RubricFormValues>({
    defaultValues: {
      name: rubric?.name || "",
      description: rubric?.description || "",
      stageId: rubric?.stageId || "",
      criteria: rubric?.criteria.map((c) => ({
        ...c,
        levels: c.levels || defaultLevels(c.maxScore),
      })) || [
        {
          id: uuidv4(),
          name: "Innovation",
          description: "Creativity and uniqueness of the solution",
          weight: 25,
          maxScore: 5,
          levels: defaultLevels(5),
        },
        {
          id: uuidv4(),
          name: "Feasibility",
          description: "Technical and practical viability of implementation",
          weight: 25,
          maxScore: 5,
          levels: defaultLevels(5),
        },
        {
          id: uuidv4(),
          name: "Presentation",
          description: "Clarity and quality of documentation/presentation",
          weight: 25,
          maxScore: 5,
          levels: defaultLevels(5),
        },
        {
          id: uuidv4(),
          name: "Impact",
          description: "Potential positive impact and scalability",
          weight: 25,
          maxScore: 5,
          levels: defaultLevels(5),
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "criteria",
  });

  const criteria = watch("criteria");

  // Calculate total weight
  const totalWeight = criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);
  const isWeightValid = totalWeight === 100;

  const handleAddCriterion = () => {
    append({
      id: uuidv4(),
      name: "",
      description: "",
      weight: Math.max(0, 100 - totalWeight),
      maxScore: 5,
      levels: defaultLevels(5),
    });
  };

  const onSubmit = async (data: RubricFormValues) => {
    if (!isWeightValid) {
      setError("Criteria weights must sum to 100%");
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      await onSave(data);
    } catch (err: any) {
      setError(err.message || "Failed to save rubric");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Rubric Details</CardTitle>
          <CardDescription>
            Define the basic information for this peer review rubric
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Rubric Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Stage 1 Peer Review Rubric"
                {...register("name", { required: "Name is required" })}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="stageId">Stage (Optional)</Label>
              <Select
                value={watch("stageId")}
                onValueChange={(value) => setValue("stageId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Apply to all stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Stages (Default)</SelectItem>
                  {stages?.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      Stage {stage.number}: {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the purpose of this rubric..."
              {...register("description")}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Weight Summary */}
      <Card className={isWeightValid ? "border-green-500" : "border-destructive"}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium">Total Weight: </span>
              <span className={`text-lg font-bold ${isWeightValid ? "text-green-600" : "text-destructive"}`}>
                {totalWeight}%
              </span>
            </div>
            {!isWeightValid && (
              <span className="text-sm text-destructive">
                Weights must sum to 100%
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Criteria */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Evaluation Criteria</CardTitle>
              <CardDescription>
                Define the criteria teams will be evaluated on
              </CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={handleAddCriterion}>
              <Plus className="mr-2 h-4 w-4" />
              Add Criterion
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {fields.map((field, index) => (
            <div key={field.id} className="space-y-4">
              {index > 0 && <Separator />}
              <div className="flex items-start gap-4">
                <GripVertical className="h-5 w-5 text-muted-foreground mt-2 cursor-grab" />
                <div className="flex-1 space-y-4">
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="md:col-span-2 space-y-2">
                      <Label>Criterion Name *</Label>
                      <Input
                        placeholder="e.g., Innovation"
                        {...register(`criteria.${index}.name`, { required: true })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Weight (%) *</Label>
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        {...register(`criteria.${index}.weight`, {
                          valueAsNumber: true,
                          required: true,
                          min: 1,
                          max: 100,
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Score *</Label>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        {...register(`criteria.${index}.maxScore`, {
                          valueAsNumber: true,
                          required: true,
                          min: 1,
                          max: 10,
                        })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      placeholder="Describe what this criterion measures..."
                      {...register(`criteria.${index}.description`)}
                      rows={2}
                    />
                  </div>
                </div>
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          {fields.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No criteria defined. Click "Add Criterion" to get started.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving || !isWeightValid}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {rubric ? "Update Rubric" : "Create Rubric"}
        </Button>
      </div>
    </form>
  );
}
