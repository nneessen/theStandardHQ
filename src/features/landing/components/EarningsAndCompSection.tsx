import { TrendingUp, Calendar, Shield, Wallet, ArrowRight } from "lucide-react";
import { useReveal } from "../hooks/useReveal";

const COMP_HIGHLIGHTS = [
  {
    icon: Wallet,
    title: "Auto-paid commissions",
    body: "Premium recorded → commission booked. No spreadsheets. No reconciliation calls. The contract rate matrix lives in the comp guide; the engine multiplies, accrues, and posts it without you touching a row.",
  },
  {
    icon: Calendar,
    title: "Advance schedules tracked",
    body: "Monthly, semi-annual, annual — the system knows when each piece earns out. You see exactly what's been advanced, what's earned, and what's still subject to chargeback risk.",
  },
  {
    icon: Shield,
    title: "Persistency calculated daily",
    body: "Percent of policies still in force across rolling 13-month windows. Know your true book health, not last quarter's snapshot. Carrier renewals depend on this; ours updates automatically.",
  },
  {
    icon: TrendingUp,
    title: "Override roll-ups visible",
    body: "Your downline production rolls up your hierarchy. Earn on what your team produces, see which agents are pacing, and watch the override line item grow on your dashboard in real time.",
  },
];

export function EarningsAndCompSection() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section id="earnings" className="section-cream-dark py-24 lg:py-32">
      <div ref={ref} className="reveal max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16">
          <div className="lg:col-span-2">
            <p className="eyebrow mb-4">Earnings & Comp</p>
            <h2 className="font-display text-3xl lg:text-5xl text-[var(--landing-navy)] mb-6 leading-[1.1]">
              The check shows up. The math is already done.
            </h2>
            <div className="space-y-5 text-lg text-[var(--landing-slate)] leading-relaxed">
              <p>
                Most agents leave their first IMO over commission disputes. We
                removed the dispute by making the math visible, automatic, and
                auditable.
              </p>
              <p>
                Pull up the comp guide and see the rate. Pull up your dashboard
                and see what you've earned, what's advanced, what's in
                chargeback risk, and what your downline is generating.
              </p>
              <p>
                When something doesn't look right, the audit trail tells you
                exactly what happened. No more "I'll have to ask accounting" —
                the answer is on the screen.
              </p>
            </div>

            <div className="mt-8 pt-8 border-t border-[var(--landing-border)]">
              <a
                href="#platform"
                className="inline-flex items-center gap-2 text-[var(--landing-navy)] font-medium hover:text-[var(--landing-gold-deep)] transition-colors group"
              >
                See the commissions pillar
                <ArrowRight
                  size={18}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </a>
            </div>
          </div>

          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {COMP_HIGHLIGHTS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className={`relative group bg-[var(--landing-warm-white)] p-7 lg:p-8 border border-[var(--landing-border)] rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.06)] hover:border-[var(--landing-gold)]/40 transition-all overflow-hidden ${idx % 3 === 0 ? "sm:translate-y-0" : "sm:translate-y-4"}`}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--landing-gold)] transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
                  <div className="w-12 h-12 bg-[var(--landing-navy)]/[0.04] flex items-center justify-center mb-5 rounded">
                    <Icon
                      size={22}
                      strokeWidth={1.5}
                      className="text-[var(--landing-navy)]"
                    />
                  </div>
                  <h3 className="font-display text-xl lg:text-2xl text-[var(--landing-navy)] mb-3 leading-tight">
                    {item.title}
                  </h3>
                  <p className="text-sm text-[var(--landing-slate)] leading-relaxed">
                    {item.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
