// src/features/messages/hooks/useSendPace.ts
// Send-pacing aggregate shared by the header quota meter and the rail's Send
// Pace card. sent/cap come from the real email quota; `scheduled` counts queued
// outbound sends across channels (scheduled emails + pending Instagram DMs).

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/services/base/supabase";
import { useEmailQuota } from "./useSendEmail";

export interface SendPace {
  sent: number;
  cap: number;
  scheduled: number;
  remaining: number;
  isLoading: boolean;
}

async function fetchScheduledCount(userId: string): Promise<number> {
  const [emailRes, igRes] = await Promise.all([
    supabase
      .from("user_emails")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("scheduled_for", "is", null)
      .is("sent_at", null),
    supabase
      .from("instagram_scheduled_messages")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);
  return (emailRes.count ?? 0) + (igRes.count ?? 0);
}

export function useSendPace(): SendPace {
  const { user } = useAuth();
  const { quota, isLoading: quotaLoading } = useEmailQuota();

  const { data: scheduled = 0, isLoading: schedLoading } = useQuery({
    queryKey: ["sendPace", "scheduled", user?.id],
    queryFn: () => fetchScheduledCount(user!.id!),
    enabled: !!user?.id,
    staleTime: 60_000,
    refetchInterval: 300_000,
  });

  const sent = quota?.dailyUsed ?? 0;
  const cap = quota?.dailyLimit ?? 50;

  return {
    sent,
    cap,
    scheduled,
    remaining: Math.max(0, cap - sent),
    isLoading: quotaLoading || schedLoading,
  };
}
