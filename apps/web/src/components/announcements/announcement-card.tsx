"use client";

import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Megaphone, Pin, Users, Building2, UserCog, Clock } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Announcement, AnnouncementAudience } from "@/lib/api/hooks/use-announcements";

interface AnnouncementCardProps {
  announcement: Announcement;
  onClick?: () => void;
  className?: string;
}

const audienceConfig: Record<
  AnnouncementAudience,
  { label: string; icon: typeof Users }
> = {
  all: { label: "Everyone", icon: Users },
  vertical: { label: "Vertical", icon: Users },
  team: { label: "Team", icon: Users },
  organization: { label: "Organizations", icon: Building2 },
  mentor: { label: "Mentors", icon: UserCog },
};

export function AnnouncementCard({
  announcement,
  onClick,
  className,
}: AnnouncementCardProps) {
  const audienceInfo = audienceConfig[announcement.audience];
  const AudienceIcon = audienceInfo.icon;

  return (
    <Card
      className={cn(
        "cursor-pointer transition-shadow hover:shadow-md",
        announcement.isPinned && "border-primary/50 bg-primary/5",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {announcement.isPinned && (
              <Pin className="h-4 w-4 text-primary" />
            )}
            <Megaphone className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold line-clamp-1">{announcement.title}</h3>
          </div>
          <Badge variant="secondary" className="shrink-0">
            <AudienceIcon className="mr-1 h-3 w-3" />
            {audienceInfo.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {announcement.content.replace(/<[^>]*>/g, "")}
        </p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {announcement.publishedAt
              ? formatDistanceToNow(new Date(announcement.publishedAt), {
                  addSuffix: true,
                })
              : "Not published"}
          </span>
          {announcement.createdBy && (
            <span>
              by {announcement.createdBy.firstName || announcement.createdBy.email}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AnnouncementStatusBadge({
  status,
}: {
  status: Announcement["status"];
}) {
  const config = {
    draft: { label: "Draft", variant: "secondary" as const },
    scheduled: { label: "Scheduled", variant: "outline" as const },
    published: { label: "Published", variant: "default" as const },
    archived: { label: "Archived", variant: "secondary" as const },
  };

  const { label, variant } = config[status];

  return <Badge variant={variant}>{label}</Badge>;
}
