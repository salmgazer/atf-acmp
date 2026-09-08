"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useNotifications,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
  useClearReadNotifications,
  type Notification,
  type NotificationType,
} from "@/lib/api/hooks/use-notifications";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  MoreHorizontal,
  Users,
  UserPlus,
  Megaphone,
  MessageSquare,
  Calendar,
  FileText,
  AlertCircle,
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Icon mapping
const notificationIcons: Record<string, typeof Bell> = {
  team_invitation: UserPlus,
  team_invitation_accepted: Users,
  team_invitation_declined: Users,
  team_member_joined: Users,
  team_member_left: Users,
  mentor_assigned: Users,
  mentor_session_scheduled: Calendar,
  mentor_session_reminder: Clock,
  brief_status_changed: FileText,
  brief_selected: FileText,
  submission_received: FileText,
  submission_deadline: Clock,
  evaluation_complete: Check,
  chat_message: MessageSquare,
  chat_mention: MessageSquare,
  forum_reply: MessageSquare,
  forum_mention: MessageSquare,
  forum_thread_reply: MessageSquare,
  announcement: Megaphone,
  deadline_reminder: Clock,
  system_alert: AlertCircle,
};

const typeLabels: Record<string, string> = {
  team_invitation: "Team Invitation",
  team_invitation_accepted: "Invitation Accepted",
  team_invitation_declined: "Invitation Declined",
  team_member_joined: "Member Joined",
  team_member_left: "Member Left",
  mentor_assigned: "Mentor Assigned",
  mentor_session_scheduled: "Session Scheduled",
  mentor_session_reminder: "Session Reminder",
  brief_status_changed: "Brief Status",
  brief_selected: "Brief Selected",
  submission_received: "Submission",
  submission_deadline: "Deadline",
  evaluation_complete: "Evaluation",
  chat_message: "Message",
  chat_mention: "Mention",
  forum_reply: "Forum Reply",
  forum_mention: "Forum Mention",
  forum_thread_reply: "Thread Reply",
  announcement: "Announcement",
  deadline_reminder: "Reminder",
  system_alert: "Alert",
};

export function NotificationList() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data, isLoading, refetch } = useNotifications({
    page,
    limit: 20,
    unreadOnly: filter === "unread",
  });

  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const deleteNotification = useDeleteNotification();
  const clearRead = useClearReadNotifications();

  const notifications = data?.data || [];
  const unreadCount = data?.unreadCount || 0;

  const handleMarkRead = async (id: string) => {
    try {
      await markAsRead.mutateAsync(id);
    } catch {
      toast.error("Failed to mark as read");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead.mutateAsync();
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification.mutateAsync(id);
      toast.success("Notification deleted");
    } catch {
      toast.error("Failed to delete notification");
    }
  };

  const handleClearRead = async () => {
    if (!confirm("Delete all read notifications?")) return;
    try {
      const count = await clearRead.mutateAsync();
      toast.success(`${count} notifications cleared`);
    } catch {
      toast.error("Failed to clear notifications");
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await handleMarkRead(notification.id);
    }
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {unreadCount} unread
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Filter */}
          <Select
            value={filter}
            onValueChange={(v) => {
              setFilter(v as "all" | "unread");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[130px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unread">Unread only</SelectItem>
            </SelectContent>
          </Select>

          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0 || markAllAsRead.isPending}
              >
                <CheckCheck className="h-4 w-4 mr-2" />
                Mark all as read
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleClearRead}
                disabled={clearRead.isPending}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear read notifications
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Notifications */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onClick={() => handleNotificationClick(notification)}
              onMarkRead={() => handleMarkRead(notification.id)}
              onDelete={() => handleDelete(notification.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Bell className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <p className="mt-2 text-muted-foreground">
            {filter === "unread" ? "No unread notifications" : "No notifications yet"}
          </p>
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Page {data.page} of {data.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= data.totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationCard({
  notification,
  onClick,
  onMarkRead,
  onDelete,
}: {
  notification: Notification;
  onClick: () => void;
  onMarkRead: () => void;
  onDelete: () => void;
}) {
  const Icon = notificationIcons[notification.type] || Bell;

  const priorityColors: Record<string, string> = {
    urgent: "border-l-red-500 bg-red-50 dark:bg-red-950/20",
    high: "border-l-orange-500 bg-orange-50 dark:bg-orange-950/20",
    normal: "border-l-transparent",
    low: "border-l-transparent",
  };

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 border-l-4 transition-colors",
        priorityColors[notification.priority],
        !notification.isRead && "bg-primary/5"
      )}
    >
      <div className="flex gap-4">
        <button
          onClick={onClick}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center"
        >
          <Icon
            className={cn(
              "h-5 w-5",
              notification.isRead ? "text-muted-foreground" : "text-primary"
            )}
          />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <button onClick={onClick} className="text-left flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p
                  className={cn(
                    "font-medium",
                    !notification.isRead && "font-semibold"
                  )}
                >
                  {notification.title}
                </p>
                {!notification.isRead && (
                  <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {notification.body}
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="text-[10px]">
                  {typeLabels[notification.type] || notification.type}
                </Badge>
                <span>
                  {formatDistanceToNow(new Date(notification.createdAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!notification.isRead && (
                  <DropdownMenuItem onClick={onMarkRead}>
                    <Check className="h-4 w-4 mr-2" />
                    Mark as read
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}
