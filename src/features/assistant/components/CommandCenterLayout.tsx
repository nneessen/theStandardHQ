import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VoiceOrb } from "./VoiceOrb";
import { AssistantSettingsSheet } from "./AssistantSettingsSheet";
import { ArcReactor, type ReactorMode } from "./hud/ArcReactorLazy";
import { ReactorDial } from "./hud/ReactorDial";
import { usePointerTilt } from "./hud/usePointerTilt";
import { HudFrame } from "./hud/HudFrame";
import { SidePanels } from "./hud/SidePanels";
import { AgentBanner } from "./hud/AgentBanner";
import { agentTheme } from "../lib/agentTheme";
import type { VoiceSessionUi } from "../hooks/voiceSession.types";

interface Props {
  assistantName: string;
  agentKey?: string | null;
  accent: string;
  reactorMode: ReactorMode;
  audioLevel?: number;
  voice: VoiceSessionUi;
  children: ReactNode;
}

/**
 * Full-bleed, dark-locked HUD stage. The arc reactor + ambient frame fill the upper
 * viewport while the conversation docks to the bottom, so Jarvis owns the screen the
 * way the rest of the app's sidebar never intrudes. Heavy chrome (reactor, frame,
 * telemetry) is desktop-only; below lg it degrades to a clean compact column.
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
  const tilt = usePointerTilt(5);

  return (
    <div className="dark relative flex h-screen flex-col overflow-hidden bg-[#050811] text-foreground">
      {/* Ambient HUD stage — desktop only */}
      <div className="hidden lg:block">
        <HudFrame accent={accent} />
        <div
          className="pointer-events-none absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2"
          style={{
            width: "min(80vh, 80vw)",
            height: "min(80vh, 80vw)",
            perspective: 1400,
          }}
        >
          <motion.div
            className="relative h-full w-full"
            style={{ rotateX: tilt.rotateX, rotateY: tilt.rotateY }}
          >
            <ReactorDial
              mode={reactorMode}
              accent={accent}
              className="absolute inset-0 h-full w-full"
            />
            <ArcReactor
              mode={reactorMode}
              accent={accent}
              audioLevel={audioLevel}
              className="absolute left-1/2 top-1/2 h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2"
            />
          </motion.div>
        </div>
        <SidePanels accent={accent} />
      </div>

      <AgentBanner agentKey={agentKey} />

      {/* Top command bar */}
      <header
        className="relative z-20 flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5 backdrop-blur-md"
        style={{
          borderColor: `${accent}22`,
          background:
            "linear-gradient(180deg, rgba(5,8,17,0.85) 0%, rgba(5,8,17,0.4) 100%)",
        }}
      >
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="group flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            style={{ borderColor: `${accent}2e` }}
            aria-label="Back to app"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span className="hidden sm:inline uppercase tracking-wider">
              App
            </span>
          </Link>
          <div
            className="grid h-9 w-9 place-items-center rounded-lg"
            style={{ background: `${accent}1f`, color: accent }}
          >
            <theme.icon className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <h1
                className="font-display text-base font-bold uppercase tracking-[0.18em]"
                style={{ textShadow: `0 0 18px ${accent}66` }}
              >
                {assistantName}
              </h1>
              <span className="hidden text-[10px] uppercase tracking-[0.25em] text-muted-foreground sm:inline">
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

      {/* Conversation docks to the bottom; reactor owns the space above it */}
      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col justify-end gap-3 p-4 lg:p-6">
        {children}
      </div>
    </div>
  );
}
