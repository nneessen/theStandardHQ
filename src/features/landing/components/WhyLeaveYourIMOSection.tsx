import { ArrowRight, X, Check } from "lucide-react";
import { useReveal } from "../hooks/useReveal";

type Comparison = {
  problem: string;
  problemDetail: string;
  solution: string;
  solutionDetail: string;
};

const COMPARISONS: Comparison[] = [
  {
    problem: "Manual lead qualification",
    problemDetail:
      "Cold-calling everyone in your CRM, hoping the next pickup is a closer. Hours wasted on stale leads.",
    solution: "AI Lead Heat scores every lead 0–100",
    solutionDetail:
      "17 deterministic signals plus AI portfolio analysis run continuously. The Hot 100 ranks who to call right now. Lifecycle velocity tracks who's about to go cold.",
  },
  {
    problem: "Generic email templates",
    problemDetail:
      "The same five templates everyone in your IMO uses. Reply rates suffer because clients have seen this exact message before.",
    solution: "AI writes every send",
    solutionDetail:
      "Tell Claude what you want — a callback ask, a renewal nudge, a check-in cadence — and Close AI Builder writes the email, the SMS, or the entire sequence. Reply STOP enforced deterministically.",
  },
  {
    problem: "Spreadsheet commissions",
    problemDetail:
      "Manual Excel reconciliation every month. Advances, chargebacks, and persistency calculated wrong. Override roll-ups disputed because nobody trusts the numbers.",
    solution: "Audited commission engine",
    solutionDetail:
      "Premiums in, commissions out. Advances follow their schedule. Chargebacks compute on lapse. Persistency rolls daily. Overrides distribute up your hierarchy. Audit trail for 90 days.",
  },
  {
    problem: "Compliance training nobody finishes",
    problemDetail:
      "PDF you skim once. Quiz you guess your way through. Knowledge that evaporates the day after.",
    solution: "Gamified XP modules",
    solutionDetail:
      "Earn XP for completing lessons, unlock badges for streaks, climb the team leaderboard. Quiz Builder makes assessments adaptive. Trainers see who's stuck and where.",
  },
];

export function WhyLeaveYourIMOSection() {
  const ref = useReveal<HTMLDivElement>();

  return (
    <section className="surface-base py-20 lg:py-28 relative">
      <div ref={ref} className="reveal max-w-7xl mx-auto px-6 lg:px-12">
        <div className="max-w-3xl mb-14">
          <div className="section-eyebrow-row">
            <span className="section-eyebrow-num">01</span>
            <span className="section-eyebrow-line" />
            <span className="section-eyebrow-label">
              Why agents leave their IMO
            </span>
          </div>

          <h2
            className="text-display-2xl text-[var(--landing-deep-green)] mb-6"
            style={{ fontWeight: 300 }}
          >
            The work other agencies
            <br />
            make you do, ours just does.
          </h2>
          <p className="text-fluid-lg text-muted max-w-2xl">
            Most IMOs sell on commission splits. They forget to mention you'll
            spend half your week on the things below. We replaced every one of
            them with software.
          </p>
        </div>

        {/* gap-px lattice grid */}
        <div className="lattice-grid grid-cols-1 lg:grid-cols-2">
          {COMPARISONS.map((c) => (
            <div key={c.problem} className="lattice-cell p-7 lg:p-10">
              <div className="flex items-center gap-2 mb-4">
                <X
                  size={16}
                  strokeWidth={2}
                  className="text-[var(--landing-terrain-grey)]"
                />
                <span className="text-eyebrow">At your old IMO</span>
              </div>
              <h3
                className="text-display-xl text-[var(--landing-terrain-grey-dark)] mb-3"
                style={{
                  textDecoration: "line-through",
                  textDecorationColor: "rgba(132,144,127,0.4)",
                  textDecorationThickness: "1px",
                }}
              >
                {c.problem}
              </h3>
              <p className="text-sm text-muted mb-6 leading-relaxed">
                {c.problemDetail}
              </p>

              <div className="flex items-center gap-2 mb-3 mt-6 pt-6 border-t border-[var(--landing-border)]">
                <Check
                  size={16}
                  strokeWidth={2.5}
                  className="text-[var(--landing-deep-green)]"
                />
                <span className="text-eyebrow !text-[var(--landing-deep-green)]">
                  At The Standard
                </span>
                <span className="badge badge-accent ml-auto">
                  <ArrowRight size={10} strokeWidth={2.5} className="mr-0.5" />
                  Live
                </span>
              </div>
              <h4 className="text-display-xl text-[var(--landing-deep-green)] mb-3">
                {c.solution}
              </h4>
              <p className="text-sm text-muted leading-relaxed">
                {c.solutionDetail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
