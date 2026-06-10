// src/components/notifications/NotificationItem.tsx
import { formatDistanceToNow } from "date-fns";
import {
  GraduationCap,
  FileCheck,
  FileX,
  FileUp,
  MessageSquare,
  CheckCircle2,
  ArrowRight,
  ClipboardCheck,
  Mail,
  BadgeCheck,
  UserPlus,
  ThumbsUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  Notification,
  NotificationType,
} from "@/types/notification.types";

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
}

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case "recruit_graduated":
      return { icon: GraduationCap, color: "text-green-500" };
    case "document_approved":
      return { icon: FileCheck, color: "text-green-500" };
    case "document_rejected":
      return { icon: FileX, color: "text-red-500" };
    case "document_uploaded":
      return { icon: FileUp, color: "text-blue-500" };
    case "new_message":
      return { icon: MessageSquare, color: "text-purple-500" };
    case "phase_completed":
      return { icon: CheckCircle2, color: "text-green-500" };
    case "phase_advanced":
      return { icon: ArrowRight, color: "text-blue-500" };
    case "checklist_item_completed":
      return { icon: ClipboardCheck, color: "text-green-500" };
    case "email_received":
      return { icon: Mail, color: "text-blue-500" };
    case "carrier_eligible":
      return { icon: BadgeCheck, color: "text-green-500" };
    case "sponsorship_request":
      return { icon: UserPlus, color: "text-blue-500" };
    case "sponsorship_decision":
      return { icon: ThumbsUp, color: "text-amber-500" };
    default:
      return { icon: MessageSquare, color: "text-muted-foreground" };
  }
};

export function NotificationItem({
  notification,
  onClick,
}: NotificationItemProps) {
  const { icon: Icon, color } = getNotificationIcon(notification.type);
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
  });

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 p-3 text-left hover:bg-muted/50 transition-colors",
        !notification.read && "bg-muted/30",
      )}
    >
      <div className={cn("flex-shrink-0 mt-0.5", color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-sm line-clamp-2",
              !notification.read && "font-medium",
            )}
          >
            {notification.title}
          </p>
          {!notification.read && (
            <div className="flex-shrink-0 h-2 w-2 rounded-full bg-primary" />
          )}
        </div>
        {notification.message && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {notification.message}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground mt-1">{timeAgo}</p>
      </div>
    </button>
  );
}
