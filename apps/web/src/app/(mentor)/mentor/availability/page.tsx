"use client";

import { useState } from "react";
import { MentorLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useMyAvailability,
  useAddAvailabilitySlot,
  useUpdateAvailabilitySlot,
  useDeleteAvailabilitySlot,
  useMyExceptions,
  useAddException,
  useAddDateRangeException,
  useDeleteException,
  DayOfWeek,
  DAY_OF_WEEK_LABELS,
  type CreateAvailabilitySlotDto,
  type CreateExceptionDto,
  type AvailabilitySlot,
} from "@/lib/api/hooks/use-mentor-availability";
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Loader2,
  CalendarOff,
  Info,
  Palmtree,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { format, addDays, differenceInDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

// Helper to group consecutive exceptions with the same reason into periods
interface ExceptionGroup {
  days: Array<{ id: string; date: string; reason?: string; isUnavailable: boolean }>;
  reason?: string;
  isUnavailable: boolean;
}

function groupConsecutiveExceptions(
  exceptions: Array<{ id: string; date: string; reason?: string; isUnavailable: boolean }>
): ExceptionGroup[] {
  if (!exceptions || exceptions.length === 0) return [];

  // Sort by date
  const sorted = [...exceptions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const groups: ExceptionGroup[] = [];
  let currentGroup: ExceptionGroup | null = null;

  for (const exc of sorted) {
    const excDate = parseISO(exc.date);
    
    if (!currentGroup) {
      // Start a new group
      currentGroup = {
        days: [exc],
        reason: exc.reason,
        isUnavailable: exc.isUnavailable,
      };
    } else {
      const lastDate = parseISO(currentGroup.days[currentGroup.days.length - 1].date);
      const dayDiff = differenceInDays(excDate, lastDate);
      
      // Check if this exception is consecutive (1 day apart) and has the same reason
      if (dayDiff === 1 && exc.reason === currentGroup.reason && exc.isUnavailable === currentGroup.isUnavailable) {
        currentGroup.days.push(exc);
      } else {
        // Save current group and start a new one
        groups.push(currentGroup);
        currentGroup = {
          days: [exc],
          reason: exc.reason,
          isUnavailable: exc.isUnavailable,
        };
      }
    }
  }

  // Don't forget the last group
  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

function AvailabilityContent() {
  const [addSlotOpen, setAddSlotOpen] = useState(false);
  const [editSlotOpen, setEditSlotOpen] = useState(false);
  const [deleteSlotOpen, setDeleteSlotOpen] = useState(false);
  const [deletingSlotId, setDeletingSlotId] = useState<string | null>(null);
  const [editingSlot, setEditingSlot] = useState<AvailabilitySlot | null>(null);
  const [addExceptionOpen, setAddExceptionOpen] = useState(false);
  const [addVacationOpen, setAddVacationOpen] = useState(false);

  // Form state
  const [newSlot, setNewSlot] = useState<CreateAvailabilitySlotDto>({
    dayOfWeek: DayOfWeek.MONDAY,
    startTime: "09:00",
    endTime: "12:00",
    durationMinutes: 45,
    bufferMinutes: 15,
  });

  const [editSlotData, setEditSlotData] = useState<CreateAvailabilitySlotDto>({
    dayOfWeek: DayOfWeek.MONDAY,
    startTime: "09:00",
    endTime: "12:00",
    durationMinutes: 45,
    bufferMinutes: 15,
  });

  const [newException, setNewException] = useState<CreateExceptionDto>({
    date: format(new Date(), "yyyy-MM-dd"),
    isUnavailable: true,
    reason: "",
  });

  const [vacationRange, setVacationRange] = useState({
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: format(addDays(new Date(), 7), "yyyy-MM-dd"),
    reason: "Vacation",
  });

  // Queries
  const { data: availability, isLoading } = useMyAvailability();
  const { data: exceptions } = useMyExceptions(
    format(new Date(), "yyyy-MM-dd"),
    format(addDays(new Date(), 90), "yyyy-MM-dd")
  );

  // Mutations
  const addSlotMutation = useAddAvailabilitySlot();
  const updateSlotMutation = useUpdateAvailabilitySlot();
  const deleteSlotMutation = useDeleteAvailabilitySlot();
  const addExceptionMutation = useAddException();
  const addVacationMutation = useAddDateRangeException();
  const deleteExceptionMutation = useDeleteException();

  const handleAddSlot = async () => {
    try {
      await addSlotMutation.mutateAsync(newSlot);
      toast.success("Availability slot added");
      setAddSlotOpen(false);
      setNewSlot({
        dayOfWeek: DayOfWeek.MONDAY,
        startTime: "09:00",
        endTime: "12:00",
        durationMinutes: 45,
        bufferMinutes: 15,
      });
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to add slot");
    }
  };

  const handleEditSlot = (slot: AvailabilitySlot) => {
    setEditingSlot(slot);
    setEditSlotData({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime.substring(0, 5),
      endTime: slot.endTime.substring(0, 5),
      durationMinutes: slot.durationMinutes,
      bufferMinutes: slot.bufferMinutes,
    });
    setEditSlotOpen(true);
  };

  const handleUpdateSlot = async () => {
    if (!editingSlot) return;
    try {
      await updateSlotMutation.mutateAsync({
        slotId: editingSlot.id,
        ...editSlotData,
      });
      toast.success("Availability slot updated");
      setEditSlotOpen(false);
      setEditingSlot(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update slot");
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    setDeletingSlotId(slotId);
    setDeleteSlotOpen(true);
  };

  const confirmDeleteSlot = async () => {
    if (!deletingSlotId) return;
    try {
      await deleteSlotMutation.mutateAsync(deletingSlotId);
      toast.success("Slot deleted");
      setDeleteSlotOpen(false);
      setDeletingSlotId(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to delete slot");
    }
  };

  const handleAddException = async () => {
    try {
      await addExceptionMutation.mutateAsync(newException);
      toast.success("Exception added");
      setAddExceptionOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to add exception");
    }
  };

  const handleAddVacation = async () => {
    try {
      await addVacationMutation.mutateAsync(vacationRange);
      toast.success("Vacation period added");
      setAddVacationOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to add vacation");
    }
  };

  const handleDeleteException = async (exceptionId: string) => {
    try {
      await deleteExceptionMutation.mutateAsync(exceptionId);
      toast.success("Exception removed");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to remove exception");
    }
  };

  // Group slots by day
  const slotsByDay = availability?.slots?.reduce<Record<DayOfWeek, AvailabilitySlot[]>>(
    (acc, slot) => {
      const day = slot.dayOfWeek;
      if (!acc[day]) acc[day] = [];
      acc[day].push(slot);
      return acc;
    },
    {} as Record<DayOfWeek, AvailabilitySlot[]>
  ) || {} as Record<DayOfWeek, AvailabilitySlot[]>;

  if (isLoading) {
    return (
      <MentorLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MentorLayout>
    );
  }

  return (
    <MentorLayout>
      <div className="space-y-6 pb-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold">Your Availability</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Set your weekly schedule so teams can book sessions with you
          </p>
        </div>

        {/* Info Banner */}
        <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 dark:border-blue-800/50 p-4">
          <div className="flex gap-3">
            <div className="shrink-0 mt-0.5">
              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100">How it works</p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1 leading-relaxed">
                Teams that have claimed you can see your available time slots and book sessions.
                Each slot can be booked by one team. Set your recurring weekly availability below,
                and add exceptions for days you&apos;re unavailable.
              </p>
            </div>
          </div>
        </div>

        {/* Weekly Schedule */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Weekly Schedule</CardTitle>
                  <CardDescription>
                    {availability?.totalWeeklySlots || 0} session slot{(availability?.totalWeeklySlots || 0) !== 1 ? 's' : ''} per week
                  </CardDescription>
                </div>
              </div>
              <Dialog open={addSlotOpen} onOpenChange={setAddSlotOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Slot
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Availability Slot</DialogTitle>
                    <DialogDescription>
                      Add a recurring weekly time slot when you&apos;re available for sessions
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Day of Week</Label>
                      <Select
                        value={newSlot.dayOfWeek.toString()}
                        onValueChange={(v) =>
                          setNewSlot({ ...newSlot, dayOfWeek: parseInt(v) as DayOfWeek })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(DAY_OF_WEEK_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Time</Label>
                        <Input
                          type="time"
                          value={newSlot.startTime}
                          onChange={(e) =>
                            setNewSlot({ ...newSlot, startTime: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>End Time</Label>
                        <Input
                          type="time"
                          value={newSlot.endTime}
                          onChange={(e) =>
                            setNewSlot({ ...newSlot, endTime: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Session Duration</Label>
                        <Select
                          value={newSlot.durationMinutes?.toString() || "45"}
                          onValueChange={(v) =>
                            setNewSlot({ ...newSlot, durationMinutes: parseInt(v) })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30">30 minutes</SelectItem>
                            <SelectItem value="45">45 minutes</SelectItem>
                            <SelectItem value="60">60 minutes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Buffer Between</Label>
                        <Select
                          value={newSlot.bufferMinutes?.toString() || "15"}
                          onValueChange={(v) =>
                            setNewSlot({ ...newSlot, bufferMinutes: parseInt(v) })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">No buffer</SelectItem>
                            <SelectItem value="10">10 minutes</SelectItem>
                            <SelectItem value="15">15 minutes</SelectItem>
                            <SelectItem value="30">30 minutes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setAddSlotOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddSlot} disabled={addSlotMutation.isPending}>
                      {addSlotMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Add Slot
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {(!availability?.slots || availability.slots.length === 0) ? (
              <div className="text-center py-12 px-4">
                <div className="h-14 w-14 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                  <Calendar className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="font-medium text-muted-foreground">No availability set yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add your first time slot to let teams book sessions
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {[DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY, DayOfWeek.SUNDAY].map((day) => {
                  const daySlots = slotsByDay[day] || [];
                  if (daySlots.length === 0) return null;

                  return (
                    <div key={day} className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="font-semibold text-sm">{DAY_OF_WEEK_LABELS[day]}</span>
                        <Badge variant="secondary" className="text-xs font-normal">
                          {daySlots.reduce((sum, s) => sum + (s.slotCount || 0), 0)} slots
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {daySlots.map((slot) => (
                          <div
                            key={slot.id}
                            className="flex items-center justify-between bg-muted/50 hover:bg-muted/70 transition-colors rounded-lg px-4 py-3"
                          >
                            <div className="flex items-center gap-4 flex-wrap">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-primary" />
                                <span className="font-medium tabular-nums">
                                  {slot.startTime.substring(0, 5)} – {slot.endTime.substring(0, 5)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Badge variant="outline" className="font-normal">
                                  {slot.durationMinutes}min
                                </Badge>
                                <span>•</span>
                                <span>{slot.slotCount} bookable slot{slot.slotCount !== 1 ? 's' : ''}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => handleEditSlot(slot)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteSlot(slot.id)}
                                disabled={deleteSlotMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Slot Dialog */}
        <Dialog open={editSlotOpen} onOpenChange={setEditSlotOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Availability Slot</DialogTitle>
              <DialogDescription>
                Update the time slot details
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Day of Week</Label>
                <Select
                  value={editSlotData.dayOfWeek.toString()}
                  onValueChange={(v) =>
                    setEditSlotData({ ...editSlotData, dayOfWeek: parseInt(v) as DayOfWeek })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DAY_OF_WEEK_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={editSlotData.startTime}
                    onChange={(e) =>
                      setEditSlotData({ ...editSlotData, startTime: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={editSlotData.endTime}
                    onChange={(e) =>
                      setEditSlotData({ ...editSlotData, endTime: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Session Duration</Label>
                  <Select
                    value={editSlotData.durationMinutes?.toString() || "45"}
                    onValueChange={(v) =>
                      setEditSlotData({ ...editSlotData, durationMinutes: parseInt(v) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">60 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Buffer Between</Label>
                  <Select
                    value={editSlotData.bufferMinutes?.toString() || "15"}
                    onValueChange={(v) =>
                      setEditSlotData({ ...editSlotData, bufferMinutes: parseInt(v) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">No buffer</SelectItem>
                      <SelectItem value="10">10 minutes</SelectItem>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setEditSlotOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateSlot} disabled={updateSlotMutation.isPending}>
                {updateSlotMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Slot Confirmation Dialog */}
        <Dialog open={deleteSlotOpen} onOpenChange={setDeleteSlotOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Availability Slot</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this availability slot? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDeleteSlotOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmDeleteSlot} 
                disabled={deleteSlotMutation.isPending}
              >
                {deleteSlotMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Exceptions / Time Off */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <Palmtree className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">Time Off & Exceptions</CardTitle>
                  <CardDescription>
                    Mark specific dates when you&apos;re unavailable
                  </CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Dialog open={addExceptionOpen} onOpenChange={setAddExceptionOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                      <CalendarOff className="h-4 w-4 mr-1.5" />
                      Single Day
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Day Off</DialogTitle>
                      <DialogDescription>
                        Mark a specific date when you&apos;re not available
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Input
                          type="date"
                          value={newException.date}
                          onChange={(e) =>
                            setNewException({ ...newException, date: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Reason (optional)</Label>
                        <Input
                          value={newException.reason || ""}
                          onChange={(e) =>
                            setNewException({ ...newException, reason: e.target.value })
                          }
                          placeholder="e.g., Holiday, Personal day"
                        />
                      </div>
                    </div>

                    <DialogFooter className="gap-2">
                      <Button variant="outline" onClick={() => setAddExceptionOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddException} disabled={addExceptionMutation.isPending}>
                        {addExceptionMutation.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Add Day Off
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={addVacationOpen} onOpenChange={setAddVacationOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                      <Palmtree className="h-4 w-4 mr-1.5" />
                      Vacation
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Vacation Period</DialogTitle>
                      <DialogDescription>
                        Mark a date range when you&apos;re not available
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Start Date</Label>
                          <Input
                            type="date"
                            value={vacationRange.startDate}
                            onChange={(e) =>
                              setVacationRange({ ...vacationRange, startDate: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>End Date</Label>
                          <Input
                            type="date"
                            value={vacationRange.endDate}
                            onChange={(e) =>
                              setVacationRange({ ...vacationRange, endDate: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Reason (optional)</Label>
                        <Input
                          value={vacationRange.reason}
                          onChange={(e) =>
                            setVacationRange({ ...vacationRange, reason: e.target.value })
                          }
                          placeholder="e.g., Vacation, Conference"
                        />
                      </div>
                    </div>

                    <DialogFooter className="gap-2">
                      <Button variant="outline" onClick={() => setAddVacationOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddVacation} disabled={addVacationMutation.isPending}>
                        {addVacationMutation.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Add Vacation
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {(!exceptions || exceptions.length === 0) ? (
              <div className="text-center py-12 px-4">
                <div className="h-14 w-14 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                  <CalendarOff className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="font-medium text-muted-foreground">No time off scheduled</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add exceptions when you need to block specific dates
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {groupConsecutiveExceptions(exceptions).map((group, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                        group.isUnavailable 
                          ? "bg-red-100 dark:bg-red-900/30" 
                          : "bg-amber-100 dark:bg-amber-900/30"
                      )}>
                        {group.days.length > 1 ? (
                          <Palmtree className={cn(
                            "h-4 w-4",
                            group.isUnavailable 
                              ? "text-red-600 dark:text-red-400" 
                              : "text-amber-600 dark:text-amber-400"
                          )} />
                        ) : (
                          <CalendarOff className={cn(
                            "h-4 w-4",
                            group.isUnavailable 
                              ? "text-red-600 dark:text-red-400" 
                              : "text-amber-600 dark:text-amber-400"
                          )} />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {group.days.length === 1 
                            ? format(new Date(group.days[0].date), "EEEE, MMMM d, yyyy")
                            : `${format(new Date(group.days[0].date), "MMM d")} – ${format(new Date(group.days[group.days.length - 1].date), "MMM d, yyyy")}`
                          }
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {group.reason || (group.days.length > 1 ? "Vacation" : "Day off")}
                          {group.days.length > 1 && ` (${group.days.length} days)`}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        // Delete all days in the group
                        if (confirm(`Delete ${group.days.length > 1 ? 'this vacation period' : 'this day off'}?`)) {
                          group.days.forEach(exc => handleDeleteException(exc.id));
                        }
                      }}
                      disabled={deleteExceptionMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MentorLayout>
  );
}

export default function MentorAvailabilityPage() {
  return (
    <ProtectedRoute portal="mentor">
      <AvailabilityContent />
    </ProtectedRoute>
  );
}
