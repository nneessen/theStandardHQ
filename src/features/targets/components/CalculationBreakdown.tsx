// src/features/targets/components/CalculationBreakdown.tsx

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Calculator, Info } from "lucide-react";
import { formatCurrency } from "../../../lib/format";
import { CalculatedTargets } from "../../../services/targets/targetsCalculationService";

interface CalculationBreakdownProps {
  targets: CalculatedTargets;
  showWarnings?: boolean;
}

export function CalculationBreakdown({
  targets,
  showWarnings = true,
}: CalculationBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const commissionPercent = (targets.avgCommissionRate * 100).toFixed(1);
  const expenseRatioPercent = (targets.expenseRatio * 100).toFixed(1);

  // Calculate gross commission needed (income + expenses)
  // Use targets.annualExpenses which is the actual sum of expenses (not monthlyExpenseTarget * 12)
  const grossCommissionNeeded =
    targets.annualIncomeTarget + targets.annualExpenses;

  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft">
      <div
        className="cursor-pointer px-3 py-2 flex items-center justify-between border-b border-v2-ring"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-v2-ink-muted" />
          <span className="text-sm font-medium text-v2-ink">
            Calculation Breakdown
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-v2-ink-muted">
            {targets.calculationMethod === "historical"
              ? `Based on your data (${targets.dataPoints} data points)`
              : "Using default values"}
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-v2-ink-muted" />
          ) : (
            <ChevronDown className="h-4 w-4 text-v2-ink-muted" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="p-3 space-y-4">
          {/* Data Source Alert */}
          {targets.calculationMethod === "default" && showWarnings && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                Using default values for calculations. As you add more policies
                and commissions, calculations will become more accurate based on
                your actual performance.
              </div>
            </div>
          )}

          {/* Income to Premium Calculation - NOW INCLUDES EXPENSES */}
          <div className="space-y-2 p-4 bg-v2-ring rounded-lg">
            <h4 className="text-sm font-semibold text-v2-ink">
              Income → Premium Needed
            </h4>
            <div className="space-y-1 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-v2-ink-muted">
                  NET Income Target (after expenses):
                </span>
                <span className="text-v2-ink">
                  {formatCurrency(targets.annualIncomeTarget)}
                </span>
              </div>
              <div className="flex justify-between text-v2-ink-muted">
                <span>+ Annual Business Expenses:</span>
                <span>{formatCurrency(targets.annualExpenses)}</span>
              </div>
              <div className="border-t border-v2-ring pt-1 flex justify-between font-semibold text-v2-ink">
                <span>= GROSS Commission Needed:</span>
                <span>{formatCurrency(grossCommissionNeeded)}</span>
              </div>
              <div className="flex justify-between text-v2-ink-muted mt-2">
                <span>÷ Commission Rate:</span>
                <span>{commissionPercent}%</span>
              </div>
              <div className="border-t border-v2-ring pt-1 flex justify-between font-semibold text-v2-ink">
                <span>= Premium Needed:</span>
                <span>{formatCurrency(targets.totalPremiumNeeded)}</span>
              </div>
            </div>
          </div>

          {/* Premium to Policies Calculation */}
          <div className="space-y-2 p-4 bg-v2-ring rounded-lg">
            <h4 className="text-sm font-semibold text-v2-ink">
              Premium → Policies Needed
            </h4>
            <div className="space-y-1 text-sm font-mono">
              <div className="flex justify-between text-v2-ink">
                <span>Premium Needed:</span>
                <span>{formatCurrency(targets.totalPremiumNeeded)}</span>
              </div>
              <div className="flex justify-between text-v2-ink-muted">
                <span>÷ Avg Policy Size:</span>
                <span>{formatCurrency(targets.avgPolicyPremium)}</span>
              </div>
              <div className="border-t border-v2-ring pt-1 flex justify-between font-semibold text-v2-ink">
                <span>= Policies/Year:</span>
                <span>{targets.annualPoliciesTarget}</span>
              </div>
            </div>
          </div>

          {/* Time Period Breakdown */}
          <div className="space-y-3 p-4 bg-v2-ring rounded-lg">
            <h4 className="text-sm font-semibold text-v2-ink mb-2">
              Time Period Breakdown
            </h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-v2-card rounded border border-v2-ring">
                <span className="text-sm font-medium text-v2-ink-muted">
                  Quarterly
                </span>
                <span className="text-base font-semibold font-mono tabular-nums text-v2-ink">
                  {targets.quarterlyPoliciesTarget}{" "}
                  <span className="text-sm text-v2-ink-muted font-normal">
                    policies
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-v2-card rounded border border-v2-ring">
                <span className="text-sm font-medium text-v2-ink-muted">
                  Monthly
                </span>
                <span className="text-base font-semibold font-mono tabular-nums text-v2-ink">
                  {targets.monthlyPoliciesTarget}{" "}
                  <span className="text-sm text-v2-ink-muted font-normal">
                    policies
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-v2-card rounded border border-v2-ring">
                <span className="text-sm font-medium text-v2-ink-muted">
                  Weekly
                </span>
                <span className="text-base font-semibold font-mono tabular-nums text-v2-ink">
                  {targets.weeklyPoliciesTarget}{" "}
                  <span className="text-sm text-v2-ink-muted font-normal">
                    policies
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-v2-card rounded border border-v2-ring">
                <span className="text-sm font-medium text-v2-ink-muted">
                  Daily
                </span>
                <span className="text-base font-semibold font-mono tabular-nums text-v2-ink">
                  {targets.dailyPoliciesTarget}{" "}
                  <span className="text-sm text-v2-ink-muted font-normal">
                    policies
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Key Metrics Used */}
          <div className="space-y-2 p-4 bg-v2-ring rounded-lg">
            <h4 className="text-sm font-semibold text-v2-ink">
              Key Metrics Used
            </h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-v2-ink-muted">Avg Commission Rate:</span>
                <span className="font-mono text-v2-ink">
                  {commissionPercent}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-v2-ink-muted">Avg Policy Premium:</span>
                <span className="font-mono text-v2-ink">
                  {formatCurrency(targets.avgPolicyPremium)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-v2-ink-muted">Monthly Expenses:</span>
                <span className="font-mono text-v2-ink">
                  {formatCurrency(targets.monthlyExpenseTarget)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-v2-ink-muted">Expense Ratio:</span>
                <span className="font-mono text-v2-ink">
                  {expenseRatioPercent}%
                </span>
              </div>
            </div>
          </div>

          {/* Confidence Indicator */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-v2-ink-muted">Calculation Confidence:</span>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {["high", "medium", "low"].map((level) => (
                  <div
                    key={level}
                    className={`h-2 w-6 rounded ${
                      (level === "high" && targets.confidence === "high") ||
                      (level === "medium" &&
                        ["high", "medium"].includes(targets.confidence)) ||
                      level === "low"
                        ? level === "high"
                          ? "bg-emerald-500"
                          : level === "medium"
                            ? "bg-amber-500"
                            : "bg-red-500"
                        : "bg-v2-ring"
                    }`}
                  />
                ))}
              </div>
              <span className="capitalize text-xs font-medium text-v2-ink">
                {targets.confidence}
              </span>
            </div>
          </div>

          {/* Note about adjustments */}
          <p className="text-xs text-v2-ink-muted italic">
            These calculations automatically adjust as you add more policies and
            track commissions. The more data you have, the more accurate the
            projections become.
          </p>
        </div>
      )}
    </div>
  );
}
