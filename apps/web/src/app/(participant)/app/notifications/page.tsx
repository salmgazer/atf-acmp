"use client";

import { ParticipantLayout } from "@/components/layouts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { 
  useNotifications, 
  useMarkAsRead, 
  useMarkAllAsRead,
  type Notification,
  type NotificationType
} from "@/lib/api/hooks/use-notifications";
import { 
  Bell, 
  CheckCircle, 
  Info, 
  AlertTriangle, 
  Users, 
  UserPlus,
  Calendar,
  MessageSquare,
  FileText,
  Award,
  Megaphone,
  Clock,
  Loader2,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { toast } from "sonner";

// Map notification types to icons
const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  team_invitation: UserPlus,
  team_invitation_accepted: CheckCircle,
  team_invitation_declined: AlertTriangle,
  team_member_joined: Users,
  team_member_left: Users,
  mentor_assigned: Users,
  mentor_session_scheduled: Calendar,
  mentor_session_reminder: Clock,
  brief_status_changed: FileText,
  brief_selected: FileText,
  submission_received: FileText,
  submission_deadline: Clock,
  evaluation_complete: Award,
  chat_message: MessageSquare,
  chat_mention: MessageSquare,
  forum_reply: MessageSquare,
  forum_mention: MessageSquare,
  forum_thread_reply: MessageSquare,
  announcement: Megaphone,
  deadline_reminder: Clock,
  system_alert: AlertTriangle,
};

// Map notification types to styles
const typeStyles: Record<string, string> = {
  team_invitation: "bg-blue-100 text-blue-600",
  team_invitation_accepted: "bg-green-100 text-green-600",
  team_invitation_declined: "bg-red-100 text-red-600",
  team_member_joined: "bg-green-100 text-green-600",
  team_member_left: "bg-orange-100 text-orange-600",
  mentor_assigned: "bg-purple-100 text-purple-600",
  mentor_session_scheduled: "bg-purple-100 text-purple-600",
  mentor_session_reminder: "bg-yellow-100 text-yellow-600",
  brief_status_changed: "bg-blue-100 text-blue-600",
  brief_selected: "bg-green-100 text-green-600",
  submission_received: "bg-blue-100 text-blue-600",
  submission_deadline: "bg-yellow-100 text-yellow-600",
  evaluation_complete: "bg-green-100 text-green-600",
  chat_message: "bg-blue-100 text-blue-600",
  chat_mention: "bg-blue-100 text-blue-600",
  forum_reply: "bg-blue-100 text-blue-600",
  forum_mention: "bg-blue-100 text-blue-600",
  forum_thread_reply: "bg-blue-100 text-blue-600",
  announcement: "bg-primary/10 text-primary",
  deadline_reminder: "bg-yellow-100 text-yellow-600",
  system_alert: "bg-red-100 text-red-600",
};

function NotificationItem({ 
  notification, 
  onMarkAsRead 
}: { 
  notification: Notification;
  onMarkAsRead: (id: string) => void;
}) {
  const Icon = typeIcons[notification.type] || Info;
  const iconStyle = typeStyles[notification.type] || "bg-gray-100 text-gray-600";

  const handleClick = () => {
    if (!notification.isRead) {
      onMarkAsRead(notification.id);
    }
  };

  const content = (
    <div
      onClick={handleClick}
      className={cn(
        "rounded-lg border bg-card p-4 transition-colors cursor-pointer hover:bg-accent/50",
        !notification.isRead && "border-primary/20 bg-primary/5"
      )}
    >
      <div className="flex gap-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", iconStyle)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className={cn("font-medium", !notification.isRead && "text-primary")}>
              {notification.title}
            </h3>
            {!notification.isRead && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary mt-2" />
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {notification.body}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
          </p>
        </div>
      </div>
    </div>
  );

  if (notification.actionUrl) {
    return (
      <Link href={notification.actionUrl} onClick={handleClick}>
        {content}
      </Link>
    );
  }

  return content;
}

function NotificationsContent() {
  const { data, isLoading, error } = useNotifications({ limit: 50 });
  const markAsReadMutation = useMarkAsRead();
  const markAllAsReadMutation = useMarkAllAsRead();

  const notifications = data?.data?.data || [];
  const unreadCount = data?.data?.unreadCount || 0;

  const handleMarkAsRead = (id: string) => {
    markAsReadMutation.mutate(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("All notifications marked as read");
      },
    });
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

  if (error) {
    return (
      <ParticipantLayout>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <h3 className="mt-4 font-medium">Failed to load notifications</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Please try again later.
          </p>
        </div>
      </ParticipantLayout>
    );
  }

  return (
    <ParticipantLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {unreadCount} unread
              </p>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsReadMutation.isPending}
            >
              {markAllAsReadMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Mark all read
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 font-medium">No notifications</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              You're all caught up! Check back later.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={handleMarkAsRead}
              />
            ))}
          </div>
        )}
      </div>
    </ParticipantLayout>
  );
}

export default function NotificationsPage() {
  return (
    <ProtectedRoute portal="participant">
      <NotificationsContent />
    </ProtectedRoute>
  );
}
