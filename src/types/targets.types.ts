// src/types/targets.types.ts

/**
 * User Targets - Personal Goal Tracking
 *
 * Stores user-specific targets for income, policy counts, persistency rates,
 * and expense management. All targets are customizable and track achievement milestones.
 */

// Achievement types and levels
export type AchievementType =
  | "income"
  | "policies"
  | "persistency"
  | "streak"
  | "milestone";
export type AchievementLevel = "bronze" | "silver" | "gold" | "platinum";

export interface Achievement {
  id: string;
  type: AchievementType;
  level: AchievementLevel;
  name: string;
  description: string;
  earnedDate: Date;
  value: number;
}

// Core user targets interface
export interface UserTargets {
  id: string;
  userId: string;

  // Income targets
  annualIncomeTarget: number;
  monthlyIncomeTarget: number;
  quarterlyIncomeTarget: number;

  // Policy targets
  annualPoliciesTarget: number;
  monthlyPoliciesTarget: number;
  avgPremiumTarget: number;

  // Persistency targets (as decimals: 0.85 = 85%)
  persistency13MonthTarget: number;
  persistency25MonthTarget: number;

  // Expense targets
  monthlyExpenseTarget: number;
  expenseRatioTarget: number; // As decimal: 0.30 = 30%

  // Realism knobs — drive the realistic plan in targetsCalculationService.
  // All decimals. premiumStatPreference is 'mean' | 'median'.
  persistencyAssumption: number;
  taxReserveRate: number;
  ntoBufferRate: number;
  premiumStatPreference: "mean" | "median";

  // Milestones
  achievements: Achievement[];
  lastMilestoneDate: Date | null;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// Progress tracking status
export type ProgressStatus = "ahead" | "on-track" | "behind" | "critical";

// Pace calculations for "policies needed per time period"
export interface PaceMetrics {
  daily: number;
  weekly: number;
  monthly: number;
}

// Progress tracking for a specific target
export interface TargetProgress {
  target: number;
  actual: number;
  percentage: number;
  remaining: number;
  pace: PaceMetrics;
  status: ProgressStatus;
  projectedEnd: number; // Projected final value based on current pace
}

// Actual metrics from the database (what user has achieved)
export interface ActualMetrics {
  // Income actuals
  ytdIncome: number;
  mtdIncome: number;
  qtdIncome: number;

  // Policy actuals
  ytdPolicies: number;
  mtdPolicies: number;
  currentAvgPremium: number;

  // Persistency actuals
  persistency13Month: number;
  persistency25Month: number;

  // Expense actuals
  mtdExpenses: number;
  currentExpenseRatio: number;
}

// Complete progress snapshot for all targets
export interface AllTargetsProgress {
  // Income progress
  annualIncome: TargetProgress;
  monthlyIncome: TargetProgress;
  quarterlyIncome: TargetProgress;

  // Policy progress
  annualPolicies: TargetProgress;
  monthlyPolicies: TargetProgress;
  avgPremium: TargetProgress;

  // Persistency progress
  persistency13Month: TargetProgress;
  persistency25Month: TargetProgress;

  // Expense progress
  monthlyExpense: TargetProgress;
  expenseRatio: TargetProgress;

  // Overall health score (0-100)
  healthScore: number;
}

// Form types for updating targets
export interface UpdateTargetsForm {
  // Income targets
  annualIncomeTarget?: number;
  monthlyIncomeTarget?: number;
  quarterlyIncomeTarget?: number;

  // Policy targets
  annualPoliciesTarget?: number;
  monthlyPoliciesTarget?: number;
  avgPremiumTarget?: number;

  // Persistency targets
  persistency13MonthTarget?: number;
  persistency25MonthTarget?: number;

  // Expense targets
  monthlyExpenseTarget?: number;
  expenseRatioTarget?: number;

  // Realism knobs
  persistencyAssumption?: number;
  taxReserveRate?: number;
  ntoBufferRate?: number;
  premiumStatPreference?: "mean" | "median";
}

// Milestone detection result
export interface MilestoneCheck {
  newAchievements: Achievement[];
  hasNewMilestones: boolean;
}

// Service layer types
export type CreateUserTargetsData = Omit<
  UserTargets,
  "id" | "createdAt" | "updatedAt" | "achievements" | "lastMilestoneDate"
>;
export type UpdateUserTargetsData = Partial<UpdateTargetsForm>;

// Time period for progress calculations
export type TimePeriod =
  | "MTD"
  | "QTD"
  | "YTD"
  | "last30"
  | "last60"
  | "last90"
  | "custom";

export interface TimePeriodRange {
  start: Date;
  end: Date;
  label: string;
}

// ============================================================================
// Team Target Types (for hierarchy/IMO visibility)
// ============================================================================

/**
 * View mode for targets - own, team (downline), or IMO-wide
 */
export type TargetViewMode = "own" | "team" | "imo";

/**
 * Target data with owner information for downline view
 */
export interface DownlineTarget {
  id: string;
  userId: string;
  ownerName: string;

  // Income targets
  annualIncomeTarget: number;
  monthlyIncomeTarget: number;
  quarterlyIncomeTarget: number;

  // Policy targets
  annualPoliciesTarget: number;
  monthlyPoliciesTarget: number;
  avgPremiumTarget: number;

  // Persistency targets
  persistency13MonthTarget: number;
  persistency25MonthTarget: number;

  // Expense targets
  monthlyExpenseTarget: number;
  expenseRatioTarget: number;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * Target data with owner and agency info for IMO-wide view
 */
export interface ImoTarget extends DownlineTarget {
  agencyName: string;
}
