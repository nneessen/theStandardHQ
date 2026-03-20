// src/services/recruiting/recruitingService.ts
import { supabase } from "../base/supabase";
import { supabaseFunctionsUrl } from "../base";
import {
  workflowEventEmitter,
  WORKFLOW_EVENTS,
} from "../events/workflowEventEmitter";
import { RecruitRepository } from "./repositories/RecruitRepository";
import { documentService, documentStorageService } from "@/services/documents";
import { activityLogService } from "@/services/activity";
import type { UserProfile } from "@/types/hierarchy.types";
import type {
  OnboardingPhase,
  UserDocument,
  UserActivityLog,
  RecruitFilters,
  UpdateRecruitInput,
  UpdatePhaseInput,
} from "@/types/recruiting.types";
import type { CreateRecruitInput } from "@/types/recruiting.types";

// Repository instance
const recruitRepository = new RecruitRepository();

type EdgeFunctionInvokeError = Error & {
  context?: Response;
};

export const recruitingService = {
  // ========================================
  // RECRUIT CRUD (using RecruitRepository)
  // ========================================

  async getRecruits(filters?: RecruitFilters, page = 1, limit = 50) {
    return recruitRepository.findRecruits(filters, page, limit);
  },

  async getRecruitById(id: string) {
    const recruit = await recruitRepository.findByIdWithRelations(id);
    if (!recruit) {
      throw new Error("Recruit not found");
    }
    return recruit;
  },

  async createRecruit(recruit: CreateRecruitInput) {
    const skipPipeline = recruit.skip_pipeline === true;
    const profileOverrides: Partial<CreateRecruitInput> = { ...recruit };
    delete profileOverrides.skip_pipeline;
    delete profileOverrides.email;
    delete profileOverrides.pipeline_template_id;

    // Recruits are created as prospects. Pipeline enrollment happens later.
    let roles: string[] = ["recruit"];
    if (skipPipeline || recruit.agent_status === "not_applicable") {
      roles = recruit.roles || ["view_only"];
    }

    const fullName =
      `${recruit.first_name || ""} ${recruit.last_name || ""}`.trim();

    const profileData = {
      ...profileOverrides,
      roles,
      agent_status: recruit.agent_status || "unlicensed",
      licensing_info: recruit.licensing_info || {},
      onboarding_status: skipPipeline ? null : "prospect",
      current_onboarding_phase: skipPipeline ? null : "prospect",
      onboarding_started_at: null,
      hierarchy_path: "",
      hierarchy_depth: 0,
      contract_level: recruit.contract_level ?? null,
      approval_status: "pending",
      is_admin: recruit.is_admin || false,
    };

    // Debug: Log profileData being sent to edge function
    console.log("[recruitingService.createRecruit] Sending profileData:", {
      upline_id: profileData.upline_id,
      imo_id: profileData.imo_id,
      agency_id: profileData.agency_id,
      keys: Object.keys(profileData),
    });

    const { data: result, error: invokeError } =
      await supabase.functions.invoke("create-auth-user", {
        body: {
          email: recruit.email.toLowerCase().trim(),
          fullName,
          roles,
          isAdmin: recruit.is_admin || false,
          skipPipeline,
          phone: recruit.phone,
          // Pass all profile data to be applied by edge function (bypasses RLS)
          profileData,
        },
      });

    // Debug: Log the full result from edge function
    console.log("[recruitingService.createRecruit] Edge function result:", {
      ok: !invokeError,
      hasProfile: !!result?.profile,
      profileUpdateError: result?.profileUpdateError,
      alreadyExists: result?.alreadyExists,
    });

    if (invokeError) {
      let errorMessage = invokeError.message || "Failed to create auth user";

      try {
        const errorContext = (invokeError as EdgeFunctionInvokeError).context;
        const errorBody = errorContext
          ? ((await errorContext.json()) as {
              error?: string;
              details?: string;
            })
          : null;

        if (typeof errorBody?.error === "string" && errorBody.error.trim()) {
          errorMessage = errorBody.error;
        } else if (
          typeof errorBody?.details === "string" &&
          errorBody.details.trim()
        ) {
          errorMessage = errorBody.details;
        }
      } catch {
        // Fall back to the transport error message if the body cannot be read.
      }

      console.error(
        "[recruitingService.createRecruit] Edge function failed:",
        invokeError,
      );
      throw new Error(errorMessage);
    }

    if (!result) {
      throw new Error("Auth user creation returned no data");
    }

    const authUserId = result.user?.id;
    if (!authUserId) {
      // Handle case where user already exists
      if (result.alreadyExists) {
        throw new Error(`A user with email ${recruit.email} already exists`);
      }
      throw new Error("Auth user was created but no ID was returned");
    }

    // Profile is updated by edge function - use returned profile or create fallback
    const newRecruit =
      (result.profile as UserProfile) ||
      ({
        ...profileData,
        id: authUserId,
        email: recruit.email.toLowerCase().trim(),
      } as UserProfile);

    // Emit recruit created event
    await workflowEventEmitter.emit(WORKFLOW_EVENTS.RECRUIT_CREATED, {
      recruitId: newRecruit.id,
      userId: newRecruit.id,
      userEmail: newRecruit.email,
      recruitName: `${newRecruit.first_name} ${newRecruit.last_name}`,
      recruiterId: newRecruit.recruiter_id || undefined,
      uplineId: newRecruit.upline_id || undefined,
      agentStatus: newRecruit.agent_status,
      onboardingStatus: newRecruit.onboarding_status,
      createdAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
    });

    return newRecruit;
  },

  async updateRecruit(id: string, updates: UpdateRecruitInput) {
    // Get current recruit data to check for status changes
    const { data: currentRecruit } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", id)
      .single();

    // Update the recruit
    const { data, error } = await supabase
      .from("user_profiles")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data)
      throw new Error(
        "Update failed — you may not have permission to edit this recruit.",
      );

    const updatedRecruit = data as UserProfile;

    // Check for status changes and emit events
    if (currentRecruit && updates.onboarding_status) {
      const oldStatus = currentRecruit.onboarding_status;
      const newStatus = updates.onboarding_status;

      // Emit phase changed event for any status change
      if (oldStatus !== newStatus) {
        await workflowEventEmitter.emit(WORKFLOW_EVENTS.RECRUIT_PHASE_CHANGED, {
          recruitId: id,
          userId: updatedRecruit.id,
          userEmail: updatedRecruit.email,
          recruitName: `${updatedRecruit.first_name} ${updatedRecruit.last_name}`,
          oldPhase: oldStatus,
          newPhase: newStatus,
          recruiterId: updatedRecruit.recruiter_id || undefined,
          uplineId: updatedRecruit.upline_id || undefined,
          timestamp: new Date().toISOString(),
        });

        // Check for graduation (completed status)
        if (newStatus === "completed") {
          await workflowEventEmitter.emit(
            WORKFLOW_EVENTS.RECRUIT_GRADUATED_TO_AGENT,
            {
              recruitId: id,
              userId: updatedRecruit.id,
              userEmail: updatedRecruit.email,
              recruitName: `${updatedRecruit.first_name} ${updatedRecruit.last_name}`,
              graduatedAt: new Date().toISOString(),
              recruiterId: updatedRecruit.recruiter_id || undefined,
              uplineId: updatedRecruit.upline_id || undefined,
              agentStatus: updatedRecruit.agent_status,
              licensingInfo: updatedRecruit.licensing_info,
              timestamp: new Date().toISOString(),
            },
          );
        }

        // Check for dropout
        if (newStatus === "dropped") {
          await workflowEventEmitter.emit(WORKFLOW_EVENTS.RECRUIT_DROPPED_OUT, {
            recruitId: id,
            userId: updatedRecruit.id,
            userEmail: updatedRecruit.email,
            recruitName: `${updatedRecruit.first_name} ${updatedRecruit.last_name}`,
            droppedAt: new Date().toISOString(),
            lastPhase: oldStatus,
            recruiterId: updatedRecruit.recruiter_id || undefined,
            uplineId: updatedRecruit.upline_id || undefined,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    return updatedRecruit;
  },

  // Hard delete recruit - permanently removes user and all related data
  async deleteRecruit(id: string) {
    return recruitRepository.deleteRecruit(id);
  },

  // ========================================
  // ONBOARDING PHASES
  // ========================================

  async getRecruitPhases(userId: string) {
    const { data, error } = await supabase
      .from("onboarding_phases")
      .select("*")
      .eq("user_id", userId)
      .order("phase_order", { ascending: true });

    if (error) throw error;
    return data as OnboardingPhase[];
  },

  async updatePhase(phaseId: string, updates: UpdatePhaseInput) {
    const { data, error } = await supabase
      .from("onboarding_phases")
      .update(updates)
      .eq("id", phaseId)
      .select()
      .single();

    if (error) throw error;
    return data as OnboardingPhase;
  },

  // ========================================
  // DOCUMENTS (delegates to documentService)
  // ========================================

  async getRecruitDocuments(userId: string) {
    const documents = await documentService.getDocumentsForUser(userId);
    // Transform to expected format (snake_case for backward compatibility)
    return documents.map((doc) => ({
      id: doc.id,
      user_id: doc.userId,
      document_type: doc.documentType,
      document_name: doc.documentName,
      file_name: doc.fileName,
      file_size: doc.fileSize,
      file_type: doc.fileType,
      storage_path: doc.storagePath,
      status: doc.status,
      uploaded_by: doc.uploadedBy,
      uploaded_at: doc.uploadedAt,
      notes: doc.notes,
      required: doc.required,
      expires_at: doc.expiresAt,
      created_at: doc.createdAt,
      updated_at: doc.updatedAt,
    })) as UserDocument[];
  },

  async uploadDocument(
    userId: string,
    file: File,
    documentType: string,
    documentName: string,
    uploadedBy: string,
    required = false,
    expiresAt?: string,
  ) {
    const document = await documentService.uploadDocument({
      userId,
      file,
      documentType,
      documentName,
      uploadedBy,
      required,
      expiresAt,
    });

    // Transform to expected format
    return {
      id: document.id,
      user_id: document.userId,
      document_type: document.documentType,
      document_name: document.documentName,
      file_name: document.fileName,
      file_size: document.fileSize,
      file_type: document.fileType,
      storage_path: document.storagePath,
      status: document.status,
      uploaded_by: document.uploadedBy,
      uploaded_at: document.uploadedAt,
      notes: document.notes,
      required: document.required,
      expires_at: document.expiresAt,
      created_at: document.createdAt,
      updated_at: document.updatedAt,
    } as UserDocument;
  },

  async downloadDocument(storagePath: string) {
    return documentStorageService.download(storagePath);
  },

  async getDocumentUrl(storagePath: string) {
    return documentStorageService.getSignedUrl(storagePath);
  },

  async deleteDocument(id: string, _storagePath?: string) {
    // Note: storagePath is ignored - documentService fetches it internally
    return documentService.deleteDocument(id);
  },

  async updateDocumentStatus(
    id: string,
    status: "pending" | "received" | "approved" | "rejected" | "expired",
    notes?: string,
  ) {
    const document = await documentService.updateStatus(id, status, notes);

    // Transform to expected format
    return {
      id: document.id,
      user_id: document.userId,
      document_type: document.documentType,
      document_name: document.documentName,
      file_name: document.fileName,
      file_size: document.fileSize,
      file_type: document.fileType,
      storage_path: document.storagePath,
      status: document.status,
      uploaded_by: document.uploadedBy,
      uploaded_at: document.uploadedAt,
      notes: document.notes,
      required: document.required,
      expires_at: document.expiresAt,
      created_at: document.createdAt,
      updated_at: document.updatedAt,
    } as UserDocument;
  },

  // ========================================
  // ACTIVITY LOG (delegates to activityLogService)
  // ========================================

  async getRecruitActivityLog(userId: string, limit = 50) {
    const logs = await activityLogService.getForUser(userId, limit);

    // Transform to expected format (snake_case for backward compatibility)
    return logs.map((log) => ({
      id: log.id,
      user_id: log.userId,
      action_type: log.actionType,
      details: log.details as Record<string, unknown> | null,
      performed_by: log.performedBy,
      created_at: log.createdAt ?? new Date().toISOString(),
    })) as UserActivityLog[];
  },

  // ========================================
  // OAUTH
  // ========================================

  getInstagramOAuthUrl(userId: string) {
    const INSTAGRAM_APP_ID = import.meta.env.VITE_INSTAGRAM_APP_ID;
    const REDIRECT_URI = `${supabaseFunctionsUrl}/instagram-oauth`;
    const state = userId;
    const scope = "user_profile,user_media";

    const authUrl = `https://api.instagram.com/oauth/authorize?client_id=${INSTAGRAM_APP_ID}&redirect_uri=${encodeURIComponent(
      REDIRECT_URI,
    )}&scope=${scope}&response_type=code&state=${state}`;

    return authUrl;
  },

  // ========================================
  // STATS & ANALYTICS (using RecruitRepository)
  // ========================================

  async getRecruitingStats(recruiterId?: string, includeProspects?: boolean) {
    return recruitRepository.getStats(recruiterId, undefined, includeProspects);
  },

  // ========================================
  // SEARCH & FILTERS (using RecruitRepository)
  // ========================================

  async searchRecruits(searchTerm: string, limit = 10) {
    return recruitRepository.searchRecruits(searchTerm, limit);
  },

  /**
   * Check if a user exists by email
   */
  async checkEmailExists(
    email: string,
  ): Promise<{ exists: boolean; userId?: string }> {
    const { data } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    return {
      exists: !!data,
      userId: data?.id,
    };
  },
};
