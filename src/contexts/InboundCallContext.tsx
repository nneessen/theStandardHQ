// src/contexts/InboundCallContext.tsx
// App-wide provider for the inbound-call screen-pop. Subscribes (Supabase realtime) to INSERTs on
// public.inbound_calls scoped to the logged-in agent, and renders a single <InboundCallPop> for the
// active call. Mirrors NotificationContext's realtime pattern exactly: synchronous channel creation
// inside useEffect, chained .on() listeners, one .subscribe(), cleanup via supabase.removeChannel.
//
// RLS (inbound_calls_select_own: agent_id = auth.uid() AND imo_id = get_my_imo_id()) means the
// channel only ever delivers this agent's own calls — no client-side tenant filtering needed.
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { supabase } from "@/services";
import { useAuth } from "@/contexts/AuthContext";
import { InboundCallPop, type InboundCallRow } from "@/features/inbound-crm";

interface InboundCallContextValue {
  activeCall: InboundCallRow | null;
  dismiss: () => void;
}

const InboundCallContext = createContext<InboundCallContextValue | undefined>(
  undefined,
);

export const InboundCallProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [activeCall, setActiveCall] = useState<InboundCallRow | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setActiveCall(null);
      return;
    }

    const channel = supabase
      .channel(`inbound_calls:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "inbound_calls",
          filter: `agent_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as InboundCallRow;
          // Pop only a real, live, agent-resolved call. Skip speculative billing rows
          // (patch_only: a PATCH that arrived before any POST) and anything already ended.
          if (row.patch_only || row.status === "ended") return;
          setActiveCall(row);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "inbound_calls",
          filter: `agent_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as InboundCallRow;
          // Auto-dismiss when THIS call ends (the billing PATCH flips status to 'ended').
          setActiveCall((cur) =>
            cur && cur.id === row.id && row.status === "ended" ? null : cur,
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const dismiss = () => setActiveCall(null);

  return (
    <InboundCallContext.Provider value={{ activeCall, dismiss }}>
      {children}
      {activeCall && <InboundCallPop call={activeCall} onDismiss={dismiss} />}
    </InboundCallContext.Provider>
  );
};

export function useInboundCall(): InboundCallContextValue {
  const ctx = useContext(InboundCallContext);
  if (!ctx) {
    throw new Error("useInboundCall must be used within InboundCallProvider");
  }
  return ctx;
}
