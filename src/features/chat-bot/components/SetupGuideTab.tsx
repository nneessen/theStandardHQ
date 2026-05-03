// src/features/chat-bot/components/SetupGuideTab.tsx
// Horizontal step-by-step wizard — one step visible at a time, no vertical scrolling.

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";

/* ─── Step definitions ─────────────────────────────────────────── */

const STEPS = [
  { id: 1, label: "Overview" },
  { id: 2, label: "Prerequisites" },
  { id: 3, label: "Connect CRM" },
  { id: 4, label: "Calendar" },
  { id: 5, label: "Audience" },
  { id: 6, label: "Agent Profile" },
  { id: 7, label: "Final Setup" },
  { id: 8, label: "Reference" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

/* ─── Shared primitives ────────────────────────────────────────── */

function Callout({
  type,
  children,
}: {
  type: "info" | "warning";
  children: React.ReactNode;
}) {
  const isWarning = type === "warning";
  return (
    <div
      className={cn(
        "flex gap-1.5 p-2 rounded text-[10px] leading-relaxed",
        isWarning ? "bg-warning/10 text-warning" : "bg-info/10 text-info",
      )}
    >
      {isWarning ? (
        <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
      ) : (
        <Info className="h-3 w-3 shrink-0 mt-0.5" />
      )}
      <span>{children}</span>
    </div>
  );
}

function BulletCheck({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-1.5">
      <CheckCircle2 className="h-3 w-3 text-success shrink-0 mt-0.5" />
      <span>{children}</span>
    </li>
  );
}

/* ─── Step indicator bar ───────────────────────────────────────── */

function StepIndicator({
  current,
  visited,
  onNavigate,
}: {
  current: StepId;
  visited: Set<StepId>;
  onNavigate: (id: StepId) => void;
}) {
  return (
    <div className="overflow-x-auto scrollbar-none -mx-1 px-1">
      <div className="flex items-center gap-0 min-w-max">
        {STEPS.map((step, idx) => {
          const isActive = step.id === current;
          const isCompleted = visited.has(step.id) && !isActive;
          return (
            <div key={step.id} className="flex items-center">
              {/* Connector line */}
              {idx > 0 && (
                <div
                  className={cn(
                    "w-4 sm:w-6 h-px",
                    visited.has(step.id) || isActive
                      ? "bg-info/70 dark:bg-info"
                      : "bg-v2-ring dark:bg-v2-ring-strong",
                  )}
                />
              )}
              {/* Dot + label group */}
              <button
                type="button"
                onClick={() => onNavigate(step.id)}
                className={cn(
                  "flex flex-col items-center gap-0.5 group",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info rounded",
                )}
              >
                <div
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors",
                    isActive &&
                      "bg-info text-white ring-2 ring-info/40 dark:ring-info",
                    isCompleted && "bg-success text-white",
                    !isActive &&
                      !isCompleted &&
                      "bg-v2-ring dark:bg-v2-ring-strong text-v2-ink-muted dark:text-v2-ink-subtle",
                  )}
                >
                  {isCompleted ? <Check className="h-3 w-3" /> : step.id}
                </div>
                <span
                  className={cn(
                    "text-[8px] sm:text-[9px] leading-tight whitespace-nowrap transition-colors",
                    isActive
                      ? "text-info font-semibold"
                      : "text-v2-ink-subtle dark:text-v2-ink-muted group-hover:text-v2-ink-muted dark:group-hover:text-v2-ink-subtle",
                  )}
                >
                  {step.label}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Step content components ──────────────────────────────────── */

function StepOverview() {
  return (
    <div className="space-y-3">
      <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle leading-relaxed">
        Your AI bot monitors Close CRM for incoming texts from leads that match
        your configured sources. It reads the conversation, responds naturally,
        and books appointments on your calendar.
      </p>

      {/* Visual flow */}
      <div className="flex items-center gap-2 justify-center py-2">
        <div className="px-2 py-1 bg-v2-card-tinted dark:bg-v2-card-tinted rounded text-[9px] font-medium text-v2-ink dark:text-v2-ink-muted">
          Lead Texts In
        </div>
        <ArrowRight className="h-3 w-3 text-v2-ink-subtle" />
        <div className="px-2 py-1 bg-info/10 dark:bg-info/30 rounded text-[9px] font-medium text-info">
          AI Responds
        </div>
        <ArrowRight className="h-3 w-3 text-v2-ink-subtle" />
        <div className="px-2 py-1 bg-success/10 dark:bg-success/30 rounded text-[9px] font-medium text-success">
          Appointment Booked
        </div>
      </div>

      <Callout type="info">
        The bot also performs <strong>proactive outreach</strong> -- it texts
        new leads first (within your configured sources) so no lead sits
        uncontacted.
      </Callout>

      <div className="pt-1 space-y-1.5">
        <h4 className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-muted dark:text-v2-ink-subtle">
          Key Concepts
        </h4>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            ["Lead Sources", "Filter which CRM leads the bot engages"],
            ["Lead Statuses", "Second filter layer by lead status"],
            [
              "Proactive Outreach",
              "Bot texts new leads first, not just replies",
            ],
            ["Monthly Quota", "Unique leads per month, not message count"],
            ["Timezone", "Controls when bot sends messages (business hours)"],
            ["Event Mappings", "Map calendar event types to lead sources"],
          ].map(([term, desc]) => (
            <div
              key={term}
              className="p-1.5 border border-v2-ring dark:border-v2-ring rounded bg-v2-card"
            >
              <span className="text-[10px] font-semibold text-v2-ink dark:text-v2-ink">
                {term}
              </span>
              <p className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle leading-snug mt-0.5">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepPrerequisites() {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <h4 className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-muted dark:text-v2-ink-subtle">
          Close CRM
        </h4>
        <ul className="space-y-1 text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle leading-relaxed">
          <BulletCheck>
            Any paid Close plan (Startup, Professional, or Enterprise)
          </BulletCheck>
          <BulletCheck>
            A custom field called &quot;Lead Source&quot; on your leads (the bot
            uses this to filter which leads it talks to)
          </BulletCheck>
          <BulletCheck>
            Your Close API key -- found under Settings &rarr; API Keys in Close
          </BulletCheck>
        </ul>
      </div>

      <div className="space-y-1.5">
        <h4 className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-muted dark:text-v2-ink-subtle">
          Calendar (Calendly or Google Calendar)
        </h4>
        <ul className="space-y-1 text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle leading-relaxed">
          <BulletCheck>
            Calendly: Standard plan or above (required for API access)
          </BulletCheck>
          <BulletCheck>
            Google Calendar: Any Google account with Calendar access
          </BulletCheck>
        </ul>
      </div>

      <div className="space-y-1.5">
        <h4 className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-muted dark:text-v2-ink-subtle">
          Lead Source Names
        </h4>
        <ul className="space-y-1 text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle leading-relaxed">
          <BulletCheck>
            Know the exact names of the Lead Source values you want the bot to
            handle (e.g., &quot;Facebook Ads&quot;, &quot;Google Ads&quot;)
          </BulletCheck>
        </ul>
      </div>

      <Callout type="warning">
        Lead Source names are <strong>case-sensitive</strong>. &quot;Facebook
        Ads&quot; and &quot;facebook ads&quot; are treated as different sources.
        Make sure names match exactly what&apos;s in Close CRM.
      </Callout>
    </div>
  );
}

function StepConnectCRM() {
  return (
    <div className="space-y-3">
      {/* Step 1 */}
      <div className="flex gap-2">
        <div className="w-5 h-5 rounded-full bg-info/20 dark:bg-info/40 flex items-center justify-center shrink-0">
          <span className="text-[9px] font-bold text-info">1</span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink mb-0.5">
            Choose a Plan
          </h4>
          <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle leading-relaxed">
            Visit the <strong>Subscription</strong> tab and select a plan tier.
            Each tier defines a monthly lead quota -- the number of unique leads
            the bot will engage, not total messages. Start free and upgrade
            anytime.
          </p>
        </div>
      </div>

      {/* Step 2 */}
      <div className="flex gap-2">
        <div className="w-5 h-5 rounded-full bg-info/20 dark:bg-info/40 flex items-center justify-center shrink-0">
          <span className="text-[9px] font-bold text-info">2</span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink mb-0.5">
            Connect Close CRM
          </h4>
          <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle leading-relaxed">
            In <strong>Bot Configuration</strong>, paste your Close API key.
            Find it in Close under Settings &rarr; API Keys &rarr; Generate New
            API Key. The bot uses this to read messages, view lead details, and
            send replies.
          </p>
        </div>
      </div>
    </div>
  );
}

function StepCalendar() {
  return (
    <div className="space-y-3">
      <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle leading-relaxed">
        Choose either <strong>Calendly</strong> or{" "}
        <strong>Google Calendar</strong>. Click the connect button to authorize
        via OAuth. Only one provider can be active at a time.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 border border-v2-ring dark:border-v2-ring rounded bg-v2-card">
          <h4 className="text-[10px] font-semibold text-v2-ink dark:text-v2-ink mb-0.5">
            Calendly
          </h4>
          <p className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle leading-snug">
            Requires Standard plan or above for API access. Supports event type
            mappings per lead source.
          </p>
        </div>
        <div className="p-2 border border-v2-ring dark:border-v2-ring rounded bg-v2-card">
          <h4 className="text-[10px] font-semibold text-v2-ink dark:text-v2-ink mb-0.5">
            Google Calendar
          </h4>
          <p className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle leading-snug">
            Any Google account with Calendar access. Grant read/write
            permissions when prompted.
          </p>
        </div>
      </div>

      <Callout type="info">
        Once connected, the bot checks your real-time availability and creates
        bookings directly. If your calendar is full, it lets the lead know and
        offers to follow up.
      </Callout>
    </div>
  );
}

function StepAudience() {
  return (
    <div className="space-y-3">
      {/* Lead Sources */}
      <div className="flex gap-2">
        <div className="w-5 h-5 rounded-full bg-info/20 dark:bg-info/40 flex items-center justify-center shrink-0">
          <span className="text-[9px] font-bold text-info">4</span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink mb-0.5">
            Configure Lead Sources
          </h4>
          <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle leading-relaxed">
            Only leads whose &quot;Lead Source&quot; custom field in Close
            matches one of your configured sources will be contacted. Choose
            from predefined sources or type a custom name. Names are{" "}
            <strong>case-sensitive</strong>.
          </p>
        </div>
      </div>

      {/* Lead Statuses */}
      <div className="flex gap-2">
        <div className="w-5 h-5 rounded-full bg-info/20 dark:bg-info/40 flex items-center justify-center shrink-0">
          <span className="text-[9px] font-bold text-info">5</span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink mb-0.5">
            Configure Lead Statuses
          </h4>
          <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle leading-relaxed">
            Choose which Close lead statuses the bot should include or exclude.
            For example, only contact leads with status &quot;Potential&quot;
            and skip &quot;Bad Fit&quot; or &quot;Qualified&quot;. This prevents
            messaging leads already handled manually.
          </p>
        </div>
      </div>
    </div>
  );
}

function StepAgentProfile() {
  return (
    <div className="space-y-3">
      <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle leading-relaxed">
        The Agent Profile defines the bot&apos;s persona and conversation style.
        The AI adapts its tone per conversation but always stays on-task:
        qualifying the lead and booking an appointment.
      </p>

      <div className="grid grid-cols-2 gap-1.5">
        {[
          ["Agent Name", "How the bot introduces itself to leads"],
          ["Company Name", "Referenced throughout conversations"],
          ["Agent Role", "Sets tone (e.g., 'Insurance Specialist')"],
          ["Greeting Style", "How the bot opens new conversations"],
        ].map(([field, desc]) => (
          <div
            key={field}
            className="p-1.5 border-l-2 border-info/40 bg-v2-card rounded-r"
          >
            <span className="text-[10px] font-semibold text-v2-ink dark:text-v2-ink">
              {field}
            </span>
            <p className="text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle leading-snug mt-0.5">
              {desc}
            </p>
          </div>
        ))}
      </div>

      <Callout type="info">
        The bot generates natural-language responses using your profile as
        context. It references your company, follows your greeting style, and
        keeps conversations focused on booking.
      </Callout>
    </div>
  );
}

function StepFinalSetup() {
  return (
    <div className="space-y-3">
      {/* Event Mappings */}
      <div className="flex gap-2">
        <div className="w-5 h-5 rounded-full bg-info/20 dark:bg-info/40 flex items-center justify-center shrink-0">
          <span className="text-[9px] font-bold text-info">7</span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink mb-0.5">
            Map Event Types (Optional)
          </h4>
          <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle leading-relaxed">
            Map specific Calendly event types to lead sources. E.g.,
            &quot;Facebook Ads&quot; leads get a 15-min intro call,
            &quot;Referral&quot; leads get a 30-min consultation. If skipped,
            auto-detection uses your default/shortest event type.
          </p>
        </div>
      </div>

      {/* Enable */}
      <div className="flex gap-2">
        <div className="w-5 h-5 rounded-full bg-info/20 dark:bg-info/40 flex items-center justify-center shrink-0">
          <span className="text-[9px] font-bold text-info">8</span>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink mb-0.5">
            Enable Your Bot
          </h4>
          <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle leading-relaxed">
            Toggle the bot on from the Configuration tab. The{" "}
            <strong>timezone setting</strong> controls when the bot is active --
            messages are only sent during business hours. Disabling pauses all
            outreach but preserves your config.
          </p>
        </div>
      </div>

      <Callout type="info">
        Toggling off immediately stops all outreach. Your configuration,
        conversation history, and analytics are preserved. Re-enable anytime.
      </Callout>
    </div>
  );
}

function StepReference() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: "Do leads need to opt in before the bot contacts them?",
      a: "The bot contacts leads already in your CRM with a matching source/status. Opt-in requirements depend on your jurisdiction.",
    },
    {
      q: "Can a lead be escalated to a human?",
      a: "Yes. If the bot detects frustration or a request for a person, it flags the conversation for human follow-up in the Conversations tab.",
    },
    {
      q: "What happens when I hit my monthly limit?",
      a: "The bot stops engaging new leads but continues conversations already in progress. Count resets at next billing cycle.",
    },
    {
      q: "Can I change my plan mid-month?",
      a: "Yes. Upgrades take effect immediately. Downgrades apply at the next billing cycle.",
    },
    {
      q: "What if my calendar is fully booked?",
      a: "The bot checks real-time availability. If no slots are open, it tells the lead and offers to follow up later.",
    },
    {
      q: "Can I change Lead Sources after setup?",
      a: "Yes. Update anytime in Bot Configuration. Changes take effect immediately.",
    },
  ];

  const troubleshooting = [
    {
      title: "Bot not responding",
      steps: [
        "Verify the bot is enabled in Bot Configuration",
        "Check lead source matches (case-sensitive)",
        "Confirm lead status is not excluded",
        "Check monthly quota in Usage tab",
        "Verify Close API key is still valid",
      ],
    },
    {
      title: "Calendar connection failing",
      steps: [
        "Calendly: ensure Standard plan or above",
        "Try disconnect and reconnect",
        "Ensure pop-ups are not blocked (OAuth redirect)",
        "Google: grant calendar read/write permissions",
      ],
    },
    {
      title: "Wrong appointment times",
      steps: [
        "Check timezone setting in Bot Configuration",
        "Verify calendar availability hours",
        "Calendly: check event type duration/buffer",
      ],
    },
    {
      title: "Wrong event type offered",
      steps: [
        "Set preferred event type as default in Calendly",
        "Or set up explicit event type mappings",
        "Verify mapped event type is still active",
      ],
    },
    {
      title: "Usage count seems high",
      steps: [
        "Each unique lead counts once, regardless of messages",
        "Check for overlapping Lead Sources",
        "Review Lead Status filters (broad = more leads)",
      ],
    },
  ];

  return (
    <div className="space-y-3">
      {/* FAQ */}
      <div>
        <h4 className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-muted dark:text-v2-ink-subtle mb-1.5">
          FAQ
        </h4>
        <div className="border border-v2-ring dark:border-v2-ring rounded bg-v2-card divide-y divide-v2-ring dark:divide-v2-ring">
          {faqs.map((faq, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
              className="w-full text-left p-1.5 hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/50 transition-colors"
            >
              <div className="flex items-start gap-1.5">
                <ChevronRight
                  className={cn(
                    "h-3 w-3 text-v2-ink-subtle mt-0.5 shrink-0 transition-transform duration-150",
                    expandedFaq === idx && "rotate-90",
                  )}
                />
                <div className="min-w-0">
                  <span className="text-[10px] font-medium text-v2-ink dark:text-v2-ink-muted">
                    {faq.q}
                  </span>
                  {expandedFaq === idx && (
                    <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle leading-relaxed mt-0.5">
                      {faq.a}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Troubleshooting */}
      <div>
        <h4 className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-muted dark:text-v2-ink-subtle mb-1.5">
          Troubleshooting
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {troubleshooting.map((item) => (
            <div
              key={item.title}
              className="p-2 border border-v2-ring dark:border-v2-ring rounded bg-v2-card"
            >
              <h5 className="text-[10px] font-semibold text-v2-ink dark:text-v2-ink mb-1">
                {item.title}
              </h5>
              <ol className="list-decimal pl-3 space-y-0.5 text-[9px] text-v2-ink-muted dark:text-v2-ink-subtle leading-snug">
                {item.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Step content map ─────────────────────────────────────────── */

const STEP_CONTENT: Record<
  StepId,
  { title: string; description: string; Component: React.FC }
> = {
  1: {
    title: "What It Does",
    description: "How the AI appointment-setting bot works end to end.",
    Component: StepOverview,
  },
  2: {
    title: "Prerequisites",
    description: "What you need before starting setup.",
    Component: StepPrerequisites,
  },
  3: {
    title: "Connect CRM",
    description: "Choose a plan and connect your Close CRM account.",
    Component: StepConnectCRM,
  },
  4: {
    title: "Connect Calendar",
    description: "Authorize Calendly or Google Calendar for booking.",
    Component: StepCalendar,
  },
  5: {
    title: "Configure Audience",
    description:
      "Set lead sources and statuses to control who the bot contacts.",
    Component: StepAudience,
  },
  6: {
    title: "Agent Profile",
    description: "Define the bot's persona, name, role, and greeting style.",
    Component: StepAgentProfile,
  },
  7: {
    title: "Final Setup",
    description: "Map event types and enable your bot.",
    Component: StepFinalSetup,
  },
  8: {
    title: "Reference",
    description: "FAQ and troubleshooting for common issues.",
    Component: StepReference,
  },
};

/* ─── Main Component ───────────────────────────────────────────── */

export function SetupGuideTab() {
  const [currentStep, setCurrentStep] = useState<StepId>(1);
  const [visited, setVisited] = useState<Set<StepId>>(() => new Set([1]));

  const navigate = useCallback((id: StepId) => {
    setCurrentStep(id);
    setVisited((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const goPrev = useCallback(() => {
    if (currentStep > 1) navigate((currentStep - 1) as StepId);
  }, [currentStep, navigate]);

  const goNext = useCallback(() => {
    if (currentStep < 8) navigate((currentStep + 1) as StepId);
  }, [currentStep, navigate]);

  const { title, description, Component } = STEP_CONTENT[currentStep];

  return (
    <div className="flex flex-col h-full">
      {/* Step indicator */}
      <div className="pb-3 border-b border-v2-ring dark:border-v2-ring">
        <StepIndicator
          current={currentStep}
          visited={visited}
          onNavigate={navigate}
        />
      </div>

      {/* Step header */}
      <div className="pt-2.5 pb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-[9px] font-bold text-info uppercase tracking-wider">
            Step {currentStep} of {STEPS.length}
          </span>
        </div>
        <h3 className="text-[13px] font-semibold text-v2-ink dark:text-v2-ink leading-tight">
          {title}
        </h3>
        <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle mt-0.5">
          {description}
        </p>
      </div>

      {/* Step content -- scrollable if it overflows */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        <Component />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-3 mt-2 border-t border-v2-ring dark:border-v2-ring">
        <button
          type="button"
          disabled={currentStep === 1}
          onClick={goPrev}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-medium transition-colors",
            currentStep === 1
              ? "text-v2-ink-subtle dark:text-v2-ink-muted cursor-not-allowed"
              : "text-v2-ink-muted dark:text-v2-ink-muted hover:bg-v2-card-tinted dark:hover:bg-v2-card-tinted",
          )}
        >
          <ChevronLeft className="h-3 w-3" />
          Previous
        </button>

        <span className="text-[9px] text-v2-ink-subtle dark:text-v2-ink-muted">
          {currentStep} / {STEPS.length}
        </span>

        <button
          type="button"
          disabled={currentStep === 8}
          onClick={goNext}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-medium transition-colors",
            currentStep === 8
              ? "text-v2-ink-subtle dark:text-v2-ink-muted cursor-not-allowed"
              : "bg-info text-white hover:bg-info",
          )}
        >
          Next
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
