import { useEffect, useState } from "react";
import { Activity, BarChart3, Flame, Trophy, UserPlus } from "lucide-react";
import { useTeamLeaderboard } from "@/hooks/leaderboard";
import { useLeadHeatScoreCount } from "@/features/close-kpi";
import { useRecruitingStats } from "@/hooks/recruiting";
import { useCountUp } from "@/features/landing";
import { useAuth } from "@/contexts/AuthContext";
import { useImoProductionSummary } from "../../hooks/useImoProductionSummary";
import { getDisplayName } from "@/types/user.types";
import { HudPanel } from "./HudPanel";
import { PanelModal } from "./PanelModal";
import { AgentLeaderboardDetail } from "./AgentLeaderboardDetail";
import { ProductionDetail } from "./ProductionDetail";
import { RecruitingDetail } from "./RecruitingDetail";

interface Props {
  accent: string;
}

function compactCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/**
 * Real-data HUD panels docked in the margins around the reactor. Every value comes
 * from existing hooks (team leaderboard, recruiting stats, lead heat) or real inputs
 * (the clock, the signed-in operator) — no mock data. Desktop-only; the parent hides
 * the whole stage under lg.
 */
export function SidePanels({ accent }: Props) {
  return (
    <>
      <div className="absolute left-5 top-20 z-10 flex w-52 flex-col gap-3">
        <StatusPanel accent={accent} />
        <LeaderboardPanel accent={accent} />
      </div>
      <div className="absolute right-5 top-20 z-10 flex w-52 flex-col gap-3">
        <ProductionPanel accent={accent} />
        <RecruitingPanel accent={accent} />
      </div>
    </>
  );
}

function StatusPanel({ accent }: Props) {
  const now = useClock();
  const { user } = useAuth();
  const operator = user
    ? getDisplayName({
        first_name: user.first_name ?? null,
        last_name: user.last_name ?? null,
        email: user.email ?? "",
      })
    : "Operator";
  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const date = now
    .toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
    .toUpperCase();

  return (
    <HudPanel
      title="Status"
      icon={Activity}
      accent={accent}
      from="left"
      delay={0.05}
    >
      <div
        className="font-mono text-2xl font-semibold tabular-nums leading-none"
        style={{ color: accent, textShadow: `0 0 16px ${accent}55` }}
      >
        {time}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {date}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full"
          style={{ background: accent, boxShadow: `0 0 6px ${accent}` }}
        />
        <span style={{ color: accent }}>All systems online</span>
      </div>
      <div className="mt-1 truncate text-[10px] text-muted-foreground">
        Operator · <span className="text-foreground">{operator}</span>
      </div>
    </HudPanel>
  );
}

