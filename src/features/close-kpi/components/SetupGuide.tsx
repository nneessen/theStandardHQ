// src/features/close-kpi/components/SetupGuide.tsx
// Step-by-step setup guide for Close CRM connection and AI scoring.

import React, { useState } from "react";
import {
  Check,
  Link2,
  RefreshCw,
  Brain,
  BarChart3,
  Loader2,
  ChevronDown,
  ChevronRight,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLeadHeatRescore } from "../hooks/useCloseKpiDashboard";

interface SetupGuideProps {
  isCloseConnected: boolean;
  hasScores: boolean;
  hasScoringRuns: boolean;
  onNavigateToDashboard: () => void;
  onNavigateToSettings: () => void;
}

interface StepDef {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  detail: string;
}

const STEPS: StepDef[] = [
  {
    id: "connect",
    icon: Link2,
    title: "Connect Close CRM",
    description: "Link your Close account by entering your API key",
    detail:
      "Go to Close CRM → Settings → Developer → + New API Key. Then go to the Connection tab above to paste your key and connect. Your key is encrypted and never shared.",
  },
  {
    id: "sync",
    icon: RefreshCw,
    title: "First Data Sync",
    description: "Your leads and activities are being pulled from Close",
    detail:
      "Once connected, the system fetches your leads, calls, emails, SMS, and opportunities from Close CRM. This happens automatically every 30 minutes. The first sync takes 30-60 seconds.",
  },
  {
    id: "scoring",
    icon: Brain,
    title: "AI Scoring Active",
    description: "AI is analyzing and scoring your leads every 30 minutes",
    detail:
      "The scoring engine evaluates each lead 0-100 based on 17 engagement, behavioral, temporal, and pipeline signals. AI generates portfolio insights and per-lead recommendations to help you prioritize.",
  },
  {
    id: "ready",
    icon: BarChart3,
    title: "Dashboard Ready",
    description: "All your CRM analytics and AI insights are live",
    detail:
      "Your dashboard shows real-time analytics across 4 sections: AI Lead Scoring, Lead Pipeline, Call Performance, and Pipeline Revenue. Everything updates automatically — just open the Dashboard tab.",
  },
];

