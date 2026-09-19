"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { format, isPast } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  Loader2,
  Send,
  Star,
  ThumbsUp,
  Lightbulb,
  MessageSquare,
  Users,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  usePeerReviewAssignment,
  useRubricForStage,
  useSubmitPeerReview,
} from "@/lib/api/hooks/use-peer-reviews";

interface PeerReviewFormProps {
  assignmentId: string;
}

interface FormValues {
  scores: Array<{
    criterionId: string;
    criterionName: string;
    score: number;
    maxScore: number;
    comment: string;
  }>;
  overallComment: string;
  strengths: string;
  improvements: string;
  isAnonymous: boolean;
}

export function PeerReviewForm({ assignmentId }: PeerReviewFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const startTimeRef = useRef<Date>(new Date());
  const { data: assignment, isLoading: assignmentLoading } = usePeerReviewAssignment(assignmentId);
  const { data: rubric, isLoading: rubricLoading } = useRubricForStage(
    assignment?.cohortId || null,
    assignment?.stageId || null
  );
  const { mutateAsync: submitReview, isPending: isSubmitting } = useSubmitPeerReview();

  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLoading = assignmentLoading || rubricLoading;
  const isAlreadyCompleted = assignment?.status === "completed";

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      scores: [],
      overallComment: "",
      strengths: "",
      improvements: "",
      isAnonymous: true,
    },
  });

  const { fields } = useFieldArray({
    control,
    name: "scores",
  });

  // Initialize scores from rubric
  useEffect(() => {
    if (rubric && rubric.criteria.length > 0) {
      const initialScores = rubric.criteria.map((criterion) => ({
        criterionId: criterion.id,
        criterionName: criterion.name,
        score: Math.ceil(criterion.maxScore / 2), // Start at midpoint
        maxScore: criterion.maxScore,
        comment: "",
      }));
      setValue("scores", initialScores);
    }
  }, [rubric, setValue]);

  const scores = watch("scores");

  // Calculate overall weighted score
  const calculateOverallScore = (): number => {
    if (!rubric || scores.length === 0) return 0;

    let totalWeightedScore = 0;
    for (const score of scores) {
      const criterion = rubric.criteria.find((c) => c.id === score.criterionId);
      if (criterion) {
        const normalizedScore = (score.score / score.maxScore) * 100;
        totalWeightedScore += normalizedScore * (criterion.weight / 100);
      }
    }
    return Math.round(totalWeightedScore);
  };

  const handleFinalSubmit = async (data: FormValues) => {
    setError(null);
    
    const timeSpentMinutes = Math.round(
      (new Date().getTime() - startTimeRef.current.getTime()) / 60000
    );

    try {
      await submitReview({
        assignmentId,
        scores: data.scores.map((s) => ({
          criterionId: s.criterionId,
          criterionName: s.criterionName,
          score: s.score,
          maxScore: s.maxScore,
          comment: s.comment || undefined,
        })),
        overallComment: data.overallComment || undefined,
        strengths: data.strengths ? data.strengths.split("\n").filter(Boolean) : undefined,
        improvements: data.improvements ? data.improvements.split("\n").filter(Boolean) : undefined,
        isAnonymous: data.isAnonymous,
        timeSpentMinutes,
      });

      queryClient.invalidateQueries({ queryKey: ["peer-reviews"] });
      setShowSubmitDialog(false);
      router.push("/app/peer-reviews");
    } catch (err: any) {
      setError(err.message || "Failed to submit review");
      setShowSubmitDialog(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-medium mb-1">Assignment not found</h3>
          <Button onClick={() => router.push("/app/peer-reviews")} className="mt-4">
            Back to Peer Reviews
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isAlreadyCompleted) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CheckCircle className="h-12 w-12 text-green-600 mb-4" />
          <h3 className="text-lg font-medium mb-1">Review Already Submitted</h3>
          <p className="text-muted-foreground text-center mb-4">
            You have already submitted your review for this team.
          </p>
          <Button onClick={() => router.push("/app/peer-reviews")}>
            Back to Peer Reviews
          </Button>
        </CardContent>
      </Card>
    );
  }

  const deadline = new Date(assignment.dueDate);
  const isOverdue = isPast(deadline);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/app/peer-reviews")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <Users className="h-6 w-6 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold">
                    Review: {assignment.reviewedTeam?.name || "Team"}
                  </h1>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Due: {format(deadline, "MMM d, yyyy 'at' h:mm a")}</span>
                    {isOverdue && (
                      <Badge variant="destructive">
                        <Clock className="mr-1 h-3 w-3" />
                        Overdue
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-primary">{calculateOverallScore()}%</div>
            <div className="text-sm text-muted-foreground">Calculated Score</div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Stage Info */}
        {assignment.stage && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                  {assignment.stage.number}
                </span>
                <div>
                  <CardTitle className="text-lg">{assignment.stage.name}</CardTitle>
                  <CardDescription>
                    Review this team's submission for Stage {assignment.stage.number}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        )}

        {/* No Rubric Warning */}
        {!rubric && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              No rubric has been configured for this stage. Please contact the program administrator.
            </AlertDescription>
          </Alert>
        )}

        {/* Review Form */}
        {rubric && (
          <form onSubmit={handleSubmit(() => setShowSubmitDialog(true))} className="space-y-6">
            {/* Scoring Criteria */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Evaluation Criteria
                </CardTitle>
                <CardDescription>
                  Rate the team on each criterion. Hover over criteria names for descriptions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {fields.map((field, index) => {
                  const criterion = rubric.criteria.find((c) => c.id === field.criterionId);
                  if (!criterion) return null;

                  const currentScore = scores[index]?.score || 0;
                  const levelDescription = criterion.levels?.find(
                    (l) => l.score === currentScore
                  );

                  return (
                    <div key={field.id} className="space-y-4">
                      {index > 0 && <Separator />}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Label className="text-base font-medium cursor-help flex items-center gap-2">
                                {criterion.name}
                                <Badge variant="outline" className="text-xs">
                                  {criterion.weight}%
                                </Badge>
                              </Label>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              <p>{criterion.description}</p>
                            </TooltipContent>
                          </Tooltip>
                          <span className="text-2xl font-bold text-primary">
                            {currentScore}/{criterion.maxScore}
                          </span>
                        </div>

                        {/* Score Slider */}
                        <div className="px-2">
                          <Slider
                            value={[currentScore]}
                            min={1}
                            max={criterion.maxScore}
                            step={1}
                            onValueChange={([value]) =>
                              setValue(`scores.${index}.score`, value)
                            }
                          />
                          <div className="flex justify-between mt-1">
                            <span className="text-xs text-muted-foreground">1</span>
                            <span className="text-xs text-muted-foreground">{criterion.maxScore}</span>
                          </div>
                        </div>

                        {/* Level Description */}
                        {levelDescription && (
                          <div className="bg-muted/50 p-3 rounded-md">
                            <span className="font-medium text-sm">{levelDescription.label}</span>
                            <p className="text-sm text-muted-foreground mt-1">
                              {levelDescription.description}
                            </p>
                          </div>
                        )}

                        {/* Criterion Comment */}
                        <Textarea
                          placeholder={`Add specific feedback for ${criterion.name} (optional)`}
                          {...register(`scores.${index}.comment`)}
                          rows={2}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Strengths */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ThumbsUp className="h-5 w-5 text-green-600" />
                  Strengths
                </CardTitle>
                <CardDescription>
                  What did this team do well? Enter one strength per line.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="- Great problem identification&#10;- Clear presentation&#10;- Innovative approach"
                  {...register("strengths")}
                  rows={4}
                />
              </CardContent>
            </Card>

            {/* Areas for Improvement */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-600" />
                  Areas for Improvement
                </CardTitle>
                <CardDescription>
                  What could this team improve? Enter one suggestion per line.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="- More detailed market analysis&#10;- Consider scalability&#10;- Strengthen financial projections"
                  {...register("improvements")}
                  rows={4}
                />
              </CardContent>
            </Card>

            {/* Overall Comments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Overall Comments
                </CardTitle>
                <CardDescription>
                  Provide any additional feedback or general comments for the team.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Your overall thoughts on this team's submission..."
                  {...register("overallComment")}
                  rows={4}
                />
              </CardContent>
            </Card>

            {/* Anonymous Toggle */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Submit Anonymously</Label>
                    <p className="text-sm text-muted-foreground">
                      Your identity will be hidden from the team being reviewed
                    </p>
                  </div>
                  <Switch
                    checked={watch("isAnonymous")}
                    onCheckedChange={(checked) => setValue("isAnonymous", checked)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/app/peer-reviews")}
              >
                Save & Exit
              </Button>
              <Button type="submit">
                <Send className="mr-2 h-4 w-4" />
                Submit Review
              </Button>
            </div>
          </form>
        )}

        {/* Submit Confirmation Dialog */}
        <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Submit Peer Review?</AlertDialogTitle>
              <AlertDialogDescription>
                Once submitted, you won't be able to make changes to this review.
                Your calculated score is <strong>{calculateOverallScore()}%</strong>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleSubmit(handleFinalSubmit)}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Submit Review
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
