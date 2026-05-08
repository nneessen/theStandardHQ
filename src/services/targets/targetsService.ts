// src/services/targets/targetsService.ts

import { userTargetsRepository } from "./UserTargetsRepository";
import type {
  UserTargets,
  UpdateUserTargetsData,
  TargetProgress,
  AllTargetsProgress,
  ActualMetrics,
  ProgressStatus,
  PaceMetrics,
  Achievement,
  MilestoneCheck,
} from "../../types/targets.types";

/**
 * Targets Service
 *
 * Manages user targets for income, policies, persistency, and expenses.
 * Calculates progress, pace metrics, and milestone achievements.
 *
 * Delegates all database operations to UserTargetsRepository.
 */
class TargetsService {
  /**
   * Get user targets by user ID
   * Creates default targets if none exist
   */
  async getUserTargets(userId: string): Promise<UserTargets> {
    const entity = await userTargetsRepository.findByUserId(userId);

    // If no targets exist, create default ones
    if (!entity) {
      const created = await userTargetsRepository.createDefaults(userId);
      return this.mapEntityToUserTargets(created);
    }

    return this.mapEntityToUserTargets(entity);
  }

  /**
   * Update user targets
   */
  async updateUserTargets(
    userId: string,
    updates: UpdateUserTargetsData,
  ): Promise<UserTargets> {
    const entity = await userTargetsRepository.updateByUserId(userId, updates);
    return this.mapEntityToUserTargets(entity);
  }

  /**
   * Calculate progress for a single target
   */
  calculateTargetProgress(
    target: number,
    actual: number,
    daysRemaining: number,
    daysTotal: number,
  ): TargetProgress {
    const percentage = target > 0 ? (actual / target) * 100 : 0;
    const remaining = Math.max(0, target - actual);

    // Calculate pace (how much needed per time period to hit target)
    const pace: PaceMetrics = {
      daily: daysRemaining > 0 ? remaining / daysRemaining : 0,
      weekly: daysRemaining > 0 ? (remaining / daysRemaining) * 7 : 0,
      monthly: daysRemaining > 0 ? (remaining / daysRemaining) * 30 : 0,
    };

    // Calculate projected end (at current pace)
    const daysElapsed = daysTotal - daysRemaining;
    const dailyRate = daysElapsed > 0 ? actual / daysElapsed : 0;
    const projectedEnd = dailyRate * daysTotal;

    // Determine status
    const expectedProgress = ((daysTotal - daysRemaining) / daysTotal) * 100;
    let status: ProgressStatus;

    if (percentage >= expectedProgress + 10) {
      status = "ahead";
    } else if (percentage >= expectedProgress - 10) {
      status = "on-track";
    } else if (percentage >= expectedProgress - 25) {
      status = "behind";
    } else {
      status = "critical";
    }

    return {
      target,
      actual,
      percentage,
      remaining,
      pace,
      status,
      projectedEnd,
    };
  }

