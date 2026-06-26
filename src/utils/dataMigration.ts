import {
  policyService,
  commissionService,
  expenseService,
  carrierService,
  constantsService,
} from "../services";
import { Policy } from "../types/policy.types";

import { CreateExpenseData } from "../types/expense.types";
import { Carrier } from "../types/carrier.types";
import { logger } from "../services/base/logger";
import { getTodayString } from "@/lib/date";

// Legacy types for migration
interface LegacyExpenseItem {
  name: string;
  amount: number;
  category: string;
}

interface LegacyExpenseData {
  personal: LegacyExpenseItem[];
  business: LegacyExpenseItem[];
}

interface Constants {
  avgAP: number;
  commissionRate: number;
  target1: number;
  target2: number;
}

export interface MigrationResult {
  success: boolean;
  message: string;
  details: {
    policies: number;
    commissions: number;
    expenses: number;
    carriers: number;
    constants: number;
  };
  errors: string[];
}

interface LocalStorageData {
  policies?: Policy[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy data with fields that no longer exist on Commission
  commissions?: Record<string, any>[];
  expenses?: LegacyExpenseData;
  carriers?: Carrier[];
  constants?: Constants;
}

class DataMigrationService {
  async migrateFromLocalStorage(userId: string): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      message: "",
      details: {
        policies: 0,
        commissions: 0,
        expenses: 0,
        carriers: 0,
        constants: 0,
      },
      errors: [],
    };

    try {
      // Get all localStorage data
      const localData = this.getLocalStorageData();

      // Migrate each entity type
      await this.migratePolicies(localData.policies || [], result, userId);
      await this.migrateCommissions(localData.commissions || [], result);
      await this.migrateExpenses(localData.expenses, result, userId);
      await this.migrateCarriers(localData.carriers || [], result);
      await this.migrateConstants(localData.constants, result);

      const totalMigrated = Object.values(result.details).reduce(
        (sum, count) => sum + count,
        0,
      );

      if (totalMigrated > 0) {
        result.success = true;
        result.message = `Successfully migrated ${totalMigrated} items to database`;
      } else {
        result.message = "No data found in localStorage to migrate";
      }
    } catch (error) {
      result.errors.push(
        `Migration failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      result.message = "Migration failed due to errors";
    }

    return result;
  }

  async checkDatabaseEmpty(): Promise<boolean> {
    try {
      const [policies, commissions, expensesResult, carriersResponse] =
        await Promise.all([
          policyService.getAll(),
          commissionService.getAll(),
          expenseService.getAllFiltered(),
          carrierService.getAll(),
        ]);

      const carriers = carriersResponse.data || [];
      const expenses = expensesResult.success ? expensesResult.data || [] : [];

      return (
        policies.length === 0 &&
        commissions.length === 0 &&
        expenses.length === 0 &&
        carriers.length === 0
      );
    } catch (error) {
      logger.error(
        "Error checking database state",
        error instanceof Error ? error : String(error),
        "DataMigration",
      );
      return false;
    }
  }

  clearLocalStorageData(): void {
    const keys = [
      "policies",
      "commissions",
      "expenses",
      "carriers",
      "constants",
    ];
    keys.forEach((key) => {
      try {
        window.localStorage.removeItem(key);
      } catch (error) {
        logger.warn(
          `Failed to clear localStorage key: ${key}`,
          error instanceof Error ? error : String(error),
          "DataMigration",
        );
      }
    });
  }

  private getLocalStorageData(): LocalStorageData {
    const data: LocalStorageData = {};

    try {
      const policies = window.localStorage.getItem("policies");
      if (policies) {
        data.policies = JSON.parse(policies);
      }
    } catch (error) {
      logger.warn(
        "Failed to parse policies from localStorage",
        error instanceof Error ? error : String(error),
        "DataMigration",
      );
    }

    try {
      const commissions = window.localStorage.getItem("commissions");
      if (commissions) {
        data.commissions = JSON.parse(commissions);
      }
    } catch (error) {
      logger.warn(
        "Failed to parse commissions from localStorage",
        error instanceof Error ? error : String(error),
        "DataMigration",
      );
    }

    try {
      const expenses = window.localStorage.getItem("expenses");
      if (expenses) {
        data.expenses = JSON.parse(expenses);
      }
    } catch (error) {
      logger.warn(
        "Failed to parse expenses from localStorage",
        error instanceof Error ? error : String(error),
        "DataMigration",
      );
    }

    try {
      const carriers = window.localStorage.getItem("carriers");
      if (carriers) {
        data.carriers = JSON.parse(carriers);
      }
    } catch (error) {
      logger.warn(
        "Failed to parse carriers from localStorage",
        error instanceof Error ? error : String(error),
        "DataMigration",
      );
    }

    try {
      const constants = window.localStorage.getItem("constants");
      if (constants) {
        data.constants = JSON.parse(constants);
      }
    } catch (error) {
      logger.warn(
        "Failed to parse constants from localStorage",
        error instanceof Error ? error : String(error),
        "DataMigration",
      );
    }

    return data;
  }

  private async migratePolicies(
    policies: Policy[],
    result: MigrationResult,
    userId: string,
  ): Promise<void> {
    for (const policy of policies) {
      try {
        // First create or find the client - using empty string as placeholder for clientId
        // In a real migration, you'd need to create the client first and get its ID
        await policyService.create({
          policyNumber: policy.policyNumber,
          clientId: "", // TODO: Need to create client first and use its ID
          userId: userId,
          carrierId: policy.carrierId,
          product: policy.product,
          submitDate: policy.submitDate
            ? new Date(policy.submitDate)
            : new Date(policy.effectiveDate),
          effectiveDate: new Date(policy.effectiveDate),
          termLength: policy.termLength,
          expirationDate: policy.expirationDate
            ? new Date(policy.expirationDate)
            : undefined,
          annualPremium: policy.annualPremium,
          monthlyPremium: policy.annualPremium / 12, // Required field
          paymentFrequency: policy.paymentFrequency,
          commissionPercentage: policy.commissionPercentage,
          notes: policy.notes,
        });
        result.details.policies++;
      } catch (error) {
        result.errors.push(
          `Failed to migrate policy ${policy.policyNumber}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }
  }

