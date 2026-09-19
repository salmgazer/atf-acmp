"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ParticipantLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useApprovedBriefs,
  type Brief,
} from "@/lib/api/hooks/use-briefs";
import { useCurrentParticipant } from "@/lib/api/hooks/use-participants";
import { useMyTeam } from "@/lib/api/hooks/use-teams";
import { useVerticals, type Vertical } from "@/lib/api/hooks/use-verticals";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  FileText,
  Building2,
  Users,
  Layers,
  Play,
  ChevronRight,
  Loader2,
  Filter,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/lib/hooks/use-debounce";

function BriefCard({ brief, onClick }: { brief: Brief; onClick: () => void }) {
  const hasVideo = !!brief.videoUrl;
  const spotsLeft = brief.maxTeams - brief.teamsCount;
  const isFull = spotsLeft <= 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-lg border bg-card overflow-hidden transition-all cursor-pointer",
        "hover:border-primary/50 hover:shadow-md",
        isFull && "opacity-60"
      )}
    >
      {/* Thumbnail/Video indicator */}
      {brief.imageUrls?.[0] || brief.videoThumbnailUrl || hasVideo ? (
        <div className="relative h-32 bg-muted">
          {brief.imageUrls?.[0] ? (
            <img
              src={brief.imageUrls[0]}
              alt={brief.title}
              className="w-full h-full object-cover"
            />
          ) : brief.videoThumbnailUrl ? (
            <img
              src={brief.videoThumbnailUrl}
              alt={brief.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-gradient-to-br from-primary/20 to-primary/5">
              <Play className="h-10 w-10 text-primary/50" />
            </div>
          )}
          {hasVideo && (
            <div className="absolute bottom-2 right-2 bg-black/70 rounded-full p-1.5">
              <Play className="h-3 w-3 text-white" />
            </div>
          )}
        </div>
      ) : (
        <div className="h-24 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
          <FileText className="h-8 w-8 text-primary/30" />
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* Title and Org */}
        <div>
          <h3 className="font-semibold line-clamp-2 leading-tight">{brief.title}</h3>
          {brief.organization && (
            <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
              {brief.organization.logoUrl ? (
                <img
                  src={brief.organization.logoUrl}
                  alt=""
                  className="w-4 h-4 rounded object-cover"
                />
              ) : (
                <Building2 className="h-3.5 w-3.5" />
              )}
              <span className="truncate">{brief.organization.name}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {brief.vertical && (
          <Badge variant="secondary" className="text-xs">
            <Layers className="mr-1 h-3 w-3" />
            {brief.vertical.name}
          </Badge>
        )}

        {/* Spots */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>
              {brief.teamsCount}/{brief.maxTeams} teams
            </span>
          </div>
          {isFull ? (
            <Badge variant="outline" className="text-xs text-red-600">
              Full
            </Badge>
          ) : (
            <span className="text-xs text-green-600">{spotsLeft} spots left</span>
          )}
        </div>
      </div>
    </div>
  );
}

function BriefsContent() {
  const [search, setSearch] = useState("");
  const [selectedVerticalId, setSelectedVerticalId] = useState<string>("");
  const [selectedBrief, setSelectedBrief] = useState<Brief | null>(null);

  // Debounce search to avoid too many API calls
  const debouncedSearch = useDebounce(search, 300);

  const { data: participant, isLoading: participantLoading } = useCurrentParticipant();
  const { data: team, isLoading: teamLoading } = useMyTeam(participant?.id || "");
  const { data: verticals, isLoading: verticalsLoading } = useVerticals(participant?.cohortId);
  const { data: briefs, isLoading: briefsLoading } = useApprovedBriefs(
    participant?.cohortId || "",
    selectedVerticalId || undefined,
    debouncedSearch || undefined
  );

  const isLoading = participantLoading || teamLoading || (briefsLoading && !briefs);

  // Check if team already has a brief assigned
  const hasBrief = !!team?.briefId;

  // Get active verticals for the filter
  const activeVerticals = useMemo(() => 
    verticals?.filter((v) => v.isActive) || [], 
    [verticals]
  );

  // Show loading only on initial load, not during search
  if (participantLoading || teamLoading) {
    return (
      <ParticipantLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ParticipantLayout>
    );
  }

  return (
    <ParticipantLayout>
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold">Browse Briefs</h1>
          <p className="text-sm text-muted-foreground">
            Explore challenges from partner organizations
          </p>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search briefs..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            value={selectedVerticalId || "all"}
            onValueChange={(value) => setSelectedVerticalId(value === "all" ? "" : value)}
          >
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Vertical" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Verticals</SelectItem>
              {activeVerticals.map((vertical) => (
                <SelectItem key={vertical.id} value={vertical.id}>
                  {vertical.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Briefs Count */}
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {briefs?.length || 0} briefs available
          </p>
          {briefsLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>

        {/* Briefs Grid */}
        {briefs && briefs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {briefs.map((brief) => (
              <BriefCard
                key={brief.id}
                brief={brief}
                onClick={() => setSelectedBrief(brief)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border bg-card p-8 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No briefs found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {search || selectedVerticalId
                ? "Try adjusting your search or filters"
                : "No approved briefs are available yet"}
            </p>
          </div>
        )}

        {/* Ranking CTA - only show if team doesn't have a brief assigned */}
        {!hasBrief && (
          <div className="rounded-lg border bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Ready to rank your favorites?</h3>
                <p className="text-sm text-muted-foreground">
                  Select up to 5 briefs you're interested in
                </p>
              </div>
              <Button asChild size="sm">
                <Link href="/app/briefs/rank">
                  Rank Briefs
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Brief Detail Modal */}
      {selectedBrief && (
        <BriefDetailModal
          brief={selectedBrief}
          onClose={() => setSelectedBrief(null)}
        />
      )}
    </ParticipantLayout>
  );
}

function BriefDetailModal({
  brief,
  onClose,
}: {
  brief: Brief;
  onClose: () => void;
}) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const spotsLeft = brief.maxTeams - brief.teamsCount;
  const isFull = spotsLeft <= 0;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="fixed inset-x-0 bottom-0 top-12 overflow-auto bg-background rounded-t-2xl shadow-xl">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between">
            <h2 className="font-semibold truncate pr-4">{brief.title}</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>

          <div className="p-4 space-y-6 pb-24">
          {/* Video/Image */}
          {brief.videoUrl ? (
            <div className="aspect-video rounded-lg overflow-hidden bg-muted">
              <video
                src={brief.videoUrl}
                controls
                className="w-full h-full object-cover"
                poster={brief.videoThumbnailUrl || brief.imageUrls?.[0]}
              />
            </div>
          ) : brief.imageUrls?.[0] ? (
            <div className="aspect-video rounded-lg overflow-hidden bg-muted">
              <img
                src={brief.imageUrls[0]}
                alt={brief.title}
                className="w-full h-full object-cover"
              />
            </div>
          ) : null}

          {/* Image Gallery */}
          {brief.imageUrls && brief.imageUrls.length > 1 && (
            <div>
              <h3 className="font-semibold mb-2">Gallery</h3>
              <div className="grid grid-cols-3 gap-2">
                {brief.imageUrls.map((url, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(url)}
                    className="aspect-square rounded-lg overflow-hidden bg-muted hover:opacity-90 transition-opacity"
                  >
                    <img
                      src={url}
                      alt={`Gallery ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Organization */}
          {brief.organization && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              {brief.organization.logoUrl ? (
                <img
                  src={brief.organization.logoUrl}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="font-medium">{brief.organization.name}</p>
                <p className="text-sm text-muted-foreground">Partner Organization</p>
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="flex flex-wrap gap-2">
            {brief.vertical && (
              <Badge variant="secondary">
                <Layers className="mr-1 h-3 w-3" />
                {brief.vertical.name}
              </Badge>
            )}
            {brief.tags?.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>

          {/* Spots */}
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <span>
                {brief.teamsCount} / {brief.maxTeams} teams
              </span>
            </div>
            {isFull ? (
              <Badge variant="destructive">Full</Badge>
            ) : (
              <Badge variant="default" className="bg-green-600">
                {spotsLeft} spots available
              </Badge>
            )}
          </div>

          {/* Description */}
          <div>
            <h3 className="font-semibold mb-2">Description</h3>
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: brief.description }}
            />
          </div>

          {/* Problem Statement */}
          <div>
            <h3 className="font-semibold mb-2">Problem Statement</h3>
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: brief.problemStatement }}
            />
          </div>

          {/* Expected Outcomes */}
          <div>
            <h3 className="font-semibold mb-2">Expected Outcomes</h3>
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: brief.expectedOutcomes }}
            />
          </div>

          {/* Resources */}
          {brief.resources && brief.resources.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Resources</h3>
              <div className="space-y-2">
                {brief.resources.map((resource, i) => (
                  <a
                    key={i}
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted transition-colors"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{resource.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {resource.type}
                    </Badge>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Image Preview Modal */}
    {selectedImage && (
      <div 
        className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
        onClick={() => setSelectedImage(null)}
      >
        <div className="relative max-w-4xl max-h-[90vh] w-full">
          <img
            src={selectedImage}
            alt="Preview"
            className="w-full h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                window.open(selectedImage, '_blank');
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in New Tab
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setSelectedImage(null)}
          >
            Close
          </Button>
        </div>
      </div>
    )}
    </>
  );
}

export default function BriefsPage() {
  return (
    <ProtectedRoute portal="participant">
      <BriefsContent />
    </ProtectedRoute>
  );
}