  /**
   * Calculate all targets progress
   */
  calculateAllProgress(
    targets: UserTargets,
    actuals: ActualMetrics,
  ): AllTargetsProgress {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const _yearEnd = new Date(now.getFullYear(), 11, 31);
    const _monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const quarterStart = new Date(
      now.getFullYear(),
      Math.floor(now.getMonth() / 3) * 3,
      1,
    );
    const quarterEnd = new Date(
      now.getFullYear(),
      Math.floor(now.getMonth() / 3) * 3 + 3,
      0,
    );

    const daysInYear = 365;
    const daysElapsedInYear = Math.floor(
      (now.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24),
    );
    const daysRemainingInYear = daysInYear - daysElapsedInYear;

    const daysInMonth = monthEnd.getDate();
    const daysElapsedInMonth = now.getDate();
    const daysRemainingInMonth = daysInMonth - daysElapsedInMonth;

    const daysInQuarter = Math.floor(
      (quarterEnd.getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24),
    );
    const daysElapsedInQuarter = Math.floor(
      (now.getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24),
    );
    const daysRemainingInQuarter = daysInQuarter - daysElapsedInQuarter;

    // Calculate income progress
    const annualIncome = this.calculateTargetProgress(
      targets.annualIncomeTarget,
      actuals.ytdIncome,
      daysRemainingInYear,
      daysInYear,
    );

    const monthlyIncome = this.calculateTargetProgress(
      targets.monthlyIncomeTarget,
      actuals.mtdIncome,
      daysRemainingInMonth,
      daysInMonth,
    );

    const quarterlyIncome = this.calculateTargetProgress(
      targets.quarterlyIncomeTarget,
      actuals.qtdIncome,
      daysRemainingInQuarter,
      daysInQuarter,
    );

    // Calculate policy progress
    const annualPolicies = this.calculateTargetProgress(
      targets.annualPoliciesTarget,
      actuals.ytdPolicies,
      daysRemainingInYear,
      daysInYear,
    );

    const monthlyPolicies = this.calculateTargetProgress(
      targets.monthlyPoliciesTarget,
      actuals.mtdPolicies,
      daysRemainingInMonth,
      daysInMonth,
    );

    // REMOVED: avgPremium target progress - always calculated from actual policies
    // No longer needed as a stored target since it's dynamically calculated
    const avgPremium = this.calculateTargetProgress(
      actuals.currentAvgPremium, // Use current as both target and actual
      actuals.currentAvgPremium,
      0, // Not time-based
      1,
    );

    // Calculate persistency progress (higher is better, so we treat it differently)
    const persistency13Month = this.calculateTargetProgress(
      targets.persistency13MonthTarget,
      actuals.persistency13Month,
      0, // Not time-based
      1,
    );

    const persistency25Month = this.calculateTargetProgress(
      targets.persistency25MonthTarget,
      actuals.persistency25Month,
      0, // Not time-based
      1,
    );

    // Calculate expense progress (lower is better, so invert the logic)
    const monthlyExpense = this.calculateTargetProgress(
      targets.monthlyExpenseTarget,
      actuals.mtdExpenses,
      daysRemainingInMonth,
      daysInMonth,
    );

    const expenseRatio = this.calculateTargetProgress(
      targets.expenseRatioTarget,
      actuals.currentExpenseRatio,
      0, // Not time-based
      1,
    );

    // Calculate overall health score (0-100)
    const healthScore = this.calculateHealthScore({
      annualIncome,
      monthlyIncome,
      quarterlyIncome,
      annualPolicies,
      monthlyPolicies,
      avgPremium,
      persistency13Month,
      persistency25Month,
      monthlyExpense,
      expenseRatio,
      healthScore: 0, // Placeholder, will be calculated below
    });

    return {
      annualIncome,
      monthlyIncome,
      quarterlyIncome,
      annualPolicies,
      monthlyPolicies,
      avgPremium,
      persistency13Month,
      persistency25Month,
      monthlyExpense,
      expenseRatio,
      healthScore,
    };
  }

  /**
   * Calculate overall health score (0-100) based on all progress metrics
   */
  private calculateHealthScore(progress: AllTargetsProgress): number {
    const scores: number[] = [];

    // Add scores for each target (weight them appropriately)
    scores.push(Math.min(100, progress.annualIncome.percentage) * 0.25); // 25% weight
    scores.push(Math.min(100, progress.monthlyIncome.percentage) * 0.15); // 15% weight
    scores.push(Math.min(100, progress.annualPolicies.percentage) * 0.2); // 20% weight
    scores.push(Math.min(100, progress.monthlyPolicies.percentage) * 0.1); // 10% weight
    scores.push(Math.min(100, progress.avgPremium.percentage) * 0.1); // 10% weight
    scores.push(Math.min(100, progress.persistency13Month.percentage) * 0.1); // 10% weight
    scores.push(Math.min(100, progress.persistency25Month.percentage) * 0.1); // 10% weight

    // Sum all weighted scores
    const totalScore = scores.reduce((sum, score) => sum + score, 0);

    return Math.round(totalScore);
  }

