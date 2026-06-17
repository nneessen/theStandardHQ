// src/services/commissions/chargebackService.ts
import { supabase, TABLES } from "../base/supabase";
import type { Database } from "../../types/database.types";
import {
  Chargeback,
  CreateChargebackData,
  ChargebackRow,
} from "../../types/commission.types";
import { formatDateForDB } from "../../lib/date";
import {
  workflowEventEmitter,
  WORKFLOW_EVENTS,
} from "../events/workflowEventEmitter";

export type { CreateChargebackData };

class ChargebackService {
  async getAll(): Promise<Chargeback[]> {
    const { data, error } = await supabase
      .from(TABLES.CHARGEBACKS)
      .select("*")
      .order("chargeback_date", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch chargebacks: ${error.message}`);
    }

    return data?.map(this.transformFromDB) || [];
  }

  async getById(id: string): Promise<Chargeback | null> {
    const { data, error } = await supabase
      .from(TABLES.CHARGEBACKS)
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to fetch chargeback: ${error.message}`);
    }

    return data ? this.transformFromDB(data) : null;
  }

  async getByCommissionId(commissionId: string): Promise<Chargeback[]> {
    const { data, error } = await supabase
      .from(TABLES.CHARGEBACKS)
      .select("*")
      .eq("commission_id", commissionId)
      .order("chargeback_date", { ascending: false });

    if (error) {
      throw new Error(
        `Failed to fetch chargebacks for commission: ${error.message}`,
      );
    }

    return data?.map(this.transformFromDB) || [];
  }

  async getByCommissionIds(commissionIds: string[]): Promise<Chargeback[]> {
    if (commissionIds.length === 0) return [];

    const { data, error } = await supabase
      .from(TABLES.CHARGEBACKS)
      .select("*")
      .in("commission_id", commissionIds)
      .order("chargeback_date", { ascending: false });

    if (error) {
      throw new Error(
        `Failed to fetch chargebacks for commissions: ${error.message}`,
      );
    }

    return data?.map(this.transformFromDB) || [];
  }

  async getByStatus(status: Chargeback["status"]): Promise<Chargeback[]> {
    const { data, error } = await supabase
      .from(TABLES.CHARGEBACKS)
      .select("*")
      .eq("status", status)
      .order("chargeback_date", { ascending: false });

    if (error) {
      throw new Error(
        `Failed to fetch chargebacks by status: ${error.message}`,
      );
    }

    return data?.map(this.transformFromDB) || [];
  }

  async create(chargebackData: CreateChargebackData): Promise<Chargeback> {
    const dbData = this.transformToDB(chargebackData);

    const { data, error } = await supabase
      .from(TABLES.CHARGEBACKS)
      .insert([dbData])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create chargeback: ${error.message}`);
    }

    const chargeback = this.transformFromDB(data);

    await workflowEventEmitter.emit(WORKFLOW_EVENTS.COMMISSION_CHARGEBACK, {
      commissionId: chargeback.commissionId ?? undefined,
      chargebackAmount: chargeback.chargebackAmount,
      reason: chargeback.reason,
      occurredAt: chargeback.chargebackDate.toISOString(),
      timestamp: new Date().toISOString(),
    });

    return chargeback;
  }

  async updateStatus(
    id: string,
    status: Chargeback["status"],
  ): Promise<Chargeback> {
    const { data, error } = await supabase
      .from(TABLES.CHARGEBACKS)
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update chargeback status: ${error.message}`);
    }

    return this.transformFromDB(data);
  }

  async resolve(id: string, resolutionNotes?: string): Promise<Chargeback> {
    const { data, error } = await supabase
      .from(TABLES.CHARGEBACKS)
      .update({
        status: "resolved" as Database["public"]["Enums"]["chargeback_status"],
        resolution_date: formatDateForDB(new Date()),
        resolution_notes: resolutionNotes || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to resolve chargeback: ${error.message}`);
    }

    // Resolve the owning agent (workflow recipient) via the linked commission,
    // then emit chargeback.resolved (non-fatal — the emitter never throws).
    let recipientId: string | undefined;
    if (data.commission_id) {
      const { data: comm } = await supabase
        .from("commissions")
        .select("user_id")
        .eq("id", data.commission_id)
        .maybeSingle();
      recipientId = comm?.user_id ?? undefined;
    }
    await workflowEventEmitter.emit(WORKFLOW_EVENTS.CHARGEBACK_RESOLVED, {
      recipientId,
      chargebackId: id,
      commissionId: data.commission_id ?? undefined,
      chargebackAmount: data.chargeback_amount,
      resolutionNotes: resolutionNotes || undefined,
      resolvedAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
    });

    return this.transformFromDB(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from(TABLES.CHARGEBACKS)
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to delete chargeback: ${error.message}`);
    }
  }

  async getTotalChargebackAmount(
    startDate?: Date,
    endDate?: Date,
  ): Promise<number> {
    let query = supabase.from(TABLES.CHARGEBACKS).select("chargeback_amount");

    if (startDate) {
      query = query.gte("chargeback_date", formatDateForDB(startDate));
    }

    if (endDate) {
      query = query.lte("chargeback_date", formatDateForDB(endDate));
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(
        `Failed to calculate total chargeback amount: ${error.message}`,
      );
    }

    return (
      data?.reduce(
        (total, chargeback) => total + Number(chargeback.chargeback_amount),
        0,
      ) || 0
    );
  }

  async getChargebacksByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<Chargeback[]> {
    const { data, error } = await supabase
      .from(TABLES.CHARGEBACKS)
      .select("*")
      .gte("chargeback_date", formatDateForDB(startDate))
      .lte("chargeback_date", formatDateForDB(endDate))
      .order("chargeback_date", { ascending: false });

    if (error) {
      throw new Error(
        `Failed to fetch chargebacks by date range: ${error.message}`,
      );
    }

    return data?.map(this.transformFromDB) || [];
  }

  async getChargebackMetrics(): Promise<{
    totalAmount: number;
    count: number;
    pendingAmount: number;
    processedAmount: number;
  }> {
    const { data, error } = await supabase
      .from(TABLES.CHARGEBACKS)
      .select("chargeback_amount, status");

    if (error) {
      throw new Error(`Failed to fetch chargeback metrics: ${error.message}`);
    }

    const metrics = {
      totalAmount: 0,
      count: data?.length || 0,
      pendingAmount: 0,
      processedAmount: 0,
    };

    data?.forEach((chargeback) => {
      const amount = Number(chargeback.chargeback_amount);
      metrics.totalAmount += amount;

      // chargeback_status enum is pending | resolved | disputed. Outstanding
      // (pending + disputed) counts toward pendingAmount; resolved is the only
      // processed state. ("processed" was a dead literal — not a valid status.)
      if (chargeback.status === "pending" || chargeback.status === "disputed") {
        metrics.pendingAmount += amount;
      } else if (chargeback.status === "resolved") {
        metrics.processedAmount += amount;
      }
    });

    return metrics;
  }

  private transformFromDB(dbRecord: ChargebackRow): Chargeback {
    return {
      id: dbRecord.id,
      commissionId: dbRecord.commission_id,
      chargebackAmount: Number(dbRecord.chargeback_amount),
      chargebackDate: new Date(dbRecord.chargeback_date),
      reason: dbRecord.reason ?? undefined,
      status: (dbRecord.status ?? "pending") as Chargeback["status"],
      resolutionDate: dbRecord.resolution_date
        ? new Date(dbRecord.resolution_date)
        : undefined,
      resolutionNotes: dbRecord.resolution_notes ?? undefined,
      createdAt: new Date(dbRecord.created_at ?? Date.now()),
      updatedAt: dbRecord.updated_at
        ? new Date(dbRecord.updated_at)
        : undefined,
    };
  }

  private transformToDB(
    data: CreateChargebackData,
  ): Database["public"]["Tables"]["chargebacks"]["Insert"] {
    return {
      commission_id: data.commissionId,
      chargeback_amount: data.chargebackAmount,
      chargeback_date: formatDateForDB(data.chargebackDate),
      reason: data.reason || null,
      status: (data.status ||
        "pending") as Database["public"]["Enums"]["chargeback_status"],
      resolution_date: data.resolutionDate
        ? formatDateForDB(data.resolutionDate)
        : null,
      resolution_notes: data.resolutionNotes || null,
    };
  }
}

export const chargebackService = new ChargebackService();
