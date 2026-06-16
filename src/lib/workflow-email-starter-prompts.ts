// Curated starter prompts for the workflow AI email-template generator
// (edge fn `generate-workflow-email-template`). This is a data CONTRACT for the
// workflows UI: render these as one-click chips that pre-fill the prompt box, then
// POST { prompt } to the edge fn. Lives in @/lib (not @/services) so feature code
// may import it without crossing the eslint feature→service boundary.
//
// Gating: the UI must only surface AI generation when `useAiAccess().hasAiAccess`
// is true — the edge fn enforces the same gate server-side (resolveAiAccessFacts).

export interface WorkflowEmailStarterPrompt {
  /** Short chip label shown in the UI. */
  label: string;
  /** The plain-English prompt sent to the generator. */
  prompt: string;
}

export const WORKFLOW_EMAIL_STARTER_PROMPTS: readonly WorkflowEmailStarterPrompt[] =
  [
    {
      label: "Welcome a new recruit",
      prompt:
        "Warmly welcome a brand-new recruit to the agency, set expectations for onboarding, and tell them their upline will be in touch shortly.",
    },
    {
      label: "Congrats on getting licensed",
      prompt:
        "Congratulate an agent on passing their licensing exam and going licensed, and encourage them to book their first onboarding session.",
    },
    {
      label: "License renewal reminder",
      prompt:
        "Remind an agent that their insurance license is approaching its expiration date and outline the steps to renew it on time.",
    },
    {
      label: "Re-engage a stalled recruit",
      prompt:
        "Gently re-engage a recruit who started the pipeline but stalled, ask if they have questions, and offer to schedule a quick call.",
    },
    {
      label: "Policy issued — next steps",
      prompt:
        "Let the writing agent know a policy was issued and remind them of the next steps to keep persistency strong.",
    },
    {
      label: "Monthly performance check-in",
      prompt:
        "Send an encouraging monthly check-in to an agent, recognizing effort and inviting them to a coaching session if they want help hitting their goals.",
    },
  ];
