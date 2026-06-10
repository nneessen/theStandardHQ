// src/features/messages/hooks/useMessagingAnalytics.ts
// Hook to fetch aggregated messaging analytics across all platforms

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentUserProfile } from "@/hooks/admin";

export interface EmailAnalytics {
  totalSent: number;
  delivered: number;
  opened: number;
  clicked: number;
  openRate: number;
  clickRate: number;
}

export interface InstagramAnalytics {
  totalSent: number;
  delivered: number;
  read: number;
  deliveryRate: number;
  readRate: number;
  templateUses: number;
}

export interface MessagingAnalytics {
  email: EmailAnalytics;
  instagram: InstagramAnalytics;
  period: "7d" | "30d" | "90d";
}

// Pure calculation functions for testability
export function calculateEmailMetrics(
  emails: {
    status: string | null;
    open_count: number | null;
    click_count: number | null;
  }[],
): EmailAnalytics {
  const totalSent = emails.length;
  const delivered = emails.filter(
    (e) => e.status === "delivered" || e.status === "sent",
  ).length;
  const opened = emails.filter((e) => (e.open_count ?? 0) > 0).length;
  const clicked = emails.filter((e) => (e.click_count ?? 0) > 0).length;

  return {
    totalSent,
    delivered,
    opened,
    clicked,
    openRate: totalSent > 0 ? Math.round((opened / totalSent) * 100) : 0,
    clickRate: totalSent > 0 ? Math.round((clicked / totalSent) * 100) : 0,
  };
}

export function calculateInstagramMetrics(
  messages: { status: string | null; read_at: string | null }[],
  templateUses: number,
): InstagramAnalytics {
  const totalSent = messages.length;
  const delivered = messages.filter((m) => m.status === "delivered").length;
  const read = messages.filter((m) => m.read_at !== null).length;

  return {
    totalSent,
    delivered,
    read,
    deliveryRate: totalSent > 0 ? Math.round((delivered / totalSent) * 100) : 0,
    readRate: totalSent > 0 ? Math.round((read / totalSent) * 100) : 0,
    templateUses,
  };
}

// Helper to get start date for period (uses UTC start of day for consistency)
function getStartDate(days: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

async function fetchEmailAnalytics(
  userId: string,
  days: number,
): Promise<EmailAnalytics> {
  const startDate = getStartDate(days);

  const { data, error } = await supabase
    .from("user_emails")
    .select("status, open_count, click_count")
    .eq("user_id", userId)
    .eq("is_incoming", false)
    .gte("sent_at", startDate);

  if (error) {
    throw new Error(`Failed to fetch email analytics: ${error.message}`);
  }

  return calculateEmailMetrics(data || []);
}

async function fetchInstagramAnalytics(
  userId: string,
  imoId: string,
  days: number,
): Promise<InstagramAnalytics> {
  const startDate = getStartDate(days);

  // Single query with JOIN via nested select to avoid N+1
  // Get messages through conversations -> integrations chain
  const { data: messages, error: messagesError } = await supabase
    .from("instagram_messages")
    .select(
      `
      status,
      read_at,
      conversation:instagram_conversations!inner(
        integration:instagram_integrations!inner(
          imo_id
        )
      )
    `,
    )
    .eq("conversation.integration.imo_id", imoId)
    .eq("direction", "outbound")
    .gte("sent_at", startDate);

  if (messagesError) {
    throw new Error(
      `Failed to fetch Instagram analytics: ${messagesError.message}`,
    );
  }

  // Get template usage (separate query - different table)
  const { data: templates, error: templatesError } = await supabase
    .from("instagram_message_templates")
    .select("use_count")
    .eq("is_active", true)
    .or(`user_id.eq.${userId},user_id.is.null`);

  if (templatesError) {
    throw new Error(
      `Failed to fetch template usage: ${templatesError.message}`,
    );
  }

  const templateUses = (templates || []).reduce(
    (sum, t) => sum + (t.use_count || 0),
    0,
  );

  return calculateInstagramMetrics(messages || [], templateUses);
}

export function useMessagingAnalytics(period: "7d" | "30d" | "90d" = "30d") {
  const { user } = useAuth();
  const { data: profile } = useCurrentUserProfile();
  const userId = user?.id;
  const imoId = profile?.imo_id;

  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;

  return useQuery({
    queryKey: ["messaging-analytics", userId, imoId, period],
    queryFn: async (): Promise<MessagingAnalytics> => {
      if (!userId || !imoId) {
        return {
          email: {
            totalSent: 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
            openRate: 0,
            clickRate: 0,
          },
          instagram: {
            totalSent: 0,
            delivered: 0,
            read: 0,
            deliveryRate: 0,
            readRate: 0,
            templateUses: 0,
          },
          period,
        };
      }

      const [email, instagram] = await Promise.all([
        fetchEmailAnalytics(userId, days),
        fetchInstagramAnalytics(userId, imoId, days),
      ]);

      return { email, instagram, period };
    },
    enabled: !!userId && !!imoId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
