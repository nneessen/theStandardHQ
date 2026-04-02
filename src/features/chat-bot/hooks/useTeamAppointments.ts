// src/features/chat-bot/hooks/useTeamAppointments.ts
// TanStack Query hook for team-level appointment monitoring

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
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
  byDate: (date: string) => [...teamAppointmentKeys.all, date] as const,
};

// ─── Hook ───────────────────────────────────────────────────────

export function useTeamAppointments(enabled: boolean) {
  const today = new Date().toISOString().slice(0, 10);

  return useQuery<TeamAppointmentsData>({
    queryKey: teamAppointmentKeys.byDate(today),
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "team-appointments",
        { body: { date: today } },
      );
      if (error) throw error;
      return data as TeamAppointmentsData;
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes — appointments change frequently
    retry: 1,
  });
}
