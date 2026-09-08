"use client";

import { useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  Megaphone,
  Plus,
  MoreHorizontal,
  Send,
  Archive,
  Trash2,
  Edit,
  Pin,
  Clock,
  Users,
  Building2,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AnnouncementStatusBadge } from "@/components/announcements";
import {
  useAdminAnnouncements,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  usePublishAnnouncement,
  useArchiveAnnouncement,
  useDeleteAnnouncement,
  type Announcement,
  type AnnouncementAudience,
  type AnnouncementStatus,
  type CreateAnnouncementDto,
} from "@/lib/api/hooks/use-announcements";
import { useCohorts } from "@/lib/api/hooks/use-cohorts";

const audienceOptions: { value: AnnouncementAudience; label: string; icon: typeof Users }[] = [
  { value: "all", label: "All Participants", icon: Users },
  { value: "vertical", label: "Specific Vertical", icon: Users },
  { value: "team", label: "Specific Teams", icon: Users },
  { value: "organization", label: "Organizations", icon: Building2 },
  { value: "mentor", label: "Mentors", icon: UserCog },
];

export default function AdminAnnouncementsPage() {
  const [selectedCohortId, setSelectedCohortId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<AnnouncementStatus | "all">("all");
  const [page, setPage] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateAnnouncementDto>({
    title: "",
    content: "",
    audience: "all",
    cohortId: "",
    isPinned: false,
    publishImmediately: false,
  });

  const { data: cohortsData } = useCohorts();
  const { data: announcementsData, isLoading } = useAdminAnnouncements({
    cohortId: selectedCohortId,
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 20,
    offset: page * 20,
  });

  const createMutation = useCreateAnnouncement();
  const updateMutation = useUpdateAnnouncement();
  const publishMutation = usePublishAnnouncement();
  const archiveMutation = useArchiveAnnouncement();
  const deleteMutation = useDeleteAnnouncement();

  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      audience: "all",
      cohortId: selectedCohortId,
      isPinned: false,
      publishImmediately: false,
    });
  };

  const handleCreate = async () => {
    await createMutation.mutateAsync({
      ...formData,
      cohortId: selectedCohortId,
    });
    setCreateDialogOpen(false);
    resetForm();
  };

  const handleUpdate = async () => {
    if (!selectedAnnouncement) return;
    await updateMutation.mutateAsync({
      id: selectedAnnouncement.id,
      dto: {
        title: formData.title,
        content: formData.content,
        audience: formData.audience,
        isPinned: formData.isPinned,
      },
    });
    setEditDialogOpen(false);
    setSelectedAnnouncement(null);
  };

  const handlePublish = async (id: string) => {
    await publishMutation.mutateAsync(id);
  };

  const handleArchive = async (id: string) => {
    await archiveMutation.mutateAsync(id);
  };

  const handleDelete = async () => {
    if (!selectedAnnouncement) return;
    await deleteMutation.mutateAsync(selectedAnnouncement.id);
    setDeleteDialogOpen(false);
    setSelectedAnnouncement(null);
  };

  const openEditDialog = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      audience: announcement.audience,
      cohortId: announcement.cohortId,
      isPinned: announcement.isPinned,
      publishImmediately: false,
    });
    setEditDialogOpen(true);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Announcements</h1>
          <p className="text-muted-foreground">
            Create and manage announcements for participants
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setCreateDialogOpen(true);
          }}
          disabled={!selectedCohortId}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Announcement
        </Button>
      </div>

      {/* Cohort Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Cohort</CardTitle>
          <CardDescription>
            Choose a cohort to view and manage announcements
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Select value={selectedCohortId} onValueChange={setSelectedCohortId}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Select a cohort" />
            </SelectTrigger>
            <SelectContent>
              {cohortsData?.data?.map((cohort) => (
                <SelectItem key={cohort.id} value={cohort.id}>
                  {cohort.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as AnnouncementStatus | "all")}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedCohortId && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Reads</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : announcementsData?.data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Megaphone className="mx-auto h-8 w-8 text-muted-foreground" />
                      <p className="mt-2 text-muted-foreground">
                        No announcements yet. Create one to get started.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  announcementsData?.data?.map((announcement) => (
                    <TableRow key={announcement.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {announcement.isPinned && (
                            <Pin className="h-4 w-4 text-primary" />
                          )}
                          <span className="font-medium">{announcement.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {audienceOptions.find((a) => a.value === announcement.audience)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <AnnouncementStatusBadge status={announcement.status} />
                      </TableCell>
                      <TableCell>
                        {announcement.publishedAt
                          ? formatDistanceToNow(new Date(announcement.publishedAt), {
                              addSuffix: true,
                            })
                          : "-"}
                      </TableCell>
                      <TableCell>{announcement.readCount}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(announcement)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            {announcement.status === "draft" && (
                              <DropdownMenuItem
                                onClick={() => handlePublish(announcement.id)}
                              >
                                <Send className="mr-2 h-4 w-4" />
                                Publish Now
                              </DropdownMenuItem>
                            )}
                            {announcement.status === "published" && (
                              <DropdownMenuItem
                                onClick={() => handleArchive(announcement.id)}
                              >
                                <Archive className="mr-2 h-4 w-4" />
                                Archive
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setSelectedAnnouncement(announcement);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {announcementsData && announcementsData.meta.total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * 20 + 1} to{" "}
            {Math.min((page + 1) * 20, announcementsData.meta.total)} of{" "}
            {announcementsData.meta.total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * 20 >= announcementsData.meta.total}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Announcement</DialogTitle>
            <DialogDescription>
              Create a new announcement for participants
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Announcement title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, content: e.target.value }))
                }
                placeholder="Write your announcement..."
                rows={6}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Audience</Label>
                <Select
                  value={formData.audience}
                  onValueChange={(v) =>
                    setFormData((prev) => ({
                      ...prev,
                      audience: v as AnnouncementAudience,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {audienceOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduledAt">Schedule (Optional)</Label>
                <Input
                  id="scheduledAt"
                  type="datetime-local"
                  value={formData.scheduledAt || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      scheduledAt: e.target.value || undefined,
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="isPinned"
                  checked={formData.isPinned}
                  onCheckedChange={(checked: boolean) =>
                    setFormData((prev) => ({ ...prev, isPinned: checked }))
                  }
                />
                <Label htmlFor="isPinned">Pin announcement</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="publishImmediately"
                  checked={formData.publishImmediately}
                  onCheckedChange={(checked: boolean) =>
                    setFormData((prev) => ({ ...prev, publishImmediately: checked }))
                  }
                />
                <Label htmlFor="publishImmediately">Publish immediately</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !formData.title || !formData.content}
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Announcement</DialogTitle>
            <DialogDescription>
              Update the announcement details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-content">Content</Label>
              <Textarea
                id="edit-content"
                value={formData.content}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, content: e.target.value }))
                }
                rows={6}
              />
            </div>
            <div className="space-y-2">
              <Label>Audience</Label>
              <Select
                value={formData.audience}
                onValueChange={(v) =>
                  setFormData((prev) => ({
                    ...prev,
                    audience: v as AnnouncementAudience,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {audienceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="edit-isPinned"
                checked={formData.isPinned}
                onCheckedChange={(checked: boolean) =>
                  setFormData((prev) => ({ ...prev, isPinned: checked }))
                }
              />
              <Label htmlFor="edit-isPinned">Pin announcement</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending || !formData.title || !formData.content}
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Announcement</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this announcement? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