function LeaderboardPanel({ accent }: Props) {
  const [expanded, setExpanded] = useState(false);
  const team = useTeamLeaderboard({
    filters: { timePeriod: "mtd", scope: "team" },
  });
  const entries = (team.data?.entries ?? []).slice(0, 3);
  const maxAp = entries.length
    ? Math.max(...entries.map((e) => e.apTotal), 1)
    : 1;

  return (
    <>
      <PanelModal
        open={expanded}
        onOpenChange={setExpanded}
        title="Agent Leaderboard"
        description="Individual agent rankings by AP and IP"
        icon={Trophy}
        accent={accent}
      >
        <AgentLeaderboardDetail accent={accent} />
      </PanelModal>
      <HudPanel
        title="Team Leaderboard"
        icon={Trophy}
        accent={accent}
        from="left"
        delay={0.12}
        onExpand={() => setExpanded(true)}
      >
        {team.isLoading ? (
          <Loading accent={accent} rows={3} />
        ) : entries.length === 0 ? (
          <Empty>No team production yet</Empty>
        ) : (
          <div className="space-y-1.5">
            {entries.map((e, i) => (
              <div key={e.leaderId} className="space-y-0.5">
                <div className="flex items-baseline justify-between gap-2 text-[11px]">
                  <span className="truncate">
                    <span style={{ color: accent }}>{i + 1}.</span>{" "}
                    <span className="text-foreground">{e.leaderName}</span>
                  </span>
                  <span
                    className="font-mono tabular-nums"
                    style={{ color: accent }}
                  >
                    {compactCurrency(e.apTotal)}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(6, (e.apTotal / maxAp) * 100)}%`,
                      background: accent,
                      boxShadow: `0 0 8px ${accent}99`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </HudPanel>
    </>
  );
}

function ProductionPanel({ accent }: Props) {
  const [expanded, setExpanded] = useState(false);
  // Org-wide, deduplicated MTD production — counts each policy once. The team
  // leaderboard rollup double-counted members under nested leaders, inflating
  // these totals; this dedicated RPC reports the true figures.
  const production = useImoProductionSummary();
  const heat = useLeadHeatScoreCount();
  const totals = production.data;
  const { value: ap } = useCountUp(totals?.totalAp ?? 0, { duration: 1600 });

  return (
    <>
      <PanelModal
        open={expanded}
        onOpenChange={setExpanded}
        title="Production"
        description="Organization-wide production by period"
        icon={BarChart3}
        accent={accent}
      >
        <ProductionDetail accent={accent} />
      </PanelModal>
      <HudPanel
        title="Production · MTD"
        icon={BarChart3}
        accent={accent}
        from="right"
        delay={0.05}
        onExpand={() => setExpanded(true)}
      >
        <div
          className="font-mono text-2xl font-semibold tabular-nums leading-none"
          style={{ color: accent, textShadow: `0 0 16px ${accent}55` }}
        >
          {production.isLoading ? (
            <span className="inline-block h-6 w-20 animate-pulse rounded bg-muted/40" />
          ) : (
            compactCurrency(ap)
          )}
        </div>
        <div className="mt-0.5 text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
          Annualized premium
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
          <Stat
            accent={accent}
            label="Policies"
            value={totals?.totalPolicies ?? 0}
          />
          <Stat
            accent={accent}
            label="IP"
            value={totals?.totalIp ?? 0}
            format={compactCurrency}
          />
          <Stat
            accent={accent}
            label="Prospects"
            value={totals?.totalProspects ?? 0}
          />
          <Stat accent={accent} label="Leads scored" value={heat.data ?? 0} />
        </div>
      </HudPanel>
    </>
  );
}

function RecruitingPanel({ accent }: Props) {
  const [expanded, setExpanded] = useState(false);
  const recruiting = useRecruitingStats();
  const d = recruiting.data;
  const phases = Object.entries(d?.byPhase ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const maxPhase = phases.length ? Math.max(...phases.map((p) => p[1]), 1) : 1;

  return (
    <>
      <PanelModal
        open={expanded}
        onOpenChange={setExpanded}
        title="Recruiting Pipeline"
        description="Recruiting pipeline breakdown by phase"
        icon={UserPlus}
        accent={accent}
      >
        <RecruitingDetail accent={accent} />
      </PanelModal>
      <HudPanel
        title="Recruiting"
        icon={UserPlus}
        accent={accent}
        from="right"
        delay={0.12}
        onExpand={() => setExpanded(true)}
      >
        {recruiting.isLoading ? (
          <Loading accent={accent} rows={3} />
        ) : (
          <>
            <div className="flex items-end justify-between">
              <div>
                <div
                  className="font-mono text-2xl font-semibold tabular-nums leading-none"
                  style={{ color: accent, textShadow: `0 0 16px ${accent}55` }}
                >
                  {d?.active ?? 0}
                </div>
                <div className="mt-0.5 text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  Active in pipeline
                </div>
              </div>
              <div className="text-right text-[10px] text-muted-foreground">
                <div>
                  <span className="text-foreground">{d?.total ?? 0}</span> total
                </div>
                <div className="flex items-center gap-1">
                  <Flame className="h-2.5 w-2.5" style={{ color: accent }} />
                  {d?.completed ?? 0} done
                </div>
              </div>
            </div>
            {phases.length > 0 && (
              <div className="mt-2 space-y-1">
                {phases.map(([name, count]) => (
                  <div key={name} className="space-y-0.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="truncate capitalize text-muted-foreground">
                        {name.replace(/[_-]/g, " ")}
                      </span>
                      <span style={{ color: accent }}>{count}</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(6, (count / maxPhase) * 100)}%`,
                          background: accent,
                          boxShadow: `0 0 8px ${accent}99`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </HudPanel>
    </>
  );
}

function Stat({
  accent,
  label,
  value,
  format,
}: {
  accent: string;
  label: string;
  value: number;
  format?: (n: number) => string;
}) {
  const display = format ? format(value) : Math.round(value).toLocaleString();
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className="font-mono text-sm font-semibold tabular-nums"
        style={{ color: accent }}
      >
        {display}
      </div>
    </div>
  );
}

function Loading({ accent, rows }: { accent: string; rows: number }) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-3 animate-pulse rounded"
          style={{ background: `${accent}1a`, width: `${90 - i * 18}%` }}
        />
      ))}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-1 text-[11px] text-muted-foreground">{children}</div>
  );
}
