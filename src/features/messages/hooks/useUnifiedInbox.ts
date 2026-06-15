// src/features/messages/hooks/useUnifiedInbox.ts
// Backbone for the unified inbox (Option C). Merges email threads + Instagram
// conversations into one chronological, day-grouped feed and derives the
// right-rail aggregates (follow-ups, channel mix). Everything here is wired to
// real Supabase data — fields with no real backing are omitted, never faked.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isToday, isYesterday } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/services/base/supabase";
import {
  useActiveInstagramIntegration,
  useInstagramConversations,
} from "@/hooks/instagram";
import type { InstagramConversation } from "@/types/instagram.types";
import { useThreads, type Thread } from "./useThreads";
import { useMessagingAnalytics } from "./useMessagingAnalytics";
import { labelTone } from "../components/unified/atoms/LabelTag";
import type { AccentTone } from "../components/unified/atoms/tint";
import type { Receipt } from "../components/unified/atoms/ReadReceipt";
import type { FollowUpState } from "../components/unified/atoms/FollowUpPill";

export type UnifiedChannel = "email" | "instagram";
export type FeedChannel = "all" | "email" | "instagram";
export type FeedSort = "newest" | "oldest";

export interface UnifiedThread {
  key: string; // stable React key, e.g. "email:<id>"
  channel: UnifiedChannel;
  refId: string; // original thread / conversation id (for open + actions)
  from: string;
  addr: string;
  subject: string; // "" for Instagram (DMs have no subject)
  preview: string;
  time: string; // formatted for display
  timestamp: number; // ms epoch for sort + grouping
  unread: boolean;
  starred: boolean;
  label: { name: string; tone: AccentTone } | null;
  receipt: Receipt; // last outbound status; null when inbound-latest / unknown
  followup: { when: string; state: FollowUpState } | null;
  count: number;
  attach: number;
}

export interface FollowUpItem {
  key: string;
  channel: UnifiedChannel;
  refId: string;
  name: string;
  task: string;
  when: string;
  state: FollowUpState;
}

export interface ChannelMix {
  emailPct: number;
  instagramPct: number;
  emailOpenRate: number;
  emailClickRate: number;
  hasData: boolean;
}

export interface FeedGroup {
  label: string;
  threads: UnifiedThread[];
}

export interface UnifiedInboxData {
  groups: FeedGroup[];
  allCount: number;
  unreadCount: number;
  emailCount: number;
  instagramCount: number;
  followups: FollowUpItem[];
  channelMix: ChannelMix;
  isLoading: boolean;
  isEmpty: boolean;
}

const HOUR = 3_600_000;
const DAY = 86_400_000;

// ── display helpers ────────────────────────────────────────────────────────

