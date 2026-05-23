// src/contexts/ImoContext.tsx
// Context for managing IMO and Agency state

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./AuthContext";
import { imoService } from "../services/imo";
import { agencyService } from "../services/agency";
import { supabase } from "../services/base";
import { logger } from "../services/base/logger";
import type { Imo, Agency, ImoContextType } from "../types/imo.types";
import { hasImoAdminRole, hasImoOwnerRole } from "../types/imo.types";

// Create the context
const ImoContext = createContext<ImoContextType | undefined>(undefined);

/**
 * Default context value for when provider is not available
 * Used to prevent errors during auth state transitions
 */
const DEFAULT_IMO_CONTEXT: ImoContextType = {
  imo: null,
  agency: null,
  isImoOwner: false,
  isImoAdmin: false,
  isAgencyOwner: false,
  isSuperAdmin: false,
  loading: true,
  error: null,
  actingImoId: null,
  setActingImoId: () => {},
  effectiveImoId: null,
  refetch: async () => {},
};

const ACTING_IMO_STORAGE_KEY = "acting-imo-id";

/**
 * Hook to access IMO context
 * Returns safe defaults if called outside provider (e.g., during auth transitions)
 */
export const useImo = (): ImoContextType => {
  const context = useContext(ImoContext);
  // Return safe defaults instead of throwing during auth transitions
  // This handles the race condition where Sidebar may briefly render
  // outside ImoProvider during auth state changes
  if (!context) {
    return DEFAULT_IMO_CONTEXT;
  }
  return context;
};

/**
 * Hook to check if ImoProvider is available
 * Useful for conditional rendering based on provider presence
 */
export const useImoAvailable = (): boolean => {
  const context = useContext(ImoContext);
  return context !== undefined;
};

interface ImoProviderProps {
  children: React.ReactNode;
}

/**
 * Provider component for IMO context
 * Loads IMO and Agency data for the current user
 */
