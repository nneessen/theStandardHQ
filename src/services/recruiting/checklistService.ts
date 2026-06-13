// src/services/recruiting/checklistService.ts

import { supabase } from "@/services";
import {
  RecruitPhaseProgressRepository,
  type PhaseProgressStatus,
} from "./repositories/RecruitPhaseProgressRepository";
import {
  RecruitChecklistProgressRepository,
  type ChecklistProgressStatus,
} from "./repositories/RecruitChecklistProgressRepository";
import { PipelinePhaseRepository } from "./repositories/PipelinePhaseRepository";
import { PhaseChecklistItemRepository } from "./repositories/PhaseChecklistItemRepository";
import { documentService } from "@/services/documents";
import { pipelineAutomationService } from "./pipelineAutomationService";
import { createAuthUserWithProfile } from "./authUserService";
import type {
  RecruitPhaseProgress,
  RecruitChecklistProgress,
  UpdateChecklistItemStatusInput,
} from "@/types/recruiting.types";

// Fire-and-forget helper for automation triggers (don't block main flow)
const triggerAutomationAsync = (fn: () => Promise<void>) => {
  fn().catch((error) => {
    console.error("[checklistService] Automation trigger failed:", error);
  });
};

// Repository instances
const phaseProgressRepository = new RecruitPhaseProgressRepository();
const checklistProgressRepository = new RecruitChecklistProgressRepository();
const pipelinePhaseRepository = new PipelinePhaseRepository();
const checklistItemRepository = new PhaseChecklistItemRepository();

// Sync cache to prevent redundant sync checks (TTL: 30 seconds)
const SYNC_CACHE_TTL_MS = 30000;
const syncCache = new Map<string, number>();

const isSyncCacheValid = (cacheKey: string): boolean => {
  const lastSync = syncCache.get(cacheKey);
  if (!lastSync) return false;
  return Date.now() - lastSync < SYNC_CACHE_TTL_MS;
};

const markSyncComplete = (cacheKey: string): void => {
  syncCache.set(cacheKey, Date.now());
};

// Mutation lock: prevents syncPhaseProgressWithTemplate from running during
// phase mutations (revert/advance). Without this, background query refetches
// can trigger sync while mutations are in-flight, competing for connections.
let phaseMutationInProgress = false;

