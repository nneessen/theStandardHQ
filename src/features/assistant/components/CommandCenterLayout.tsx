import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { VoiceOrb } from "./VoiceOrb";
import { AssistantSettingsSheet } from "./AssistantSettingsSheet";
import { ArcReactor, type ReactorMode } from "./hud/ArcReactorLazy";
import { HudFrame } from "./hud/HudFrame";
import { TelemetryRail } from "./hud/TelemetryRail";
import { AgentBanner } from "./hud/AgentBanner";
import { agentTheme } from "../lib/agentTheme";
import type { AssistantVoiceSession } from "../hooks/useAssistantVoiceSession";

interface Props {
  assistantName: string;
  agentKey?: string | null;
  accent: string;
  reactorMode: ReactorMode;
  audioLevel?: number;
  voice: AssistantVoiceSession;
  children: ReactNode;
}

/**
 * Dark-locked HUD shell. Layers an ambient frame + a background arc reactor behind a
 * frosted content column, with live telemetry on the right. Heavy chrome (reactor,
 * frame, telemetry) is desktop-only; below lg it degrades to a clean compact column.
 */
export function CommandCenterLayout({
  assistantName,
  agentKey,
  accent,
  reactorMode,
  audioLevel = 0,
  voice,
  children,
}: Props) {
  const theme = agentTheme(agentKey);

  return (
    <div className="dark relative min-h-[calc(100vh-3rem)] overflow-hidden rounded-2xl bg-[#050811] text-foreground">
      {/* Ambient HUD layers — desktop only */}
      <div className="hidden lg:block">
        <HudFrame accent={accent} />
        <div className="pointer-events-none absolute left-1/2 top-[38%] h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2">
          <ArcReactor
            mode={reactorMode}
            accent={accent}
            audioLevel={audioLevel}
            className="h-full w-full opacity-90"
          />
        </div>
        <div className="absolute right-6 top-24 z-10">
          <TelemetryRail accent={accent} />
        </div>
      </div>

      <AgentBanner agentKey={agentKey} />

      {/* Content column */}
      <div className="relative z-10 mx-auto w-full max-w-3xl space-y-4 p-4 lg:p-6">
        <header
          className="flex items-center justify-between gap-3 rounded-xl border bg-card/50 p-4 backdrop-blur-md"
          style={{ borderColor: `${accent}33` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="grid h-10 w-10 place-items-center rounded-lg"
              style={{ background: `${accent}22`, color: accent }}
            >
              <theme.icon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1
                  className="font-display text-lg font-bold uppercase tracking-wider leading-tight"
                  style={{ textShadow: `0 0 18px ${accent}55` }}
                >
                  {assistantName}
                </h1>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  Command Center
                </span>
              </div>
              {agentKey && (
                <Badge
                  variant="secondary"
                  className="mt-0.5 text-[10px]"
                  style={{ color: accent }}
                >
                  {theme.label}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <VoiceOrb voice={voice} assistantName={assistantName} />
            <AssistantSettingsSheet />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
