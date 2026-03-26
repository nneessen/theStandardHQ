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
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="space-y-2 text-center">
        <h2 className="text-base font-semibold text-foreground">
          CRM KPI Dashboard
        </h2>
        <p className="mx-auto max-w-md text-xs text-muted-foreground">
          Build a fully configurable analytics dashboard from your Close CRM
          data. Monitor pipeline health, call performance, and lead lifecycle
          velocity with real-time widgets.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {VALUE_PROPS.map((vp) => (
          <div
            key={vp.title}
            className="rounded-lg border border-border bg-card p-3 shadow-sm"
          >
            <vp.icon className="mb-1.5 h-4 w-4 text-muted-foreground" />
            <h3 className="text-[11px] font-semibold text-card-foreground">
              {vp.title}
            </h3>
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
              {vp.desc}
            </p>
          </div>
        ))}
      </div>

      <UpgradePrompt feature="close_kpi" />
    </div>
  );
}
