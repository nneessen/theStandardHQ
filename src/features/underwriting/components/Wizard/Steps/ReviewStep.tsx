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
      <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
        Review the information below before submitting for AI analysis.
      </div>

      {/* Risk Summary Banner */}
      <div
        className={cn(
          "p-3 rounded-lg border",
          riskFactorCount === 0
            ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
            : riskFactorCount <= 2
              ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
              : "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800",
        )}
      >
        <div className="flex items-center gap-2">
          <AlertCircle
            className={cn(
              "h-4 w-4",
              riskFactorCount === 0
                ? "text-emerald-600"
                : riskFactorCount <= 2
                  ? "text-yellow-600"
                  : "text-orange-600",
            )}
          />
          <span
            className={cn(
              "text-xs font-medium",
              riskFactorCount === 0
                ? "text-emerald-700 dark:text-emerald-300"
                : riskFactorCount <= 2
                  ? "text-yellow-700 dark:text-yellow-300"
                  : "text-orange-700 dark:text-orange-300",
            )}
          >
            {riskFactorCount === 0
              ? "No significant risk factors identified"
              : `${riskFactorCount} potential risk factor${riskFactorCount > 1 ? "s" : ""} identified`}
          </span>
        </div>
      </div>

      {/* Client Information */}
      <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden shadow-sm bg-white dark:bg-zinc-900">
        <div className="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-2">
          <User className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            Client Information
          </span>
        </div>
        <div className="p-4 bg-white dark:bg-zinc-900 grid grid-cols-2 gap-y-2.5 gap-x-4 text-sm">
          {clientInfo.name && (
            <>
              <span className="text-zinc-500">Name:</span>
              <span className="text-zinc-700 dark:text-zinc-300">
                {clientInfo.name}
              </span>
            </>
          )}
          <span className="text-zinc-500">Age:</span>
          <span className="text-zinc-700 dark:text-zinc-300">
            {clientInfo.age} years
          </span>
          <span className="text-zinc-500">Gender:</span>
          <span className="text-zinc-700 dark:text-zinc-300 capitalize">
            {clientInfo.gender}
          </span>
          <span className="text-zinc-500">State:</span>
          <span className="text-zinc-700 dark:text-zinc-300">{stateName}</span>
          <span className="text-zinc-500">Height:</span>
          <span className="text-zinc-700 dark:text-zinc-300">
            {formatHeight(clientInfo.heightFeet, clientInfo.heightInches)}
          </span>
          <span className="text-zinc-500">Weight:</span>
          <span className="text-zinc-700 dark:text-zinc-300">
            {clientInfo.weight} lbs
          </span>
          <span className="text-zinc-500">BMI:</span>
          <span
            className={cn(
              bmi >= 30
                ? "text-orange-600 dark:text-orange-400"
                : bmi >= 25
                  ? "text-yellow-600 dark:text-yellow-400"
                  : "text-emerald-600 dark:text-emerald-400",
            )}
          >
            {bmi} ({bmiCategory})
          </span>
        </div>
      </div>

      {/* Health Information */}
      <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden shadow-sm bg-white dark:bg-zinc-900">
        <div className="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-2">
          <Activity className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            Health Information
          </span>
        </div>
        <div className="p-4 bg-white dark:bg-zinc-900 space-y-3">
          {/* Conditions */}
          <div>
            <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide">
              Conditions Reported
            </span>
            {healthInfo.conditions.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {healthInfo.conditions.map((c) => (
                  <span
                    key={c.conditionCode}
                    className="inline-flex px-2 py-0.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-[10px] text-red-700 dark:text-red-300"
                  >
                    {c.conditionName}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                No health conditions reported
              </p>
            )}
          </div>

          {/* Tobacco */}
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <Cigarette className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-xs text-zinc-500">Tobacco Use:</span>
            <span
              className={cn(
                "text-xs",
                healthInfo.tobacco.currentUse
                  ? "text-orange-600 dark:text-orange-400"
                  : "text-emerald-600 dark:text-emerald-400",
              )}
            >
              {healthInfo.tobacco.currentUse
                ? `Yes (${healthInfo.tobacco.type || "unspecified"})`
                : "No"}
            </span>
          </div>

          {/* Medications */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
            <div className="flex items-center gap-2">
              <Pill className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-[10px] font-medium text-zinc-500">
                Medications
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs pl-5">
              <span className="text-zinc-500">
                BP Meds:{" "}
                <span
                  className={cn(
                    healthInfo.medications.bpMedCount >= 2
                      ? "text-orange-600"
                      : "text-zinc-700 dark:text-zinc-300",
                  )}
                >
                  {healthInfo.medications.bpMedCount}
                </span>
              </span>
              <span className="text-zinc-500">
                Cholesterol:{" "}
                <span
                  className={cn(
                    healthInfo.medications.cholesterolMedCount >= 2
                      ? "text-orange-600"
                      : "text-zinc-700 dark:text-zinc-300",
                  )}
                >
                  {healthInfo.medications.cholesterolMedCount}
                </span>
              </span>
              {healthInfo.medications.insulinUse && (
                <span className="text-orange-600">Insulin</span>
              )}
              {healthInfo.medications.bloodThinners && (
                <span className="text-orange-600">Blood Thinners</span>
              )}
              {healthInfo.medications.antidepressants && (
                <span className="text-amber-600">Antidepressants</span>
              )}
              {healthInfo.medications.painMedications !== "none" && (
                <span
                  className={cn(
                    healthInfo.medications.painMedications === "opioid"
                      ? "text-red-600"
                      : healthInfo.medications.painMedications ===
                          "prescribed_non_opioid"
                        ? "text-amber-600"
                        : "text-zinc-600",
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
      <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden shadow-sm bg-white dark:bg-zinc-900">
        <div className="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            Coverage Request
          </span>
        </div>
        <div className="p-4 bg-white dark:bg-zinc-900 space-y-2">
          <div className="flex items-start justify-between text-xs">
            <span className="text-zinc-500">Face Amounts:</span>
            <div className="flex flex-wrap gap-1 justify-end">
              {(coverageRequest.faceAmounts || [])
                .filter((a) => a >= 10000)
                .map((amount, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded text-[10px] text-emerald-700 dark:text-emerald-300 font-medium"
                  >
                    {formatCurrency(amount)}
                  </span>
                ))}
            </div>
          </div>
          <div className="flex items-start justify-between text-xs">
            <span className="text-zinc-500">Product Types:</span>
            <div className="flex flex-wrap gap-1 justify-end">
              {coverageRequest.productTypes.map((type) => (
                <span
                  key={type}
                  className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-[10px] text-blue-700 dark:text-blue-300"
                >
                  {PRODUCT_LABELS[type] || type}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Submit Notice */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Click <span className="font-medium">"Get Recommendations"</span> to
          analyze this client profile and receive carrier/product
          recommendations with expected rating classes.
        </p>
      </div>
    </div>
  );
}
