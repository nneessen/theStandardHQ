// src/features/chat-bot/hooks/useTeamAppointments.ts
// TanStack Query hook for team-level appointment monitoring

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import { getTodayString } from "@/lib/date";
import { chatBotKeys } from "./useChatBot";

// ─── Types ──────────────────────────────────────────────────────

export interface TeamAppointmentItem {
  id: string;
  leadName: string;
  scheduledAt: string | null;
  endAt: string | null;
  status: string;
  source: string | null;
  createdAt: string | null;
}

export interface TeamAgentAppointments {
  userId: string;
  name: string;
  today: number;
  thisWeek: number;
  byStatus: {
    scheduled: number;
    completed: number;
    cancelled: number;
    noShow: number;
  };
  items: TeamAppointmentItem[];
  fetchError?: string;
}

export interface TeamAppointmentsData {
  agents: TeamAgentAppointments[];
  summary: {
    totalAgents: number;
    todayTotal: number;
    thisWeekTotal: number;
  };
  errors?: string[];
}

// ─── Query Keys ─────────────────────────────────────────────────

export const teamAppointmentKeys = {
  all: [...chatBotKeys.all, "team-appointments"] as const,
  byDate: (date: string, tz: string) =>
    [...teamAppointmentKeys.all, date, tz] as const,
};

// ─── Hook ───────────────────────────────────────────────────────

// IANA timezone (e.g. "America/New_York") — resolved from the browser so the
// edge function can interpret appointment ISO timestamps in the caller's local
// time. Without this, evening appointments crossing the UTC date boundary get
// miscounted.
function getLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function useTeamAppointments(enabled: boolean) {
  const today = getTodayString(); // YYYY-MM-DD in local tz
  const timezone = getLocalTimezone();

  return useQuery<TeamAppointmentsData>({
    queryKey: teamAppointmentKeys.byDate(today, timezone),
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "team-appointments",
        { body: { date: today, timezone } },
      );
      if (error) throw error;
      return data as TeamAppointmentsData;
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes — appointments change frequently
    retry: 1,
  });
}
