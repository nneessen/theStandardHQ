// src/features/training-hub/components/ActivityTab.tsx
import {
  Mail,
  Bell,
  Clock,
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
} from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
// eslint-disable-next-line no-restricted-imports
import { supabase } from "@/services/base/supabase";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { useAuthorizationStatus } from "@/hooks/admin";
import { useAuth } from "@/contexts/AuthContext";

const PAGE_SIZE = 20;

interface ActivityTabProps {
  searchQuery: string;
}

interface EmailActivity {
  id: string;
  type: "email";
  subject: string;
  recipient: string;
  status: string;
  sent_at: string | null;
  created_at: string;
}

interface NotificationActivity {
  id: string;
  type: "notification";
  notification_type: string;
  title: string;
  message: string | null;
  user_name: string;
  created_at: string;
}

type Activity = EmailActivity | NotificationActivity;

export function ActivityTab({ searchQuery }: ActivityTabProps) {
  // Get current user and super admin status
  const { user } = useAuth();
  const { isSuperAdmin, isLoading: authStatusLoading } =
    useAuthorizationStatus();

  // Fetch recent emails with pagination - filtered by user unless super admin
  const {
    data: emailsData,
    isLoading: emailsLoading,
    isFetchingNextPage: emailsFetchingNext,
    hasNextPage: emailsHasNextPage,
    fetchNextPage: fetchNextEmails,
  } = useInfiniteQuery({
    queryKey: ["training-hub-recent-emails", user?.id, isSuperAdmin],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from("user_emails")
        .select(
          `
          id,
          subject,
          status,
          sent_at,
          created_at,
          to_addresses,
          user_id,
          sender_id,
          user:user_id(first_name, last_name, email)
        `,
        )
        .in("status", ["sent", "delivered", "failed"])
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      // Filter by current user if not super admin
      if (!isSuperAdmin && user?.id) {
        query = query.or(`user_id.eq.${user.id},sender_id.eq.${user.id}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return { data, nextPage: pageParam + PAGE_SIZE };
    },
    getNextPageParam: (lastPage) => {
      // If we got fewer items than PAGE_SIZE, there are no more pages
      return lastPage.data.length === PAGE_SIZE ? lastPage.nextPage : undefined;
    },
    initialPageParam: 0,
    enabled: !!user && !authStatusLoading,
  });

  // Fetch recent notifications with pagination - filtered by user unless super admin
  const {
    data: notificationsData,
    isLoading: notificationsLoading,
    isFetchingNextPage: notificationsFetchingNext,
    hasNextPage: notificationsHasNextPage,
    fetchNextPage: fetchNextNotifications,
  } = useInfiniteQuery({
    queryKey: ["training-hub-recent-notifications", user?.id, isSuperAdmin],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from("notifications")
        .select(
          `
          id,
          type,
          title,
          message,
          created_at,
          user_id,
          user:user_id(first_name, last_name, email)
        `,
        )
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      // Filter by current user if not super admin
      if (!isSuperAdmin && user?.id) {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return { data, nextPage: pageParam + PAGE_SIZE };
    },
    getNextPageParam: (lastPage) => {
      return lastPage.data.length === PAGE_SIZE ? lastPage.nextPage : undefined;
    },
    initialPageParam: 0,
    enabled: !!user && !authStatusLoading,
  });

  // Flatten paginated data
  const recentEmails = emailsData?.pages.flatMap((page) => page.data) || [];
  const recentNotifications =
    notificationsData?.pages.flatMap((page) => page.data) || [];

  // Combine and sort activities
  const activities: Activity[] = [];

  recentEmails.forEach((email) => {
    const recipient = email.to_addresses?.[0] || "Unknown";
    activities.push({
      id: email.id,
      type: "email",
      subject: email.subject,
      recipient,
      status: email.status,
      sent_at: email.sent_at,
      created_at: email.created_at,
    });
  });

  recentNotifications.forEach((notif) => {
    // Handle Supabase foreign key joins - could be object or array
    const userRecord = notif.user;
    const userInfo = Array.isArray(userRecord) ? userRecord[0] : userRecord;
    const userName = userInfo
      ? `${userInfo.first_name || ""} ${userInfo.last_name || ""}`.trim() ||
        userInfo.email
      : "Unknown";
    activities.push({
      id: notif.id,
      type: "notification",
      notification_type: notif.type,
      title: notif.title,
      message: notif.message,
      user_name: userName,
      created_at: notif.created_at,
    });
  });

  // Sort by created_at descending
  activities.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  // Apply search filter
  const filteredActivities = activities.filter((activity) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    if (activity.type === "email") {
      return (
        activity.subject.toLowerCase().includes(query) ||
        activity.recipient.toLowerCase().includes(query)
      );
    } else {
      return (
        activity.title.toLowerCase().includes(query) ||
        activity.message?.toLowerCase().includes(query) ||
        activity.user_name.toLowerCase().includes(query)
      );
    }
  });

  const isLoading = emailsLoading || notificationsLoading || authStatusLoading;
  const isFetchingMore = emailsFetchingNext || notificationsFetchingNext;
  const hasMoreData = emailsHasNextPage || notificationsHasNextPage;

  // Handler to load more data from both sources
  const handleLoadMore = () => {
    if (emailsHasNextPage) fetchNextEmails();
    if (notificationsHasNextPage) fetchNextNotifications();
  };

  const getEmailStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
      case "delivered":
        return <CheckCircle2 className="h-3 w-3 text-success" />;
      case "failed":
        return <AlertCircle className="h-3 w-3 text-destructive" />;
      default:
        return <Clock className="h-3 w-3 text-warning" />;
    }
  };

  const getNotificationTypeIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="h-3 w-3 text-success" />;
      case "warning":
        return <AlertCircle className="h-3 w-3 text-warning" />;
      case "error":
        return <AlertCircle className="h-3 w-3 text-destructive" />;
      default:
        return <Info className="h-3 w-3 text-info" />;
    }
  };

  return (
    <div className="flex flex-col h-full p-3">
      {/* Stats row */}
      <div className="flex items-center gap-3 text-[11px] mb-2">
        <div className="flex items-center gap-1">
          <Mail className="h-3 w-3 text-info" />
          <span className="font-medium text-v2-ink dark:text-v2-ink">
            {recentEmails?.length || 0}
          </span>
          <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
            emails
          </span>
        </div>
        <div className="h-3 w-px bg-v2-ring dark:bg-v2-ring-strong" />
        <div className="flex items-center gap-1">
          <Bell className="h-3 w-3 text-info" />
          <span className="font-medium text-v2-ink dark:text-v2-ink">
            {recentNotifications?.length || 0}
          </span>
          <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
            notifications
          </span>
        </div>
      </div>

      {/* Activity list */}
      <div className="flex-1 overflow-auto rounded-lg border border-v2-ring dark:border-v2-ring-strong">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center py-8">
              <Clock className="h-6 w-6 mx-auto mb-2 text-v2-ink-subtle" />
              <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
                {searchQuery
                  ? "No activity matches your search"
                  : "No recent activity"}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-v2-ring dark:divide-v2-ring">
            {filteredActivities.map((activity) => (
              <div
                key={`${activity.type}-${activity.id}`}
                className="flex items-start gap-2.5 px-2.5 py-2 hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/50 transition-colors"
              >
                {/* Icon */}
                <div className="mt-0.5">
                  {activity.type === "email" ? (
                    <div className="h-5 w-5 rounded-full bg-info/15 flex items-center justify-center">
                      <Mail className="h-2.5 w-2.5 text-info" />
                    </div>
                  ) : (
                    <div className="h-5 w-5 rounded-full bg-info/20 dark:bg-info/15 flex items-center justify-center">
                      <Bell className="h-2.5 w-2.5 text-info" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {activity.type === "email" ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-v2-ink dark:text-v2-ink truncate">
                          {activity.subject}
                        </span>
                        {getEmailStatusIcon(activity.status)}
                      </div>
                      <div className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle truncate">
                        To: {activity.recipient}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-v2-ink dark:text-v2-ink truncate">
                          {activity.title}
                        </span>
                        {getNotificationTypeIcon(activity.notification_type)}
                      </div>
                      <div className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle truncate">
                        {activity.message || `Sent to ${activity.user_name}`}
                      </div>
                    </>
                  )}
                </div>

                {/* Timestamp & badge */}
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <Badge
                    variant="outline"
                    className={`text-[9px] h-4 px-1 border ${
                      activity.type === "email"
                        ? "text-info border-info/30"
                        : "text-info border-info/30"
                    }`}
                  >
                    {activity.type === "email" ? "Email" : "Notification"}
                  </Badge>
                  <span className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle">
                    {formatDistanceToNow(new Date(activity.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
            ))}

            {/* Load More Button */}
            {hasMoreData && (
              <div className="p-3 flex justify-center border-t border-v2-ring dark:border-v2-ring">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={isFetchingMore}
                  className="text-[11px] h-7"
                >
                  {isFetchingMore ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ActivityTab;
