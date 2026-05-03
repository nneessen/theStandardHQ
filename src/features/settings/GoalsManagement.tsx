// src/features/settings/GoalsManagement.tsx
// Redesigned with zinc palette and compact design patterns

import React, { useState, useEffect } from "react";
import {
  Target,
  Save,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUserTargets, useUpdateUserTargets } from "@/hooks";
import { formatCurrency } from "@/utils/formatters";

export function GoalsManagement() {
  const { data: userTargets, isLoading } = useUserTargets();
  const updateTargets = useUpdateUserTargets();

  // Form state
  const [annualIncomeTarget, setAnnualIncomeTarget] =
    useState<string>("120000");
  const [monthlyIncomeTarget, setMonthlyIncomeTarget] =
    useState<string>("10000");
  const [annualPoliciesTarget, setAnnualPoliciesTarget] =
    useState<string>("100");
  const [monthlyPoliciesTarget, setMonthlyPoliciesTarget] =
    useState<string>("9");
  const [persistency13Target, setPersistency13Target] = useState<string>("85");

  const [validationError, setValidationError] = useState<string>("");
  const [showSuccess, setShowSuccess] = useState(false);

  // Load data when available
  useEffect(() => {
    if (userTargets) {
      setAnnualIncomeTarget(
        userTargets.annual_income_target?.toString() || "120000",
      );
      setMonthlyIncomeTarget(
        userTargets.monthly_income_target?.toString() || "10000",
      );
      setAnnualPoliciesTarget(
        userTargets.annual_policies_target?.toString() || "100",
      );
      setMonthlyPoliciesTarget(
        userTargets.monthly_policies_target?.toString() || "9",
      );
      setPersistency13Target(
        ((userTargets.persistency_13_month_target || 0.85) * 100).toString(),
      );
    }
  }, [userTargets]);

  const validateForm = (): boolean => {
    const annualIncome = Number(annualIncomeTarget);
    if (isNaN(annualIncome) || annualIncome < 0) {
      setValidationError("Annual income target must be a positive number");
      return false;
    }

    const monthlyIncome = Number(monthlyIncomeTarget);
    if (isNaN(monthlyIncome) || monthlyIncome < 0) {
      setValidationError("Monthly income target must be a positive number");
      return false;
    }

    const annualPolicies = Number(annualPoliciesTarget);
    if (
      isNaN(annualPolicies) ||
      annualPolicies < 0 ||
      !Number.isInteger(annualPolicies)
    ) {
      setValidationError("Annual policies target must be a positive integer");
      return false;
    }

    const monthlyPolicies = Number(monthlyPoliciesTarget);
    if (
      isNaN(monthlyPolicies) ||
      monthlyPolicies < 0 ||
      !Number.isInteger(monthlyPolicies)
    ) {
      setValidationError("Monthly policies target must be a positive integer");
      return false;
    }

    const persistency = Number(persistency13Target);
    if (isNaN(persistency) || persistency < 0 || persistency > 100) {
      setValidationError("Persistency target must be between 0 and 100");
      return false;
    }

    setValidationError("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuccess(false);

    if (!validateForm()) {
      return;
    }

    try {
      await updateTargets.mutateAsync({
        annual_income_target: Number(annualIncomeTarget),
        monthly_income_target: Number(monthlyIncomeTarget),
        annual_policies_target: parseInt(annualPoliciesTarget, 10),
        monthly_policies_target: parseInt(monthlyPoliciesTarget, 10),
        persistency_13_month_target: Number(persistency13Target) / 100,
      });

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (_error) {
      setValidationError("Failed to update targets. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div className="bg-v2-card rounded-lg border border-v2-ring p-6">
        <div className="flex items-center justify-center text-[11px] text-v2-ink-muted">
          Loading your goals...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Goals Form Card */}
      <div className="bg-v2-card rounded-lg border border-v2-ring">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-v2-ring/60">
          <Target className="h-3.5 w-3.5 text-v2-ink-subtle" />
          <div>
            <h3 className="text-[11px] font-semibold text-v2-ink uppercase tracking-wide">
              Income & Production Goals
            </h3>
            <p className="text-[10px] text-v2-ink-muted">
              Set your annual and monthly targets for income and production
            </p>
          </div>
        </div>
        <div className="p-3">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Income Targets */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-wide flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Income Targets
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="annualIncome"
                    className="block text-[10px] font-medium text-v2-ink-muted mb-1"
                  >
                    Annual Income Goal
                  </label>
                  <Input
                    id="annualIncome"
                    type="number"
                    value={annualIncomeTarget}
                    onChange={(e) => {
                      setAnnualIncomeTarget(e.target.value);
                      setShowSuccess(false);
                    }}
                    placeholder="120000"
                    step="1000"
                    className="h-7 text-[11px] bg-v2-card border-v2-ring"
                  />
                  <p className="text-[10px] text-v2-ink-subtle mt-0.5">
                    Target: {formatCurrency(Number(annualIncomeTarget) || 0)}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="monthlyIncome"
                    className="block text-[10px] font-medium text-v2-ink-muted mb-1"
                  >
                    Monthly Income Goal
                  </label>
                  <Input
                    id="monthlyIncome"
                    type="number"
                    value={monthlyIncomeTarget}
                    onChange={(e) => {
                      setMonthlyIncomeTarget(e.target.value);
                      setShowSuccess(false);
                    }}
                    placeholder="10000"
                    step="100"
                    className="h-7 text-[11px] bg-v2-card border-v2-ring"
                  />
                  <p className="text-[10px] text-v2-ink-subtle mt-0.5">
                    Target: {formatCurrency(Number(monthlyIncomeTarget) || 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Production Targets */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-wide">
                Production Targets
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="annualPolicies"
                    className="block text-[10px] font-medium text-v2-ink-muted mb-1"
                  >
                    Annual Policies Goal
                  </label>
                  <Input
                    id="annualPolicies"
                    type="number"
                    value={annualPoliciesTarget}
                    onChange={(e) => {
                      setAnnualPoliciesTarget(e.target.value);
                      setShowSuccess(false);
                    }}
                    placeholder="100"
                    step="1"
                    className="h-7 text-[11px] bg-v2-card border-v2-ring"
                  />
                  <p className="text-[10px] text-v2-ink-subtle mt-0.5">
                    Number of policies to sell this year
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="monthlyPolicies"
                    className="block text-[10px] font-medium text-v2-ink-muted mb-1"
                  >
                    Monthly Policies Goal
                  </label>
                  <Input
                    id="monthlyPolicies"
                    type="number"
                    value={monthlyPoliciesTarget}
                    onChange={(e) => {
                      setMonthlyPoliciesTarget(e.target.value);
                      setShowSuccess(false);
                    }}
                    placeholder="9"
                    step="1"
                    className="h-7 text-[11px] bg-v2-card border-v2-ring"
                  />
                  <p className="text-[10px] text-v2-ink-subtle mt-0.5">
                    Number of policies to sell per month
                  </p>
                </div>
              </div>
            </div>

            {/* Quality Targets */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-wide">
                Quality Targets
              </h4>
              <div className="max-w-xs">
                <label
                  htmlFor="persistency"
                  className="block text-[10px] font-medium text-v2-ink-muted mb-1"
                >
                  13-Month Persistency Goal (%)
                </label>
                <Input
                  id="persistency"
                  type="number"
                  value={persistency13Target}
                  onChange={(e) => {
                    setPersistency13Target(e.target.value);
                    setShowSuccess(false);
                  }}
                  placeholder="85"
                  step="1"
                  min="0"
                  max="100"
                  className="h-7 text-[11px] bg-v2-card border-v2-ring"
                />
                <p className="text-[10px] text-v2-ink-subtle mt-0.5">
                  Target retention rate at 13 months: {persistency13Target}%
                </p>
              </div>
            </div>

            {/* Validation Error */}
            {validationError && (
              <div className="flex items-center gap-2 p-2 bg-destructive/10 border border-destructive/30 rounded text-[10px] text-destructive">
                <AlertCircle className="h-3 w-3 flex-shrink-0" />
                {validationError}
              </div>
            )}

            {/* Success Message */}
            {showSuccess && (
              <div className="flex items-center gap-2 p-2 bg-success/10 border border-success/30 rounded text-[10px] text-success">
                <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                Goals updated successfully!
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={updateTargets.isPending}
                size="sm"
                className="h-7 px-3 text-[10px]"
              >
                <Save className="h-3 w-3 mr-1" />
                {updateTargets.isPending ? "Saving..." : "Save Goals"}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-info/10 rounded-lg border border-info/30 p-3">
        <h4 className="text-[10px] font-semibold text-info mb-1.5">
          How Goals Are Used
        </h4>
        <div className="space-y-1 text-[10px] text-info">
          <p>
            <span className="font-medium text-info">Income Goal Tracker:</span>{" "}
            Your annual income goal is displayed in the Analytics dashboard,
            showing your progress and projecting if you'll hit your target.
          </p>
          <p>
            <span className="font-medium text-info">Production Metrics:</span>{" "}
            Policy goals help calculate how many policies you need to sell per
            week/month to stay on track.
          </p>
          <p>
            <span className="font-medium text-info">Quality Benchmarks:</span>{" "}
            Premium and persistency targets help you maintain quality while
            scaling production.
          </p>
        </div>
      </div>
    </div>
  );
}
