"use client";

import { use, useState, useCallback } from "react";
import Link from "next/link";
import { StaffLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCohort } from "@/lib/api/hooks/use-cohorts";
import {
  useVerticals,
  useCreateVertical,
  useUpdateVertical,
  useDeleteVertical,
  useReorderVerticals,
  useDeactivateVertical,
  type Vertical,
} from "@/lib/api/hooks/use-verticals";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Loader2,
  Power,
  PowerOff,
  Check,
  X,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VerticalItemProps {
  vertical: Vertical;
  onEdit: (vertical: Vertical) => void;
  onDelete: (vertical: Vertical) => void;
  onDeactivate: (vertical: Vertical) => void;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isDropTarget: boolean;
}

function VerticalItem({
  vertical,
  onEdit,
  onDelete,
  onDeactivate,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragging,
  isDropTarget,
}: VerticalItemProps) {
  const capacityPercentage = vertical.briefCap > 0 
    ? Math.round((vertical.briefCount / vertical.briefCap) * 100) 
    : 0;

  return (
    <div
      draggable
      onDragStart={() => onDragStart(vertical.id)}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(vertical.id);
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "flex items-center gap-4 rounded-lg border bg-card p-4 transition-all",
        isDragging && "opacity-50",
        isDropTarget && "border-primary border-2",
        !vertical.isActive && "opacity-60 bg-muted"
      )}
    >
      <div className="cursor-grab text-muted-foreground hover:text-foreground">
        <GripVertical className="h-5 w-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium truncate">{vertical.name}</h3>
          {!vertical.isActive && (
            <Badge variant="secondary" className="text-xs">Inactive</Badge>
          )}
        </div>
        {vertical.description && (
          <p className="text-sm text-muted-foreground truncate">
            {vertical.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-sm font-medium">
            {vertical.briefCount} / {vertical.briefCap}
          </div>
          <div className="text-xs text-muted-foreground">briefs</div>
        </div>

        <div className="w-20">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                capacityPercentage >= 100 ? "bg-destructive" :
                capacityPercentage >= 80 ? "bg-yellow-500" : "bg-primary"
              )}
              style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(vertical)}
            className="h-8 w-8"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDeactivate(vertical)}
            className="h-8 w-8"
            title={vertical.isActive ? "Deactivate" : "Already inactive"}
            disabled={!vertical.isActive}
          >
            {vertical.isActive ? (
              <PowerOff className="h-4 w-4" />
            ) : (
              <Power className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(vertical)}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            disabled={vertical.briefCount > 0}
            title={vertical.briefCount > 0 ? "Cannot delete - has briefs" : "Delete"}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function VerticalsContent({ cohortId }: { cohortId: string }) {
  const { data: cohort, isLoading: cohortLoading } = useCohort(cohortId);
  const { data: verticals, isLoading: verticalsLoading } = useVerticals(cohortId);
  const createMutation = useCreateVertical();
  const updateMutation = useUpdateVertical();
  const deleteMutation = useDeleteVertical();
  const reorderMutation = useReorderVerticals();
  const deactivateMutation = useDeactivateVertical();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedVertical, setSelectedVertical] = useState<Vertical | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "", briefCap: 50 });
  
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const handleDragStart = useCallback((id: string) => {
    setDraggedId(id);
  }, []);

  const handleDragOver = useCallback((id: string) => {
    if (id !== draggedId) {
      setDropTargetId(id);
    }
  }, [draggedId]);

  const handleDragEnd = useCallback(() => {
    if (draggedId && dropTargetId && verticals) {
      const newOrder = [...verticals];
      const draggedIndex = newOrder.findIndex(v => v.id === draggedId);
      const dropIndex = newOrder.findIndex(v => v.id === dropTargetId);
      
      if (draggedIndex !== -1 && dropIndex !== -1) {
        const [removed] = newOrder.splice(draggedIndex, 1);
        newOrder.splice(dropIndex, 0, removed);
        
        reorderMutation.mutate({
          cohortId,
          verticalIds: newOrder.map(v => v.id),
        });
      }
    }
    setDraggedId(null);
    setDropTargetId(null);
  }, [draggedId, dropTargetId, verticals, cohortId, reorderMutation]);

  const handleAdd = () => {
    setFormData({ name: "", description: "", briefCap: 50 });
    setShowAddDialog(true);
  };

  const handleEdit = (vertical: Vertical) => {
    setSelectedVertical(vertical);
    setFormData({
      name: vertical.name,
      description: vertical.description || "",
      briefCap: vertical.briefCap,
    });
    setShowEditDialog(true);
  };

  const handleDelete = (vertical: Vertical) => {
    setSelectedVertical(vertical);
    setShowDeleteDialog(true);
  };

  const handleDeactivate = (vertical: Vertical) => {
    deactivateMutation.mutate(vertical.id);
  };

  const handleCreateSubmit = async () => {
    await createMutation.mutateAsync({
      ...formData,
      cohortId,
    });
    setShowAddDialog(false);
  };

  const handleEditSubmit = async () => {
    if (!selectedVertical) return;
    await updateMutation.mutateAsync({
      id: selectedVertical.id,
      data: formData,
    });
    setShowEditDialog(false);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedVertical) return;
    await deleteMutation.mutateAsync({
      id: selectedVertical.id,
      cohortId,
    });
    setShowDeleteDialog(false);
  };

  const isLoading = cohortLoading || verticalsLoading;

  if (isLoading) {
    return (
      <StaffLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </StaffLayout>
    );
  }

  if (!cohort) {
    return (
      <StaffLayout>
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-destructive">Cohort not found</p>
          <Button asChild className="mt-4" variant="outline">
            <Link href="/portal/cohorts">Back to Cohorts</Link>
          </Button>
        </div>
      </StaffLayout>
    );
  }

  const sortedVerticals = verticals?.sort((a, b) => a.displayOrder - b.displayOrder) || [];
  const totalBriefs = sortedVerticals.reduce((sum, v) => sum + v.briefCount, 0);
  const totalCapacity = sortedVerticals.reduce((sum, v) => sum + v.briefCap, 0);

  return (
    <StaffLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link href={`/portal/cohorts/${cohortId}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Manage Verticals</h1>
              <p className="text-muted-foreground">{cohort.name}</p>
            </div>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Vertical
          </Button>
        </div>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-blue-100 p-2">
                <Layers className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Verticals</p>
                <p className="text-2xl font-bold">{sortedVerticals.length}</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-orange-100 p-2">
                <Check className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Verticals</p>
                <p className="text-2xl font-bold">
                  {sortedVerticals.filter(v => v.isActive).length}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-green-100 p-2">
                <Check className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Brief Usage</p>
                <p className="text-2xl font-bold">
                  {totalBriefs} / {totalCapacity}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Verticals List */}
        <div className="rounded-lg border bg-card">
          <div className="border-b p-4">
            <h2 className="font-semibold">Verticals</h2>
            <p className="text-sm text-muted-foreground">
              Drag to reorder. Order determines display priority.
            </p>
          </div>

          {sortedVerticals.length === 0 ? (
            <div className="p-8 text-center">
              <Layers className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No verticals yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Add verticals to organize briefs by industry or focus area.
              </p>
              <Button className="mt-4" onClick={handleAdd}>
                <Plus className="mr-2 h-4 w-4" />
                Add First Vertical
              </Button>
            </div>
          ) : (
            <div className="space-y-2 p-4">
              {sortedVerticals.map((vertical) => (
                <VerticalItem
                  key={vertical.id}
                  vertical={vertical}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onDeactivate={handleDeactivate}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                  isDragging={draggedId === vertical.id}
                  isDropTarget={dropTargetId === vertical.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Vertical</DialogTitle>
            <DialogDescription>
              Create a new vertical for organizing briefs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="add-name">Name *</Label>
              <Input
                id="add-name"
                placeholder="e.g., FinTech"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-description">Description</Label>
              <Textarea
                id="add-description"
                placeholder="Brief description of this vertical's focus area..."
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-briefCap">Brief Capacity</Label>
              <Input
                id="add-briefCap"
                type="number"
                min={1}
                value={formData.briefCap}
                onChange={(e) => setFormData({ ...formData, briefCap: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of briefs in this vertical
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSubmit}
              disabled={!formData.name || createMutation.isPending}
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Vertical</DialogTitle>
            <DialogDescription>
              Update the vertical details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-briefCap">Brief Capacity</Label>
              <Input
                id="edit-briefCap"
                type="number"
                min={selectedVertical?.briefCount || 1}
                value={formData.briefCap}
                onChange={(e) => setFormData({ ...formData, briefCap: Number(e.target.value) })}
              />
              {selectedVertical && selectedVertical.briefCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  Minimum: {selectedVertical.briefCount} (current brief count)
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEditSubmit}
              disabled={!formData.name || updateMutation.isPending}
            >
              {updateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Vertical</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedVertical?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StaffLayout>
  );
}

export default function VerticalsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <ProtectedRoute portal="staff">
      <VerticalsContent cohortId={id} />
    </ProtectedRoute>
  );
}