  private async migrateCommissions(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy data has fields that no longer exist on Commission
    commissions: Record<string, any>[],
    result: MigrationResult,
  ): Promise<void> {
    for (const commission of commissions) {
      try {
        await commissionService.create({
          policyId: commission.policyId,
          type: commission.type,
          status: commission.status,
          amount: commission.advanceAmount ?? commission.amount ?? 0,
          advanceMonths: commission.advanceMonths ?? 0,
          earnedAmount: commission.earnedAmount ?? 0,
          unearnedAmount: commission.unearnedAmount ?? 0,
          monthsPaid: commission.monthsPaid ?? 0,
          userId: commission.userId,
          notes: commission.notes,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy data migration type assertion
        } as any);
        result.details.commissions++;
      } catch (error) {
        result.errors.push(
          `Failed to migrate commission ${commission.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }
  }

  private async migrateExpenses(
    expenseData: LegacyExpenseData | undefined,
    result: MigrationResult,
    userId: string,
  ): Promise<void> {
    if (!expenseData) return;

    const allExpenses: Array<
      LegacyExpenseItem & { expense_type: "personal" | "business" }
    > = [
      ...expenseData.personal.map((e) => ({
        ...e,
        expense_type: "personal" as const,
      })),
      ...expenseData.business.map((e) => ({
        ...e,
        expense_type: "business" as const,
      })),
    ];

    for (const expense of allExpenses) {
      try {
        const createData: CreateExpenseData = {
          name: expense.name,
          description: expense.name, // Use name as description for legacy data
          amount: expense.amount,
          category: expense.category,
          expense_type: expense.expense_type,
          date: getTodayString(), // Use current date for legacy data
        };
        await expenseService.create(createData, userId);
        result.details.expenses++;
      } catch (error) {
        result.errors.push(
          `Failed to migrate expense ${expense.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }
  }

  private async migrateCarriers(
    carriers: Carrier[],
    result: MigrationResult,
  ): Promise<void> {
    for (const carrier of carriers) {
      try {
        await carrierService.createFromForm({
          name: carrier.name,
          is_active: carrier.is_active ?? true,
        });
        result.details.carriers++;
      } catch (error) {
        result.errors.push(
          `Failed to migrate carrier ${carrier.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }
  }

  private async migrateConstants(
    constants: Constants | undefined,
    result: MigrationResult,
  ): Promise<void> {
    if (!constants) return;

    try {
      await constantsService.updateMultiple(
        Object.entries(constants).map(([key, value]) => ({ key, value })),
      );
      result.details.constants = Object.keys(constants).length;
    } catch (error) {
      result.errors.push(
        `Failed to migrate constants: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

export const dataMigrationService = new DataMigrationService();
