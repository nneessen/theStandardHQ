// src/features/close-kpi/components/CloseKpiLanding.tsx
// Upsell landing page for users without close_kpi feature access

import {
  BarChart3,
  TrendingUp,
  Timer,
  Phone,
  Grid3X3,
  Target,
} from "lucide-react";
import { UpgradePrompt } from "@/components/subscription/UpgradePrompt";

const VALUE_PROPS = [
  {
    icon: BarChart3,
    title: "Lead Pipeline Health",
    desc: "Monitor lead counts by status, source, and smart view with configurable widgets.",
  },
  {
    icon: Phone,
    title: "Call & Activity Analytics",
    desc: "Track call volume, duration, connect rates, email/SMS activity, and disposition breakdowns.",
  },
  {
    icon: TrendingUp,
    title: "Opportunity Funnel",
    desc: "Pipeline value, win rate, sales velocity, deal size, and stage conversion metrics.",
  },
  {
    icon: Timer,
    title: "Lifecycle Velocity",
    desc: "Measure time from lead creation to contact, quote, and sale — identify bottlenecks.",
  },
  {
    icon: Grid3X3,
    title: "Cross-Reference Matrix",
    desc: "Smart view rows vs status columns — see exactly where your leads stand at a glance.",
  },
  {
    icon: Target,
    title: "Insurance-Specific KPIs",
    desc: "Track by carrier, application status, policy status, premium pipeline, and coverage amounts.",
  },
];

export function CloseKpiLanding() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {VALUE_PROPS.map((vp) => (
          <div
            key={vp.title}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3"
          >
            <vp.icon className="mb-1.5 h-4 w-4 text-muted-foreground" />
            <h3 className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
              {vp.title}
            </h3>
            <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              {vp.desc}
            </p>
          </div>
        ))}
      </div>

      <UpgradePrompt feature="close_kpi" />
    </div>
  );
}
