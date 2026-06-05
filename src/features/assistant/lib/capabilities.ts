// Single source of truth for "what can Jarvis actually do" — used by the in-app guide
// (CapabilitiesSheet) and the quick-prompt chips (CommandInput) so they never drift apart.
//
// Every prompt here is grounded in a REAL orchestrator tool (see
// supabase/functions/assistant-orchestrator/core/registry.ts + agents.ts) — nothing aspirational.
// Each example is phrased to be directly runnable as-is (no "<name>" placeholders that would
// send a literal placeholder), so clicking it produces a sensible, grounded action.

export interface CapabilityExample {
  /** The exact message sent to Jarvis when the example is clicked. */
  prompt: string;
}

export interface CapabilityGroup {
  /** Short section heading. */
  title: string;
  /** One-line description of what this group covers. */
  blurb: string;
  examples: CapabilityExample[];
}

export const CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    title: "Daily briefing",
    blurb: "A fast, grounded read on what needs your attention right now.",
    examples: [
      { prompt: "Brief me on what needs my attention today" },
      { prompt: "What should I focus on first this morning?" },
    ],
  },
  {
    title: "Production & policies",
    blurb: "Your numbers, your team's numbers, and per-policy detail.",
    examples: [
      { prompt: "How's my production this month?" },
      { prompt: "How is my team's production this month?" },
      { prompt: "Who are my top producers right now?" },
      { prompt: "List my pending policies from the last two weeks" },
      { prompt: "Which carriers am I missing writing numbers with?" },
    ],
  },
  {
    title: "Risk & retention",
    blurb: "Chargeback exposure and policies that need saving.",
    examples: [
      { prompt: "What policies are at risk of chargeback?" },
      { prompt: "Where is my commission advance most exposed?" },
    ],
  },
  {
    title: "Leads & clients",
    blurb: "Who to call next and a read on your book of business.",
    examples: [
      { prompt: "Which leads should I call first?" },
      { prompt: "Give me a snapshot of my book of business" },
    ],
  },
  {
    title: "Close CRM",
    blurb: "Live pipeline and activity — if your Close account is connected.",
    examples: [
      { prompt: "Show my open Close opportunities" },
      { prompt: "What's stalled in my Close pipeline?" },
    ],
  },
  {
    title: "Drafting",
    blurb: "Outreach you approve before anything is sent — never auto-sent.",
    examples: [
      { prompt: "Draft a follow-up email for me to approve" },
      { prompt: "Draft a text reminder for me to approve" },
    ],
  },
  {
    title: "Underwriting",
    blurb: "Rank carriers by approval odds for a client's health profile.",
    examples: [
      {
        prompt:
          "Which carrier is best for a 55-year-old male smoker in Texas with diabetes?",
      },
    ],
  },
  {
    title: "Memory",
    blurb: "Tell Jarvis to remember goals and preferences across sessions.",
    examples: [
      { prompt: "Remember my goal is $50k AP this year" },
      { prompt: "What do you know about me?" },
    ],
  },
];

// The three chips shown directly under the command input. A curated subset of the most common
// asks; the full reference lives in the "?" guide (CapabilitiesSheet).
export const QUICK_PROMPTS: string[] = [
  "Brief me on what needs my attention today",
  "What policies are at risk of chargeback?",
  "How is my team's production this month?",
];