  /**
   * Check for milestone achievements
   */
  async checkMilestones(
    userId: string,
    progress: AllTargetsProgress,
  ): Promise<MilestoneCheck> {
    const targets = await this.getUserTargets(userId);
    const existingAchievements = targets.achievements;
    const newAchievements: Achievement[] = [];

    // Check income milestones
    if (
      progress.annualIncome.percentage >= 100 &&
      !this.hasAchievement(existingAchievements, "income", "gold")
    ) {
      newAchievements.push({
        id: crypto.randomUUID(),
        type: "income",
        level: "gold",
        name: "Annual Income Goal Achieved",
        description: "Reached your annual income target!",
        earnedDate: new Date(),
        value: progress.annualIncome.actual,
      });
    } else if (
      progress.annualIncome.percentage >= 75 &&
      !this.hasAchievement(existingAchievements, "income", "silver")
    ) {
      newAchievements.push({
        id: crypto.randomUUID(),
        type: "income",
        level: "silver",
        name: "75% Income Progress",
        description: "Reached 75% of your annual income target!",
        earnedDate: new Date(),
        value: progress.annualIncome.actual,
      });
    } else if (
      progress.annualIncome.percentage >= 50 &&
      !this.hasAchievement(existingAchievements, "income", "bronze")
    ) {
      newAchievements.push({
        id: crypto.randomUUID(),
        type: "income",
        level: "bronze",
        name: "Halfway There!",
        description: "Reached 50% of your annual income target!",
        earnedDate: new Date(),
        value: progress.annualIncome.actual,
      });
    }

    // Check policy milestones
    if (
      progress.annualPolicies.percentage >= 100 &&
      !this.hasAchievement(existingAchievements, "policies", "gold")
    ) {
      newAchievements.push({
        id: crypto.randomUUID(),
        type: "policies",
        level: "gold",
        name: "Policy Goal Achieved",
        description: "Reached your annual policy target!",
        earnedDate: new Date(),
        value: progress.annualPolicies.actual,
      });
    }

    // Check persistency milestones
    if (
      progress.persistency13Month.percentage >= 100 &&
      !this.hasAchievement(existingAchievements, "persistency", "gold")
    ) {
      newAchievements.push({
        id: crypto.randomUUID(),
        type: "persistency",
        level: "gold",
        name: "Persistency Champion",
        description: "Exceeded your 13-month persistency target!",
        earnedDate: new Date(),
        value: progress.persistency13Month.actual,
      });
    }

    // If there are new achievements, update the database
    if (newAchievements.length > 0) {
      const allAchievements = [...existingAchievements, ...newAchievements];
      await userTargetsRepository.updateByUserId(userId, {
        achievements: allAchievements,
        lastMilestoneDate: new Date().toISOString(),
      });
    }

    return {
      newAchievements,
      hasNewMilestones: newAchievements.length > 0,
    };
  }

  /**
   * Check if user already has a specific achievement
   */
  private hasAchievement(
    achievements: Achievement[],
    type: string,
    level: string,
  ): boolean {
    return achievements.some((a) => a.type === type && a.level === level);
  }

  /**
   * Get all achievements for a user
   */
  async getAchievements(userId: string): Promise<Achievement[]> {
    const targets = await this.getUserTargets(userId);
    return targets.achievements;
  }

  /**
   * Map repository entity to UserTargets interface
   */
  private mapEntityToUserTargets(entity: {
    id: string;
    userId: string;
    annualIncomeTarget: number;
    monthlyIncomeTarget: number;
    quarterlyIncomeTarget: number;
    annualPoliciesTarget: number;
    monthlyPoliciesTarget: number;
    avgPremiumTarget: number;
    persistency13MonthTarget: number;
    persistency25MonthTarget: number;
    monthlyExpenseTarget: number;
    expenseRatioTarget: number;
    persistencyAssumption: number;
    taxReserveRate: number;
    ntoBufferRate: number;
    premiumStatPreference: "mean" | "median";
    achievements: Achievement[];
    lastMilestoneDate: string | null;
    createdAt: string;
    updatedAt: string;
  }): UserTargets {
    return {
      id: entity.id,
      userId: entity.userId,
      annualIncomeTarget: entity.annualIncomeTarget,
      monthlyIncomeTarget: entity.monthlyIncomeTarget,
      quarterlyIncomeTarget: entity.quarterlyIncomeTarget,
      annualPoliciesTarget: entity.annualPoliciesTarget,
      monthlyPoliciesTarget: entity.monthlyPoliciesTarget,
      avgPremiumTarget: entity.avgPremiumTarget,
      persistency13MonthTarget: entity.persistency13MonthTarget,
      persistency25MonthTarget: entity.persistency25MonthTarget,
      monthlyExpenseTarget: entity.monthlyExpenseTarget,
      expenseRatioTarget: entity.expenseRatioTarget,
      persistencyAssumption: entity.persistencyAssumption,
      taxReserveRate: entity.taxReserveRate,
      ntoBufferRate: entity.ntoBufferRate,
      premiumStatPreference: entity.premiumStatPreference,
      achievements: entity.achievements,
      lastMilestoneDate: entity.lastMilestoneDate
        ? new Date(entity.lastMilestoneDate)
        : null,
      createdAt: new Date(entity.createdAt),
      updatedAt: new Date(entity.updatedAt),
    };
  }
}

export const targetsService = new TargetsService();
