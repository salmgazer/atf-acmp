"use client";

import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { Megaphone, Pin, X, Clock, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useParticipantAnnouncements,
  useMarkAnnouncementRead,
  type Announcement,
} from "@/lib/api/hooks/use-announcements";
import { cn } from "@/lib/utils";

export default function ParticipantAnnouncementsPage() {
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const { data, isLoading } = useParticipantAnnouncements();
  const markReadMutation = useMarkAnnouncementRead();

  const handleOpenAnnouncement = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    markReadMutation.mutate(announcement.id);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="mb-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const announcements = data?.data || [];
  const pinnedAnnouncements = announcements.filter((a) => a.isPinned);
  const regularAnnouncements = announcements.filter((a) => !a.isPinned);

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Announcements</h1>
        <p className="text-muted-foreground">
          Stay updated with the latest news and updates
        </p>
      </div>

      {announcements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Megaphone className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No announcements yet</h3>
            <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
              Check back later for updates and important information from the program team.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Pinned Announcements */}
          {pinnedAnnouncements.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Pin className="h-4 w-4" />
                Pinned
              </h2>
              <div className="space-y-3">
                {pinnedAnnouncements.map((announcement) => (
                  <AnnouncementListItem
                    key={announcement.id}
                    announcement={announcement}
                    onClick={() => handleOpenAnnouncement(announcement)}
                    isPinned
                  />
                ))}
              </div>
            </div>
          )}

          {/* Regular Announcements */}
          {regularAnnouncements.length > 0 && (
            <div className="space-y-3">
              {pinnedAnnouncements.length > 0 && (
                <h2 className="text-sm font-medium text-muted-foreground">Recent</h2>
              )}
              <div className="space-y-3">
                {regularAnnouncements.map((announcement) => (
                  <AnnouncementListItem
                    key={announcement.id}
                    announcement={announcement}
                    onClick={() => handleOpenAnnouncement(announcement)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Announcement Detail Dialog */}
      <Dialog
        open={!!selectedAnnouncement}
        onOpenChange={(open) => !open && setSelectedAnnouncement(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh]">
          {selectedAnnouncement && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-2">
                  {selectedAnnouncement.isPinned && (
                    <Pin className="h-5 w-5 text-primary mt-0.5" />
                  )}
                  <DialogTitle className="text-xl">
                    {selectedAnnouncement.title}
                  </DialogTitle>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground pt-2">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {selectedAnnouncement.publishedAt &&
                      format(new Date(selectedAnnouncement.publishedAt), "PPP 'at' p")}
                  </span>
                  {selectedAnnouncement.createdBy && (
                    <span>
                      by {selectedAnnouncement.createdBy.firstName || selectedAnnouncement.createdBy.email}
                    </span>
                  )}
                </div>
              </DialogHeader>
              <ScrollArea className="max-h-[50vh] pr-4">
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: selectedAnnouncement.content.replace(/\n/g, "<br />"),
                  }}
                />
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AnnouncementListItem({
  announcement,
  onClick,
  isPinned = false,
}: {
  announcement: Announcement;
  onClick: () => void;
  isPinned?: boolean;
}) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        isPinned && "border-primary/50 bg-primary/5"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isPinned && <Pin className="h-4 w-4 text-primary shrink-0" />}
              <h3 className="font-semibold truncate">{announcement.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {announcement.content.replace(/<[^>]*>/g, "")}
            </p>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {announcement.publishedAt &&
                formatDistanceToNow(new Date(announcement.publishedAt), {
                  addSuffix: true,
                })}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}
