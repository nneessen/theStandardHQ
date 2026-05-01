import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import type { LandingPageTheme, FaqItem } from "../types";
import { useReveal } from "../hooks/useReveal";

interface Props {
  theme: LandingPageTheme;
}

const PLATFORM_FAQ_FALLBACKS: FaqItem[] = [
  {
    question:
      "Does The Standard provide all this software, or do I have to buy it?",
    answer:
      "Everything is included. The platform was built by The Standard for The Standard. You don't pay separately for the AI lead scoring, the Close AI Builder, the underwriting wizard, the training modules, or any of it. It's the operating system you log into when you join — period.",
  },
  {
    question: "What does the AI actually do for me, day to day?",
    answer:
      "Three things. (1) AI Lead Heat ranks every lead in your Close pipeline 0–100 so you spend your dialing time on the warm ones. (2) Close AI Builder writes your follow-up emails, SMS messages, and full Close sequences in seconds — you tell Claude what you want, it writes it. (3) The Underwriting Wizard walks a client through their health intake and recommends the right carrier in under three minutes.",
  },
  {
    question: "Is my Close CRM data safe?",
    answer:
      "Your Close API key is encrypted and scoped to you — we never share keys between agents. The platform reads your leads to score them and writes back custom fields you authorize, but it does not touch leads belonging to other agents on the team. Audit trail tracks every read and write for 90 days.",
  },
  {
    question: "What does it cost me to use the platform as an agent?",
    answer:
      "Nothing additional. The platform is included in your contract with The Standard. You bring the work ethic; we bring the software, the training, the leads when applicable, and the team to plug into.",
  },
  {
    question: "Do I need prior insurance experience?",
    answer:
      "No. Our Training Modules walk new agents through everything from licensing prep to advanced sales process. You earn XP, unlock badges, and build streaks as you go — most new agents are writing business within the first 30 days post-licensing.",
  },
  {
    question: "Is this 100% remote?",
    answer:
      "Yes. The team is fully remote. The platform was built for remote work — Slack-integrated daily leaderboards, two-way messaging, AI-powered async coaching via the Game Plan dashboard.",
  },
];

export function FaqAccordion({ theme }: Props) {
  const ref = useReveal<HTMLDivElement>();
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const items =
    theme.faq_items &&
    theme.faq_items.length > 0 &&
    theme.faq_items[0].question !== "Do I need prior insurance experience?"
      ? theme.faq_items
      : PLATFORM_FAQ_FALLBACKS;

  return (
    <section id="faq" className="section-warm-white py-24 lg:py-32">
      <div ref={ref} className="reveal max-w-3xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="eyebrow mb-4">Common Questions</p>
          <h2 className="font-display text-3xl lg:text-5xl text-[var(--landing-navy)] leading-[1.1]">
            {theme.faq_headline || "What recruits want to know."}
          </h2>
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={`${item.question}-${idx}`}
                className={`bg-[var(--landing-warm-white)] border rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all ${
                  isOpen
                    ? "border-[var(--landing-gold)] border-2"
                    : "border-[var(--landing-border)]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full p-6 flex items-start justify-between gap-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="font-display text-xl lg:text-2xl text-[var(--landing-navy)] leading-tight">
                    {item.question}
                  </span>
                  <span className="shrink-0 mt-1">
                    {isOpen ? (
                      <Minus
                        size={20}
                        className="text-[var(--landing-gold-deep)]"
                      />
                    ) : (
                      <Plus size={20} className="text-[var(--landing-slate)]" />
                    )}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-6 pb-6 text-base text-[var(--landing-slate)] leading-relaxed">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