function prettyName(email: string): string {
  const local = (email.split("@")[0] ?? email).replace(/[._-]+/g, " ").trim();
  if (!local) return email;
  return local.replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtTime(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  if (Date.now() - ts < 7 * DAY) return format(d, "EEE");
  return format(d, "MMM d");
}

function truncate(s: string, n: number): string {
  const t = (s ?? "").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
}

// A follow-up is owed when the other side wrote last (unread / inbound-latest)
// and it has been sitting long enough to nag. Real signal only — no due dates
// are invented; the "task" line is filled from the real last message / notes.
function deriveFollowup(
  owed: boolean,
  ts: number,
  now: number,
): { when: string; state: FollowUpState } | null {
  if (!owed || !ts) return null;
  const age = now - ts;
  if (age < 6 * HOUR) return null; // too fresh to flag
  const days = Math.floor(age / DAY);
  if (age > 2 * DAY) return { state: "over", when: `${days}d over` };
  return { state: "due", when: days < 1 ? "Today" : `${days}d` };
}

// ── receipt enrichment (one query per channel, latest outbound per thread) ───

async function fetchReceipts(
  emailThreadIds: string[],
  igConversationIds: string[],
): Promise<Record<string, Receipt>> {
  const out: Record<string, Receipt> = {};

  await Promise.all([
    (async () => {
      if (!emailThreadIds.length) return;
      const { data } = await supabase
        .from("user_emails")
        .select("thread_id, status, open_count, click_count, sent_at")
        .in("thread_id", emailThreadIds)
        .eq("is_incoming", false)
        .order("sent_at", { ascending: false });
      const seen = new Set<string>();
      for (const m of data ?? []) {
        const tid = m.thread_id;
        if (!tid || seen.has(tid)) continue;
        seen.add(tid);
        out[`email:${tid}`] =
          (m.click_count ?? 0) > 0
            ? "clicked"
            : (m.open_count ?? 0) > 0
              ? "opened"
              : m.status === "delivered"
                ? "delivered"
                : "sent";
      }
    })(),
    (async () => {
      if (!igConversationIds.length) return;
      const { data } = await supabase
        .from("instagram_messages")
        .select("conversation_id, status, read_at, sent_at")
        .in("conversation_id", igConversationIds)
        .eq("direction", "outbound")
        .order("sent_at", { ascending: false });
      const seen = new Set<string>();
      for (const m of data ?? []) {
        const cid = m.conversation_id;
        if (seen.has(cid)) continue;
        seen.add(cid);
        out[`ig:${cid}`] = m.read_at
          ? "opened"
          : m.status === "delivered"
            ? "delivered"
            : "sent";
      }
    })(),
  ]);

  return out;
}

// ── mappers ──────────────────────────────────────────────────────────────--

function mapEmail(
  t: Thread,
  now: number,
  receipts: Record<string, Receipt>,
): { thread: UnifiedThread; follow: FollowUpItem | null } {
  const ts = t.lastMessageAt ? new Date(t.lastMessageAt).getTime() : 0;
  const primaryEmail = t.participantEmails?.[0] ?? "";
  const unread = (t.unreadCount ?? 0) > 0;
  const fu = deriveFollowup(unread, ts, now);
  const key = `email:${t.id}`;
  const preview = t.snippet || t.latestMessage?.bodyText || "";
  const label = t.labels?.[0]
    ? { name: t.labels[0].name, tone: labelTone(t.labels[0].name) }
    : null;

  const thread: UnifiedThread = {
    key,
    channel: "email",
    refId: t.id,
    from: primaryEmail ? prettyName(primaryEmail) : t.subject || "Email",
    addr: primaryEmail,
    subject: t.subject || "",
    preview,
    time: fmtTime(ts),
    timestamp: ts,
    unread,
    starred: !!t.isStarred,
    label,
    // Inbound-latest (unread) → no outbound receipt to show.
    receipt: unread ? null : (receipts[key] ?? null),
    followup: fu,
    count: t.messageCount ?? 0,
    attach: t.latestMessage?.hasAttachments ? 1 : 0,
  };

  const follow: FollowUpItem | null = fu
    ? {
        key,
        channel: "email",
        refId: t.id,
        name: thread.from,
        task: truncate(preview, 64),
        when: fu.when,
        state: fu.state,
      }
    : null;

  return { thread, follow };
}

function mapInstagram(
  c: InstagramConversation,
  now: number,
  receipts: Record<string, Receipt>,
): { thread: UnifiedThread; follow: FollowUpItem | null } {
  const ts = c.last_message_at ? new Date(c.last_message_at).getTime() : 0;
  const unread = (c.unread_count ?? 0) > 0;
  const inboundLast = c.last_message_direction === "inbound";
  const fu = deriveFollowup(unread && inboundLast, ts, now);
  const key = `ig:${c.id}`;
  const preview = c.last_message_preview || "";

  const thread: UnifiedThread = {
    key,
    channel: "instagram",
    refId: c.id,
    from: c.participant_name || c.participant_username || "Instagram user",
    addr: c.participant_username ? `@${c.participant_username}` : "",
    subject: "",
    preview,
    time: fmtTime(ts),
    timestamp: ts,
    unread,
    starred: !!c.is_priority,
    label: c.recruiting_lead_id
      ? { name: "New lead", tone: labelTone("new lead") }
      : null,
    // Only show a receipt when our message was the last one out.
    receipt:
      c.last_message_direction === "outbound" ? (receipts[key] ?? null) : null,
    followup: fu,
    count: 0,
    attach: 0,
  };

  const follow: FollowUpItem | null = fu
    ? {
        key,
        channel: "instagram",
        refId: c.id,
        name: thread.from,
        task: truncate(c.priority_notes || c.contact_notes || preview, 64),
        when: fu.when,
        state: fu.state,
      }
    : null;

  return { thread, follow };
}

// ── hook ─────────────────────────────────────────────────────────────────--

interface UseUnifiedInboxOptions {
  search?: string;
  channel?: FeedChannel;
  unreadOnly?: boolean;
  sort?: FeedSort;
}

export function useUnifiedInbox(
  options: UseUnifiedInboxOptions = {},
): UnifiedInboxData {
  const {
    search = "",
    channel = "all",
    unreadOnly = false,
    sort = "newest",
  } = options;
  const { user } = useAuth();

  // Email threads (all non-archived). Search is applied client-side so the feed
  // stays snappy and filters both channels identically.
  const { threads: emailThreads, isLoading: emailLoading } = useThreads({
    filter: "all",
  });

  // Instagram conversations for the active integration (empty if not connected).
  const { data: integration, isLoading: integrationLoading } =
    useActiveInstagramIntegration();
  const { data: conversations = [], isLoading: convLoading } =
    useInstagramConversations(integration?.id);

  const { data: analytics } = useMessagingAnalytics("7d");

  // Real read-receipts: latest outbound status per visible thread/conversation.
  const emailIds = useMemo(() => emailThreads.map((t) => t.id), [emailThreads]);
  const igIds = useMemo(() => conversations.map((c) => c.id), [conversations]);
  const idKey = useMemo(
    () => `${[...emailIds].sort().join(",")}|${[...igIds].sort().join(",")}`,
    [emailIds, igIds],
  );
  const { data: receipts = {} } = useQuery({
    queryKey: ["unifiedReceipts", user?.id, idKey],
    queryFn: () => fetchReceipts(emailIds, igIds),
    enabled: !!user?.id && (emailIds.length > 0 || igIds.length > 0),
    staleTime: 30_000,
  });

  return useMemo<UnifiedInboxData>(() => {
    const now = Date.now();
    const mappedEmail = emailThreads.map((t) => mapEmail(t, now, receipts));
    const mappedIg = conversations.map((c) => mapInstagram(c, now, receipts));
    const everything = [...mappedEmail, ...mappedIg];

    const allThreads = everything.map((x) => x.thread);

    // Search scopes the counts + feed; the rail is independent of it.
    const q = search.trim().toLowerCase();
    const searched = q
      ? allThreads.filter(
          (t) =>
            t.from.toLowerCase().includes(q) ||
            t.subject.toLowerCase().includes(q) ||
            t.preview.toLowerCase().includes(q) ||
            t.addr.toLowerCase().includes(q),
        )
      : allThreads;

    const channelScoped =
      channel === "all"
        ? searched
        : searched.filter((t) => t.channel === channel);

    const allCount = searched.length;
    const emailCount = searched.filter((t) => t.channel === "email").length;
    const instagramCount = searched.filter(
      (t) => t.channel === "instagram",
    ).length;
    const unreadCount = channelScoped.filter((t) => t.unread).length;

    const displayed = unreadOnly
      ? channelScoped.filter((t) => t.unread)
      : channelScoped;

    displayed.sort((a, b) =>
      sort === "newest" ? b.timestamp - a.timestamp : a.timestamp - b.timestamp,
    );

    const buckets: Record<string, UnifiedThread[]> = {
      today: [],
      yesterday: [],
      earlier: [],
    };
    for (const t of displayed) {
      const d = new Date(t.timestamp);
      if (isToday(d)) buckets.today.push(t);
      else if (isYesterday(d)) buckets.yesterday.push(t);
      else buckets.earlier.push(t);
    }
    const order =
      sort === "newest"
        ? (["today", "yesterday", "earlier"] as const)
        : (["earlier", "yesterday", "today"] as const);
    const LABELS: Record<string, string> = {
      today: "Today",
      yesterday: "Yesterday",
      earlier: "Earlier",
    };
    const groups: FeedGroup[] = order
      .filter((k) => buckets[k].length > 0)
      .map((k) => ({ label: LABELS[k], threads: buckets[k] }));

    // Follow-ups: overdue first, then due, oldest within each (most pressing top).
    const followups = everything
      .map((x) => x.follow)
      .filter((f): f is FollowUpItem => f !== null)
      .sort((a, b) => {
        if (a.state !== b.state) return a.state === "over" ? -1 : 1;
        return 0;
      })
      .slice(0, 8);

    const emailVol = analytics?.email.totalSent ?? 0;
    const igVol = analytics?.instagram.totalSent ?? 0;
    const volTotal = emailVol + igVol;
    const emailPct = volTotal > 0 ? Math.round((emailVol / volTotal) * 100) : 0;
    const channelMix: ChannelMix = {
      emailPct,
      instagramPct: volTotal > 0 ? 100 - emailPct : 0,
      emailOpenRate: analytics?.email.openRate ?? 0,
      emailClickRate: analytics?.email.clickRate ?? 0,
      hasData: volTotal > 0,
    };

    const isLoading = emailLoading || integrationLoading || convLoading;

    return {
      groups,
      allCount,
      unreadCount,
      emailCount,
      instagramCount,
      followups,
      channelMix,
      isLoading,
      isEmpty: !isLoading && channelScoped.length === 0,
    };
  }, [
    emailThreads,
    conversations,
    receipts,
    analytics,
    search,
    channel,
    unreadOnly,
    sort,
    emailLoading,
    integrationLoading,
    convLoading,
  ]);
}
