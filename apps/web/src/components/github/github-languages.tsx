"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGitHubLanguages } from "@/lib/api/hooks/use-github";
import { Loader2 } from "lucide-react";

interface GitHubLanguagesProps {
  githubUrl: string;
}

// Language colors (subset of GitHub's language colors)
const languageColors: Record<string, string> = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Python: "#3572A5",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Go: "#00ADD8",
  Rust: "#dea584",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
  HTML: "#e34c26",
  CSS: "#563d7c",
  SCSS: "#c6538c",
  Shell: "#89e051",
  Vue: "#41b883",
  Svelte: "#ff3e00",
};

export function GitHubLanguages({ githubUrl }: GitHubLanguagesProps) {
  const { data, isLoading } = useGitHubLanguages(githubUrl);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data || Object.keys(data.percentages).length === 0) {
    return null;
  }

  const sortedLanguages = Object.entries(data.percentages)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Languages</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress bar */}
        <div className="flex h-2 overflow-hidden rounded-full bg-muted">
          {sortedLanguages.map(([lang, percent]) => (
            <div
              key={lang}
              className="h-full"
              style={{
                width: `${percent}%`,
                backgroundColor: languageColors[lang] || "#8b8b8b",
              }}
              title={`${lang}: ${percent}%`}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {sortedLanguages.map(([lang, percent]) => (
            <div key={lang} className="flex items-center gap-1.5 text-sm">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: languageColors[lang] || "#8b8b8b" }}
              />
              <span className="text-muted-foreground">{lang}</span>
              <span className="font-medium">{percent}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
