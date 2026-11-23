"use client";

import { Fragment, useState, useEffect } from "react";
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
import { participantBriefScopeKey } from "@/lib/api/hooks/use-briefs";
import { normalizeTeamCountry } from "@acmp/shared";
import {
  ArrowLeft,
  GripVertical,
  Save,
  Loader2,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  total: number;
  isSorting: boolean;
  onMove: (id: string, index: number) => void;
}

function SortableBriefItem({ brief, rank, isTopRanked, total, isSorting, onMove }: SortableBriefItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
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
        "flex items-center gap-2 p-3 rounded-lg border bg-card transition-shadow",
        isDragging && "opacity-50 shadow-lg z-50",
        isFull && "opacity-60"
      )}
    >
      {/* Drag Handle */}
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${brief.title} to reorder`}
        title="Drag to reorder; or choose a rank beside it"
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg touch-none cursor-grab active:cursor-grabbing hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </button>

      {/* Rank Number */}
      <select
        aria-label={`Rank for ${brief.title}`}
        value={rank}
        disabled={isSorting}
        onChange={event => onMove(brief.id, Number(event.target.value) - 1)}
        className={cn(
          "h-11 w-14 flex-shrink-0 rounded-lg border px-1 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
          isTopRanked
            ? "border-primary bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {Array.from({ length: total }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
      </select>

      {/* Brief Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sm line-clamp-1">{brief.title}</h3>
        {(brief.problemCountry?.trim() || brief.organization?.country) && <span className="text-xs text-muted-foreground">{normalizeTeamCountry(brief.problemCountry?.trim() || brief.organization?.country)}</span>}
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const { data: participant, isLoading: participantLoading } = useCurrentParticipant();
  const { data: team, isLoading: teamLoading } = useMyTeam(participant?.id || "");
  const { data: preferences, isLoading: preferencesLoading, isError: preferencesError, refetch: refetchPreferences } = useParticipantPreferences(
    participant?.id || ""
  );
  const { data: briefs, isLoading: briefsLoading, isError: briefsError, refetch: refetchBriefs } = useApprovedBriefs(
    participant?.cohortId || "", undefined, undefined, participantBriefScopeKey(participant, team),
  );
  const updateRankingsMutation = useUpdateBriefRankings();

  const isLoading = participantLoading || teamLoading || preferencesLoading || briefsLoading;
  const loadFailed = preferencesError || briefsError;

  // Redirect if team already has a brief assigned
  useEffect(() => {
    if (!teamLoading && team?.briefId) {
      router.replace("/participant/briefs");
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

  // Reconcile visibility when the confirmed roster changes, preserving local ranking order.
  useEffect(() => {
    if (briefs && !preferencesLoading && !teamLoading && !loadFailed) {
      setOrderedBriefs(current => {
        const existingRankings = initialized ? current.map(brief => brief.id) : preferences?.briefRankings || [];
        const rankedBriefs = existingRankings.map(id => briefs.find(brief => brief.id === id)).filter(Boolean) as Brief[];
        return [...rankedBriefs, ...briefs.filter(brief => !existingRankings.includes(brief.id))];
      });
      setInitialized(true);
    }
  }, [briefs, preferences, initialized, preferencesLoading, teamLoading, loadFailed]);

  const moveBrief = (id: string, newIndex: number) => {
    setOrderedBriefs(items => {
      const oldIndex = items.findIndex(item => item.id === id);
      return oldIndex < 0 || newIndex < 0 || newIndex >= items.length || oldIndex === newIndex
        ? items : arrayMove(items, oldIndex, newIndex);
    });
  };

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
        return oldIndex < 0 || newIndex < 0 ? items : arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Get the active brief for overlay
  const activeBrief = activeId ? orderedBriefs.find((b) => b.id === activeId) : null;
  const activeIndex = activeId ? orderedBriefs.findIndex((b) => b.id === activeId) : -1;

  // Get top rankings (first MAX_RANKINGS)
  const topRankings = orderedBriefs.slice(0, MAX_RANKINGS).map((b) => b.id);
  const savedRankings = preferences?.briefRankings || [];
  // Compare with the last server-confirmed order. An older save must never
  // mark newer edits as saved, including edits made while its request is pending.
  const hasChanges = initialized && topRankings.length > 0 && (
    topRankings.length !== savedRankings.length || topRankings.some((id, index) => id !== savedRankings[index])
  );

  // Handle save
  const handleSave = () => {
    if (!participant || !hasChanges || loadFailed || activeId || updateRankingsMutation.isPending) return;
    updateRankingsMutation.mutate({ participantId: participant.id, briefRankings: topRankings });
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

  return (
    <ParticipantLayout>
      <div className="space-y-4 pb-40 md:pb-28">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/participant/briefs">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Rank Your Briefs</h1>
            <p className="text-sm text-muted-foreground">
              Choose a rank or drag the grip. Only your top {MAX_RANKINGS} preferences are saved.
            </p>
          </div>
        </div>

        {loadFailed && <div role="alert" className="space-y-2 rounded-lg border border-destructive p-3 text-sm"><p>Could not load your briefs or saved rankings. Try again before saving.</p><Button variant="outline" onClick={() => { void refetchPreferences(); void refetchBriefs(); }}>Try again</Button></div>}
        {!loadFailed && !orderedBriefs.length && <p className="py-8 text-center text-sm text-muted-foreground">No approved briefs are currently available to rank.</p>}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext items={orderedBriefs.map(brief => brief.id)} strategy={verticalListSortingStrategy}>
            {orderedBriefs.length > 0 && <h2 className="font-semibold text-sm text-muted-foreground mb-2 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              Your Top {MAX_RANKINGS} Preferences
            </h2>}
            <div className="space-y-2">
              {orderedBriefs.map((brief, index) => <Fragment key={brief.id}>
                {index === MAX_RANKINGS && <h2 className="pt-4 pb-1 text-sm font-semibold text-muted-foreground">Other Available Briefs</h2>}
                <SortableBriefItem
                  brief={brief}
                  rank={index + 1}
                  isTopRanked={index < MAX_RANKINGS}
                  total={orderedBriefs.length}
                  isSorting={activeId !== null}
                  onMove={moveBrief}
                />
              </Fragment>)}
            </div>
          </SortableContext>

          {/* Drag Overlay - Shows the item being dragged */}
          <DragOverlay>
            {activeBrief ? (
              <DragOverlayItem brief={activeBrief} rank={activeIndex + 1} />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Fixed Save Button */}
      <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-30 p-4 bg-background/80 backdrop-blur-sm border-t md:bottom-0 md:left-64">
        {!loadFailed && orderedBriefs.length > 0 && <p aria-live="polite" className="mb-2 text-center text-xs text-muted-foreground">{hasChanges ? "Your current preferences have unsaved changes." : "Your current preferences are saved."}</p>}
        <Button
          className="w-full"
          size="lg"
          onClick={handleSave}
          disabled={updateRankingsMutation.isPending || !hasChanges || loadFailed || activeId !== null}
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
