// src/features/underwriting/hooks/useUnderwritingSessions.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useImo } from "@/contexts/ImoContext";
import { underwritingQueryKeys } from "./useHealthConditions";
import type {
  UnderwritingSession,
  SessionSaveData,
} from "../types/underwriting.types";

export interface PaginatedSessionsResult {
  data: UnderwritingSession[];
  count: number;
}

interface PaginatedSessionsParams {
  page: number;
  pageSize: number;
  search: string;
}

async function fetchUserSessions(
  userId: string,
): Promise<UnderwritingSession[]> {
  const { data, error } = await supabase
    .from("underwriting_sessions")
    .select("*")
    .eq("created_by", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch sessions: ${error.message}`);
  }

  return data || [];
}

async function fetchAgencySessions(
  agencyId: string,
  imoId: string,
): Promise<UnderwritingSession[]> {
  const { data, error } = await supabase
    .from("underwriting_sessions")
    .select("*")
    .eq("agency_id", agencyId)
    .eq("imo_id", imoId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch agency sessions: ${error.message}`);
  }

  return data || [];
}

async function fetchAgencySessionsPaginated(
  agencyId: string,
  imoId: string,
  { page, pageSize, search }: PaginatedSessionsParams,
): Promise<PaginatedSessionsResult> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("underwriting_sessions")
    .select("*", { count: "exact" })
    .eq("agency_id", agencyId)
    .eq("imo_id", imoId);

  if (search.trim()) {
    const pattern = `%${search.trim()}%`;
    query = query.or(
      `client_name.ilike.${pattern},client_state.ilike.${pattern},health_tier.ilike.${pattern}`,
    );
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(`Failed to fetch agency sessions: ${error.message}`);
  }

  return { data: data || [], count: count ?? 0 };
}

async function fetchUserSessionsPaginated(
  userId: string,
  { page, pageSize, search }: PaginatedSessionsParams,
): Promise<PaginatedSessionsResult> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("underwriting_sessions")
    .select("*", { count: "exact" })
    .eq("created_by", userId);

  if (search.trim()) {
    const pattern = `%${search.trim()}%`;
    query = query.or(
      `client_name.ilike.${pattern},client_state.ilike.${pattern},health_tier.ilike.${pattern}`,
    );
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(`Failed to fetch sessions: ${error.message}`);
  }

  return { data: data || [], count: count ?? 0 };
}

async function fetchSession(sessionId: string): Promise<UnderwritingSession> {
  const { data, error } = await supabase
    .from("underwriting_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch session: ${error.message}`);
  }

  return data;
}

interface SaveSessionParams {
  data: SessionSaveData;
}

interface SaveUnderwritingSessionResult {
  success: boolean;
  error?: string;
  session?: UnderwritingSession;
}

async function saveSession(
  params: SaveSessionParams,
): Promise<UnderwritingSession> {
  const { data } = params;
  const { data: result, error } = await supabase.functions.invoke(
    "save-underwriting-session",
    {
      body: data,
    },
  );

  if (error) {
    let message = error.message;

    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const body = (await ctx.json()) as { error?: string };
        message = body.error || message;
      }
    } catch {
      // Ignore response body parsing failures and surface the transport error.
    }

    throw new Error(`Failed to save session: ${message}`);
  }

  const parsed = result as SaveUnderwritingSessionResult | null;
  if (!parsed?.success || !parsed.session) {
    throw new Error(parsed?.error || "Failed to save session");
  }

  return parsed.session;
}

/**
 * Hook to fetch the current user's underwriting sessions
 */
export function useUnderwritingSessions() {
  const { user, loading: userLoading } = useAuth();

  return useQuery({
    queryKey: underwritingQueryKeys.sessions(user?.id || ""),
    queryFn: () => fetchUserSessions(user!.id!),
    enabled: !!user?.id && !userLoading,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to fetch a specific session by ID
 */
export function useUnderwritingSession(sessionId: string) {
  return useQuery({
    queryKey: underwritingQueryKeys.session(sessionId),
    queryFn: () => fetchSession(sessionId),
    enabled: !!sessionId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to save an underwriting session
 */
export function useSaveUnderwritingSession() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { agency, imo } = useImo();

  return useMutation({
    mutationFn: (data: SessionSaveData) => saveSession({ data }),
    onSuccess: () => {
      // Invalidate the sessions list (both user and agency)
      if (user?.id) {
        queryClient.invalidateQueries({
          queryKey: underwritingQueryKeys.sessions(user.id),
        });
      }
      if (agency?.id && imo?.id) {
        queryClient.invalidateQueries({
          queryKey: underwritingQueryKeys.agencySessions(imo.id, agency.id),
        });
      }
    },
  });
}

/**
 * Hook to fetch all sessions for the current agency (agency-wide access)
 */
export function useAgencySessions() {
  const { agency, imo, loading: imoLoading } = useImo();

  return useQuery({
    queryKey: underwritingQueryKeys.agencySessions(
      imo?.id || "",
      agency?.id || "",
    ),
    queryFn: () => fetchAgencySessions(agency!.id!, imo!.id),
    enabled: !!agency?.id && !!imo?.id && !imoLoading,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to fetch paginated agency sessions with optional search
 */
export function useAgencySessionsPaginated(
  page: number,
  pageSize: number,
  search: string,
) {
  const { agency, imo, loading: imoLoading } = useImo();

  return useQuery({
    queryKey: underwritingQueryKeys.agencySessionsPaginated(
      imo?.id || "",
      agency?.id || "",
      page,
      pageSize,
      search,
    ),
    queryFn: () =>
      fetchAgencySessionsPaginated(agency!.id!, imo!.id, {
        page,
        pageSize,
        search,
      }),
    enabled: !!agency?.id && !!imo?.id && !imoLoading,
    placeholderData: (prev) => prev,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch paginated user sessions with optional search
 */
export function useUserSessionsPaginated(
  page: number,
  pageSize: number,
  search: string,
) {
  const { user, loading: userLoading } = useAuth();

  return useQuery({
    queryKey: underwritingQueryKeys.sessionsPaginated(
      user?.id || "",
      page,
      pageSize,
      search,
    ),
    queryFn: () =>
      fetchUserSessionsPaginated(user!.id!, { page, pageSize, search }),
    enabled: !!user?.id && !userLoading,
    placeholderData: (prev) => prev,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
