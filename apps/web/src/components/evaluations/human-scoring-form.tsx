"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bot,
  User,
  Loader2,
  Save,
  Star,
  ExternalLink,
  FileText,
  Github,
  Video,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useEvaluation,
  useSubmitHumanScore,
  Evaluation,
} from "@/lib/api/hooks/use-evaluations";

interface HumanScoringFormProps {
  evaluationId: string;
}

interface FormValues {
  scores: Array<{
    criterionId: string;
    criterionName: string;
    score: number;
    maxScore: number;
    comment: string;
  }>;
  feedback: string;
}

export function HumanScoringForm({ evaluationId }: HumanScoringFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: evaluation, isLoading } = useEvaluation(evaluationId);
  const { mutateAsync: submitScore, isPending: isSubmitting } = useSubmitHumanScore();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
  } = useForm<FormValues>({
    defaultValues: {
      scores: [],
      feedback: "",
    },
  });

  const { fields } = useFieldArray({
    control,
    name: "scores",
  });

  // Initialize form from AI scores or existing human scores
  useEffect(() => {
    if (evaluation) {
      if (evaluation.humanScores && evaluation.humanScores.length > 0) {
        // Use existing human scores
        setValue(
          "scores",
          evaluation.humanScores.map((s) => ({
            ...s,
            comment: s.comment || "",
          }))
        );
        setValue("feedback", evaluation.humanFeedback || "");
      } else if (evaluation.aiScores && evaluation.aiScores.length > 0) {
        // Initialize from AI scores
        setValue(
          "scores",
          evaluation.aiScores.map((s) => ({
            criterionId: s.criterionId,
            criterionName: s.criterionName,
            score: s.score,
            maxScore: s.maxScore,
            comment: "",
          }))
        );
      }
    }
  }, [evaluation, setValue]);

  const scores = watch("scores");

  // Calculate human overall score
  const calculateHumanScore = (): number => {
    if (scores.length === 0) return 0;
    const total = scores.reduce((sum, s) => sum + s.score, 0);
    const max = scores.reduce((sum, s) => sum + s.maxScore, 0);
    return max > 0 ? Math.round((total / max) * 100) : 0;
  };

  const onSubmit = async (data: FormValues) => {
    setError(null);
    try {
      await submitScore({
        evaluationId,
        scores: data.scores.map((s) => ({
          criterionId: s.criterionId,
          criterionName: s.criterionName,
          score: s.score,
          maxScore: s.maxScore,
          comment: s.comment || undefined,
        })),
        feedback: data.feedback || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["evaluations"] });
      toast.success("Human scores submitted successfully");
      router.push("/portal/evaluations");
    } catch (err: any) {
      setError(err.message || "Failed to submit scores");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!evaluation) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-medium">Evaluation not found</h3>
          <Button onClick={() => router.push("/portal/evaluations")} className="mt-4">
            Back to Evaluations
          </Button>
        </CardContent>
      </Card>
    );
  }

  const humanScore = calculateHumanScore();
  const aiScore = evaluation.aiOverallScore ? Math.round(evaluation.aiOverallScore) : null;


  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/portal/evaluations")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                {evaluation.team?.name || "Team"} - Human Scoring
              </h1>
              <p className="text-muted-foreground">
                Stage {evaluation.stage?.number}: {evaluation.stage?.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* AI Score */}
            {aiScore !== null && (
              <div className="text-center">
                <div className="flex items-center gap-1 text-2xl font-bold text-purple-600">
                  <Bot className="h-5 w-5" />
                  {aiScore}%
                </div>
                <div className="text-xs text-muted-foreground">AI Score</div>
              </div>
            )}
            {/* Human Score */}
            <div className="text-center">
              <div className="flex items-center gap-1 text-2xl font-bold text-primary">
                <User className="h-5 w-5" />
                {humanScore}%
              </div>
              <div className="text-xs text-muted-foreground">Your Score</div>
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

        {/* Already Scored Notice */}
        {evaluation.humanEvaluatedAt && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              This evaluation was already scored by a human reviewer. You can update the scores if needed.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Submission Details */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Submission Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">View submission documents</span>
                  <Button variant="ghost" size="sm" asChild>
                    <a href="#" target="_blank">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Github className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">GitHub Repository</span>
                  <Button variant="ghost" size="sm" asChild>
                    <a href="#" target="_blank">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Video Submission</span>
                  <Button variant="ghost" size="sm" asChild>
                    <a href="#" target="_blank">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* AI Feedback */}
            {evaluation.aiFeedback && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bot className="h-4 w-4 text-purple-600" />
                    AI Feedback
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {evaluation.aiFeedback}
                </CardContent>
              </Card>
            )}

            {/* AI Strengths/Improvements */}
            {(evaluation.aiStrengths?.length || evaluation.aiImprovements?.length) && (
              <Card>
                <CardContent className="pt-6 space-y-4">
                  {evaluation.aiStrengths && evaluation.aiStrengths.length > 0 && (
                    <div>
                      <Label className="text-green-600">AI Identified Strengths</Label>
                      <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                        {evaluation.aiStrengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {evaluation.aiImprovements && evaluation.aiImprovements.length > 0 && (
                    <div>
                      <Label className="text-amber-600">AI Identified Improvements</Label>
                      <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                        {evaluation.aiImprovements.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>


          {/* Right Column - Scoring Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Scoring Criteria */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    Evaluation Criteria
                  </CardTitle>
                  <CardDescription>
                    Score each criterion. AI scores shown for reference.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {fields.map((field, index) => {
                    const aiCriterion = evaluation.aiScores?.find(
                      (s) => s.criterionId === field.criterionId
                    );
                    const currentScore = scores[index]?.score || 0;
                    const maxScore = field.maxScore;

                    return (
                      <div key={field.id} className="space-y-4">
                        {index > 0 && <Separator />}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-base font-medium">
                              {field.criterionName}
                            </Label>
                            <div className="flex items-center gap-4">
                              {aiCriterion && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="outline" className="text-purple-600">
                                      <Bot className="mr-1 h-3 w-3" />
                                      {aiCriterion.score}/{aiCriterion.maxScore}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-sm">
                                    <p className="font-medium">AI Explanation:</p>
                                    <p>{aiCriterion.explanation}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              <span className="text-2xl font-bold text-primary">
                                {currentScore}/{maxScore}
                              </span>
                            </div>
                          </div>

                          {/* Score Slider */}
                          <div className="px-2">
                            <Slider
                              value={[currentScore]}
                              min={0}
                              max={maxScore}
                              step={1}
                              onValueChange={([value]) =>
                                setValue(`scores.${index}.score`, value)
                              }
                            />
                            <div className="flex justify-between mt-1">
                              <span className="text-xs text-muted-foreground">0</span>
                              <span className="text-xs text-muted-foreground">{maxScore}</span>
                            </div>
                          </div>

                          {/* Score Comparison */}
                          {aiCriterion && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-muted-foreground">AI:</span>
                              <Progress
                                value={(aiCriterion.score / aiCriterion.maxScore) * 100}
                                className="h-2 flex-1 bg-purple-100"
                              />
                              <span className="text-muted-foreground">You:</span>
                              <Progress
                                value={(currentScore / maxScore) * 100}
                                className="h-2 flex-1"
                              />
                            </div>
                          )}

                          {/* Comment */}
                          <Textarea
                            placeholder={`Add comments for ${field.criterionName} (optional)`}
                            {...register(`scores.${index}.comment`)}
                            rows={2}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Overall Feedback */}
              <Card>
                <CardHeader>
                  <CardTitle>Overall Feedback</CardTitle>
                  <CardDescription>
                    Provide comprehensive feedback for the team
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Your overall assessment and recommendations..."
                    {...register("feedback")}
                    rows={5}
                  />
                </CardContent>
              </Card>

              {/* Submit Button */}
              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/portal/evaluations")}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Submit Human Scores
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
