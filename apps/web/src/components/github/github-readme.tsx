"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGitHubReadme } from "@/lib/api/hooks/use-github";
import { FileText, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface GitHubReadmeProps {
  githubUrl: string;
  maxHeight?: number;
}

export function GitHubReadme({ githubUrl, maxHeight = 400 }: GitHubReadmeProps) {
  const { data, isLoading } = useGitHubReadme(githubUrl);
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data?.readme) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          README
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`prose prose-sm max-w-none dark:prose-invert overflow-hidden transition-all duration-300 ${
            !expanded ? `max-h-[${maxHeight}px]` : ""
          }`}
          style={{ maxHeight: expanded ? "none" : maxHeight }}
        >
          <pre className="whitespace-pre-wrap text-sm font-sans bg-transparent p-0 overflow-auto">
            {data.readme}
          </pre>
        </div>
        {data.readme.length > 1000 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="mr-2 h-4 w-4" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="mr-2 h-4 w-4" />
                Show More
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
