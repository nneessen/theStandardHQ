import type { WizardStep } from "../../types/underwriting.types";

export interface StepGuidance {
  eyebrow: string;
  title: string;
  body: string;
  checklist: string[];
  caution: string;
}

export const STEP_GUIDANCE: Record<WizardStep, StepGuidance> = {
  client: {
    eyebrow: "Baseline intake",
    title: "Start with clean demographic and build data",
    body: "Age, state, tobacco, height, and weight shape the candidate product set before any medical underwriting logic is applied.",
    checklist: [
      "Use the applicant's actual age and state of issue.",
      "Confirm height and weight carefully before moving on.",
      "If tobacco or nicotine use is recent, capture that now instead of guessing later.",
    ],
    caution:
      "Bad baseline data skews every later recommendation, even when the rules engine is deterministic.",
  },
  health: {
    eyebrow: "Condition intake",
    title: "Enter diagnosed conditions, not broad symptoms",
    body: "The strongest underwriting outputs come from specific diagnoses plus complete follow-up facts such as diagnosis date, severity, recurrence, and recent events.",
    checklist: [
      "Add known diagnoses only.",
      "Open follow-up questions for each selected condition and answer the required items.",
      "If the client is unsure about a major event date or severity, pause and confirm it.",
    ],
    caution:
      "Missing or vague condition details will often force manual review or distort product eligibility.",
  },
  medications: {
    eyebrow: "Medication review",
    title: "Use medications to validate the medical story",
    body: "Medication data is useful when it supports known diagnoses and flags missing follow-up, but it is still one of the least mature parts of this wizard.",
    checklist: [
      "Focus on current medications with real underwriting significance.",
      "If a medication implies a condition that was not selected, go back and confirm the diagnosis history.",
      "Treat specialty medications, opioids, insulin, and immunosuppressants as verification triggers.",
    ],
    caution:
      "This step is still improving. Do not treat medication-only inputs as a complete underwriting picture.",
  },
  coverage: {
    eyebrow: "Product targeting",
    title: "Ask for the real coverage goal",
    body: "Face amount, product type, and term choices determine which products survive hard eligibility before pricing and ranking happen.",
    checklist: [
      "Enter realistic face amounts the client would actually consider.",
      "Use the right product category before comparing prices.",
      "If term length matters, plan to review the term-specific results carefully.",
    ],
    caution:
      "A favorable result at the wrong face amount or product type is not useful underwriting guidance.",
  },
  review: {
    eyebrow: "Quality control",
    title: "Clear mismatches before you run the case",
    body: "This is the point to catch contradictions between conditions, medications, tobacco use, and requested coverage.",
    checklist: [
      "Recheck condition follow-ups that are partially answered.",
      "Look for medications that do not match the selected diagnoses.",
      "Confirm the applicant profile one more time before running results.",
    ],
    caution:
      "If the intake is sloppy here, the results page will look more certain than it should.",
  },
  results: {
    eyebrow: "Decision support",
    title: "Use the results as screening guidance only",
    body: "The wizard helps narrow likely fits, but it is not a binding underwriting decision and it is not a substitute for current carrier confirmation.",
    checklist: [
      "Compare eligibility reasons, not just price.",
      "Escalate complex or unusual cases for manual verification.",
      "Cross-check any borderline result against carrier documentation before presenting it as likely approved.",
    ],
    caution:
      "Do not present the output as final carrier approval, especially for medically complex cases.",
  },
};

export const KNOWN_LIMITATIONS = [
  "This workflow is still being refined and is not fully accurate yet.",
  "Medication capture is coarse and can miss nuance or indication context.",
  "Missing follow-up answers can materially change which products survive screening.",
  "Carrier rules and exceptions can change outside the wizard's current data refresh cycle.",
];
