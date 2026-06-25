// src/services/commissions/CommissionCRUDService.ts
// Handles basic CRUD operations for commissions

import { Commission } from "../../types/commission.types";
import { CommissionRepository } from "./CommissionRepository";
import { logger } from "../base/logger";
import {
  NotFoundError,
  DatabaseError,
  ValidationError,
  getErrorMessage,
} from "../../errors/ServiceErrors";
import { withRetry } from "../../utils/retry";
import {
  workflowEventEmitter,
  WORKFLOW_EVENTS,
} from "../events/workflowEventEmitter";
import type { SupabaseClient } from "@supabase/supabase-js";
import { commissionStatusService } from "./CommissionStatusService";

export interface CreateCommissionData {
  policyId?: string;
  userId?: string;
  type: string;
  status: string;

  // ADVANCE (upfront payment)
  amount?: number;
  advanceMonths?: number;

  // CAPPED ADVANCE
  originalAdvance?: number | null;
  overageAmount?: number | null;
  overageStartMonth?: number | null;

  // EARNING TRACKING
  monthsPaid?: number;
  earnedAmount?: number;
  unearnedAmount?: number;
  lastPaymentDate?: Date;

  // Dates
  paymentDate?: Date | string;
  notes?: string;
  monthNumber?: number | null;
  relatedAdvanceId?: string | null;
  imoId?: string | null;
}

export interface UpdateCommissionData extends Partial<CreateCommissionData> {
  id: string;
}

export interface CommissionFilters {
  status?: string;
  type?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  policyId?: string;
}

class CommissionCRUDService {
  private repository: CommissionRepository;

  constructor() {
    this.repository = new CommissionRepository();
  }

  private handleError(
    error: unknown,
    context: string,
    entityId?: string,
  ): never {
    const message = getErrorMessage(error);
    logger.error(
      `CommissionCRUDService.${context}`,
      error instanceof Error ? error : new Error(String(error)),
    );

    if (
      error instanceof NotFoundError ||
      error instanceof DatabaseError ||
      error instanceof ValidationError
    ) {
      throw error;
    }

    throw new DatabaseError(
      context,
      error instanceof Error ? error : new Error(message),
      { entityId },
    );
  }

  async getAll(): Promise<Commission[]> {
    try {
      return await withRetry(
        async () => {
          return await this.repository.findAll();
        },
        { maxAttempts: 2 },
      );
    } catch (error) {
      throw this.handleError(error, "getAll");
    }
  }

  async getById(id: string): Promise<Commission | null> {
    if (!id) {
      throw new ValidationError("Invalid commission ID", [
        { field: "id", message: "ID is required", value: id },
      ]);
    }

    try {
      return await withRetry(
        async () => {
          const commission = await this.repository.findById(id);
          if (!commission) {
            throw new NotFoundError("Commission", id);
          }
          return commission;
        },
        { maxAttempts: 2 },
      );
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw this.handleError(error, "getById", id);
    }
  }

  async getByPolicyId(policyId: string): Promise<Commission[]> {
    try {
      return await this.repository.findByPolicy(policyId);
    } catch (error) {
      throw this.handleError(error, "getByPolicyId");
    }
  }

  async getByPolicyIds(policyIds: string[]): Promise<Commission[]> {
    try {
      return await this.repository.findByPolicyIds(policyIds);
    } catch (error) {
      throw this.handleError(error, "getByPolicyIds");
    }
  }

  async getCommissionsByUser(
    userId: string,
    since?: Date,
  ): Promise<Commission[]> {
    try {
      return await this.repository.findByAgent(userId, since);
    } catch (error) {
      throw this.handleError(error, "getCommissionsByUser");
    }
  }

  async create(data: CreateCommissionData): Promise<Commission> {
    const errors: Array<{ field: string; message: string; value?: unknown }> =
      [];

    if (!data.type) {
      errors.push({ field: "type", message: "Commission type is required" });
    }
    if (!data.amount || data.amount <= 0) {
      errors.push({
        field: "amount",
        message: "Amount must be greater than 0",
        value: data.amount,
      });
    }

    if (errors.length > 0) {
      throw new ValidationError("Invalid commission data", errors);
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Repository handles both formats
      const commission = await this.repository.create(data as any);

      if (commission.status === "paid") {
        await workflowEventEmitter.emit(WORKFLOW_EVENTS.COMMISSION_EARNED, {
          commissionId: commission.id,
          policyId: commission.policyId,
          agentId: commission.userId,
          amount: commission.amount,
          commissionType: commission.type,
          status: commission.status,
          earnedAt: new Date().toISOString(),
        });
      }

      return commission;
    } catch (error) {
      throw this.handleError(error, "create");
    }
  }

