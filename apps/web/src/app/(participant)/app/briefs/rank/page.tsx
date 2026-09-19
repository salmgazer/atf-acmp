"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ParticipantLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useApprovedBriefs,
  type Brief,
} from "@/lib/api/hooks/use-briefs";
import {
  useCurrentParticipant,
  useParticipantPreferences,
  useUpdateBriefRankings,
} from "@/lib/api/hooks/use-participants";
import { useMyTeam } from "@/lib/api/hooks/use-teams";
import {
  ArrowLeft,
  GripVertical,
  Save,
  Loader2,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// DnD Kit imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const MAX_RANKINGS = 5;

interface SortableBriefItemProps {
  brief: Brief;
  rank: number;
  isTopRanked: boolean;
}

function SortableBriefItem({ brief, rank, isTopRanked }: SortableBriefItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: brief.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const spotsLeft = brief.maxTeams - brief.teamsCount;
  const isFull = spotsLeft <= 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border bg-card transition-shadow",
        isDragging && "opacity-50 shadow-lg z-50",
        isFull && "opacity-60"
      )}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 touch-none cursor-grab active:cursor-grabbing p-1 -m-1"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>

      {/* Rank Number */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
          isTopRanked
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {rank}
      </div>

      {/* Brief Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sm line-clamp-1">{brief.title}</h3>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {brief.organization && (
            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
              {brief.organization.name}
            </span>
          )}
          {brief.vertical && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {brief.vertical.name}
            </Badge>
          )}
          {isFull && (
            <Badge variant="destructive" className="text-xs px-1.5 py-0">
              Full
            </Badge>
          )}
        </div>
      </div>

      {/* Trophy for #1 */}
      {rank === 1 && (
        <Trophy className="h-4 w-4 text-yellow-500 flex-shrink-0" />
      )}
    </div>
  );
}

// Overlay item shown while dragging
function DragOverlayItem({ brief, rank }: { brief: Brief; rank: number }) {
  const spotsLeft = brief.maxTeams - brief.teamsCount;
  const isFull = spotsLeft <= 0;
  const isTopRanked = rank <= MAX_RANKINGS;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border bg-card shadow-xl",
        isFull && "opacity-60"
      )}
    >
      <div className="flex-shrink-0 p-1 -m-1">
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>

      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
          isTopRanked
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {rank}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sm line-clamp-1">{brief.title}</h3>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {brief.organization && (
            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
              {brief.organization.name}
            </span>
          )}
          {brief.vertical && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {brief.vertical.name}
            </Badge>
          )}
        </div>
      </div>

      {rank === 1 && (
        <Trophy className="h-4 w-4 text-yellow-500 flex-shrink-0" />
      )}
    </div>
  );
}

function RankingContent() {
  const router = useRouter();
  const [orderedBriefs, setOrderedBriefs] = useState<Brief[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const { data: participant, isLoading: participantLoading } = useCurrentParticipant();
  const { data: team, isLoading: teamLoading } = useMyTeam(participant?.id || "");
  const { data: preferences, isLoading: preferencesLoading } = useParticipantPreferences(
    participant?.id || ""
  );
  const { data: briefs, isLoading: briefsLoading } = useApprovedBriefs(
    participant?.cohortId || ""
  );
  const updateRankingsMutation = useUpdateBriefRankings();

  const isLoading = participantLoading || teamLoading || preferencesLoading || briefsLoading;

  // Redirect if team already has a brief assigned
  useEffect(() => {
    if (!teamLoading && team?.briefId) {
      router.replace("/app/briefs");
    }
  }, [team, teamLoading, router]);

  // Sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Initialize ordered briefs from preferences and available briefs
  useEffect(() => {
    if (briefs && !initialized) {
      const existingRankings = preferences?.briefRankings || [];
      
      // Start with briefs that were previously ranked (in order)
      const rankedBriefs = existingRankings
        .map((id) => briefs.find((b) => b.id === id))
        .filter(Boolean) as Brief[];
      
      // Add remaining briefs that weren't ranked
      const unrankedBriefs = briefs.filter(
        (b) => !existingRankings.includes(b.id)
      );
      
      setOrderedBriefs([...rankedBriefs, ...unrankedBriefs]);
      setInitialized(true);
    }
  }, [briefs, preferences, initialized]);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      setOrderedBriefs((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
      setHasChanges(true);
    }
  };

  // Get the active brief for overlay
  const activeBrief = activeId ? orderedBriefs.find((b) => b.id === activeId) : null;
  const activeIndex = activeId ? orderedBriefs.findIndex((b) => b.id === activeId) : -1;

  // Get top rankings (first MAX_RANKINGS)
  const topRankings = orderedBriefs.slice(0, MAX_RANKINGS).map((b) => b.id);

  // Handle save
  const handleSave = async () => {
    if (!participant) return;
    
    try {
      await updateRankingsMutation.mutateAsync({
        participantId: participant.id,
        briefRankings: topRankings,
      });
      setHasChanges(false);
      toast.success("Rankings saved successfully!");
    } catch (error) {
      toast.error("Failed to save rankings");
    }
  };

  if (isLoading) {
    return (
      <ParticipantLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ParticipantLayout>
    );
  }

  const topBriefs = orderedBriefs.slice(0, MAX_RANKINGS);
  const otherBriefs = orderedBriefs.slice(MAX_RANKINGS);

  return (
    <ParticipantLayout>
      <div className="space-y-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/app/briefs">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Rank Your Briefs</h1>
            <p className="text-sm text-muted-foreground">
              Drag to reorder • Top {MAX_RANKINGS} are your preferences
            </p>
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Top Rankings Section */}
          <div>
            <h2 className="font-semibold text-sm text-muted-foreground mb-2 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              Your Top {MAX_RANKINGS} Preferences
            </h2>
            <SortableContext
              items={orderedBriefs.map((b) => b.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {topBriefs.map((brief, index) => (
                  <SortableBriefItem
                    key={brief.id}
                    brief={brief}
                    rank={index + 1}
                    isTopRanked={true}
                  />
                ))}
              </div>
            </SortableContext>
          </div>

          {/* Other Briefs Section */}
          {otherBriefs.length > 0 && (
            <div className="mt-6">
              <h2 className="font-semibold text-sm text-muted-foreground mb-2">
                Other Available Briefs
              </h2>
              <SortableContext
                items={orderedBriefs.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {otherBriefs.map((brief, idx) => (
                    <SortableBriefItem
                      key={brief.id}
                      brief={brief}
                      rank={MAX_RANKINGS + idx + 1}
                      isTopRanked={false}
                    />
                  ))}
                </div>
              </SortableContext>
            </div>
          )}

          {/* Drag Overlay - Shows the item being dragged */}
          <DragOverlay>
            {activeBrief ? (
              <DragOverlayItem brief={activeBrief} rank={activeIndex + 1} />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Fixed Save Button */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t">
        <Button
          className="w-full"
          size="lg"
          onClick={handleSave}
          disabled={updateRankingsMutation.isPending || !hasChanges}
        >
          {updateRankingsMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Rankings
            </>
          )}
        </Button>
      </div>
    </ParticipantLayout>
  );
}

export default function RankBriefsPage() {
  return (
    <ProtectedRoute portal="participant">
      <RankingContent />
    </ProtectedRoute>
  );
}
