// src/features/chat-bot/components/HowItWorksTab.tsx
// "How It Works" tab — single-screen layout with 3-step flow + demo + selling points

import { MessageSquare, Bot, Calendar, Check } from "lucide-react";
import { ConversationDemo } from "./ConversationDemo";

const steps = [
  {
    step: 1,
    icon: MessageSquare,
    title: "Lead Texts In",
    desc: "A new lead sends an SMS to your Close CRM phone number — or the bot reaches out first when a new lead appears.",
  },
  {
    step: 2,
    icon: Bot,
    title: "AI Responds Instantly",
    desc: "The bot replies within seconds, has a natural back-and-forth conversation, and offers appointment times from your real calendar.",
  },
  {
    step: 3,
    icon: Calendar,
    title: "Appointment Booked",
    desc: "An event is created on your calendar and both you and the lead are notified — no manual follow-up needed.",
  },
];

const sellingPoints = [
  "Responds in seconds during compliant business hours",
  "Books directly from your Calendly or Google Calendar availability",
  "Handles objections and steers toward booking naturally",
  "Proactively contacts new CRM leads — doesn't wait for them to text first",
  "Re-engages cold leads with personalized follow-ups",
  "Adjusts timezone and availability automatically",
  "Never quotes prices or policy details over text — stays compliant",
  "Works 24/7 within configured hours — no missed leads",
];

export function HowItWorksTab() {
  return (
    <div className="space-y-4">
      {/* ── 3-Step Horizontal Flow ────────────────────────────── */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <h2 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
          Three Steps to Booked Appointments
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {steps.map((item, i) => (
            <div key={item.step} className="flex items-start gap-2.5">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-foreground text-white dark:text-black text-[10px] font-bold flex-shrink-0 mt-0.5">
                {item.step}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <item.icon className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                  <span className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
                    {item.title}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {item.desc}
                </p>
              </div>
              {i < steps.length - 1 && (
                <div className="hidden lg:flex items-center justify-center w-4 text-zinc-300 dark:text-zinc-600 mt-1 flex-shrink-0">
                  &rarr;
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Demo + Selling Points (2-column) ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Conversation Demo */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              See It In Action
            </h2>
            <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <ConversationDemo />
        </div>

        {/* Right: Key Selling Points */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Why It Works
            </h2>
            <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4">
            <ul className="space-y-2.5">
              {sellingPoints.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <Check className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span className="text-[10px] text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    {point}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
