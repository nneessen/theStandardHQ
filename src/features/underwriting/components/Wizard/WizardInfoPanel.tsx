import {
  AlertTriangle,
  ClipboardList,
  FileWarning,
  Pill,
  ShieldAlert,
  Stethoscope,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  MedicationInfo,
  WizardFormData,
  WizardStep,
} from "../../types/underwriting.types";

interface WizardInfoPanelProps {
  currentStep: WizardStep;
  formData: WizardFormData;
}

const STEP_GUIDANCE: Record<
  WizardStep,
  {
    eyebrow: string;
    title: string;
    body: string;
    checklist: string[];
    caution: string;
  }
> = {
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

const KNOWN_LIMITATIONS = [
  "This workflow is still being refined and is not fully accurate yet.",
  "Medication capture is coarse and can miss nuance or indication context.",
  "Missing follow-up answers can materially change which products survive screening.",
  "Carrier rules and exceptions can change outside the wizard's current data refresh cycle.",
];

function formatProductType(productType: string): string {
  return productType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function countMedicationSignals(medications: MedicationInfo): number {
  const booleanFlags = [
    medications.bloodThinners,
    medications.heartMeds,
    medications.insulinUse,
    medications.oralDiabetesMeds,
    medications.antidepressants,
    medications.antianxiety,
    medications.antipsychotics,
    medications.moodStabilizers,
    medications.sleepAids,
    medications.adhdMeds,
    medications.seizureMeds,
    medications.migraineMeds,
    medications.inhalers,
    medications.copdMeds,
    medications.thyroidMeds,
    medications.hormonalTherapy,
    medications.steroids,
    medications.immunosuppressants,
    medications.biologics,
    medications.dmards,
    medications.cancerTreatment,
    medications.antivirals,
    medications.osteoporosisMeds,
    medications.kidneyMeds,
    medications.liverMeds,
  ].filter(Boolean).length;

  const countFlags =
    (medications.bpMedCount > 0 ? 1 : 0) +
    (medications.cholesterolMedCount > 0 ? 1 : 0) +
    (medications.painMedications !== "none" ? 1 : 0);

  return booleanFlags + countFlags;
}

export function WizardInfoPanel({
  currentStep,
  formData,
}: WizardInfoPanelProps) {
  const guidance = STEP_GUIDANCE[currentStep];
  const validFaceAmounts = formData.coverage.faceAmounts.filter(
    (amount) => amount >= 10000,
  );
  const medicationSignals = countMedicationSignals(formData.health.medications);

  return (
    <div className="xl:sticky xl:top-4">
      <ScrollArea className="xl:h-[calc(100vh-14rem)]">
        <div className="space-y-4 xl:pr-4">
          <div className="rounded-[28px] border border-warning/30/80 bg-gradient-to-br from-amber-100 via-orange-50 to-white p-5 shadow-sm dark:border-warning/70 dark:from-amber-950/40 dark:via-zinc-950 dark:to-zinc-900">
            <div className="mb-4 flex items-center justify-between gap-3">
              <Badge className="bg-warning text-white hover:bg-warning">
                Use With Caution
              </Badge>
              <ShieldAlert className="h-5 w-5 text-warning" />
            </div>
            <div className="space-y-2">
              <h2
                className="text-xl font-semibold tracking-tight text-v2-ink dark:text-v2-ink"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                Decision support, not final underwriting authority.
              </h2>
              <p className="text-sm leading-6 text-v2-ink dark:text-v2-ink-muted">
                This wizard helps screen likely fits using stored underwriting
                data, but the flow is still evolving. Favorable results should
                be treated as directional until an agent verifies the case
                against current carrier rules.
              </p>
            </div>
          </div>

          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Important</AlertTitle>
            <AlertDescription>
              Use this tool to narrow options and identify follow-up needs. Do
              not use it as the sole basis for quoting a medically complex case.
            </AlertDescription>
          </Alert>

          <Card variant="glass" className="border border-border/70">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardDescription className="uppercase tracking-[0.16em] text-[11px] text-warning">
                    {guidance.eyebrow}
                  </CardDescription>
                  <CardTitle className="text-base">{guidance.title}</CardTitle>
                </div>
                <ClipboardList className="mt-0.5 h-4 w-4 text-v2-ink-subtle" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">
                {guidance.body}
              </p>
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-v2-ink-muted">
                  What to do in this step
                </div>
                <ul className="space-y-2 text-sm text-v2-ink dark:text-v2-ink-muted">
                  {guidance.checklist.map((item) => (
                    <li
                      key={item}
                      className="rounded-lg border border-v2-ring/80 bg-white/70 px-3 py-2 dark:border-v2-ring dark:bg-v2-card/60"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-warning/30 bg-warning/10/90 px-3 py-2 text-sm text-warning dark:border-warning/70 dark:bg-warning/15 dark:text-warning">
                {guidance.caution}
              </div>
            </CardContent>
          </Card>

          <Card variant="outlined" className="border-border/70">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">
                    Current Case Snapshot
                  </CardTitle>
                  <CardDescription>
                    Quick context for the case currently loaded in the wizard.
                  </CardDescription>
                </div>
                <Stethoscope className="h-4 w-4 text-v2-ink-subtle" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-v2-card-tinted px-3 py-2 dark:bg-v2-card">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-v2-ink-muted">
                    Applicant
                  </div>
                  <div className="mt-1 text-sm font-medium text-v2-ink dark:text-v2-ink">
                    {formData.client.name || "Unnamed case"}
                  </div>
                </div>
                <div className="rounded-lg bg-v2-card-tinted px-3 py-2 dark:bg-v2-card">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-v2-ink-muted">
                    Profile
                  </div>
                  <div className="mt-1 text-sm font-medium text-v2-ink dark:text-v2-ink">
                    {formData.client.age > 0
                      ? `Age ${formData.client.age}`
                      : "Age missing"}
                    {formData.client.state ? `, ${formData.client.state}` : ""}
                  </div>
                </div>
                <div className="rounded-lg bg-v2-card-tinted px-3 py-2 dark:bg-v2-card">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-v2-ink-muted">
                    Conditions
                  </div>
                  <div className="mt-1 text-sm font-medium text-v2-ink dark:text-v2-ink">
                    {formData.health.conditions.length}
                  </div>
                </div>
                <div className="rounded-lg bg-v2-card-tinted px-3 py-2 dark:bg-v2-card">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-v2-ink-muted">
                    Med Signals
                  </div>
                  <div className="mt-1 text-sm font-medium text-v2-ink dark:text-v2-ink">
                    {medicationSignals}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-v2-ink-muted">
                  Coverage targets
                </div>
                <div className="flex flex-wrap gap-2">
                  {validFaceAmounts.length > 0 ? (
                    validFaceAmounts.map((amount) => (
                      <Badge
                        key={amount}
                        variant="secondary"
                        className="rounded-full"
                      >
                        ${amount.toLocaleString()}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline" className="rounded-full">
                      No valid face amount yet
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-v2-ink-muted">
                  <Pill className="h-3.5 w-3.5" />
                  Product types
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.coverage.productTypes.map((productType) => (
                    <Badge
                      key={productType}
                      variant="outline"
                      className="rounded-full"
                    >
                      {formatProductType(productType)}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="outlined" className="border-border/70">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Known Limitations</CardTitle>
                  <CardDescription>
                    The current release still requires judgment and
                    verification.
                  </CardDescription>
                </div>
                <FileWarning className="h-4 w-4 text-v2-ink-subtle" />
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-v2-ink dark:text-v2-ink-muted">
                {KNOWN_LIMITATIONS.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-warning" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}

export default WizardInfoPanel;
