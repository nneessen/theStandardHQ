// src/features/underwriting/hooks/useUnderwritingSessions.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useImo } from "@/contexts/ImoContext";
import { underwritingQueryKeys } from "../shared/query-keys";
import {
  createUnderwritingRequestError,
  extractUnderwritingRequestError,
  UnderwritingRequestError,
} from "../shared/request-error";
import type {
  SaveAuthoritativeSessionInput,
  UnderwritingSession,
  UnderwritingSessionSummary,
} from "../../types/underwriting.types";

export interface PaginatedSessionsResult<TSession> {
  data: TSession[];
  count: number;
}

interface PaginatedSessionsParams {
  page: number;
  pageSize: number;
  search: string;
}

function getPaginatedSessionCount(rows: UnderwritingSessionSummary[]): number {
  return rows[0]?.total_count ?? 0;
}

async function fetchAgencySessionsPaginated({
  page,
  pageSize,
  search,
}: PaginatedSessionsParams): Promise<
  PaginatedSessionsResult<UnderwritingSessionSummary>
> {
  const { data, error } = await supabase.rpc(
    "list_agency_underwriting_sessions_v1",
    {
      p_page: page,
      p_page_size: pageSize,
      p_search: search.trim() || null,
    },
  );

  if (error) {
    throw new Error(`Failed to fetch agency sessions: ${error.message}`);
  }

  const rows = data || [];
  return { data: rows, count: getPaginatedSessionCount(rows) };
}

async function fetchUserSessionsPaginated({
  page,
  pageSize,
  search,
}: PaginatedSessionsParams): Promise<
  PaginatedSessionsResult<UnderwritingSessionSummary>
> {
  const { data, error } = await supabase.rpc(
    "list_my_underwriting_sessions_v1",
    {
      p_page: page,
      p_page_size: pageSize,
      p_search: search.trim() || null,
    },
  );

  if (error) {
    throw new Error(`Failed to fetch sessions: ${error.message}`);
  }

  const rows = data || [];
  return { data: rows, count: getPaginatedSessionCount(rows) };
}

export async function fetchUnderwritingSession(
  sessionId: string,
): Promise<UnderwritingSession> {
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
  data: SaveAuthoritativeSessionInput;
}

interface SaveUnderwritingSessionResult {
  success: boolean;
  code?: string;
  error?: string;
  requestId?: string;
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
    throw await extractUnderwritingRequestError(
      error,
      "Failed to save session",
    );
  }

  const parsed = result as SaveUnderwritingSessionResult | null;
  if (!parsed?.success || !parsed.session) {
    throw createUnderwritingRequestError(parsed, "Failed to save session");
  }

  return parsed.session;
}

/**
 * Hook to fetch a specific session by ID
 */
export function useUnderwritingSession(sessionId: string) {
  return useQuery({
    queryKey: underwritingQueryKeys.session(sessionId),
    queryFn: () => fetchUnderwritingSession(sessionId),
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

  return useMutation<
    UnderwritingSession,
    UnderwritingRequestError,
    SaveAuthoritativeSessionInput
  >({
    mutationFn: (data: SaveAuthoritativeSessionInput) => saveSession({ data }),
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
      fetchAgencySessionsPaginated({
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
    queryFn: () => fetchUserSessionsPaginated({ page, pageSize, search }),
    enabled: !!user?.id && !userLoading,
    placeholderData: (prev) => prev,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