export const ImoProvider: React.FC<ImoProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Use ref to track current user for race condition prevention
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // State
  const [imo, setImo] = useState<Imo | null>(null);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [actingImoId, setActingImoIdState] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(ACTING_IMO_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  // Fetch IMO and Agency data
  const fetchImoData = useCallback(async () => {
    if (!user?.id) {
      setImo(null);
      setAgency(null);
      setLoading(false);
      setError(null);
      return;
    }

    // Capture user ID to detect stale responses
    const currentUserId = user.id;

    try {
      setLoading(true);
      setError(null);

      // Fetch IMO and Agency in parallel using allSettled
      // Pass userId directly to avoid redundant getUser() calls in services
      // User roles are now available from AuthContext (user.roles, user.is_super_admin)
      const results = await Promise.allSettled([
        imoService.getMyImoForUser(currentUserId),
        agencyService.getMyAgencyForUser(currentUserId),
      ]);

      // Guard against stale responses using ref (not closure)
      if (userRef.current?.id !== currentUserId) {
        return;
      }

      // Extract results, handling partial failures
      const imoData =
        results[0].status === "fulfilled" ? results[0].value : null;
      const agencyData =
        results[1].status === "fulfilled" ? results[1].value : null;

      // Log any failures but don't throw
      if (results[0].status === "rejected") {
        logger.warn(
          "Failed to fetch IMO data",
          { error: results[0].reason },
          "ImoContext",
        );
      }
      if (results[1].status === "rejected") {
        logger.warn(
          "Failed to fetch agency data",
          { error: results[1].reason },
          "ImoContext",
        );
      }

      setImo(imoData);
      setAgency(agencyData);
    } catch (err) {
      // Guard against stale error using ref
      if (userRef.current?.id !== currentUserId) {
        return;
      }
      const error =
        err instanceof Error ? err : new Error("Failed to fetch IMO data");
      logger.error("Failed to fetch IMO data", error, "ImoContext");
      setError(error);
    } finally {
      // Only update loading if this is still the current user's request
      if (userRef.current?.id === currentUserId) {
        setLoading(false);
      }
    }
  }, [user?.id]);

  // Fetch data when user changes
  useEffect(() => {
    fetchImoData();
  }, [fetchImoData]);

  // Derive role flags from AuthContext user data (avoids redundant DB query)
  // user.roles and user.is_super_admin are now available after AuthContext awaits full profile
  const roles = user?.roles ?? [];
  const isImoOwner = hasImoOwnerRole(roles);
  const isImoAdmin = hasImoAdminRole(roles);
  const isAgencyOwner = agency?.owner_id === user?.id;
  const isSuperAdmin = user?.is_super_admin === true;

  // Super-admin-only acting IMO setter. Non-super-admins cannot bypass tenant.
  // The acting_imo_id is written to auth.users.raw_user_meta_data via
  // supabase.auth.updateUser — the SQL helper get_effective_imo_id() reads it
  // directly via SECURITY DEFINER, so RLS scoping takes effect on the next
  // query. No JWT refresh is needed.
  const setActingImoId = useCallback(
    async (imoId: string | null) => {
      if (!isSuperAdmin) {
        logger.warn(
          "Non-super-admin attempted to set actingImoId; ignored",
          { userId: user?.id },
          "ImoContext",
        );
        return;
      }
      setActingImoIdState(imoId);
      try {
        if (imoId) {
          sessionStorage.setItem(ACTING_IMO_STORAGE_KEY, imoId);
        } else {
          sessionStorage.removeItem(ACTING_IMO_STORAGE_KEY);
        }
      } catch {
        // sessionStorage unavailable (private mode, etc.) — in-memory still works
      }
      // Persist acting_imo_id into auth.users.raw_user_meta_data so RLS sees
      // it. Must complete BEFORE we invalidate queries — otherwise the
      // refetches would race against the metadata write and see stale scope.
      try {
        const { error: updateError } = await supabase.auth.updateUser({
          data: { acting_imo_id: imoId },
        });
        if (updateError) {
          logger.error(
            "Failed to persist acting_imo_id to auth.users",
            updateError,
            "ImoContext",
          );
          // Don't bail — local state is set so the UI reflects the switch
          // even if the server-side metadata write failed. The user will see
          // stale data and can retry.
        }
      } catch (err) {
        logger.error(
          "auth.updateUser threw",
          err instanceof Error ? err : { error: String(err) },
          "ImoContext",
        );
      }
      // Tenant context changed — every scoped query is potentially looking at
      // the wrong IMO now. Broad invalidation is correct here: enumerating keys
      // risks missing one and silently showing cross-tenant data.
      queryClient.invalidateQueries();
    },
    [isSuperAdmin, user?.id, queryClient],
  );

  // If the user is not a super-admin but a stale acting IMO sits in storage,
  // clear it so it never silently affects a non-super-admin session.
  useEffect(() => {
    if (!isSuperAdmin && actingImoId !== null) {
      setActingImoIdState(null);
      try {
        sessionStorage.removeItem(ACTING_IMO_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  }, [isSuperAdmin, actingImoId]);

  // On mount / when user changes, sync auth.users.raw_user_meta_data.acting_imo_id
  // to match this tab's sessionStorage. Without this, a previous tab's acting
  // value persists in the DB and silently scopes a new tab whose UI shows
  // "Own IMO". This makes acting tab-scoped: each new session starts fresh
  // (or restored from sessionStorage on a same-tab reload).
  useEffect(() => {
    if (!isSuperAdmin || !user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { error: syncError } = await supabase.auth.updateUser({
          data: { acting_imo_id: actingImoId },
        });
        if (syncError && !cancelled) {
          logger.warn(
            "Failed to sync acting_imo_id to auth.users on mount",
            { error: syncError.message },
            "ImoContext",
          );
        }
      } catch (err) {
        if (!cancelled) {
          logger.warn(
            "auth.updateUser sync-on-mount threw",
            { error: err instanceof Error ? err.message : String(err) },
            "ImoContext",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only re-sync when the user identity changes — actingImoId changes are
    // handled by setActingImoId, which writes to auth.users directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isSuperAdmin]);

  const effectiveImoId =
    (isSuperAdmin ? actingImoId : null) ?? user?.imo_id ?? null;

  // Context value
  const value: ImoContextType = {
    imo,
    agency,
    isImoOwner,
    isImoAdmin,
    isAgencyOwner,
    isSuperAdmin,
    loading,
    error,
    actingImoId: isSuperAdmin ? actingImoId : null,
    setActingImoId,
    effectiveImoId,
    refetch: fetchImoData,
  };

  return <ImoContext.Provider value={value}>{children}</ImoContext.Provider>;
};

/**
 * Higher-order component to inject IMO context
 */
export function withImo<P extends object>(
  Component: React.ComponentType<P & ImoContextType>,
): React.FC<P> {
  return function WithImoComponent(props: P) {
    const imoContext = useImo();
    return <Component {...props} {...imoContext} />;
  };
}
