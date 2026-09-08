"use client";

import Link from "next/link";
import { useForumCategories, type ForumCategory } from "@/lib/api/hooks/use-forum";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  MessageCircle,
  Megaphone,
  HelpCircle,
  Lightbulb,
  Code,
  Briefcase,
  Lock,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

// Icon mapping for category icons
const iconMap: Record<string, typeof MessageSquare> = {
  general: MessageSquare,
  announcements: Megaphone,
  help: HelpCircle,
  ideas: Lightbulb,
  technical: Code,
  business: Briefcase,
  discussion: MessageCircle,
};

interface CategoryListProps {
  cohortId: string;
  verticalId?: string;
  basePath?: string; // e.g., "/app/forum" or "/mentor/forum"
}

export function CategoryList({
  cohortId,
  verticalId,
  basePath = "/app/forum",
}: CategoryListProps) {
  const { data: categories, isLoading, error } = useForumCategories(cohortId, verticalId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Failed to load forum categories
      </div>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50" />
        <p className="mt-2 text-muted-foreground">No forum categories available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {categories.map((category) => (
        <CategoryCard
          key={category.id}
          category={category}
          basePath={basePath}
        />
      ))}
    </div>
  );
}

function CategoryCard({
  category,
  basePath,
}: {
  category: ForumCategory;
  basePath: string;
}) {
  const Icon = iconMap[category.iconName || "general"] || MessageSquare;

  return (
    <Link
      href={`${basePath}/category/${category.id}`}
      className={cn(
        "block rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50",
        category.isLocked && "opacity-75"
      )}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{category.name}</h3>
            {category.isLocked && (
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {category.staffOnly && (
              <Badge variant="secondary" className="text-[10px]">
                Staff Only
              </Badge>
            )}
          </div>
          {category.description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {category.description}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="flex-shrink-0 text-right">
          <div className="text-lg font-semibold">{category.threadCount}</div>
          <div className="text-xs text-muted-foreground">
            {category.threadCount === 1 ? "thread" : "threads"}
          </div>
          {category.lastActivity && (
            <div className="mt-1 text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(category.lastActivity), {
                addSuffix: true,
              })}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
