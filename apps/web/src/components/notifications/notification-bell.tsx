"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useNotifications,
  useNotificationCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useNotificationSocket,
  type Notification,
  type NotificationType,
} from "@/lib/api/hooks/use-notifications";
import {
  Bell,
  Check,
  CheckCheck,
  Users,
  UserPlus,
  Megaphone,
  MessageSquare,
  Calendar,
  FileText,
  AlertCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Icon mapping for notification types
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

interface NotificationBellProps {
  token: string;
  notificationsPath?: string; // e.g., "/app/notifications"
}

export function NotificationBell({
  token,
  notificationsPath = "/app/notifications",
}: NotificationBellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const { data: countData, refetch: refetchCount } = useNotificationCount();
  const { data: notificationsData, isLoading } = useNotifications({ limit: 5 });
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  // WebSocket for real-time updates
  useNotificationSocket({
    token,
    onNotification: (notification) => {
      // Show toast for new notifications
      toast(notification.title, {
        description: notification.body,
        action: notification.actionUrl
          ? {
              label: "View",
              onClick: () => router.push(notification.actionUrl!),
            }
          : undefined,
      });
    },
    onUnreadCountUpdate: () => {
      refetchCount();
    },
  });

  const unreadCount = countData?.unread || 0;
  const notifications = notificationsData?.data || [];

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await markAsRead.mutateAsync(notification.id);
    }

    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }

    setOpen(false);
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead.mutateAsync();
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]"
              variant="destructive"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="end">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={markAllAsRead.isPending}
              className="text-xs"
            >
              {markAllAsRead.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <CheckCheck className="h-3 w-3 mr-1" />
              )}
              Mark all read
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2" />
              <p className="text-sm">No notifications</p>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              className="w-full text-sm"
              onClick={() => {
                router.push(notificationsPath);
                setOpen(false);
              }}
            >
              View all notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function NotificationItem({
  notification,
  onClick,
}: {
  notification: Notification;
  onClick: () => void;
}) {
  const Icon = notificationIcons[notification.type] || Bell;

  const priorityColors: Record<string, string> = {
    urgent: "border-l-red-500",
    high: "border-l-orange-500",
    normal: "border-l-transparent",
    low: "border-l-transparent",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 hover:bg-muted/50 transition-colors border-l-2",
        priorityColors[notification.priority],
        !notification.isRead && "bg-primary/5"
      )}
    >
      <div className="flex gap-3">
        <div
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
            notification.isRead ? "bg-muted" : "bg-primary/10"
          )}
        >
          <Icon
            className={cn(
              "h-4 w-4",
              notification.isRead ? "text-muted-foreground" : "text-primary"
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                "text-sm truncate",
                !notification.isRead && "font-semibold"
              )}
            >
              {notification.title}
            </p>
            {!notification.isRead && (
              <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {notification.summary || notification.body}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(notification.createdAt), {
              addSuffix: true,
            })}
          </p>
        </div>
      </div>
    </button>
  );
}
