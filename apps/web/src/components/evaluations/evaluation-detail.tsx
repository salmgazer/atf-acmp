"use client";

import { format } from "date-fns";
import {
  Bot,
  User,
  Star,
  CheckCircle,
  Clock,
  Loader2,
  AlertCircle,
  ThumbsUp,
  Lightbulb,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Evaluation } from "@/lib/api/hooks/use-evaluations";

interface EvaluationDetailProps {
  evaluation: Evaluation;
}

export function EvaluationDetail({ evaluation }: EvaluationDetailProps) {
  const aiScore = evaluation.aiOverallScore ? Math.round(evaluation.aiOverallScore) : null;
  const humanScore = evaluation.humanOverallScore ? Math.round(evaluation.humanOverallScore) : null;
  const finalScore = evaluation.finalScore ? Math.round(evaluation.finalScore) : null;

  return (
    <div className="space-y-6">
      {/* Score Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-purple-600" />
                <span className="font-medium">AI Score</span>
              </div>
              {aiScore !== null ? (
                <span className="text-3xl font-bold text-purple-600">{aiScore}%</span>
              ) : (
                <Badge variant="outline">Pending</Badge>
              )}
            </div>
            {evaluation.aiEvaluatedAt && (
              <p className="text-xs text-muted-foreground mt-2">
                Evaluated {format(new Date(evaluation.aiEvaluatedAt), "MMM d, yyyy")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Human Score</span>
              </div>
              {humanScore !== null ? (
                <span className="text-3xl font-bold text-blue-600">{humanScore}%</span>
              ) : (
                <Badge variant="outline">Pending</Badge>
              )}
            </div>
            {evaluation.humanEvaluatedAt && (
              <p className="text-xs text-muted-foreground mt-2">
                Evaluated {format(new Date(evaluation.humanEvaluatedAt), "MMM d, yyyy")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-600" />
                <span className="font-medium">Final Score</span>
              </div>
              {finalScore !== null ? (
                <span className="text-3xl font-bold text-primary">{finalScore}%</span>
              ) : (
                <Badge variant="outline">Pending</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Weight: {Math.round(evaluation.aiWeight * 100)}% AI / {Math.round((1 - evaluation.aiWeight) * 100)}% Human
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Publication Status */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <span className="font-medium">Publication Status</span>
            {evaluation.isPublished ? (
              <Badge variant="default">
                <CheckCircle className="mr-1 h-3 w-3" />
                Published
              </Badge>
            ) : (
              <Badge variant="secondary">
                <Clock className="mr-1 h-3 w-3" />
                Not Published
              </Badge>
            )}
          </div>
          {evaluation.publishedAt && (
            <p className="text-sm text-muted-foreground mt-2">
              Published on {format(new Date(evaluation.publishedAt), "MMM d, yyyy 'at' h:mm a")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* AI Scores Breakdown */}
      {evaluation.aiScores && evaluation.aiScores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-purple-600" />
              AI Evaluation Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {evaluation.aiScores.map((score, index) => (
              <div key={score.criterionId} className="space-y-2">
                {index > 0 && <Separator />}
                <div className="flex items-center justify-between">
                  <span className="font-medium">{score.criterionName}</span>
                  <span className="font-bold">
                    {score.score}/{score.maxScore}
                  </span>
                </div>
                <Progress
                  value={(score.score / score.maxScore) * 100}
                  className="h-2"
                />
                {score.explanation && (
                  <p className="text-sm text-muted-foreground">{score.explanation}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Human Scores Breakdown */}
      {evaluation.humanScores && evaluation.humanScores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              Human Evaluation Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {evaluation.humanScores.map((score, index) => (
              <div key={score.criterionId} className="space-y-2">
                {index > 0 && <Separator />}
                <div className="flex items-center justify-between">
                  <span className="font-medium">{score.criterionName}</span>
                  <span className="font-bold">
                    {score.score}/{score.maxScore}
                  </span>
                </div>
                <Progress
                  value={(score.score / score.maxScore) * 100}
                  className="h-2"
                />
                {score.comment && (
                  <p className="text-sm text-muted-foreground italic">{score.comment}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Feedback */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* AI Feedback */}
        {(evaluation.aiFeedback || evaluation.aiStrengths?.length || evaluation.aiImprovements?.length) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4 text-purple-600" />
                AI Feedback
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {evaluation.aiFeedback && (
                <p className="text-sm text-muted-foreground">{evaluation.aiFeedback}</p>
              )}
              {evaluation.aiStrengths && evaluation.aiStrengths.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-green-600 mb-1">
                    <ThumbsUp className="h-4 w-4" />
                    <span className="font-medium text-sm">Strengths</span>
                  </div>
                  <ul className="list-disc list-inside text-sm text-muted-foreground">
                    {evaluation.aiStrengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {evaluation.aiImprovements && evaluation.aiImprovements.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-amber-600 mb-1">
                    <Lightbulb className="h-4 w-4" />
                    <span className="font-medium text-sm">Areas for Improvement</span>
                  </div>
                  <ul className="list-disc list-inside text-sm text-muted-foreground">
                    {evaluation.aiImprovements.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Human Feedback */}
        {evaluation.humanFeedback && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-blue-600" />
                Human Feedback
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{evaluation.humanFeedback}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Metrics */}
      {evaluation.metrics && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Code Analysis Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {evaluation.metrics.codeQuality && (
                <div>
                  <span className="font-medium">Code Quality</span>
                  <div className="text-2xl font-bold text-primary">
                    {evaluation.metrics.codeQuality.score}/100
                  </div>
                </div>
              )}
              {evaluation.metrics.commitHistory && (
                <div>
                  <span className="font-medium">Commit Activity</span>
                  <div className="text-sm text-muted-foreground">
                    {evaluation.metrics.commitHistory.totalCommits} commits,{" "}
                    {evaluation.metrics.commitHistory.contributors} contributors
                  </div>
                  <div className="text-sm">{evaluation.metrics.commitHistory.commitFrequency}</div>
                </div>
              )}
              {evaluation.metrics.documentation && (
                <div>
                  <span className="font-medium">Documentation</span>
                  <div className="text-sm text-muted-foreground">
                    README: {evaluation.metrics.documentation.hasReadme ? "Yes" : "No"}
                    {evaluation.metrics.documentation.hasReadme &&
                      ` (${evaluation.metrics.documentation.readmeQuality}/100)`}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
