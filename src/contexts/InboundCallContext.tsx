// src/contexts/InboundCallContext.tsx
// App-wide provider for the inbound client-intake pop. The actual phone call lives in NetTrio (the
// dialer) — it is answered and ended there, NOT here. This app's only job is to POP the client
// intake form when NetTrio routes a caller to the agent, and to surface two real events:
//   1. the call ended in NetTrio  -> notify the agent (the intake form stays open to finish + save);
//   2. a new caller is routed in while a form is still open -> queue it (never clobber the open
//      form) and pop a clear notification so the agent knows another intake is waiting.
//
// Subscribes via Supabase realtime BROADCAST to a PRIVATE per-agent topic `inbound:<agent_id>`, fed
// by the inbound_call_broadcast() DB trigger (migration 20260619134244). Broadcast scales to high
// concurrent call volume (no single-threaded WAL reader, no per-subscriber RLS sweep). See
// SCALE_REVIEW.md. Channel authorization: RLS on realtime.messages (topic = 'inbound:' || auth.uid())
// means the agent only ever receives their OWN intake feed — no client-side tenant filtering needed.
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { supabase } from "@/services";
import { useAuth } from "@/contexts/AuthContext";
import type { InboundCallRow } from "@/features/inbound-crm";

interface InboundCallContextValue {
  /** The intake form currently on screen. */
  activeCall: InboundCallRow | null;
  /** Callers routed in while a form was already open — queued (FIFO), never shown over the open one. */
  waitingCalls: InboundCallRow[];
  /** Close the current intake; if a caller is queued, show the next one. */
  dismiss: () => void;
  /** Switch to a queued intake now (defaults to the next one in the queue). */
  acceptWaiting: (id?: string) => void;
}

const InboundCallContext = createContext<InboundCallContextValue | undefined>(
  undefined,
);

export const InboundCallProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [activeCall, setActiveCall] = useState<InboundCallRow | null>(null);
  const [waitingCalls, setWaitingCalls] = useState<InboundCallRow[]>([]);
  // Synchronous mirrors of the open call's id and the queue, read inside the broadcast handler (whose
  // closure would otherwise see stale state) to decide pop-vs-queue without losing or clobbering work.
  const activeIdRef = useRef<string | null>(null);
  const waitingRef = useRef<InboundCallRow[]>([]);

  const setWaiting = useCallback((next: InboundCallRow[]) => {
    waitingRef.current = next;
    setWaitingCalls(next);
  }, []);

  const setActive = useCallback((row: InboundCallRow | null) => {
    activeIdRef.current = row?.id ?? null;
    setActiveCall(row);
  }, []);

  // Show a queued intake now and drop it from the queue. The current form is replaced (the agent
  // finishes + saves it first, then switches) — queued intakes are never auto-merged into the open one.
  const acceptWaiting = useCallback(
    (id?: string) => {
      const q = waitingRef.current;
      const target = id ? q.find((c) => c.id === id) : q[0];
      if (!target) return;
      setWaiting(q.filter((c) => c.id !== target.id));
      setActive(target);
    },
    [setWaiting, setActive],
  );

  // Close the current intake; promote the next queued caller if one is waiting.
  const dismiss = useCallback(() => {
    const [next, ...rest] = waitingRef.current;
    setWaiting(rest);
    setActive(next ?? null);
  }, [setWaiting, setActive]);

  useEffect(() => {
    if (!user?.id) {
      setActive(null);
      setWaiting([]);
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
            // The call ended in NetTrio. Do NOT auto-dismiss — the intake outlives the call. If it's
            // the OPEN call, notify the agent and mark it ended so they finish + save and close
            // manually. If it was only queued, drop it quietly.
            if (activeIdRef.current === row.id) {
              setActiveCall((cur) =>
                cur && cur.id === row.id ? { ...cur, status: "ended" } : cur,
              );
              toast("Call ended in NetTrio", {
                description: "The caller hung up — finish and save the intake.",
              });
            } else if (waitingRef.current.some((c) => c.id === row.id)) {
              setWaiting(waitingRef.current.filter((c) => c.id !== row.id));
            }
            return;
          }

          // A fresh, agent-resolved intake. If nothing is open, pop it (the full-screen form is the
          // change). If a form is already open, NEVER clobber it — queue this caller. (NetTrio never
          // routes a new call to an agent who is mid-call, so an open form here belongs to a caller
          // whose call already ENDED and is being wrapped up. The modal raises a prominent "new
          // caller" dialog off this queue so the agent can finish + switch.)
          if (!activeIdRef.current) {
            setActive(row);
          } else if (
            activeIdRef.current !== row.id &&
            !waitingRef.current.some((c) => c.id === row.id)
          ) {
            setWaiting([...waitingRef.current, row]);
          }
        })
        .subscribe((status) => {
          // Surface join/auth problems for ops; a healthy channel stays silent.
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.warn("[inbound-call] realtime channel:", status);
            return;
          }
          if (status !== "SUBSCRIBED") return;
          // Rehydrate: a broadcast is fire-and-forget (no replay), so an intake popped while this
          // channel was not yet joined (page load, brief disconnect, or the auth/subscribe gap) is
          // otherwise lost forever. On every (re)subscribe, fetch the agent's currently-ringing call
          // and apply the SAME pop-vs-queue logic as the live handler (RLS scopes to this agent):
          // pop it if nothing is open, else queue it (e.g. a call that arrived while the agent was
          // wrapping up a previous, already-ended intake). Without the queue branch it would be lost.
          void (async () => {
            // Only rehydrate a GENUINELY LIVE call. A row stuck in `ringing`
            // far longer than any real intake (no `ended` ever arrived — an
            // abandoned call, a dropped NetTrio webhook, or leftover local test
            // data) must NOT re-pop the intake on every reload. Bound the lookup
            // to recently-created ringing calls so stale rows are ignored.
            const STALE_RINGING_MS = 60 * 60 * 1000; // 1h — beyond any real call
            const freshSince = new Date(
              Date.now() - STALE_RINGING_MS,
            ).toISOString();
            const { data } = await supabase
              .from("inbound_calls")
              .select("*")
              .eq("agent_id", user.id)
              .eq("status", "ringing")
              .gte("created_at", freshSince)
              .order("call_start", { ascending: false, nullsFirst: false })
              .limit(1)
              .maybeSingle();
            if (cancelled || !data) return;
            const row = data as unknown as InboundCallRow;
            if (!activeIdRef.current) {
              setActive(row);
            } else if (
              activeIdRef.current !== row.id &&
              !waitingRef.current.some((c) => c.id === row.id)
            ) {
              setWaiting([...waitingRef.current, row]);
            }
          })();
        });
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id, setActive, setWaiting]);

  return (
    <InboundCallContext.Provider
      value={{ activeCall, waitingCalls, dismiss, acceptWaiting }}
    >
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