  async update(
    id: string,
    data: Partial<CreateCommissionData>,
  ): Promise<Commission> {
    if (!id) {
      throw new ValidationError("Invalid commission ID", [
        { field: "id", message: "ID is required" },
      ]);
    }

    try {
      await this.getById(id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Repository handles both formats
      const updated = await this.repository.update(id, data as any);
      return updated;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw this.handleError(error, "update", id);
    }
  }

  async delete(id: string): Promise<void> {
    if (!id) {
      throw new ValidationError("Invalid commission ID", [
        { field: "id", message: "ID is required" },
      ]);
    }

    try {
      await this.getById(id);
      await this.repository.delete(id);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw this.handleError(error, "delete", id);
    }
  }

  async markAsPaid(id: string, paymentDate?: Date): Promise<Commission> {
    if (!id) {
      throw new ValidationError("Invalid commission ID", [
        { field: "id", message: "ID is required" },
      ]);
    }

    try {
      const commission = await this.getById(id);
      if (!commission) {
        throw new NotFoundError("Commission", id);
      }

      if (commission.status !== "pending") {
        throw new ValidationError(
          `Cannot mark commission as paid. Current status is ${commission.status}, must be pending.`,
          [
            {
              field: "status",
              message: `Current status is ${commission.status}, must be pending`,
              value: commission.status,
            },
          ],
        );
      }

      if (commission.policyId) {
        const { data: policy, error: policyError } = await (
          this.repository as unknown as { client: SupabaseClient }
        ).client
          .from("policies")
          .select("lifecycle_status")
          .eq("id", commission.policyId)
          .single();

        if (policyError) {
          throw new DatabaseError("markAsPaid", policyError);
        }

        if (policy.lifecycle_status !== "active") {
          throw new ValidationError(
            `Cannot mark commission as paid. Policy lifecycle is ${policy.lifecycle_status}, must be active.`,
            [
              {
                field: "policy.lifecycle_status",
                message: `Policy lifecycle is ${policy.lifecycle_status}, must be active`,
                value: policy.lifecycle_status,
              },
            ],
          );
        }
      }

      await commissionStatusService.updateCommissionStatus({
        commissionId: id,
        status: "paid",
        paymentDate,
      });

      // Use repository's transform (via findById) for consistent conversion
      const updatedCommission = await this.getById(id);
      if (!updatedCommission) {
        throw new NotFoundError("Commission", id);
      }

      await workflowEventEmitter.emit(WORKFLOW_EVENTS.COMMISSION_PAID, {
        commissionId: updatedCommission.id,
        policyId: updatedCommission.policyId,
        agentId: updatedCommission.userId,
        amount: updatedCommission.amount,
        paidDate: updatedCommission.paymentDate
          ? new Date(updatedCommission.paymentDate).toISOString()
          : undefined,
        timestamp: new Date().toISOString(),
      });

      return updatedCommission;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw this.handleError(error, "markAsPaid", id);
    }
  }

  async getFiltered(filters: CommissionFilters): Promise<Commission[]> {
    try {
      let commissions = await this.repository.findAll();

      if (filters.status) {
        commissions = commissions.filter((c) => c.status === filters.status);
      }

      if (filters.type) {
        commissions = commissions.filter((c) => c.type === filters.type);
      }

      if (filters.userId) {
        commissions = commissions.filter((c) => c.userId === filters.userId);
      }

      if (filters.policyId) {
        commissions = commissions.filter(
          (c) => c.policyId === filters.policyId,
        );
      }

      if (filters.startDate) {
        commissions = commissions.filter(
          (c) => c.createdAt >= filters.startDate!,
        );
      }

      if (filters.endDate) {
        commissions = commissions.filter(
          (c) => c.createdAt <= filters.endDate!,
        );
      }

      if (filters.minAmount !== undefined) {
        commissions = commissions.filter((c) => c.amount >= filters.minAmount!);
      }

      if (filters.maxAmount !== undefined) {
        commissions = commissions.filter((c) => c.amount <= filters.maxAmount!);
      }

      return commissions;
    } catch (error) {
      throw this.handleError(error, "getFiltered");
    }
  }
}

export const commissionCRUDService = new CommissionCRUDService();