export const checklistService = {
  // ========================================
  // RECRUIT PHASE PROGRESS
  // ========================================

  async getRecruitPhaseProgress(userId: string) {
    // First, sync progress records with template to handle new phases
    await this.syncPhaseProgressWithTemplate(userId);

    const data = await phaseProgressRepository.findByUserIdWithPhase(userId);

    // Sort by phase_order in JavaScript (Supabase doesn't support ordering by related fields)
    const sorted = (data ?? []).sort((a, b) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- phase relation type
      const orderA = (a.phase as any)?.phase_order ?? 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- phase relation type
      const orderB = (b.phase as any)?.phase_order ?? 0;
      return orderA - orderB;
    });

    return sorted as RecruitPhaseProgress[];
  },

  /**
   * Sync phase progress records with template.
   * Creates missing progress records for phases added after enrollment.
   * Uses caching to prevent redundant sync checks.
   */
  async syncPhaseProgressWithTemplate(userId: string) {
    const cacheKey = `phase:${userId}`;

    // Skip if a phase mutation (revert/advance) is in progress to avoid
    // competing for DB connections during multi-step operations
    if (phaseMutationInProgress) {
      return;
    }

    // Skip if recently synced
    if (isSyncCacheValid(cacheKey)) {
      return;
    }

    try {
      // Get user's existing progress to find their template
      const existingProgress =
        await phaseProgressRepository.findByUserId(userId);
      if (!existingProgress || existingProgress.length === 0) {
        // User not enrolled in any pipeline
        markSyncComplete(cacheKey);
        return;
      }

      const templateId = existingProgress[0].templateId;
      const existingPhaseIds = new Set(existingProgress.map((p) => p.phaseId));

      // Get all phases from template
      const templatePhases =
        await pipelinePhaseRepository.findByTemplateId(templateId);
      if (!templatePhases || templatePhases.length === 0) {
        markSyncComplete(cacheKey);
        return;
      }

      // Find phases that exist in template but not in progress
      const missingPhases = templatePhases.filter(
        (phase) => !existingPhaseIds.has(phase.id),
      );

      if (missingPhases.length === 0) {
        markSyncComplete(cacheKey);
        return;
      }

      console.log(
        `[checklistService] Syncing ${missingPhases.length} new phases for user ${userId}`,
      );

      // Get user's imo_id and agency_id for RLS policies
      const { data: userProfile } = await supabase
        .from("user_profiles")
        .select("imo_id, agency_id")
        .eq("id", userId)
        .single();

      const imoId = userProfile?.imo_id ?? null;
      const agencyId = userProfile?.agency_id ?? null;

      // Create progress records for missing phases (include imo_id and agency_id for RLS)
      const newProgressRecords = missingPhases.map((phase) => ({
        userId,
        phaseId: phase.id,
        templateId,
        status: "not_started" as PhaseProgressStatus,
        startedAt: null,
        imoId,
        agencyId,
      }));

      await phaseProgressRepository.upsertMany(newProgressRecords);
      markSyncComplete(cacheKey);
    } catch (error) {
      console.error(
        `[checklistService] Phase sync failed for user ${userId}:`,
        error,
      );
      // Don't throw - allow main query to proceed with potentially stale data
    }
  },

  async getCurrentPhase(userId: string) {
    // Sync phase progress first to handle new phases
    await this.syncPhaseProgressWithTemplate(userId);

    const data =
      await phaseProgressRepository.findCurrentPhaseWithDetails(userId);
    return data as RecruitPhaseProgress | null;
  },

  async initializeRecruitProgress(userId: string, templateId: string) {
    // Use a single RPC call that runs as one transaction.
    // Previously this made 6+ separate DB calls which could exhaust the connection pool.
    phaseMutationInProgress = true;
    try {
      const { data, error } = await supabase.rpc(
        "initialize_recruit_progress",
        {
          p_user_id: userId,
          p_template_id: templateId,
        },
      );

      if (error) throw error;

      const result = data as {
        initialized: boolean;
        first_phase_id?: string;
        reason?: string;
      };

      if (!result.initialized) {
        // Already enrolled — return existing progress
        const existingProgress =
          await phaseProgressRepository.findByUserIdWithPhase(userId);
        return existingProgress as unknown as RecruitPhaseProgress[];
      }

      // Trigger phase_enter automation for first phase (fire-and-forget)
      if (result.first_phase_id) {
        triggerAutomationAsync(() =>
          pipelineAutomationService.triggerPhaseAutomations(
            result.first_phase_id!,
            "phase_enter",
            userId,
          ),
        );
      }

      // Return the newly created progress
      const newProgress =
        await phaseProgressRepository.findByUserIdWithPhase(userId);
      return newProgress as unknown as RecruitPhaseProgress[];
    } finally {
      phaseMutationInProgress = false;
    }
  },

  async updatePhaseStatus(
    userId: string,
    phaseId: string,
    status: "not_started" | "in_progress" | "completed" | "blocked" | "skipped",
    notes?: string,
    blockedReason?: string,
  ) {
    // Ensure phase progress record exists before updating
    // This handles cases where a phase was added after enrollment
    const existingProgress = await phaseProgressRepository.findByUserAndPhase(
      userId,
      phaseId,
    );

    if (!existingProgress) {
      console.log(
        `[checklistService] Creating missing phase progress record for phase ${phaseId} user ${userId}`,
      );
      // Get template ID from user's other phases
      const userProgress = await phaseProgressRepository.findByUserId(userId);
      if (!userProgress || userProgress.length === 0) {
        throw new Error("User has no pipeline enrollment to update phase for");
      }
      const templateId = userProgress[0].templateId;

      // Create the phase progress record first
      await phaseProgressRepository.createMany([
        {
          userId,
          phaseId,
          templateId,
          status: "not_started" as PhaseProgressStatus,
          startedAt: null,
        },
      ]);
    }

    const data = await phaseProgressRepository.updateStatus(
      userId,
      phaseId,
      status as PhaseProgressStatus,
      { notes, blockedReason },
    );

    return data as unknown as RecruitPhaseProgress;
  },

  async advanceToNextPhase(userId: string, currentPhaseId: string) {
    // Use a single RPC call that runs as one transaction.
    // Previously this made 7-9 separate DB calls which could exhaust the connection pool.
    phaseMutationInProgress = true;
    try {
      const { data, error } = await supabase.rpc("advance_recruit_phase", {
        p_user_id: userId,
        p_current_phase_id: currentPhaseId,
      });

      if (error) throw error;

      const result = data as {
        completed: boolean;
        next_phase_id: string | null;
        current_phase_id: string;
        next_phase_order?: number;
      };

      // Trigger phase_complete automation for current phase (fire-and-forget)
      triggerAutomationAsync(() =>
        pipelineAutomationService.triggerPhaseAutomations(
          currentPhaseId,
          "phase_complete",
          userId,
        ),
      );

      if (result.next_phase_id) {
        // Check if next phase requires login access (phase 2+)
        if (result.next_phase_order && result.next_phase_order >= 2) {
          this.ensureRecruitHasAuthUser(userId)
            .then((authResult) => {
              if (authResult.created && authResult.emailSent) {
                console.log(
                  `[checklistService] Login instructions sent to recruit ${userId}`,
                );
              } else if (authResult.created && !authResult.emailSent) {
                console.warn(
                  `[checklistService] Auth user created for ${userId} but email not sent`,
                );
              }
            })
            .catch((error) => {
              console.error(
                "[checklistService] Failed to ensure auth user (non-blocking):",
                error,
              );
            });
        }

        // Trigger phase_enter automation for next phase (fire-and-forget)
        triggerAutomationAsync(() =>
          pipelineAutomationService.triggerPhaseAutomations(
            result.next_phase_id!,
            "phase_enter",
            userId,
          ),
        );
      }

      if (result.completed) {
        return null;
      }

      return result as unknown as RecruitPhaseProgress;
    } finally {
      phaseMutationInProgress = false;
    }
  },

  async blockPhase(userId: string, phaseId: string, reason: string) {
    return this.updatePhaseStatus(
      userId,
      phaseId,
      "blocked",
      undefined,
      reason,
    );
  },

  async revertPhase(userId: string, phaseId: string) {
    // Use a single RPC call that runs as one transaction.
    // Previously this made 4N+8 separate DB calls (N = subsequent phases),
    // which exhausted the connection pool on 2026-02-27.
    phaseMutationInProgress = true;
    try {
      const { data, error } = await supabase.rpc("revert_recruit_phase", {
        p_user_id: userId,
        p_phase_id: phaseId,
      });

      if (error) {
        throw new Error(error.message);
      }

      // Trigger phase_enter automation for reverted phase (fire-and-forget)
      triggerAutomationAsync(() =>
        pipelineAutomationService.triggerPhaseAutomations(
          phaseId,
          "phase_enter",
          userId,
        ),
      );

      return data as unknown as RecruitPhaseProgress;
    } finally {
      phaseMutationInProgress = false;
    }
  },

  // ========================================
  // CHECKLIST ITEM PROGRESS
  // ========================================

  async initializeChecklistProgress(userId: string, phaseId: string) {
    // Get all checklist items for the phase
    const items = await checklistItemRepository.findByPhaseId(phaseId);

    if (!items || items.length === 0) return [];

    // Create progress records for all items
    const progressRecords = items.map((item) => ({
      userId,
      checklistItemId: item.id,
      status: "not_started" as ChecklistProgressStatus,
    }));

    const data = await checklistProgressRepository.upsertMany(progressRecords);
    return data as unknown as RecruitChecklistProgress[];
  },

  async getChecklistProgress(userId: string, phaseId: string) {
    // First, sync checklist progress with phase items to handle new items
    await this.syncChecklistProgressWithPhase(userId, phaseId);

    const data = await checklistProgressRepository.findByUserAndPhase(
      userId,
      phaseId,
    );
    return data as RecruitChecklistProgress[];
  },

  /**
   * Sync checklist progress records with phase items.
   * Creates missing progress records for items added after enrollment.
   * Uses caching and upsert for safe idempotent operation.
   */
  async syncChecklistProgressWithPhase(userId: string, phaseId: string) {
    const cacheKey = `checklist:${userId}:${phaseId}`;

    // Skip if recently synced
    if (isSyncCacheValid(cacheKey)) {
      return;
    }

    try {
      // Get all checklist items for the phase
      const items = await checklistItemRepository.findByPhaseId(phaseId);
      if (!items || items.length === 0) {
        markSyncComplete(cacheKey);
        return;
      }

      // Get existing progress records
      const existingProgress =
        await checklistProgressRepository.findByUserAndPhase(userId, phaseId);
      const existingItemIds = new Set(
        existingProgress?.map((p) => p.checklist_item_id) || [],
      );

      // Find items that exist in phase but not in progress
      const missingItems = items.filter(
        (item) => !existingItemIds.has(item.id),
      );

      if (missingItems.length === 0) {
        markSyncComplete(cacheKey);
        return;
      }

      console.log(
        `[checklistService] Syncing ${missingItems.length} new checklist items for user ${userId} in phase ${phaseId}`,
      );

      // Create progress records for missing items using upsert
      const progressRecords = missingItems.map((item) => ({
        userId,
        checklistItemId: item.id,
        status: "not_started" as ChecklistProgressStatus,
      }));

      await checklistProgressRepository.upsertMany(progressRecords);
      markSyncComplete(cacheKey);
    } catch (error) {
      console.error(
        `[checklistService] Checklist sync failed for user ${userId} phase ${phaseId}:`,
        error,
      );
      // Don't throw - allow main query to proceed with potentially stale data
    }
  },

  async updateChecklistItemStatus(
    userId: string,
    itemId: string,
    statusData: UpdateChecklistItemStatusInput,
  ) {
    // Ensure progress record exists using upsert (race-condition safe)
    // This handles cases where an item was added after enrollment
    await checklistProgressRepository.upsertMany([
      {
        userId,
        checklistItemId: itemId,
        status: "not_started" as ChecklistProgressStatus,
      },
    ]);

    const data = await checklistProgressRepository.updateStatus(
      userId,
      itemId,
      statusData.status as ChecklistProgressStatus,
      {
        completedBy: statusData.completed_by,
        verifiedBy: statusData.verified_by,
        documentId: statusData.document_id,
        notes: statusData.notes,
        rejectionReason: statusData.rejection_reason,
        metadata: statusData.metadata,
      },
    );

    // Trigger item automations based on status change (fire-and-forget)
    const status = statusData.status;
    if (status === "completed" || status === "approved") {
      triggerAutomationAsync(() =>
        pipelineAutomationService.triggerItemAutomations(
          itemId,
          "item_complete",
          userId,
        ),
      );
    } else if (status === "in_progress") {
      // "in_progress" with document upload means item is awaiting approval/verification
      // Only trigger if a document was attached (indicating submission for review)
      if (statusData.document_id) {
        triggerAutomationAsync(() =>
          pipelineAutomationService.triggerItemAutomations(
            itemId,
            "item_approval_needed",
            userId,
          ),
        );
      }
    }

    // Check if all required items in this phase are approved
    await this.checkPhaseAutoAdvancement(userId, itemId);

    return data as unknown as RecruitChecklistProgress;
  },

  async checkPhaseAutoAdvancement(userId: string, checklistItemId: string) {
    // Use a single RPC that checks completion + auto-advances in one transaction.
    // Previously this was a 14-call chain: checkPhaseAutoAdvancement (3) → advanceToNextPhase (9).
    // That chain was the primary cause of the 2026-02-27 connection pool exhaustion.
    const { data, error } = await supabase.rpc("check_and_auto_advance_phase", {
      p_user_id: userId,
      p_checklist_item_id: checklistItemId,
    });

    if (error) {
      console.error("[checklistService] Auto-advance check failed:", error);
      return;
    }

    const result = data as {
      advanced: boolean;
      phase_id?: string;
      advance_result?: {
        next_phase_id?: string;
        next_phase_order?: number;
        completed?: boolean;
      };
    };

    if (result.advanced && result.phase_id) {
      // Trigger phase_complete automation (fire-and-forget)
      triggerAutomationAsync(() =>
        pipelineAutomationService.triggerPhaseAutomations(
          result.phase_id!,
          "phase_complete",
          userId,
        ),
      );

      if (result.advance_result?.next_phase_id) {
        // Trigger phase_enter automation (fire-and-forget)
        triggerAutomationAsync(() =>
          pipelineAutomationService.triggerPhaseAutomations(
            result.advance_result!.next_phase_id!,
            "phase_enter",
            userId,
          ),
        );

        // Ensure auth user for phase 2+ (fire-and-forget)
        if (
          result.advance_result.next_phase_order &&
          result.advance_result.next_phase_order >= 2
        ) {
          this.ensureRecruitHasAuthUser(userId).catch((err) => {
            console.error(
              "[checklistService] Failed to ensure auth user:",
              err,
            );
          });
        }
      }
    }
  },

  // ========================================
  // DOCUMENT APPROVAL (delegates to documentService)
  // ========================================

  async approveDocument(documentId: string, approverId: string) {
    // Update document status via documentService
    const document = await documentService.approve(documentId, approverId);

    // Find linked checklist item and mark as approved
    const checklistProgress =
      await checklistProgressRepository.findByDocumentId(documentId);

    if (checklistProgress) {
      // Update checklist item status to approved
      await this.updateChecklistItemStatus(
        checklistProgress.userId,
        checklistProgress.checklistItemId,
        {
          status: "approved",
          verified_by: approverId,
        },
      );
    }

    return document;
  },

  async rejectDocument(documentId: string, approverId: string, reason: string) {
    // Update document status via documentService
    const document = await documentService.reject(
      documentId,
      approverId,
      reason,
    );

    // Find linked checklist item and mark as needs_resubmission
    const checklistProgress =
      await checklistProgressRepository.findByDocumentId(documentId);

    if (checklistProgress) {
      // Update checklist item status to needs_resubmission
      await this.updateChecklistItemStatus(
        checklistProgress.userId,
        checklistProgress.checklistItemId,
        {
          status: "needs_resubmission",
          verified_by: approverId,
          rejection_reason: reason,
        },
      );
    }

    return document;
  },

  // ========================================
  // PIPELINE UNENROLLMENT
  // ========================================

  async unenrollFromPipeline(userId: string) {
    // Use RPC with SECURITY DEFINER to bypass RLS for deletion operations
    const { data, error } = await supabase.rpc("unenroll_from_pipeline", {
      target_user_id: userId,
    });

    if (error) {
      console.error("[checklistService] Unenroll RPC failed:", error);
      throw error;
    }

    if (data && !data.success) {
      console.error("[checklistService] Unenroll failed:", data.error);
      throw new Error(data.error || "Failed to unenroll from pipeline");
    }

    console.log(
      `[checklistService] Successfully unenrolled user ${userId} from pipeline:`,
      data,
    );

    return { success: true };
  },

  // ========================================
  // AUTH USER MANAGEMENT
  // ========================================

  /**
   * Ensures recruit has an auth user. Creates one if missing.
   * Called when advancing to a phase that requires login access (phase 2+).
   * Returns whether an email was sent (only on new auth user creation).
   */
  async ensureRecruitHasAuthUser(
    userId: string,
  ): Promise<{ emailSent: boolean; created: boolean }> {
    // Get recruit profile to check if they need auth user creation
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, email, first_name, last_name, roles")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error(
        "[checklistService] Failed to get profile for auth user check:",
        profileError,
      );
      throw new Error("Recruit profile not found");
    }

    // Check if auth user already exists by trying to query auth.users
    // Note: This requires checking if the profile was created via auth
    // If profile.id matches an auth.users.id, then auth user exists
    // We can check this by trying to call the edge function and handling the "already exists" error
    try {
      console.log(
        `[checklistService] Creating auth user for recruit ${userId} (${profile.email})`,
      );

      const authResult = await createAuthUserWithProfile({
        email: profile.email,
        fullName: `${profile.first_name} ${profile.last_name}`,
        roles: (profile.roles as string[]) || ["recruit"],
        isAdmin: false,
        skipPipeline: true, // Pipeline already exists, just need auth
        // The recruit's user_profiles row already exists (selected above), so the
        // new auth user MUST reuse its id. Without this, createUser mints a fresh
        // UUID and handle_new_user's INSERT collides on UNIQUE(email) (its ON
        // CONFLICT is keyed on id, not email) → the function returns HTTP 400.
        existingProfileId: userId,
      });

      // Check if user already existed
      const alreadyExisted = authResult.message
        ?.toLowerCase()
        .includes("already exists");

      if (alreadyExisted) {
        console.log(
          `[checklistService] Auth user already existed for ${profile.email}`,
        );
        return { emailSent: false, created: false };
      }

      console.log(
        `[checklistService] Auth user created for ${profile.email}, email sent: ${authResult.emailSent}`,
      );

      return { emailSent: authResult.emailSent, created: true };
    } catch (error) {
      // If error indicates user already exists, that's fine
      const errorMessage =
        error instanceof Error ? error.message.toLowerCase() : "";
      if (
        errorMessage.includes("already exists") ||
        errorMessage.includes("already registered")
      ) {
        console.log(
          `[checklistService] Auth user already exists for ${profile.email}`,
        );
        return { emailSent: false, created: false };
      }

      // Re-throw other errors
      console.error("[checklistService] Failed to create auth user:", error);
      throw error;
    }
  },
};
