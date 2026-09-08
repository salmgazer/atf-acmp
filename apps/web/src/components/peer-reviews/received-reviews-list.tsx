"use client";

import { format } from "date-fns";
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  MessageSquare,
  Star,
  ThumbsUp,
  Lightbulb,
  Eye,
  EyeOff,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useMyReceivedReviews, PeerReview } from "@/lib/api/hooks/use-peer-reviews";

export function ReceivedReviewsList() {
  const { data: reviews, isLoading, error } = useMyReceivedReviews();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-muted-foreground">Failed to load reviews</p>
        </CardContent>
      </Card>
    );
  }

  if (!reviews || reviews.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-1">No Reviews Received Yet</h3>
          <p className="text-muted-foreground text-center max-w-md">
            You haven't received any peer reviews yet. Reviews will appear here once other teams complete their evaluations.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate average score
  const averageScore =
    reviews.reduce((sum, r) => sum + Number(r.overallScore), 0) / reviews.length;

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            Review Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {reviews.length}
              </div>
              <div className="text-sm text-muted-foreground">Reviews Received</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {Math.round(averageScore)}%
              </div>
              <div className="text-sm text-muted-foreground">Average Score</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {Math.max(...reviews.map((r) => Number(r.overallScore)))}%
              </div>
              <div className="text-sm text-muted-foreground">Highest Score</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-600">
                {Math.min(...reviews.map((r) => Number(r.overallScore)))}%
              </div>
              <div className="text-sm text-muted-foreground">Lowest Score</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Reviews */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Individual Reviews</h2>
        <Accordion type="single" collapsible className="space-y-4">
          {reviews.map((review, index) => (
            <ReviewCard key={review.id} review={review} index={index + 1} />
          ))}
        </Accordion>
      </div>
    </div>
  );
}

function ReviewCard({ review, index }: { review: PeerReview; index: number }) {
  return (
    <AccordionItem value={review.id} className="border rounded-lg">
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex items-center justify-between w-full pr-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
              {index}
            </span>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {review.isAnonymous ? "Anonymous Reviewer" : "Reviewer"}
                </span>
                {review.isAnonymous ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                {format(new Date(review.submittedAt), "MMM d, yyyy")}
                {review.assignment?.stage && ` • ${review.assignment.stage.name}`}
              </span>
            </div>
          </div>
          <Badge variant="default" className="text-lg px-3 py-1">
            {Math.round(Number(review.overallScore))}%
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-6 pt-4">
          {/* Score Breakdown */}
          {review.scores.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Star className="h-4 w-4" />
                Score Breakdown
              </h4>
              <div className="space-y-3">
                {review.scores.map((score) => (
                  <div key={score.criterionId} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{score.criterionName}</span>
                      <span className="font-medium">
                        {score.score}/{score.maxScore}
                      </span>
                    </div>
                    <Progress
                      value={(score.score / score.maxScore) * 100}
                      className="h-2"
                    />
                    {score.comment && (
                      <p className="text-sm text-muted-foreground italic pl-2 border-l-2">
                        {score.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Strengths */}
          {review.strengths && review.strengths.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2 text-green-600">
                <ThumbsUp className="h-4 w-4" />
                Strengths
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {review.strengths.map((strength, i) => (
                  <li key={i}>{strength}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Areas for Improvement */}
          {review.improvements && review.improvements.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2 text-amber-600">
                <Lightbulb className="h-4 w-4" />
                Areas for Improvement
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {review.improvements.map((improvement, i) => (
                  <li key={i}>{improvement}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Overall Comment */}
          {review.overallComment && (
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Overall Comments
              </h4>
              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                {review.overallComment}
              </p>
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
