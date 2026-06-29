// src/components/notifications/NotificationDropdown.tsx
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
} from "./useNotifications";
import { NotificationItem } from "./NotificationItem";
import { useNavigate } from "@tanstack/react-router";
import type { NotificationMetadata } from "@/types/notification.types";

interface NotificationDropdownProps {
  isCollapsed?: boolean;
}

export function NotificationDropdown({
  isCollapsed: _isCollapsed = false,
}: NotificationDropdownProps) {
  const navigate = useNavigate();
  const { data: notifications, isLoading } = useNotifications();
  const { data: unreadCount = 0 } = useUnreadCount();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const handleNotificationClick = (
    notificationId: string,
    metadata: NotificationMetadata | null,
  ) => {
    // Mark as read
    markAsRead.mutate(notificationId);

    // Navigate if there's a link in metadata. A stored link may include a query
    // string (e.g. "/analytics?tab=inbound"); TanStack Router's `to` is matched as
    // a pathname and does NOT parse an embedded query, so split it and pass the
    // query as `search` or the deep-link (the tab) is silently dropped.
    if (metadata?.link) {
      const [pathname, query] = metadata.link.split("?");
      const search = query
        ? Object.fromEntries(new URLSearchParams(query))
        : undefined;
      navigate({ to: pathname, search });
    }
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-3 py-2">
          <h4 className="text-sm font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsRead.isPending}
            >
              {markAllAsRead.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCheck className="h-3 w-3" />
              )}
              Mark all read
            </Button>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : notifications && notifications.length > 0 ? (
          <ScrollArea className="h-[300px]">
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() =>
                    handleNotificationClick(
                      notification.id,
                      notification.metadata as NotificationMetadata | null,
                    )
                  }
                />
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center py-8">
            <Bell className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-foreground">No notifications</p>
            <p className="text-xs text-muted-foreground">
              You're all caught up!
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
