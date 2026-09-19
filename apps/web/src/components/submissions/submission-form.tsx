"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { format, isPast } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  ClipboardCheck,
  FileText,
  Github,
  Link as LinkIcon,
  Loader2,
  Lock,
  Save,
  Send,
  Video,
  Upload,
  X,
  XCircle,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useStage } from "@/lib/api/hooks/use-stages";
import {
  useMySubmissionForStage,
  useSaveDraft,
  useSubmitSubmission,
  useUploadSubmissionVideo,
  FileUrl,
} from "@/lib/api/hooks/use-submissions";
import { useCurrentParticipant } from "@/lib/api/hooks/use-participants";
import { useMyTeam, TeamRole } from "@/lib/api/hooks/use-teams";

interface SubmissionFormProps {
  stageId: string;
}

interface FormValues {
  videoUrl: string;
  content: Record<string, string>;
}

/**
 * Checks if user has permission to edit/submit (lead or co_lead only)
 */
function canUserEdit(role: TeamRole | null): boolean {
  return role === "lead" || role === "co_lead";
}

export function SubmissionForm({ stageId }: SubmissionFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: participant, isLoading: participantLoading } = useCurrentParticipant();
  const { data: team, isLoading: teamLoading } = useMyTeam(participant?.id || "");
  const { data: stage, isLoading: stageLoading } = useStage(stageId);
  const { data: submission, isLoading: submissionLoading } = useMySubmissionForStage(stageId);
  const saveDraftMutation = useSaveDraft();
  const submitMutation = useSubmitSubmission();
  const uploadVideoMutation = useUploadSubmissionVideo();

  // Calculate user's role and permissions
  const userRole = useMemo((): TeamRole | null => {
    if (!team?.members || !participant) return null;
    const member = team.members.find((m) => m.participantId === participant.id);
    return member?.role || null;
  }, [team, participant]);

  const hasEditPermission = useMemo(() => canUserEdit(userRole), [userRole]);
  const isViewOnly = !hasEditPermission;

  const [files, setFiles] = useState<FileUrl[]>([]);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const isSubmitted = submission?.status && ["submitted", "late", "pending_approval", "approved", "evaluated"].includes(submission.status);
  const isPendingApproval = submission?.status === "pending_approval";
  const isApproved = submission?.status === "approved";
  const isRejected = submission?.status === "rejected";
  const isLoading = stageLoading || submissionLoading || participantLoading || teamLoading;
  
  // Disable editing if:
  // - User doesn't have edit permission (not lead/co-lead), OR
  // - Deadline has passed (regardless of late submission settings for already submitted work)
  // - EXCEPTION: Rejected submissions can be edited even after deadline (to allow resubmission)
  // Note: Late submissions setting only applies to NEW submissions, not editing existing ones after deadline
  const deadline = stage ? new Date(stage.deadline) : new Date();
  const isOverdue = stage ? isPast(deadline) : false;
  const isDisabled = isViewOnly || (isOverdue && !isRejected);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { isDirty },
  } = useForm<FormValues>({
    defaultValues: {
      videoUrl: "",
      content: {},
    },
  });

  // Initialize form with existing submission data
  useEffect(() => {
    if (submission) {
      reset({
        videoUrl: submission.videoUrl || "",
        content: submission.content || {},
      });
      setFiles(submission.fileUrls || []);
      if (submission.lastSavedAt) {
        setLastSaved(new Date(submission.lastSavedAt));
      }
    }
  }, [submission, reset]);

  const handleSaveDraft = useCallback(async (data: FormValues) => {
    if (isDisabled) return;
    
    setError(null);
    try {
      await saveDraftMutation.mutateAsync({
        stageId,
        content: data.content,
        fileUrls: files,
        videoUrl: data.videoUrl || undefined,
      });
      setLastSaved(new Date());
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to save draft");
    }
  }, [stageId, files, saveDraftMutation, isDisabled, queryClient]);

  const handleFinalSubmit = async (data: FormValues) => {
    setError(null);
    try {
      await submitMutation.mutateAsync({
        stageId,
        content: data.content,
        fileUrls: files,
        videoUrl: data.videoUrl || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
      setShowSubmitDialog(false);
      router.push("/app/submissions");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to submit");
      setShowSubmitDialog(false);
    }
  };

  // Validate submission before showing confirm dialog
  const validateAndShowSubmitDialog = useCallback(() => {
    if (!stage) return;
    
    const errors: string[] = [];
    const formData = watch();
    
    // Validate document upload
    if ((stage.type === "document" || stage.type === "mixed") && stage.requirements?.documentRequired) {
      if (files.length === 0) {
        errors.push("Document upload is required");
      }
    }
    
    // GitHub requirement is now checked at team level, not in submission form
    // The backend will validate team.githubRepoUrl if stage.requirements.githubRequired is true
    
    // Validate Video URL
    if (stage.type === "video" || stage.requirements?.videoRequired) {
      if (!formData.videoUrl || formData.videoUrl.trim() === "") {
        errors.push("Video URL is required");
      }
    }
    
    // Validate Custom URL
    if (stage.requirements?.urlRequired) {
      if (!formData.content?.customUrl || formData.content.customUrl.trim() === "") {
        errors.push(`${stage.requirements.urlLabel || "URL"} is required`);
      }
    }
    
    // Validate Text Content
    if (stage.type === "text" || stage.requirements?.textRequired) {
      const textContent = formData.content?.textContent || "";
      const textLength = textContent.length;
      
      if (stage.requirements?.textRequired && textLength === 0) {
        errors.push(`${stage.requirements.textLabel || "Written response"} is required`);
      }
      
      if (stage.requirements?.textMinLength && textLength < stage.requirements.textMinLength) {
        errors.push(`${stage.requirements.textLabel || "Written response"} must be at least ${stage.requirements.textMinLength.toLocaleString()} characters (currently ${textLength.toLocaleString()})`);
      }
      
      if (stage.requirements?.textMaxLength && textLength > stage.requirements.textMaxLength) {
        errors.push(`${stage.requirements.textLabel || "Written response"} must not exceed ${stage.requirements.textMaxLength.toLocaleString()} characters (currently ${textLength.toLocaleString()})`);
      }
    }
    
    // Validate additional fields
    stage.requirements?.additionalFields?.forEach((field) => {
      if (field.required) {
        const value = formData.content?.[field.name] || "";
        if (value.trim() === "") {
          errors.push(`${field.label} is required`);
        }
      }
    });
    
    setValidationErrors(errors);
    
    if (errors.length === 0) {
      setShowSubmitDialog(true);
    }
  }, [stage, files, watch]);

  // Auto-save every 30 seconds if dirty and has edit permission
  useEffect(() => {
    if (!isDirty || isDisabled) return;
    
    const interval = setInterval(() => {
      handleSubmit(handleSaveDraft)();
    }, 30000);

    return () => clearInterval(interval);
  }, [isDirty, isDisabled, handleSubmit, handleSaveDraft]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stage) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-medium mb-1">Stage not found</h3>
          <Button onClick={() => router.push("/app/submissions")} className="mt-4">
            Back to Submissions
          </Button>
        </CardContent>
      </Card>
    );
  }

  const stageIsOpen = stage.isOpen || (isOverdue && stage.allowLateSubmissions && !isSubmitted);
  // Allow submission if: stage is open AND user has edit permission AND (not submitted OR rejected)
  const canSubmit = (stageIsOpen || isRejected) && hasEditPermission && (!isSubmitted || isRejected);

  return (
    <div className="space-y-6">
      {/* Header - Clean and Simple */}
      <div className="space-y-3">
        {/* Back Button and Title Row */}
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" onClick={() => router.push("/app/submissions")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 flex-wrap">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold shrink-0">
                {stage.number}
              </span>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold leading-tight">{stage.name}</h1>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span>Due {format(deadline, "MMM d, yyyy")}</span>
                </div>
              </div>
            </div>
            {/* Status Badges - on new line on mobile */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {isOverdue && (
                <Badge variant="destructive" className="text-xs">
                  Overdue
                </Badge>
              )}
              {isPendingApproval && (
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                  <ClipboardCheck className="mr-1 h-3 w-3" />
                  Pending Approval
                </Badge>
              )}
              {isApproved && (
                <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Approved
                </Badge>
              )}
              {isRejected && (
                <Badge variant="outline" className="text-xs text-red-600 border-red-300">
                  <XCircle className="mr-1 h-3 w-3" />
                  Rejected
                </Badge>
              )}
              {isSubmitted && !isPendingApproval && !isApproved && !isRejected && (
                <Badge variant="default" className="text-xs">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Submitted
                </Badge>
              )}
              {isViewOnly && !isSubmitted && (
                <Badge variant="secondary" className="text-xs">
                  <Eye className="mr-1 h-3 w-3" />
                  View Only
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Validation Errors - only show when not submitted */}
      {validationErrors.length > 0 && !isSubmitted && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium mb-1">Please fix the following before submitting:</p>
            <ul className="list-disc list-inside text-sm space-y-0.5">
              {validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* View-Only Alert for Regular Members */}
      {isViewOnly && !isSubmitted && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription className="flex items-center gap-2">
            <span className="font-medium">View Only</span> — Only team leads and co-leads can edit and submit. 
            You can view the submission details but cannot make changes.
            {userRole && (
              <Badge variant="outline" className="ml-2">
                {userRole === "member" ? "Team Member" : userRole}
              </Badge>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Late Submission Warning */}
      {isOverdue && canSubmit && !isSubmitted && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            This submission is past the deadline. Late submissions will receive a {stage.latePenaltyPercentage}% penalty.
          </AlertDescription>
        </Alert>
      )}

      {/* Pending Approval Info */}
      {isPendingApproval && (
        <Alert>
          <ClipboardCheck className="h-4 w-4" />
          <AlertDescription>
            <span className="font-medium">Pending Approval</span> — Your submission is being reviewed by the program staff. 
            You will be notified once it has been approved or if any changes are needed.
          </AlertDescription>
        </Alert>
      )}

      {/* Approval Notes */}
      {isApproved && submission?.approvalNotes && (
        <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700 dark:text-green-300">
            <span className="font-medium">Approved!</span> {submission.approvalNotes}
          </AlertDescription>
        </Alert>
      )}

      {/* Rejection Reason */}
      {isRejected && submission?.rejectionReason && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            <span className="font-medium">Submission Rejected</span> — {submission.rejectionReason}
          </AlertDescription>
        </Alert>
      )}

      {/* Stage Instructions - compact collapsible */}
      {stage.instructions && !isSubmitted && (
        <details className="group border rounded-lg">
          <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <span className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Instructions
            </span>
            <span className="text-xs text-muted-foreground group-open:hidden">Click to expand</span>
          </summary>
          <div className="px-3 pb-3 pt-0 text-sm text-muted-foreground border-t">
            <div className="pt-3 whitespace-pre-wrap">{stage.instructions}</div>
          </div>
        </details>
      )}

      {/* Submission Form */}
      <form onSubmit={handleSubmit(handleSaveDraft)} className="space-y-8">
        {/* Document Upload */}
        {(stage.type === "document" || stage.type === "mixed") && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documents
              {stage.requirements?.documentRequired && !isSubmitted && (
                <Badge variant="outline" className="text-xs">Required</Badge>
              )}
            </Label>
            <FileUploadArea
              files={files}
              onChange={setFiles}
              maxSize={stage.requirements?.documentMaxSize || 25}
              disabled={isDisabled}
            />
          </div>
        )}

        {/* GitHub Requirement Info - link to team settings */}
        {stage.requirements?.githubRequired && (
          <Alert>
            <Github className="h-4 w-4" />
            <AlertDescription>
              <span className="font-medium">GitHub Repository Required</span> — This stage requires a GitHub repository. 
              {team?.githubRepoUrl ? (
                <span> Your team's repository: <a href={team.githubRepoUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{team.githubRepoUrl}</a></span>
              ) : (
                <span> Please set your team's GitHub repository URL in the <a href="/app/team" className="text-primary hover:underline">Team Settings</a>.</span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Video Upload */}
        {(stage.type === "video" || stage.requirements?.videoRequired) && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              Video
              {stage.requirements?.videoRequired && !isSubmitted && (
                <Badge variant="outline" className="text-xs">Required</Badge>
              )}
            </Label>
            <VideoUploadArea
              videoUrl={watch("videoUrl")}
              onUpload={async (file) => {
                const result = await uploadVideoMutation.mutateAsync({ file });
                // Set the video URL in the form
                reset({
                  ...watch(),
                  videoUrl: result.url,
                });
              }}
              onRemove={() => {
                reset({
                  ...watch(),
                  videoUrl: "",
                });
              }}
              isUploading={uploadVideoMutation.isPending}
              disabled={isDisabled}
            />
            {!isSubmitted && (
              <p className="text-sm text-muted-foreground">
                Upload your video (MP4, WebM, or MOV format, max 100MB)
              </p>
            )}
          </div>
        )}

        {/* Custom URL */}
        {stage.requirements?.urlRequired && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              {stage.requirements.urlLabel || "URL"}
              {!isSubmitted && <Badge variant="outline" className="text-xs">Required</Badge>}
            </Label>
            <Input
              placeholder="https://..."
              {...register("content.customUrl")}
              disabled={isDisabled}
            />
          </div>
        )}

        {/* Text Content (for text type stages) */}
        {(stage.type === "text" || stage.requirements?.textRequired) && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {stage.requirements?.textLabel || "Written Response"}
              {stage.requirements?.textRequired && !isSubmitted && (
                <Badge variant="outline" className="text-xs">Required</Badge>
              )}
            </Label>
            <Textarea
              placeholder={`Enter your ${stage.requirements?.textLabel?.toLowerCase() || "response"} here...`}
              {...register("content.textContent")}
              disabled={isDisabled}
              rows={12}
              className="min-h-[200px] resize-y"
            />
            {!isSubmitted && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{(watch("content.textContent") || "").length.toLocaleString()} chars</span>
                  {stage.requirements?.textMinLength && stage.requirements?.textMinLength > 0 && (
                    <span className="text-muted-foreground/70">Min: {stage.requirements.textMinLength.toLocaleString()}</span>
                  )}
                  {stage.requirements?.textMaxLength && (
                    <span className="text-muted-foreground/70">Max: {stage.requirements.textMaxLength.toLocaleString()}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Additional Fields */}
        {stage.requirements?.additionalFields?.map((field) => (
          <div key={field.name} className="space-y-2">
            <Label className="flex items-center gap-2">
              {field.label}
              {field.required && !isSubmitted && <Badge variant="outline" className="text-xs">Required</Badge>}
            </Label>
            {field.type === "textarea" ? (
              <Textarea
                placeholder={field.placeholder}
                {...register(`content.${field.name}`)}
                disabled={isDisabled}
                rows={5}
              />
            ) : (
              <Input
                type={field.type === "url" ? "url" : "text"}
                placeholder={field.placeholder}
                {...register(`content.${field.name}`)}
                disabled={isDisabled}
              />
            )}
          </div>
        ))}

        {/* Feedback (for evaluated submissions) */}
        {submission?.feedback && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Feedback
                {submission.score !== undefined && (
                  <Badge variant="default" className="text-lg">
                    Score: {submission.score}%
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {submission.feedback.strengths && submission.feedback.strengths.length > 0 && (
                <div>
                  <Label className="text-green-600">Strengths</Label>
                  <ul className="list-disc list-inside text-sm mt-1">
                    {submission.feedback.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {submission.feedback.improvements && submission.feedback.improvements.length > 0 && (
                <div>
                  <Label className="text-amber-600">Areas for Improvement</Label>
                  <ul className="list-disc list-inside text-sm mt-1">
                    {submission.feedback.improvements.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {submission.feedback.comments && (
                <div>
                  <Label>Comments</Label>
                  <p className="text-sm mt-1">{submission.feedback.comments}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Action Buttons - At Bottom */}
        {!isDisabled && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {lastSaved ? (
                <span>Last saved {format(lastSaved, "MMM d 'at' h:mm a")}</span>
              ) : (
                <span>Not saved yet</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleSubmit(handleSaveDraft)}
                disabled={saveDraftMutation.isPending || !canSubmit}
                className="flex-1 sm:flex-none"
              >
                {saveDraftMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Draft
              </Button>
              <Button 
                onClick={validateAndShowSubmitDialog} 
                disabled={!canSubmit}
                className="flex-1 sm:flex-none"
              >
                <Send className="mr-2 h-4 w-4" />
                Submit
              </Button>
            </div>
          </div>
        )}
      </form>

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit {stage.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {isOverdue ? (
                <>
                  This submission is past the deadline and will be marked as late.
                  A {stage.latePenaltyPercentage}% penalty will be applied.
                </>
              ) : (
                <>
                  Once submitted, you will not be able to make changes. Make sure
                  you have reviewed everything carefully.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmit(handleFinalSubmit)}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FileUploadArea({
  files,
  onChange,
  maxSize,
  disabled,
}: {
  files: FileUrl[];
  onChange: (files: FileUrl[]) => void;
  maxSize: number;
  disabled?: boolean;
}) {
  // Simulated file upload - in production, this would upload to S3/cloud storage
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const newFiles: FileUrl[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      if (file.size > maxSize * 1024 * 1024) {
        alert(`File ${file.name} exceeds the maximum size of ${maxSize}MB`);
        continue;
      }
      // In production: upload to storage and get URL
      newFiles.push({
        name: file.name,
        url: URL.createObjectURL(file), // Placeholder - would be actual URL
        type: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      });
    }
    onChange([...files, ...newFiles]);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    if (disabled) return;
    const newFiles = [...files];
    newFiles.splice(index, 1);
    onChange(newFiles);
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {!disabled && (
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-muted-foreground">
              Maximum file size: {maxSize}MB
            </p>
          </div>
          <input
            type="file"
            className="hidden"
            multiple
            onChange={handleFileSelect}
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
          />
        </label>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-md bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              {!disabled && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {files.length === 0 && disabled && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No documents uploaded
        </p>
      )}
    </div>
  );
}

function VideoUploadArea({
  videoUrl,
  onUpload,
  onRemove,
  isUploading,
  disabled,
}: {
  videoUrl?: string;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => void;
  isUploading?: boolean;
  disabled?: boolean;
}) {
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || isUploading) return;
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["video/mp4", "video/webm", "video/quicktime"];
    if (!allowedTypes.includes(file.type)) {
      alert("Please upload a video file (MP4, WebM, or MOV format)");
      return;
    }

    // Validate file size (100MB max)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("Video file is too large. Maximum size is 100MB.");
      return;
    }

    await onUpload(file);
    e.target.value = "";
  };

  // If video is already uploaded, show the video player
  if (videoUrl) {
    return (
      <div className="space-y-3">
        <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
          <video
            src={videoUrl}
            controls
            className="w-full h-full object-contain"
          />
        </div>
        {!disabled && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRemove}
              className="flex-1"
            >
              <X className="mr-2 h-4 w-4" />
              Remove Video
            </Button>
            <label className="flex-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                asChild
              >
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  Replace Video
                </span>
              </Button>
              <input
                type="file"
                className="hidden"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
            </label>
          </div>
        )}
      </div>
    );
  }

  // Upload area when no video is uploaded
  return (
    <label className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg transition-colors ${
      disabled || isUploading ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted/50"
    }`}>
      <div className="flex flex-col items-center justify-center py-6">
        {isUploading ? (
          <>
            <Loader2 className="h-10 w-10 text-primary mb-3 animate-spin" />
            <p className="text-sm font-medium text-muted-foreground">
              Uploading video...
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              This may take a moment
            </p>
          </>
        ) : (
          <>
            <Video className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Click to upload</span> your video
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              MP4, WebM, or MOV (max 100MB)
            </p>
          </>
        )}
      </div>
      <input
        type="file"
        className="hidden"
        accept="video/mp4,video/webm,video/quicktime"
        onChange={handleFileSelect}
        disabled={disabled || isUploading}
      />
    </label>
  );
}
