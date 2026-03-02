// src/features/chat-bot/components/SetupGuideTab.tsx
// Static setup guide / knowledge base for AI Chat Bot

import { useState } from "react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  Zap,
  CheckCircle2,
  ClipboardList,
  Settings,
  Lightbulb,
  HelpCircle,
  Wrench,
  AlertTriangle,
  Info,
  ArrowRight,
} from "lucide-react";

/* ─── Private helper components ─────────────────────────────────── */

function GuideSection({
  icon: Icon,
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  icon: React.ElementType;
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-2 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
          <Icon className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
          <span className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 flex-1 text-left">
            {title}
          </span>
          {badge && (
            <Badge
              variant="secondary"
              className="text-[9px] h-4 px-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
            >
              {badge}
            </Badge>
          )}
          <ChevronRight
            className={cn(
              "h-3 w-3 text-zinc-400 transition-transform duration-200",
              open && "rotate-90",
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1.5 space-y-2 pl-1">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function StepCard({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5 p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg">
      <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-[9px] font-bold text-blue-700 dark:text-blue-300">
          {step}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
          {title}
        </h4>
        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed space-y-1.5">
          {children}
        </div>
      </div>
    </div>
  );
}

function ConceptCard({
  term,
  children,
}: {
  term: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-3 border-l-2 border-blue-300 dark:border-blue-700 bg-white dark:bg-zinc-900 rounded-r-lg">
      <h4 className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
        {term}
      </h4>
      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-start gap-2 p-2 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left">
          <ChevronRight
            className={cn(
              "h-3 w-3 text-zinc-400 mt-0.5 shrink-0 transition-transform duration-200",
              open && "rotate-90",
            )}
          />
          <span className="text-[10px] font-medium text-zinc-700 dark:text-zinc-300">
            {question}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed pl-5 pr-2 pb-2">
          {answer}
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

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
        "flex gap-2 p-2 rounded-md text-[10px] leading-relaxed",
        isWarning
          ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
          : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
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

/* ─── Main Component ────────────────────────────────────────────── */

export function SetupGuideTab() {
  return (
    <div className="space-y-3 pb-6">
      {/* Page heading */}
      <div className="px-1">
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
          Everything you need to know to get your AI appointment-setting bot up
          and running. Follow the walkthrough below or jump to any section.
        </p>
      </div>

      {/* ── Section 1: What the Bot Does ── */}
      <GuideSection icon={Zap} title="What the Bot Does" defaultOpen>
        <div className="p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg space-y-2.5">
          {/* Visual flow */}
          <div className="flex items-center gap-2 justify-center py-2">
            <div className="flex items-center gap-1 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-[9px] font-medium text-zinc-700 dark:text-zinc-300">
              Lead Texts In
            </div>
            <ArrowRight className="h-3 w-3 text-zinc-400" />
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 rounded text-[9px] font-medium text-blue-700 dark:text-blue-300">
              AI Responds
            </div>
            <ArrowRight className="h-3 w-3 text-zinc-400" />
            <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 dark:bg-emerald-900/30 rounded text-[9px] font-medium text-emerald-700 dark:text-emerald-300">
              Appointment Booked
            </div>
          </div>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
            The bot monitors your Close CRM account for incoming text messages
            from leads that match your configured Lead Sources. When a message
            arrives, the AI reads the conversation history, responds naturally,
            and works toward booking an appointment on your Calendly calendar.
          </p>
          <Callout type="info">
            The bot also performs <strong>proactive outreach</strong> — it can
            text new leads first (within your configured sources) rather than
            only responding to incoming messages. This ensures no lead sits
            uncontacted.
          </Callout>
        </div>
      </GuideSection>

      {/* ── Section 2: Before You Start ── */}
      <GuideSection
        icon={ClipboardList}
        title="Before You Start"
        badge="Prerequisites"
        defaultOpen
      >
        <div className="p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg space-y-3">
          <div className="space-y-2">
            <h4 className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Close CRM
            </h4>
            <ul className="space-y-1 text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                Any paid Close plan (Startup, Professional, or Enterprise)
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                A custom field called &quot;Lead Source&quot; on your leads (the
                bot uses this to filter which leads it talks to)
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                Your Close API key — found under Settings → API Keys in Close
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Calendly
            </h4>
            <ul className="space-y-1 text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                Standard plan or above (required for API access)
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                At least one active event type configured
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Lead Source Names
            </h4>
            <ul className="space-y-1 text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                Know the exact names of the Lead Source values you want the bot
                to handle (e.g., &quot;Facebook Ads&quot;, &quot;Google
                Ads&quot;)
              </li>
            </ul>
          </div>

          <Callout type="warning">
            Lead Source names are <strong>case-sensitive</strong>.
            &quot;Facebook Ads&quot; and &quot;facebook ads&quot; are treated as
            different sources. Make sure the names you enter match exactly
            what&apos;s in Close CRM.
          </Callout>
        </div>
      </GuideSection>

      {/* ── Section 3: Setup Walkthrough ── */}
      <GuideSection
        icon={Settings}
        title="Setup Walkthrough"
        badge="8 Steps"
        defaultOpen
      >
        <StepCard step={1} title="Choose a Plan">
          <p>
            Visit the <strong>Subscription</strong> tab and select a plan tier.
            Each tier defines a monthly lead quota — this is the number of{" "}
            <strong>unique leads</strong> the bot will engage per month, not the
            total number of messages sent.
          </p>
          <p>
            You can start with the free tier to test things out. Upgrade anytime
            from the same tab.
          </p>
        </StepCard>

        <StepCard step={2} title="Connect Close CRM">
          <p>
            In the <strong>Bot Configuration</strong> tab, paste your Close API
            key. Find it in Close under{" "}
            <strong>Settings → API Keys → Generate New API Key</strong>.
          </p>
          <p>
            The bot uses this key to read incoming messages, view lead details,
            and send replies on your behalf. It only accesses leads matching
            your configured sources.
          </p>
        </StepCard>

        <StepCard step={3} title="Connect Calendly">
          <p>
            Click the Calendly connect button. This opens an OAuth popup where
            you authorize access. You need a Calendly Standard plan or above for
            API access.
          </p>
          <p>
            Once connected, the bot can check your availability and create
            bookings directly on your calendar.
          </p>
        </StepCard>

        <StepCard step={4} title="Configure Lead Sources">
          <p>
            Lead Sources tell the bot which leads to engage. Only leads whose
            &quot;Lead Source&quot; custom field in Close matches one of your
            configured sources will be contacted.
          </p>
          <p>
            You can choose from predefined sources (common ones like
            &quot;Facebook Ads&quot;, &quot;Google Ads&quot;) or type a custom
            source name. Remember: these are <strong>case-sensitive</strong> and
            must match exactly.
          </p>
        </StepCard>

        <StepCard step={5} title="Configure Lead Statuses">
          <p>
            Choose which Close lead statuses the bot should include or exclude.
            For example, you may want the bot to only contact leads with status
            &quot;Potential&quot; and skip those marked &quot;Bad Fit&quot; or
            &quot;Qualified&quot; (already in your pipeline).
          </p>
          <p>
            This prevents the bot from messaging leads that are already being
            handled manually or have been disqualified.
          </p>
        </StepCard>

        <StepCard step={6} title="Complete Agent Profile">
          <p>
            The Agent Profile defines the bot&apos;s persona and conversation
            style. Each field shapes how the bot interacts:
          </p>
          <ul className="list-disc pl-3 space-y-0.5 mt-1">
            <li>
              <strong>Agent Name</strong> — how the bot introduces itself
            </li>
            <li>
              <strong>Company Name</strong> — referenced in conversations
            </li>
            <li>
              <strong>Agent Role</strong> — sets conversational tone (e.g.,
              &quot;Insurance Specialist&quot;)
            </li>
            <li>
              <strong>Greeting Style</strong> — how the bot opens new
              conversations
            </li>
          </ul>
        </StepCard>

        <StepCard step={7} title="Map Event Types (Optional)">
          <p>
            If you have multiple Calendly event types, you can map specific ones
            to specific lead sources. For example, &quot;Facebook Ads&quot;
            leads get a 15-minute intro call while &quot;Referral&quot; leads
            get a 30-minute consultation.
          </p>
          <p>
            If you skip this step, <strong>auto-detection</strong> kicks in —
            the bot will use your default or shortest event type for all
            bookings.
          </p>
        </StepCard>

        <StepCard step={8} title="Enable Your Bot">
          <p>
            Toggle the bot on from the Configuration tab. Once enabled, the bot
            immediately begins monitoring your Close account for matching leads.
          </p>
          <p>
            The <strong>timezone setting</strong> controls when the bot is
            active — it will only send messages during business hours in your
            selected timezone (to avoid texting leads at 3am). Disabling the bot
            pauses all outreach but preserves your configuration.
          </p>
        </StepCard>
      </GuideSection>

      {/* ── Section 4: How It All Works ── */}
      <GuideSection icon={Lightbulb} title="How It All Works">
        <div className="space-y-2">
          <ConceptCard term="Lead Sources">
            <p>
              Lead Sources are the filter that determines which leads the bot
              talks to. They correspond to the &quot;Lead Source&quot; custom
              field in Close CRM. A lead must have a source value that matches
              one of your configured sources, or the bot ignores it entirely.
            </p>
          </ConceptCard>

          <ConceptCard term="Lead Statuses">
            <p>
              Lead Statuses provide a second layer of filtering. Even if a
              lead&apos;s source matches, the bot will skip it if the
              lead&apos;s status is excluded. Use this to avoid contacting leads
              that are already qualified, closed, or marked as bad fits.
            </p>
          </ConceptCard>

          <ConceptCard term="Proactive Outreach">
            <p>
              The bot doesn&apos;t just wait for leads to text first. It
              proactively reaches out to new leads that appear in Close with a
              matching source and status. This means leads get contacted within
              minutes of entering your CRM, dramatically improving response
              time.
            </p>
          </ConceptCard>

          <ConceptCard term="Leads-Per-Month Quota">
            <p>
              Your plan tier sets a monthly limit on unique leads the bot
              engages. A &quot;lead&quot; is counted once regardless of how many
              messages are exchanged. If you hit your limit mid-month, the bot
              stops engaging new leads but continues conversations already in
              progress.
            </p>
          </ConceptCard>

          <ConceptCard term="Timezone Setting">
            <p>
              The timezone controls the bot&apos;s active hours. Messages are
              only sent during business hours in the selected timezone. If a
              lead texts outside those hours, the bot queues a response for the
              next business-hours window.
            </p>
          </ConceptCard>

          <ConceptCard term="Event Type Mappings & Auto-Detection">
            <p>
              When the bot books an appointment, it needs to know which Calendly
              event type to use. If you&apos;ve mapped sources to event types,
              that mapping is used. Otherwise, auto-detection selects the
              default event type from your Calendly account (typically the
              shortest duration event).
            </p>
          </ConceptCard>

          <ConceptCard term="What the Bot Says (Agent Profile)">
            <p>
              The bot generates natural-language responses using your Agent
              Profile as context. It introduces itself with your agent name,
              references your company, and follows the greeting style you set.
              The AI adapts its tone based on the conversation but always stays
              on-task: qualifying the lead and booking an appointment.
            </p>
          </ConceptCard>

          <ConceptCard term="Disabling the Bot">
            <p>
              Toggling the bot off immediately stops all outreach and responses.
              Your configuration, conversation history, and analytics are all
              preserved. You can re-enable at any time and the bot picks up
              where it left off.
            </p>
          </ConceptCard>
        </div>
      </GuideSection>

      {/* ── Section 5: FAQ ── */}
      <GuideSection
        icon={HelpCircle}
        title="Frequently Asked Questions"
        badge="10 Q&A"
      >
        <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg divide-y divide-zinc-100 dark:divide-zinc-800">
          <FaqItem
            question="Do leads need to opt in before the bot contacts them?"
            answer="The bot contacts leads that are already in your Close CRM with a matching source and status. Opt-in/consent requirements depend on your industry and jurisdiction. Make sure your lead acquisition process includes appropriate consent for SMS communication."
          />
          <FaqItem
            question="Can a lead be escalated to a human agent?"
            answer="Yes. If the bot detects that a lead is asking questions beyond its scope, is frustrated, or explicitly asks for a person, it flags the conversation for human follow-up. You'll see these flagged conversations in the Conversations tab."
          />
          <FaqItem
            question="What happens when I hit my monthly lead limit?"
            answer="The bot stops engaging new leads but continues all conversations already in progress. No leads are lost — they remain in your CRM for manual follow-up. Your count resets at the start of the next billing cycle."
          />
          <FaqItem
            question="Can I change my plan mid-month?"
            answer="Yes. Upgrades take effect immediately and increase your remaining quota. Downgrades take effect at the next billing cycle."
          />
          <FaqItem
            question="What if my calendar is fully booked?"
            answer="The bot checks your real-time Calendly availability before offering times. If there are no open slots, it lets the lead know and offers to follow up when availability opens up."
          />
          <FaqItem
            question="Where can I see bot conversations?"
            answer="The Conversations tab shows all bot interactions in real time. You can view the full thread, see which leads have been contacted, and monitor how conversations are progressing."
          />
          <FaqItem
            question="The bot isn't responding to some leads — why?"
            answer="Check three things: (1) the lead's source matches one of your configured sources (case-sensitive), (2) the lead's status isn't excluded, and (3) you haven't hit your monthly quota. Also verify the bot is enabled and the lead has a valid phone number."
          />
          <FaqItem
            question="Does the bot support international phone numbers?"
            answer="The bot works with any phone number format supported by Close CRM. International numbers are supported as long as Close can send/receive SMS to that number."
          />
          <FaqItem
            question="Can I change my Lead Sources after setup?"
            answer="Yes. Go to Bot Configuration and update your sources anytime. Changes take effect immediately — the bot will start monitoring the new sources and stop monitoring removed ones."
          />
          <FaqItem
            question="Can I have multiple bots for different Close numbers?"
            answer="Each bot is tied to one Close CRM account. Check the All Bots tab to see all bots across your organization. Contact support if you need multiple bots on different accounts."
          />
        </div>
      </GuideSection>

      {/* ── Section 6: Troubleshooting ── */}
      <GuideSection icon={Wrench} title="Troubleshooting" badge="5 Issues">
        <div className="space-y-2">
          <StepCard step={1} title="Bot not responding to messages">
            <ol className="list-decimal pl-3 space-y-0.5">
              <li>
                Verify the bot is <strong>enabled</strong> in Bot Configuration
              </li>
              <li>
                Check that the lead&apos;s source matches one of your configured
                sources (case-sensitive)
              </li>
              <li>Confirm the lead&apos;s status is not excluded</li>
              <li>
                Check the <strong>Usage</strong> tab to see if you&apos;ve hit
                your monthly quota
              </li>
              <li>
                Verify your Close API key is still valid (keys can be revoked in
                Close settings)
              </li>
            </ol>
          </StepCard>

          <StepCard step={2} title="Calendly connection failing">
            <ol className="list-decimal pl-3 space-y-0.5">
              <li>
                Make sure you have a Calendly <strong>Standard</strong> plan or
                above
              </li>
              <li>
                Try disconnecting and reconnecting — click the disconnect
                button, then reconnect
              </li>
              <li>
                Ensure pop-ups are not blocked in your browser (the OAuth flow
                uses a popup)
              </li>
              <li>
                If using a Calendly team account, make sure you have admin
                permissions
              </li>
            </ol>
          </StepCard>

          <StepCard step={3} title="Wrong appointment times being offered">
            <ol className="list-decimal pl-3 space-y-0.5">
              <li>
                Check your <strong>timezone setting</strong> in Bot
                Configuration — it should match the timezone you want
                appointments in
              </li>
              <li>Verify your Calendly availability hours are set correctly</li>
              <li>
                Ensure your Calendly event type has the correct duration and
                buffer times
              </li>
            </ol>
          </StepCard>

          <StepCard step={4} title="Wrong event type being offered to leads">
            <ol className="list-decimal pl-3 space-y-0.5">
              <li>
                If using auto-detection, the bot picks the default event type —
                set your preferred type as default in Calendly
              </li>
              <li>
                For more control, set up explicit event type mappings in Bot
                Configuration (Step 7 in the walkthrough above)
              </li>
              <li>
                Check that the mapped event type is still active in Calendly
              </li>
            </ol>
          </StepCard>

          <StepCard step={5} title="Usage count seems too high">
            <ol className="list-decimal pl-3 space-y-0.5">
              <li>
                Remember: each <strong>unique lead</strong> counts once,
                regardless of message count
              </li>
              <li>
                Check if you have overlapping Lead Sources that might match more
                leads than expected
              </li>
              <li>
                Review your Lead Status filters — a broad status filter means
                more leads qualify
              </li>
              <li>
                View detailed usage breakdown in the <strong>Usage</strong> tab
              </li>
            </ol>
          </StepCard>
        </div>
      </GuideSection>
    </div>
  );
}
