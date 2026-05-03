// src/features/underwriting/components/WizardSteps/ReviewStep.tsx

import { useMemo } from "react";
import {
  User,
  Activity,
  DollarSign,
  AlertCircle,
  Cigarette,
  Pill,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ClientInfo,
  HealthInfo,
  CoverageRequest,
} from "../../../types/underwriting.types";
import { US_STATES } from "@/constants/states";
import {
  calculateBMI,
  getBMICategory,
  formatHeight,
} from "../../../utils/shared/bmiCalculator";

interface ReviewStepProps {
  clientInfo: ClientInfo;
  healthInfo: HealthInfo;
  coverageRequest: CoverageRequest;
}

const PRODUCT_LABELS: Record<string, string> = {
  term_life: "Term Life",
  whole_life: "Whole Life",
  universal_life: "Universal Life",
  indexed_universal_life: "Indexed Universal Life",
};

export default function ReviewStep({
  clientInfo,
  healthInfo,
  coverageRequest,
}: ReviewStepProps) {
  const bmi = useMemo(
    () =>
      calculateBMI(
        clientInfo.heightFeet,
        clientInfo.heightInches,
        clientInfo.weight,
      ),
    [clientInfo.heightFeet, clientInfo.heightInches, clientInfo.weight],
  );

  const bmiCategory = useMemo(() => getBMICategory(bmi), [bmi]);

  const stateName = useMemo(() => {
    const state = US_STATES.find((s) => s.value === clientInfo.state);
    return state?.label || clientInfo.state;
  }, [clientInfo.state]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Count risk factors for summary
  const riskFactorCount = useMemo(() => {
    let count = 0;
    if (healthInfo.conditions.length > 0) count += healthInfo.conditions.length;
    if (healthInfo.tobacco.currentUse) count++;
    if (bmi >= 30) count++;
    if (healthInfo.medications.bpMedCount >= 2) count++;
    if (healthInfo.medications.cholesterolMedCount >= 2) count++;
    if (healthInfo.medications.insulinUse) count++;
    if (healthInfo.medications.bloodThinners) count++;
    if (healthInfo.medications.antidepressants) count++;
    if (healthInfo.medications.painMedications === "opioid") count++;
    return count;
  }, [healthInfo, bmi]);

  return (
    <div className="space-y-4 p-1">
      <div className="text-xs text-v2-ink-muted dark:text-v2-ink-subtle mb-3">
        Review the information below before submitting for AI analysis.
      </div>

      {/* Risk Summary Banner */}
      <div
        className={cn(
          "p-3 rounded-lg border",
          riskFactorCount === 0
            ? "bg-success/10 border-success/30"
            : riskFactorCount <= 2
              ? "bg-warning/10 dark:bg-warning/20 border-warning/30"
              : "bg-warning/10 dark:bg-warning/20 border-warning/30",
        )}
      >
        <div className="flex items-center gap-2">
          <AlertCircle
            className={cn(
              "h-4 w-4",
              riskFactorCount === 0
                ? "text-success"
                : riskFactorCount <= 2
                  ? "text-warning"
                  : "text-warning",
            )}
          />
          <span
            className={cn(
              "text-xs font-medium",
              riskFactorCount === 0
                ? "text-success"
                : riskFactorCount <= 2
                  ? "text-warning"
                  : "text-warning",
            )}
          >
            {riskFactorCount === 0
              ? "No significant risk factors identified"
              : `${riskFactorCount} potential risk factor${riskFactorCount > 1 ? "s" : ""} identified`}
          </span>
        </div>
      </div>

      {/* Client Information */}
      <div className="border border-v2-ring dark:border-v2-ring-strong rounded-lg overflow-hidden shadow-sm bg-v2-card">
        <div className="px-4 py-2.5 bg-v2-card-tinted dark:bg-v2-card-tinted border-b border-v2-ring dark:border-v2-ring-strong flex items-center gap-2">
          <User className="h-4 w-4 text-v2-ink-muted dark:text-v2-ink-subtle" />
          <span className="text-sm font-semibold text-v2-ink dark:text-v2-ink">
            Client Information
          </span>
        </div>
        <div className="p-4 bg-v2-card grid grid-cols-2 gap-y-2.5 gap-x-4 text-sm">
          {clientInfo.name && (
            <>
              <span className="text-v2-ink-muted">Name:</span>
              <span className="text-v2-ink dark:text-v2-ink-muted">
                {clientInfo.name}
              </span>
            </>
          )}
          <span className="text-v2-ink-muted">Age:</span>
          <span className="text-v2-ink dark:text-v2-ink-muted">
            {clientInfo.age} years
          </span>
          <span className="text-v2-ink-muted">Gender:</span>
          <span className="text-v2-ink dark:text-v2-ink-muted capitalize">
            {clientInfo.gender}
          </span>
          <span className="text-v2-ink-muted">State:</span>
          <span className="text-v2-ink dark:text-v2-ink-muted">
            {stateName}
          </span>
          <span className="text-v2-ink-muted">Height:</span>
          <span className="text-v2-ink dark:text-v2-ink-muted">
            {formatHeight(clientInfo.heightFeet, clientInfo.heightInches)}
          </span>
          <span className="text-v2-ink-muted">Weight:</span>
          <span className="text-v2-ink dark:text-v2-ink-muted">
            {clientInfo.weight} lbs
          </span>
          <span className="text-v2-ink-muted">BMI:</span>
          <span
            className={cn(
              bmi >= 30
                ? "text-warning"
                : bmi >= 25
                  ? "text-warning"
                  : "text-success",
            )}
          >
            {bmi} ({bmiCategory})
          </span>
        </div>
      </div>

      {/* Health Information */}
      <div className="border border-v2-ring dark:border-v2-ring-strong rounded-lg overflow-hidden shadow-sm bg-v2-card">
        <div className="px-4 py-2.5 bg-v2-card-tinted dark:bg-v2-card-tinted border-b border-v2-ring dark:border-v2-ring-strong flex items-center gap-2">
          <Activity className="h-4 w-4 text-v2-ink-muted dark:text-v2-ink-subtle" />
          <span className="text-sm font-semibold text-v2-ink dark:text-v2-ink">
            Health Information
          </span>
        </div>
        <div className="p-4 bg-v2-card space-y-3">
          {/* Conditions */}
          <div>
            <span className="text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide">
              Conditions Reported
            </span>
            {healthInfo.conditions.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {healthInfo.conditions.map((c) => (
                  <span
                    key={c.conditionCode}
                    className="inline-flex px-2 py-0.5 bg-destructive/10 border border-destructive/30 rounded text-[10px] text-destructive"
                  >
                    {c.conditionName}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-success">
                No health conditions reported
              </p>
            )}
          </div>

          {/* Tobacco */}
          <div className="flex items-center gap-2 pt-2 border-t border-v2-ring dark:border-v2-ring">
            <Cigarette className="h-3.5 w-3.5 text-v2-ink-subtle" />
            <span className="text-xs text-v2-ink-muted">Tobacco Use:</span>
            <span
              className={cn(
                "text-xs",
                healthInfo.tobacco.currentUse ? "text-warning" : "text-success",
              )}
            >
              {healthInfo.tobacco.currentUse
                ? `Yes (${healthInfo.tobacco.type || "unspecified"})`
                : "No"}
            </span>
          </div>

          {/* Medications */}
          <div className="pt-2 border-t border-v2-ring dark:border-v2-ring space-y-2">
            <div className="flex items-center gap-2">
              <Pill className="h-3.5 w-3.5 text-v2-ink-subtle" />
              <span className="text-[10px] font-medium text-v2-ink-muted">
                Medications
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs pl-5">
              <span className="text-v2-ink-muted">
                BP Meds:{" "}
                <span
                  className={cn(
                    healthInfo.medications.bpMedCount >= 2
                      ? "text-warning"
                      : "text-v2-ink dark:text-v2-ink-muted",
                  )}
                >
                  {healthInfo.medications.bpMedCount}
                </span>
              </span>
              <span className="text-v2-ink-muted">
                Cholesterol:{" "}
                <span
                  className={cn(
                    healthInfo.medications.cholesterolMedCount >= 2
                      ? "text-warning"
                      : "text-v2-ink dark:text-v2-ink-muted",
                  )}
                >
                  {healthInfo.medications.cholesterolMedCount}
                </span>
              </span>
              {healthInfo.medications.insulinUse && (
                <span className="text-warning">Insulin</span>
              )}
              {healthInfo.medications.bloodThinners && (
                <span className="text-warning">Blood Thinners</span>
              )}
              {healthInfo.medications.antidepressants && (
                <span className="text-warning">Antidepressants</span>
              )}
              {healthInfo.medications.painMedications !== "none" && (
                <span
                  className={cn(
                    healthInfo.medications.painMedications === "opioid"
                      ? "text-destructive"
                      : healthInfo.medications.painMedications ===
                          "prescribed_non_opioid"
                        ? "text-warning"
                        : "text-v2-ink-muted",
                  )}
                >
                  Pain:{" "}
                  {healthInfo.medications.painMedications === "opioid"
                    ? "Opioid"
                    : healthInfo.medications.painMedications ===
                        "prescribed_non_opioid"
                      ? "Rx Non-Opioid"
                      : "OTC"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Coverage Request */}
      <div className="border border-v2-ring dark:border-v2-ring-strong rounded-lg overflow-hidden shadow-sm bg-v2-card">
        <div className="px-4 py-2.5 bg-v2-card-tinted dark:bg-v2-card-tinted border-b border-v2-ring dark:border-v2-ring-strong flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-v2-ink-muted dark:text-v2-ink-subtle" />
          <span className="text-sm font-semibold text-v2-ink dark:text-v2-ink">
            Coverage Request
          </span>
        </div>
        <div className="p-4 bg-v2-card space-y-2">
          <div className="flex items-start justify-between text-xs">
            <span className="text-v2-ink-muted">Face Amounts:</span>
            <div className="flex flex-wrap gap-1 justify-end">
              {(coverageRequest.faceAmounts || [])
                .filter((a) => a >= 10000)
                .map((amount, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 bg-success/10 border border-success/30 rounded text-[10px] text-success font-medium"
                  >
                    {formatCurrency(amount)}
                  </span>
                ))}
            </div>
          </div>
          <div className="flex items-start justify-between text-xs">
            <span className="text-v2-ink-muted">Product Types:</span>
            <div className="flex flex-wrap gap-1 justify-end">
              {coverageRequest.productTypes.map((type) => (
                <span
                  key={type}
                  className="px-1.5 py-0.5 bg-info/10 border border-info/30 rounded text-[10px] text-info"
                >
                  {PRODUCT_LABELS[type] || type}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Submit Notice */}
      <div className="p-3 bg-info/10 border border-info/30 rounded-lg">
        <p className="text-xs text-info">
          Click <span className="font-medium">"Get Recommendations"</span> to
          analyze this client profile and receive carrier/product
          recommendations with expected rating classes.
        </p>
      </div>
    </div>
  );
}
