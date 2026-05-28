import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VoiceOrb } from "./VoiceOrb";
import { AssistantSettingsSheet } from "./AssistantSettingsSheet";

const AGENT_LABELS: Record<string, string> = {
  "executive-briefing": "Executive Briefing",
  "production-analyst": "Production Analyst",
  "policy-risk": "Policy Risk",
  "lead-priority": "Lead Prioritization",
  crm: "CRM",
  "sms-email-copy": "SMS / Email Copy",
  compliance: "Compliance",
  recruiting: "Recruiting",
  coaching: "Agent Coaching",
  calendar: "Calendar",
  slack: "Slack",
  workflow: "Workflow Builder",
  "data-quality": "Data Quality",
};

interface Props {
  assistantName: string;
  agentKey?: string | null;
  children: ReactNode;
}

export function CommandCenterLayout({
  assistantName,
  agentKey,
  children,
}: Props) {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
      <header className="flex items-center justify-between gap-3 rounded-xl border border-border bg-gradient-to-r from-primary/10 via-background to-background p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold leading-tight">
                {assistantName}
              </h1>
              <span className="text-xs text-muted-foreground">
                Command Center
              </span>
            </div>
            {agentKey && (
              <Badge variant="secondary" className="mt-0.5 text-[10px]">
                {AGENT_LABELS[agentKey] ?? agentKey}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <VoiceOrb />
          <AssistantSettingsSheet />
        </div>
      </header>
      {children}
    </div>
  );
}
