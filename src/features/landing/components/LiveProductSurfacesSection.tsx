import {
  ProductSurfaceCard,
  MockDashboard,
  MockLeadHeat,
  MockUWWizard,
  MockRecruiting,
} from "./ProductSurfaceCard";
import { useReveal } from "../hooks/useReveal";

export function LiveProductSurfacesSection() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className="section-warm-white py-24 lg:py-32">
      <div ref={ref} className="reveal max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-20 max-w-3xl mx-auto">
          <p className="eyebrow mb-3">Inside the platform</p>
          <h2 className="font-display text-4xl lg:text-5xl mb-4">
            What you actually see when you log in.
          </h2>
          <p className="text-lg text-[var(--landing-slate)]">
            Every screen is built for the job, not generalized for ten different
            verticals. Below: the four screens you'll spend the most time in.
          </p>
        </div>

        <div className="space-y-24">
          <ProductSurfaceCard
            eyebrow="Main Dashboard"
            title="Your day in one screen."
            description="Pace toward your monthly target, commission MTD, where you sit on the team leaderboard, and a live activity feed. Open your laptop, see exactly what you should do next."
          >
            <MockDashboard />
          </ProductSurfaceCard>

          <ProductSurfaceCard
            reverse
            eyebrow="Close KPI · AI Hot 100"
            title="The only call list you need."
            description="Every lead in your Close pipeline is scored 0–100 against 17 deterministic signals plus AI portfolio analysis. The Hot 100 surface tells you who's warm, who just engaged, and what to say."
          >
            <MockLeadHeat />
          </ProductSurfaceCard>

          <ProductSurfaceCard
            eyebrow="Underwriting Wizard"
            title="Health intake to carrier rec — under 3 minutes."
            description="Walk a client through their medical history with smart follow-up questions. AI classifies the health tier, lookups against carrier underwriting guides (auto-extracted by PaddleOCR + Claude), and recommends the carrier most likely to approve."
          >
            <MockUWWizard />
          </ProductSurfaceCard>

          <ProductSurfaceCard
            reverse
            eyebrow="Recruiting Pipeline"
            title="Build your downline like an engineer ships features."
            description="Drag-and-drop kanban with custom phases. Each phase carries an interactive checklist (videos, quizzes, signatures, document uploads). Phase transitions trigger emails, Slack alerts, and DocuSeal envelopes."
          >
            <MockRecruiting />
          </ProductSurfaceCard>
        </div>
      </div>
    </section>
  );
}
