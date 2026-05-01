import type { LucideIcon } from "lucide-react";
import { Flame, PhoneCall, Wand2, Stethoscope, Compass } from "lucide-react";

export type AICapability = {
  id: string;
  icon: LucideIcon;
  title: string;
  oneLiner: string;
  body: string;
  proof: string;
  status?: "live" | "in-development";
};

export const AI_TOOLKIT: AICapability[] = [
  {
    id: "lead-heat",
    icon: Flame,
    title: "Lead Heat Index",
    oneLiner: "Stop dialing dead leads.",
    body: "Every lead in your Close pipeline is scored 0–100 using 17 deterministic signals plus AI portfolio analysis. The Hot 100 is the only call list you need.",
    proof:
      "Three-tier scoring: deterministic + Haiku batch every 4hr + Sonnet on-demand deep-dive.",
    status: "live",
  },
  {
    id: "ai-builder",
    icon: Wand2,
    title: "Close AI Builder",
    oneLiner: "Generate Close emails, SMS, and full sequences in seconds.",
    body: "Tell Claude what you want — a callback request, a check-in, a renewal nudge — and it writes the email, the follow-up SMS, or the whole sequence. Reply STOP enforced deterministically.",
    proof:
      "AI toggles guarantee binary outcomes (Reply STOP, length caps, mandatory disclosures).",
    status: "live",
  },
  {
    id: "uw-wizard",
    icon: Stethoscope,
    title: "AI Underwriting Wizard",
    oneLiner: "Health intake to carrier recommendation in under 3 minutes.",
    body: "Walk a client through their medical history. AI classifies them into a health tier and tells you which carrier is most likely to approve them at what rate.",
    proof:
      "Carrier guides auto-extracted from PDFs by PaddleOCR + Claude. Acceptance rules engine.",
    status: "live",
  },
  {
    id: "game-plan",
    icon: Compass,
    title: "Game Plan Coach",
    oneLiner: "Your monthly target, tracked daily.",
    body: "AI looks at your pace, your pipeline, and your historical close rates, then tells you exactly which carrier and product to focus on to hit your number.",
    proof:
      "Forecasts shortfall and recommends the specific actions to close the gap.",
    status: "live",
  },
  {
    id: "voice-agent",
    icon: PhoneCall,
    title: "Voice AI Agent",
    oneLiner: "An AI that answers your inbound calls in your cloned voice.",
    body: "Powered by Retell. Inbound qualifying flows, transcript writeback to Close, multi-number routing. Currently in active development — not yet live for agents.",
    proof:
      "Architecture in place. Voice cloning, custom LLM personality, business-hours scheduling all designed.",
    status: "in-development",
  },
];