export const SetupGuide: React.FC<SetupGuideProps> = ({
  isCloseConnected,
  hasScores,
  hasScoringRuns,
  onNavigateToDashboard,
  onNavigateToSettings,
}) => {
  const leadHeatRescore = useLeadHeatRescore();
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const getStepStatus = (
    stepId: string,
  ): "complete" | "current" | "upcoming" => {
    switch (stepId) {
      case "connect":
        return isCloseConnected ? "complete" : "current";
      case "sync":
        if (!isCloseConnected) return "upcoming";
        return hasScores ? "complete" : "current";
      case "scoring":
        if (!hasScores) return "upcoming";
        return hasScoringRuns ? "complete" : "current";
      case "ready":
        if (!hasScoringRuns) return "upcoming";
        return "complete";
      default:
        return "upcoming";
    }
  };

  const handleRescore = async () => {
    try {
      await leadHeatRescore.mutateAsync();
    } catch {
      // silently handle
    }
  };

  const allComplete = STEPS.every((s) => getStepStatus(s.id) === "complete");

  return (
    <div className="max-w-2xl mx-auto py-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-sm font-bold text-foreground">
          Get Started with Close KPIs
        </h2>
        <p className="text-[11px] text-muted-foreground">
          Follow these steps to connect your CRM and unlock AI-powered lead
          scoring
        </p>
      </div>

      {/* Stepper */}
      <div className="space-y-0">
        {STEPS.map((step, i) => {
          const status = getStepStatus(step.id);
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex gap-3">
              {/* Step indicator + connector line */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full border-2 flex-shrink-0 transition-colors ${
                    status === "complete"
                      ? "bg-success/20 border-success dark:bg-success/30 dark:border-success"
                      : status === "current"
                        ? "bg-primary/10 border-primary"
                        : "bg-v2-ring border-v2-ring dark:bg-v2-ring "
                  }`}
                >
                  {status === "complete" ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Icon
                      className={`h-4 w-4 ${
                        status === "current"
                          ? "text-primary"
                          : "text-v2-ink-subtle"
                      }`}
                    />
                  )}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`w-0.5 flex-1 min-h-[2rem] ${
                      status === "complete"
                        ? "bg-success/40 dark:bg-success"
                        : "bg-v2-ring"
                    }`}
                  />
                )}
              </div>

              {/* Step content */}
              <div className="pb-6 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3
                    className={`text-xs font-semibold ${
                      status === "upcoming"
                        ? "text-muted-foreground"
                        : "text-foreground"
                    }`}
                  >
                    {step.title}
                  </h3>
                  {status === "complete" && (
                    <span className="text-[9px] font-medium text-success bg-success/10 px-1.5 py-0.5 rounded">
                      Done
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {step.description}
                </p>

                {/* Action button for current step */}
                {status === "current" && (
                  <div className="mt-2">
                    {step.id === "connect" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px] gap-1.5"
                        onClick={onNavigateToSettings}
                      >
                        <Wrench className="h-3 w-3" />
                        Go to Connection
                      </Button>
                    )}
                    {step.id === "sync" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px] gap-1.5"
                        onClick={handleRescore}
                        disabled={leadHeatRescore.isPending}
                      >
                        {leadHeatRescore.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        {leadHeatRescore.isPending ? "Scoring..." : "Score Now"}
                      </Button>
                    )}
                    {step.id === "scoring" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px] gap-1.5"
                        onClick={handleRescore}
                        disabled={leadHeatRescore.isPending}
                      >
                        {leadHeatRescore.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Brain className="h-3 w-3" />
                        )}
                        {leadHeatRescore.isPending
                          ? "Running..."
                          : "Run AI Analysis"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* All complete CTA */}
      {allComplete && (
        <div className="text-center">
          <Button
            size="sm"
            className="h-8 text-[11px] gap-1.5"
            onClick={onNavigateToDashboard}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Open Dashboard
          </Button>
        </div>
      )}

      {/* FAQ Section */}
      <div className="border-t border-v2-ring pt-4 space-y-1">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
          Common Questions
        </h3>
        {FAQ_ITEMS.map((faq) => (
          <div key={faq.q} className="rounded-md border border-v2-ring">
            <button
              className="flex items-center justify-between w-full px-3 py-2 text-left"
              onClick={() =>
                setExpandedFaq(expandedFaq === faq.q ? null : faq.q)
              }
            >
              <span className="text-[11px] font-medium text-foreground">
                {faq.q}
              </span>
              {expandedFaq === faq.q ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              )}
            </button>
            {expandedFaq === faq.q && (
              <div className="px-3 pb-2">
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  {faq.a}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const FAQ_ITEMS = [
  {
    q: "Where do I find my Close API key?",
    a: "In Close CRM, go to Settings (gear icon) → Developer → + New API Key. Give it a name, copy the key, and paste it in the Connection tab. You only need read access.",
  },
  {
    q: "How does AI lead scoring work?",
    a: "The scoring engine analyzes 17 signals for each lead — call answer rates, email responses, status changes, pipeline activity, and more. Each signal contributes to a 0-100 heat score. AI then generates portfolio insights and per-lead recommendations to help you prioritize.",
  },
  {
    q: "How often does data update?",
    a: "Lead scores update every 30 minutes automatically via a background process. Call analytics, pipeline metrics, and other widgets refresh when you open the dashboard (cached for 5 minutes). You can also click 'Refresh' to get the latest data immediately.",
  },
  {
    q: "What does each heat level mean?",
    a: "Hot (top 10%): Your highest-priority leads by engagement and pipeline signals — call immediately. Warming (next 15%): Strong leads trending positive — priority follow-up. Neutral (middle 25%): Average engagement — standard cadence. Cooling (next 25%): Below-average signals — deprioritize. Cold (bottom 25%): Lowest engagement in your portfolio — consider archiving.",
  },
  {
    q: "Can I use this with my existing Close setup?",
    a: "Yes — the system reads your existing leads, statuses, activities, smart views, and pipelines. It works with any Close CRM configuration. No changes to your CRM setup are needed.",
  },
];
