// src/contexts/InboundCallContext.tsx
// App-wide provider for the inbound-call screen-pop. Subscribes (Supabase realtime BROADCAST) to a
// PRIVATE per-agent topic `inbound:<agent_id>`, fed by the inbound_call_broadcast() DB trigger
// (migration 20260619134244), and exposes { activeCall, dismiss }. Replaces the earlier
// postgres_changes subscription — Broadcast scales to high concurrent call volume (no single-threaded
// WAL reader, no per-subscriber RLS sweep). See docs/inbound-lead-feature/SCALE_REVIEW.md.
//
// Channel authorization: RLS on realtime.messages (topic = 'inbound:' || auth.uid()) means the agent
// only ever receives their OWN screen-pop feed — no client-side tenant filtering needed.
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { supabase } from "@/services";
import { useAuth } from "@/contexts/AuthContext";
import type { InboundCallRow } from "@/features/inbound-crm";

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

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    void (async () => {
      // A PRIVATE Broadcast channel authorizes the JOIN via RLS on realtime.messages, which requires
      // the realtime client to carry the user's access token. Set it explicitly before subscribing —
      // relying on auto-auth races the subscribe and silently yields no messages.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session?.access_token) {
        await supabase.realtime.setAuth(data.session.access_token);
      }
      if (cancelled) return;

      // Single-subscribe guard: tear down any pre-existing channel on this topic before opening a
      // new one. A double effect run (React StrictMode / an auth-driven re-render) could otherwise
      // leave two channels on `inbound:<id>` — and in supabase-js, removing one unsubscribes the
      // topic for the other. The topic embeds the agent's UUID, so endsWith() can't false-match.
      const topic = `inbound:${user.id}`;
      supabase
        .getChannels()
        .filter((c) => c.topic.endsWith(topic))
        .forEach((c) => supabase.removeChannel(c));

      channel = supabase
        .channel(topic, { config: { private: true } })
        .on("broadcast", { event: "inbound_call" }, ({ payload }) => {
          const row = payload as InboundCallRow;
          if (row.status === "ended") {
            // Auto-dismiss when THIS call ends.
            setActiveCall((cur) => (cur && cur.id === row.id ? null : cur));
            return;
          }
          // A fresh, agent-resolved ringing pop. The trigger only broadcasts fired_pop ringing
          // INSERTs, so patch_only/already-ended rows never reach here.
          setActiveCall(row);
        })
        .subscribe((status) => {
          // Surface join/auth problems for ops; a healthy channel stays silent.
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("[inbound-call] realtime channel:", status);
            return;
          }
          if (status !== "SUBSCRIBED") return;
          // Rehydrate: a broadcast is fire-and-forget (no replay), so a pop fired while this channel
          // was not yet joined (page load, brief disconnect, or the auth/subscribe gap) is otherwise
          // lost forever. On every (re)subscribe, fetch the agent's currently-ringing call and pop it
          // if nothing is shown (RLS already scopes inbound_calls to this agent's own calls).
          void (async () => {
            const { data } = await supabase
              .from("inbound_calls")
              .select("*")
              .eq("agent_id", user.id)
              .eq("status", "ringing")
              .order("call_start", { ascending: false, nullsFirst: false })
              .limit(1)
              .maybeSingle();
            if (!cancelled && data) {
              setActiveCall(
                (cur) => cur ?? (data as unknown as InboundCallRow),
              );
            }
          })();
        });
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const dismiss = () => setActiveCall(null);

  return (
    <InboundCallContext.Provider value={{ activeCall, dismiss }}>
      {children}
      {/* The UI (full-screen InboundCallModal) is rendered separately inside the authed
          app shell (App.tsx) so it inherits the board theme + ImoContext + router. */}
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
