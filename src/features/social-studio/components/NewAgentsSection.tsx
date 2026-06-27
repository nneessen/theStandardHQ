// src/features/social-studio/components/NewAgentsSection.tsx
// The "New Agents" customizer body: pick which approved agents to feature in a welcome
// graphic (one card per selected agent) AND manage each agent's photo set (upload multiple
// → auto-rotation). The page owns the agent list (useNewAgents) + the selection; this owns
// the local "which agent's photos am I managing" UI state.

import { useState } from "react";
import { Loader2, Check, Images } from "lucide-react";
import { Cap } from "@/components/board";
import { initials } from "@/features/social-cards";
import { AgentPhotoManager } from "./AgentPhotoManager";

export interface NewAgentListItem {
  id: string;
  name: string;
  photoUrl: string | null;
  createdAt?: string | null;
  /** Count of managed rotation photos (badge on the manage button). */
  photoCount?: number;
}

interface NewAgentsSectionProps {
  agents: NewAgentListItem[];
  featuredIds: string[];
  onToggle: (id: string) => void;
  loading?: boolean;
  imoId: string | null;
}

function joinedLabel(createdAt?: string | null): string | null {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return null;
  return `Joined ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export function NewAgentsSection({
  agents,
  featuredIds,
  onToggle,
  loading,
  imoId,
}: NewAgentsSectionProps) {
  const [managingId, setManagingId] = useState<string | null>(null);

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-center justify-between">
        <Cap style={{ fontSize: 11 }}>Feature new agents</Cap>
        {featuredIds.length > 0 && (
          <span className="text-[10px] font-medium text-muted-foreground">
            {featuredIds.length} selected
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 px-1 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading agents…
        </div>
      ) : agents.length === 0 ? (
        <p className="px-1 py-2 text-[11px] text-muted-foreground">
          No approved agents yet. Agents appear here once they're approved in
          your agency.
        </p>
      ) : (
        <div className="max-h-72 space-y-1 overflow-y-auto overscroll-contain pr-1">
          {agents.map((a) => {
            const selected = featuredIds.includes(a.id);
            const managing = managingId === a.id;
            const joined = joinedLabel(a.createdAt);
            return (
              <div key={a.id}>
                <div
                  className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${
                    selected
                      ? "border-accent bg-accent/10"
                      : "border-border bg-background"
                  }`}
                >
                  {/* Feature toggle (the agent identity is the toggle target). */}
                  <button
                    type="button"
                    onClick={() => onToggle(a.id)}
                    aria-pressed={selected}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    title={
                      selected
                        ? "Remove from this post"
                        : "Feature in this post"
                    }
                  >
                    {a.photoUrl ? (
                      <img
                        src={a.photoUrl}
                        alt=""
                        className="h-8 w-8 flex-none rounded-full border border-border object-cover"
                      />
                    ) : (
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-border bg-secondary text-[10px] font-semibold text-muted-foreground">
                        {initials(a.name)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-foreground">
                        {a.name}
                      </span>
                      {joined && (
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {joined}
                        </span>
                      )}
                    </span>
                    <span
                      className={`flex h-4 w-4 flex-none items-center justify-center rounded-full border ${
                        selected
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-border"
                      }`}
                    >
                      {selected && <Check className="h-3 w-3" />}
                    </span>
                  </button>
                  {/* Manage photos (separate sibling button — never nested). */}
                  <button
                    type="button"
                    onClick={() =>
                      setManagingId((cur) => (cur === a.id ? null : a.id))
                    }
                    aria-pressed={managing}
                    className={`flex flex-none items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] transition-colors ${
                      managing
                        ? "border-accent text-accent"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                    title="Upload & rotate photos for this agent"
                  >
                    <Images className="h-3.5 w-3.5" />
                    {a.photoCount ? a.photoCount : "Photos"}
                  </button>
                </div>
                {managing && (
                  <div className="mt-1">
                    <AgentPhotoManager agentId={a.id} imoId={imoId} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="px-0.5 text-[10px] text-muted-foreground">
        Each selected agent posts as their own welcome card. Add multiple photos
        to auto-rotate them across posts.
      </p>
    </div>
  );
}
