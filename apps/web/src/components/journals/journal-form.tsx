"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Save,
  Trash2,
  Lightbulb,
  AlertTriangle,
  Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  useMyJournalForWeek,
  useCreateJournal,
  useUpdateJournal,
  CreateJournalInput,
  JournalEntry,
} from "@/lib/api/hooks/use-journals";

interface JournalFormProps {
  weekNumber?: number;
  existingEntry?: JournalEntry;
}

interface FormValues {
  weekNumber: number;
  title: string;
  content: string;
  highlights: { value: string }[];
  challenges: { value: string }[];
  nextWeekGoals: { value: string }[];
}

export function JournalForm({ weekNumber, existingEntry }: JournalFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const createJournalMutation = useCreateJournal();
  const updateJournalMutation = useUpdateJournal();

  const isEditing = !!existingEntry;
  const isSaving = createJournalMutation.isPending || updateJournalMutation.isPending;

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      weekNumber: weekNumber || 1,
      title: "",
      content: "",
      highlights: [{ value: "" }],
      challenges: [{ value: "" }],
      nextWeekGoals: [{ value: "" }],
    },
  });

  const {
    fields: highlightFields,
    append: appendHighlight,
    remove: removeHighlight,
  } = useFieldArray({ control, name: "highlights" });

  const {
    fields: challengeFields,
    append: appendChallenge,
    remove: removeChallenge,
  } = useFieldArray({ control, name: "challenges" });

  const {
    fields: goalFields,
    append: appendGoal,
    remove: removeGoal,
  } = useFieldArray({ control, name: "nextWeekGoals" });

  // Initialize form with existing data
  useEffect(() => {
    if (existingEntry) {
      reset({
        weekNumber: existingEntry.weekNumber,
        title: existingEntry.title || "",
        content: existingEntry.content,
        highlights: existingEntry.highlights?.length
          ? existingEntry.highlights.map((v) => ({ value: v }))
          : [{ value: "" }],
        challenges: existingEntry.challenges?.length
          ? existingEntry.challenges.map((v) => ({ value: v }))
          : [{ value: "" }],
        nextWeekGoals: existingEntry.nextWeekGoals?.length
          ? existingEntry.nextWeekGoals.map((v) => ({ value: v }))
          : [{ value: "" }],
      });
    }
  }, [existingEntry, reset]);

  const content = watch("content");
  const wordCount = content
    ? content.trim().split(/\s+/).filter((w) => w.length > 0).length
    : 0;

  const onSubmit = async (data: FormValues) => {
    setError(null);

    const payload: CreateJournalInput = {
      weekNumber: data.weekNumber,
      title: data.title || undefined,
      content: data.content,
      highlights: data.highlights
        .map((h) => h.value.trim())
        .filter((v) => v.length > 0),
      challenges: data.challenges
        .map((c) => c.value.trim())
        .filter((v) => v.length > 0),
      nextWeekGoals: data.nextWeekGoals
        .map((g) => g.value.trim())
        .filter((v) => v.length > 0),
      status: "published",
    };

    try {
      if (isEditing && existingEntry) {
        await updateJournalMutation.mutateAsync({ id: existingEntry.id, data: payload });
      } else {
        await createJournalMutation.mutateAsync(payload);
      }
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      router.push("/app/journals");
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to save journal entry");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {isEditing ? "Edit Journal Entry" : "New Journal Entry"}
          </h1>
          <p className="text-muted-foreground">
            {isEditing
              ? `Editing Week ${existingEntry.weekNumber} entry`
              : "Record your team's weekly progress"}
          </p>
        </div>
      </div>

      {/* Edit time warning */}
      {isEditing && existingEntry.canEdit && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You have {existingEntry.hoursRemainingToEdit} hours remaining to edit this entry.
          </AlertDescription>
        </Alert>
      )}

      {isEditing && !existingEntry.canEdit && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            The edit window for this entry has expired. You can no longer make changes.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Entry Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="weekNumber">Week Number</Label>
                <Input
                  id="weekNumber"
                  type="number"
                  min={1}
                  {...register("weekNumber", { required: true, min: 1 })}
                  disabled={isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title (optional)</Label>
                <Input
                  id="title"
                  placeholder="e.g., Major milestone reached!"
                  {...register("title")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="content">Weekly Summary</Label>
                <span className="text-xs text-muted-foreground">{wordCount} words</span>
              </div>
              <Textarea
                id="content"
                placeholder="Describe what your team accomplished this week, key decisions made, and overall progress..."
                rows={8}
                {...register("content", { required: "Content is required" })}
              />
              {errors.content && (
                <p className="text-sm text-destructive">{errors.content.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Highlights */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Highlights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              What were the key wins or achievements this week?
            </p>
            {highlightFields.map((field, index) => (
              <div key={field.id} className="flex gap-2">
                <Input
                  placeholder="e.g., Completed the MVP prototype"
                  {...register(`highlights.${index}.value`)}
                />
                {highlightFields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeHighlight(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => appendHighlight({ value: "" })}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Highlight
            </Button>
          </CardContent>
        </Card>

        {/* Challenges */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Challenges
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              What obstacles or difficulties did you face?
            </p>
            {challengeFields.map((field, index) => (
              <div key={field.id} className="flex gap-2">
                <Input
                  placeholder="e.g., Integration issues with the API"
                  {...register(`challenges.${index}.value`)}
                />
                {challengeFields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeChallenge(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => appendChallenge({ value: "" })}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Challenge
            </Button>
          </CardContent>
        </Card>

        {/* Next Week Goals */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              Next Week Goals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              What do you plan to accomplish next week?
            </p>
            {goalFields.map((field, index) => (
              <div key={field.id} className="flex gap-2">
                <Input
                  placeholder="e.g., Complete user testing with 10 participants"
                  {...register(`nextWeekGoals.${index}.value`)}
                />
                {goalFields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeGoal(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => appendGoal({ value: "" })}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Goal
            </Button>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSaving || (isEditing && !existingEntry.canEdit)}
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? "Update Entry" : "Publish Entry"}
          </Button>
        </div>
      </form>
    </div>
  );
}
