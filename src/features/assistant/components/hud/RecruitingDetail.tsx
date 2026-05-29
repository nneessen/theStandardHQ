import { useRecruitingStats } from "@/hooks/recruiting";
import { cn } from "@/lib/utils";

interface Props {
  accent: string;
}

/**
 * Expanded recruiting detail: headline counts plus the FULL pipeline breakdown by
 * phase (the docked panel shows only the top 3). Uses the same useRecruitingStats
 * hook as the panel — no new data layer.
 */
export function RecruitingDetail({ accent }: Props) {
  const { data, isLoading, isError } = useRecruitingStats();

  const phases = Object.entries(data?.byPhase ?? {}).sort(
    (a, b) => b[1] - a[1],
  );
  const maxPhase = phases.length ? Math.max(...phases.map((p) => p[1]), 1) : 1;

  const headline: { label: string; value: number }[] = [
    { label: "Active", value: data?.active ?? 0 },
    { label: "Total", value: data?.total ?? 0 },
    { label: "Completed", value: data?.completed ?? 0 },
    { label: "Dropped", value: data?.dropped ?? 0 },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {headline.map((h) => (
          <div
            key={h.label}
            className="rounded-lg border p-2.5 text-center"
            style={{ borderColor: `${accent}1f`, background: `${accent}0a` }}
          >
            <div
              className="font-mono text-xl font-semibold tabular-nums leading-none"
              style={{ color: accent }}
            >
              {isLoading ? "—" : h.value}
            </div>
            <div className="mt-1 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              {h.label}
            </div>
          </div>
        ))}
      </div>

      <div
        className="border-b pb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground"
        style={{ borderColor: `${accent}1f` }}
      >
        By phase
      </div>

      <div
        className="max-h-[300px] space-y-2 overflow-y-auto overscroll-contain pr-1"
        onWheel={(e) => e.stopPropagation()}
      >
        {isLoading ? (
          <div className="space-y-2 pt-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-6 animate-pulse rounded bg-white/5" />
            ))}
          </div>
        ) : isError ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Couldn't load recruiting data.
          </p>
        ) : phases.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No recruits in the pipeline yet.
          </p>
        ) : (
          phases.map(([name, count]) => (
            <div key={name} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span
                  className={cn("truncate capitalize text-foreground")}
                  title={name}
                >
                  {name.replace(/[_-]/g, " ")}
                </span>
                <span
                  className="font-mono tabular-nums"
                  style={{ color: accent }}
                >
                  {count}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(4, (count / maxPhase) * 100)}%`,
                    background: accent,
                    boxShadow: `0 0 8px ${accent}99`,
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
