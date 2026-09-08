"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Stage,
  CreateStageInput,
  UpdateStageInput,
  useCreateStage,
  useUpdateStage,
} from "@/lib/api/hooks/use-stages";

interface StageFormDialogProps {
  cohortId: string;
  stage?: Stage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nextNumber: number;
}

interface FormValues {
  name: string;
  number: number;
  description: string;
  instructions: string;
  type: "document" | "video" | "url" | "text" | "mixed";
  startDate: string;
  deadline: string;
  weightPercentage: number;
  allowLateSubmissions: boolean;
  latePenaltyPercentage: number;
  documentRequired: boolean;
  documentMaxSize: number;
  videoRequired: boolean;
  videoMaxSize: number;
  githubRequired: boolean;
  urlRequired: boolean;
  urlLabel: string;
  textRequired: boolean;
  textLabel: string;
  textMinLength: number;
  textMaxLength: number;
  isActive: boolean;
}

export function StageFormDialog({
  cohortId,
  stage,
  open,
  onOpenChange,
  nextNumber,
}: StageFormDialogProps) {
  const isEditing = !!stage;
  const queryClient = useQueryClient();
  const createMutation = useCreateStage();
  const updateMutation = useUpdateStage();
  const [activeTab, setActiveTab] = useState("basic");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: "",
      number: nextNumber,
      description: "",
      instructions: "",
      type: "mixed",
      startDate: "",
      deadline: "",
      weightPercentage: 0,
      allowLateSubmissions: true,
      latePenaltyPercentage: 10,
      documentRequired: false,
      documentMaxSize: 25,
      videoRequired: false,
      videoMaxSize: 500,
      githubRequired: false,
      urlRequired: false,
      urlLabel: "",
      textRequired: false,
      textLabel: "",
      textMinLength: 0,
      textMaxLength: 5000,
      isActive: true,
    },
  });

  const stageType = watch("type");
  const allowLate = watch("allowLateSubmissions");

  // Auto-set requirements based on stage type
  useEffect(() => {
    if (!stage) {
      // Only auto-set for new stages, not when editing
      switch (stageType) {
        case "document":
          setValue("documentRequired", true);
          setValue("videoRequired", false);
          setValue("urlRequired", false);
          setValue("textRequired", false);
          break;
        case "video":
          setValue("documentRequired", false);
          setValue("videoRequired", true);
          setValue("urlRequired", false);
          setValue("textRequired", false);
          break;
        case "url":
          setValue("documentRequired", false);
          setValue("videoRequired", false);
          setValue("urlRequired", true);
          setValue("textRequired", false);
          break;
        case "text":
          setValue("documentRequired", false);
          setValue("videoRequired", false);
          setValue("urlRequired", false);
          setValue("textRequired", true);
          break;
        case "mixed":
          // Keep current values for mixed
          break;
      }
    }
  }, [stageType, stage, setValue]);

  useEffect(() => {
    if (stage) {
      reset({
        name: stage.name,
        number: stage.number,
        description: stage.description || "",
        instructions: stage.instructions || "",
        type: stage.type,
        startDate: stage.startDate
          ? new Date(stage.startDate).toISOString().slice(0, 16)
          : "",
        deadline: new Date(stage.deadline).toISOString().slice(0, 16),
        weightPercentage: stage.weightPercentage,
        allowLateSubmissions: stage.allowLateSubmissions,
        latePenaltyPercentage: stage.latePenaltyPercentage,
        documentRequired: stage.requirements?.documentRequired || false,
        documentMaxSize: stage.requirements?.documentMaxSize || 25,
        videoRequired: stage.requirements?.videoRequired || false,
        videoMaxSize: stage.requirements?.videoMaxSize || 500,
        githubRequired: stage.requirements?.githubRequired || false,
        urlRequired: stage.requirements?.urlRequired || false,
        urlLabel: stage.requirements?.urlLabel || "",
        textRequired: stage.requirements?.textRequired || false,
        textLabel: stage.requirements?.textLabel || "",
        textMinLength: stage.requirements?.textMinLength || 0,
        textMaxLength: stage.requirements?.textMaxLength || 5000,
        isActive: stage.isActive,
      });
    } else {
      reset({
        name: "",
        number: nextNumber,
        description: "",
        instructions: "",
        type: "mixed",
        startDate: "",
        deadline: "",
        weightPercentage: 0,
        allowLateSubmissions: true,
        latePenaltyPercentage: 10,
        documentRequired: false,
        documentMaxSize: 25,
        videoRequired: false,
        videoMaxSize: 500,
        githubRequired: false,
        urlRequired: false,
        urlLabel: "",
        textRequired: false,
        textLabel: "",
        textMinLength: 0,
        textMaxLength: 5000,
        isActive: true,
      });
    }
  }, [stage, nextNumber, reset]);

  const onSubmit = async (data: FormValues) => {
    // Build requirements based on stage type
    let requirements = {};
    
    switch (data.type) {
      case "document":
        requirements = {
          documentRequired: true,
          documentMaxSize: data.documentMaxSize,
          githubRequired: data.githubRequired,
        };
        break;
      case "video":
        requirements = {
          videoRequired: true,
          videoMaxSize: data.videoMaxSize,
          githubRequired: data.githubRequired,
        };
        break;
      case "url":
        requirements = {
          urlRequired: true,
          urlLabel: data.urlLabel || undefined,
          githubRequired: data.githubRequired,
        };
        break;
      case "text":
        requirements = {
          textRequired: true,
          textLabel: data.textLabel || undefined,
          textMinLength: data.textMinLength,
          textMaxLength: data.textMaxLength,
          githubRequired: data.githubRequired,
        };
        break;
      case "mixed":
        requirements = {
          documentRequired: data.documentRequired,
          documentMaxSize: data.documentMaxSize,
          videoRequired: data.videoRequired,
          videoMaxSize: data.videoMaxSize,
          githubRequired: data.githubRequired,
          urlRequired: data.urlRequired,
          urlLabel: data.urlLabel || undefined,
          textRequired: data.textRequired,
          textLabel: data.textLabel || undefined,
          textMinLength: data.textMinLength,
          textMaxLength: data.textMaxLength,
        };
        break;
    }

    try {
      if (isEditing && stage) {
        const updateData: UpdateStageInput = {
          name: data.name,
          number: data.number,
          description: data.description || undefined,
          instructions: data.instructions || undefined,
          type: data.type,
          startDate: data.startDate || undefined,
          deadline: data.deadline,
          weightPercentage: data.weightPercentage,
          allowLateSubmissions: data.allowLateSubmissions,
          latePenaltyPercentage: data.latePenaltyPercentage,
          requirements,
          isActive: data.isActive,
        };
        await updateMutation.mutateAsync({ id: stage.id, data: updateData });
      } else {
        const createData: CreateStageInput = {
          cohortId,
          name: data.name,
          number: data.number,
          description: data.description || undefined,
          instructions: data.instructions || undefined,
          type: data.type,
          startDate: data.startDate || undefined,
          deadline: data.deadline,
          weightPercentage: data.weightPercentage,
          allowLateSubmissions: data.allowLateSubmissions,
          latePenaltyPercentage: data.latePenaltyPercentage,
          requirements,
        };
        await createMutation.mutateAsync(createData);
      }

      queryClient.invalidateQueries({ queryKey: ["stages"] });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save stage:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Stage" : "Create Stage"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the stage configuration"
              : "Add a new submission stage to this cohort"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="requirements">Requirements</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="number">Stage #</Label>
                  <Input
                    id="number"
                    type="number"
                    min={1}
                    {...register("number", { required: true, min: 1 })}
                  />
                </div>
                <div className="col-span-3 space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Problem Statement"
                    {...register("name", { required: "Name is required" })}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Stage Type</Label>
                <Select
                  value={stageType}
                  onValueChange={(v) =>
                    setValue("type", v as FormValues["type"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="document">Document Upload</SelectItem>
                    <SelectItem value="video">Video Submission</SelectItem>
                    <SelectItem value="url">URL Submission</SelectItem>
                    <SelectItem value="text">Text / Summary</SelectItem>
                    <SelectItem value="mixed">Mixed (Multiple Types)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of this stage"
                  rows={2}
                  {...register("description")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions">Instructions</Label>
                <Textarea
                  id="instructions"
                  placeholder="Detailed instructions for participants"
                  rows={4}
                  {...register("instructions")}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date (optional)</Label>
                  <Input
                    id="startDate"
                    type="datetime-local"
                    {...register("startDate")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deadline">Deadline</Label>
                  <Input
                    id="deadline"
                    type="datetime-local"
                    {...register("deadline", { required: "Deadline is required" })}
                  />
                  {errors.deadline && (
                    <p className="text-sm text-destructive">
                      {errors.deadline.message}
                    </p>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="requirements" className="space-y-4 mt-4">
              {stageType === "mixed" ? (
                <>
                  <div className="rounded-lg bg-muted/50 p-3 mb-4">
                    <p className="text-sm text-muted-foreground">
                      Mixed stages allow multiple submission types. Select which fields participants should fill in.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label>Document Upload</Label>
                        <p className="text-sm text-muted-foreground">
                          Require participants to upload documents
                        </p>
                      </div>
                      <Switch
                        checked={watch("documentRequired")}
                        onCheckedChange={(v) => setValue("documentRequired", v)}
                      />
                    </div>

                    {watch("documentRequired") && (
                      <div className="pl-4 space-y-2">
                        <Label>Max File Size (MB)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          {...register("documentMaxSize")}
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label>Video Submission</Label>
                        <p className="text-sm text-muted-foreground">
                          Require participants to upload a video
                        </p>
                      </div>
                      <Switch
                        checked={watch("videoRequired")}
                        onCheckedChange={(v) => setValue("videoRequired", v)}
                      />
                    </div>

                    {watch("videoRequired") && (
                      <div className="pl-4 space-y-2">
                        <Label>Max Video Size (MB)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={2000}
                          {...register("videoMaxSize")}
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label>Text / Summary</Label>
                        <p className="text-sm text-muted-foreground">
                          Require participants to write a description or summary
                        </p>
                      </div>
                      <Switch
                        checked={watch("textRequired")}
                        onCheckedChange={(v) => setValue("textRequired", v)}
                      />
                    </div>

                    {watch("textRequired") && (
                      <div className="pl-4 space-y-4">
                        <div className="space-y-2">
                          <Label>Text Label</Label>
                          <Input
                            placeholder="e.g., Problem Statement, Executive Summary"
                            {...register("textLabel")}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Min Length (chars)</Label>
                            <Input
                              type="number"
                              min={0}
                              {...register("textMinLength")}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Max Length (chars)</Label>
                            <Input
                              type="number"
                              min={1}
                              {...register("textMaxLength")}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label>GitHub Repository</Label>
                        <p className="text-sm text-muted-foreground">
                          Require a GitHub repository URL
                        </p>
                      </div>
                      <Switch
                        checked={watch("githubRequired")}
                        onCheckedChange={(v) => setValue("githubRequired", v)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label>Custom URL</Label>
                        <p className="text-sm text-muted-foreground">
                          Require an additional URL (demo, presentation, etc.)
                        </p>
                      </div>
                      <Switch
                        checked={watch("urlRequired")}
                        onCheckedChange={(v) => setValue("urlRequired", v)}
                      />
                    </div>

                    {watch("urlRequired") && (
                      <div className="pl-4 space-y-2">
                        <Label>URL Label</Label>
                        <Input
                          placeholder="e.g., Demo Video URL"
                          {...register("urlLabel")}
                        />
                      </div>
                    )}
                  </div>
                </>
              ) : stageType === "document" ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Document type stages require participants to upload a document file.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Max File Size (MB)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      {...register("documentMaxSize")}
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum file size for document uploads (default: 25MB)
                    </p>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label>Also Require GitHub Repository</Label>
                      <p className="text-sm text-muted-foreground">
                        Optionally require a GitHub repository link
                      </p>
                    </div>
                    <Switch
                      checked={watch("githubRequired")}
                      onCheckedChange={(v) => setValue("githubRequired", v)}
                    />
                  </div>
                </div>
              ) : stageType === "video" ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 p-4">
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      Video type stages require participants to upload a video file.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Max Video Size (MB)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={2000}
                      {...register("videoMaxSize")}
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum video file size (default: 500MB)
                    </p>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label>Also Require GitHub Repository</Label>
                      <p className="text-sm text-muted-foreground">
                        Optionally require a GitHub repository link
                      </p>
                    </div>
                    <Switch
                      checked={watch("githubRequired")}
                      onCheckedChange={(v) => setValue("githubRequired", v)}
                    />
                  </div>
                </div>
              ) : stageType === "url" ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      URL type stages require participants to submit a link (e.g., demo, prototype, presentation).
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>URL Label</Label>
                    <Input
                      placeholder="e.g., Demo URL, Presentation Link"
                      {...register("urlLabel")}
                    />
                    <p className="text-xs text-muted-foreground">
                      Label shown to participants (e.g., "Demo URL", "Figma Link")
                    </p>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label>Also Require GitHub Repository</Label>
                      <p className="text-sm text-muted-foreground">
                        Optionally require a GitHub repository link
                      </p>
                    </div>
                    <Switch
                      checked={watch("githubRequired")}
                      onCheckedChange={(v) => setValue("githubRequired", v)}
                    />
                  </div>
                </div>
              ) : stageType === "text" ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4">
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Text type stages require participants to write a description, summary, or problem statement in a text area.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Text Label</Label>
                    <Input
                      placeholder="e.g., Problem Statement, Executive Summary"
                      {...register("textLabel")}
                    />
                    <p className="text-xs text-muted-foreground">
                      Label shown above the text area (e.g., "Problem Statement")
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Minimum Length (characters)</Label>
                      <Input
                        type="number"
                        min={0}
                        {...register("textMinLength")}
                      />
                      <p className="text-xs text-muted-foreground">
                        Set to 0 for no minimum
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Maximum Length (characters)</Label>
                      <Input
                        type="number"
                        min={1}
                        {...register("textMaxLength")}
                      />
                      <p className="text-xs text-muted-foreground">
                        Default: 5000 characters
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label>Also Require GitHub Repository</Label>
                      <p className="text-sm text-muted-foreground">
                        Optionally require a GitHub repository link
                      </p>
                    </div>
                    <Switch
                      checked={watch("githubRequired")}
                      onCheckedChange={(v) => setValue("githubRequired", v)}
                    />
                  </div>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="weightPercentage">Weight Percentage</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="weightPercentage"
                    type="number"
                    min={0}
                    max={100}
                    {...register("weightPercentage")}
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  How much this stage counts towards the final score
                </p>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label>Allow Late Submissions</Label>
                  <p className="text-sm text-muted-foreground">
                    Accept submissions after the deadline
                  </p>
                </div>
                <Switch
                  checked={allowLate}
                  onCheckedChange={(v) => setValue("allowLateSubmissions", v)}
                />
              </div>

              {allowLate && (
                <div className="space-y-2">
                  <Label htmlFor="latePenaltyPercentage">Late Penalty</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="latePenaltyPercentage"
                      type="number"
                      min={0}
                      max={100}
                      {...register("latePenaltyPercentage")}
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Percentage deducted from late submissions
                  </p>
                </div>
              )}

              {isEditing && (
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label>Active</Label>
                    <p className="text-sm text-muted-foreground">
                      Whether this stage is visible to participants
                    </p>
                  </div>
                  <Switch
                    checked={watch("isActive")}
                    onCheckedChange={(v) => setValue("isActive", v)}
                  />
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : isEditing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
