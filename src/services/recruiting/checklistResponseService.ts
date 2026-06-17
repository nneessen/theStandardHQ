// src/services/recruiting/checklistResponseService.ts

import { supabase } from "../base/supabase";
import {
  workflowEventEmitter,
  WORKFLOW_EVENTS,
} from "../events/workflowEventEmitter";
import type {
  BooleanQuestionResponse,
  AcknowledgmentResponse,
  TextResponseData,
  MultipleChoiceResponse,
  FileDownloadResponse,
  ExternalLinkResponse,
  QuizResponse,
  QuizAttempt,
  QuizMetadata,
  MultipleChoiceMetadata,
  BooleanQuestionMetadata,
  VideoEmbedResponse,
  VideoEmbedMetadata,
  CarrierContractingResponse,
} from "@/types/recruiting.types";

// =============================================================================
// Types
// =============================================================================

export type ChecklistResponse =
  | BooleanQuestionResponse
  | AcknowledgmentResponse
  | TextResponseData
  | MultipleChoiceResponse
  | FileDownloadResponse
  | ExternalLinkResponse
  | QuizResponse
  | VideoEmbedResponse
  | CarrierContractingResponse;

export interface SubmitResponseResult {
  success: boolean;
  error?: string;
  autoComplete?: boolean;
  completionDetails?: Record<string, unknown>;
}

// =============================================================================
// Response Submission Handlers
// =============================================================================

/**
 * Submit a boolean question response
 */
export async function submitBooleanQuestionResponse(
  progressId: string,
  answer: boolean,
  explanation?: string,
  metadata?: BooleanQuestionMetadata,
): Promise<SubmitResponseResult> {
  const response: BooleanQuestionResponse = {
    answer,
    explanation,
    answered_at: new Date().toISOString(),
  };

  // Check if auto-complete is allowed
  const autoComplete =
    !metadata?.require_positive || (metadata.require_positive && answer);

  const { error } = await supabase
    .from("recruit_checklist_progress")
    .update({
      response_data: response,
      ...(autoComplete && {
        status: "completed",
        completed_at: new Date().toISOString(),
      }),
    })
    .eq("id", progressId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, autoComplete };
}

/**
 * Submit an acknowledgment response
 */
export async function submitAcknowledgmentResponse(
  progressId: string,
  acknowledged: boolean,
  scrollCompleted?: boolean,
): Promise<SubmitResponseResult> {
  if (!acknowledged) {
    return { success: false, error: "Acknowledgment is required" };
  }

  const response: AcknowledgmentResponse = {
    acknowledged,
    acknowledged_at: new Date().toISOString(),
    scroll_completed: scrollCompleted,
  };

  const { error } = await supabase
    .from("recruit_checklist_progress")
    .update({
      response_data: response,
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", progressId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, autoComplete: true };
}

/**
 * Submit a text response
 */
export async function submitTextResponse(
  progressId: string,
  text: string,
): Promise<SubmitResponseResult> {
  const response: TextResponseData = {
    text,
    submitted_at: new Date().toISOString(),
    character_count: text.length,
  };

  const { error } = await supabase
    .from("recruit_checklist_progress")
    .update({
      response_data: response,
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", progressId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, autoComplete: true };
}

/**
 * Submit a multiple choice response
 */
export async function submitMultipleChoiceResponse(
  progressId: string,
  selectedOptionIds: string[],
  metadata?: MultipleChoiceMetadata,
): Promise<SubmitResponseResult> {
  const response: MultipleChoiceResponse = {
    selected_option_ids: selectedOptionIds,
    submitted_at: new Date().toISOString(),
  };

  // Check if correct answer is required
  let autoComplete = true;
  if (metadata?.require_correct) {
    const correctOptionIds = metadata.options
      .filter((o) => o.is_correct)
      .map((o) => o.id)
      .sort();
    const selected = [...selectedOptionIds].sort();
    autoComplete =
      correctOptionIds.length === selected.length &&
      correctOptionIds.every((id, i) => id === selected[i]);
  }

  // Check for disqualifying options
  const disqualifying = metadata?.options
    .filter((o) => o.is_disqualifying && selectedOptionIds.includes(o.id))
    .map((o) => o.label);

  const { error } = await supabase
    .from("recruit_checklist_progress")
    .update({
      response_data: response,
      ...(autoComplete && {
        status: "completed",
        completed_at: new Date().toISOString(),
      }),
      completion_details: disqualifying?.length
        ? { disqualifying_selections: disqualifying }
        : undefined,
    })
    .eq("id", progressId);

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    autoComplete,
    completionDetails: disqualifying?.length
      ? { disqualifying_selections: disqualifying }
      : undefined,
  };
}

/**
 * Record a file download event
 */
export async function recordFileDownload(
  progressId: string,
): Promise<SubmitResponseResult> {
  // First check if there's already a response
  const { data: existing } = await supabase
    .from("recruit_checklist_progress")
    .select("response_data")
    .eq("id", progressId)
    .single();

  const existingResponse =
    existing?.response_data as FileDownloadResponse | null;

  const response: FileDownloadResponse = {
    downloaded: true,
    downloaded_at: existingResponse?.downloaded_at ?? new Date().toISOString(),
    acknowledged: existingResponse?.acknowledged,
    acknowledged_at: existingResponse?.acknowledged_at,
  };

  const { error } = await supabase
    .from("recruit_checklist_progress")
    .update({ response_data: response })
    .eq("id", progressId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, autoComplete: false };
}

/**
 * Acknowledge a file download (after downloading and reviewing)
 */
export async function acknowledgeFileDownload(
  progressId: string,
): Promise<SubmitResponseResult> {
  const { data: existing } = await supabase
    .from("recruit_checklist_progress")
    .select("response_data")
    .eq("id", progressId)
    .single();

  const existingResponse =
    existing?.response_data as FileDownloadResponse | null;

  if (!existingResponse?.downloaded) {
    return { success: false, error: "File must be downloaded first" };
  }

  const response: FileDownloadResponse = {
    ...existingResponse,
    acknowledged: true,
    acknowledged_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("recruit_checklist_progress")
    .update({
      response_data: response,
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", progressId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, autoComplete: true };
}

/**
 * Record an external link click
 */
export async function recordExternalLinkClick(
  progressId: string,
): Promise<SubmitResponseResult> {
  const response: ExternalLinkResponse = {
    clicked: true,
    clicked_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("recruit_checklist_progress")
    .update({ response_data: response })
    .eq("id", progressId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, autoComplete: false };
}

/**
 * Mark external link as completed (manual verification)
 */
export async function completeExternalLink(
  progressId: string,
): Promise<SubmitResponseResult> {
  const { data: existing } = await supabase
    .from("recruit_checklist_progress")
    .select("response_data")
    .eq("id", progressId)
    .single();

  const existingResponse =
    existing?.response_data as ExternalLinkResponse | null;

  const response: ExternalLinkResponse = {
    clicked: existingResponse?.clicked ?? true,
    clicked_at: existingResponse?.clicked_at ?? new Date().toISOString(),
    returned: true,
    returned_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("recruit_checklist_progress")
    .update({
      response_data: response,
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", progressId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, autoComplete: true };
}

/**
 * Submit a quiz attempt
 */
export async function submitQuizAttempt(
  progressId: string,
  answers: Record<string, string[]>,
  metadata: QuizMetadata,
): Promise<SubmitResponseResult> {
  // Get existing response to track attempts (user_id for the workflow recipient)
  const { data: existing } = await supabase
    .from("recruit_checklist_progress")
    .select("response_data, user_id")
    .eq("id", progressId)
    .single();

  const existingResponse = existing?.response_data as QuizResponse | null;
  const attemptNumber = (existingResponse?.total_attempts ?? 0) + 1;

  // Calculate score
  let correctCount = 0;
  const totalQuestions = metadata.questions.length;

  for (const question of metadata.questions) {
    const selectedIds = answers[question.id] ?? [];
    const correctIds = question.options
      .filter((o) => o.is_correct)
      .map((o) => o.id)
      .sort();
    const selected = [...selectedIds].sort();

    if (
      correctIds.length === selected.length &&
      correctIds.every((id, i) => id === selected[i])
    ) {
      correctCount++;
    }
  }

  const scorePercent = Math.round((correctCount / totalQuestions) * 100);
  const passed = scorePercent >= metadata.passing_score_percent;

  const attempt: QuizAttempt = {
    attempt_number: attemptNumber,
    started_at:
      existingResponse?.attempts?.[existingResponse.attempts.length - 1]
        ?.started_at ?? new Date().toISOString(),
    completed_at: new Date().toISOString(),
    answers,
    score_percent: scorePercent,
    correct_count: correctCount,
    total_questions: totalQuestions,
    passed,
  };

  const bestScore = Math.max(
    scorePercent,
    existingResponse?.best_score_percent ?? 0,
  );

  const response: QuizResponse = {
    attempts: [...(existingResponse?.attempts ?? []), attempt],
    best_score_percent: bestScore,
    total_attempts: attemptNumber,
    passed: passed || (existingResponse?.passed ?? false),
  };

  // Check if max retries reached
  const canRetry =
    !passed &&
    metadata.allow_retries &&
    (!metadata.max_retries || attemptNumber < metadata.max_retries);

  const autoComplete = passed;

  const { error } = await supabase
    .from("recruit_checklist_progress")
    .update({
      response_data: response,
      ...(autoComplete && {
        status: "completed",
        completed_at: new Date().toISOString(),
      }),
      completion_details: {
        final_score_percent: scorePercent,
        total_attempts: attemptNumber,
        passed,
        completed_at: new Date().toISOString(),
      },
    })
    .eq("id", progressId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Emit recruit.quiz_passed / recruit.quiz_failed (non-fatal, mutually exclusive).
  // recipientId = the recruit (user_id on the progress row).
  await workflowEventEmitter.emit(
    passed
      ? WORKFLOW_EVENTS.RECRUIT_QUIZ_PASSED
      : WORKFLOW_EVENTS.RECRUIT_QUIZ_FAILED,
    {
      recipientId: existing?.user_id ?? undefined,
      checklistProgressId: progressId,
      scorePercent,
      attemptNumber,
      timestamp: new Date().toISOString(),
    },
  );

  return {
    success: true,
    autoComplete,
    completionDetails: {
      score_percent: scorePercent,
      correct_count: correctCount,
      total_questions: totalQuestions,
      passed,
      can_retry: canRetry,
      attempts_remaining: metadata.max_retries
        ? metadata.max_retries - attemptNumber
        : null,
    },
  };
}

/**
 * Submit a video watch response
 */
export async function submitVideoWatchResponse(
  progressId: string,
  metadata?: VideoEmbedMetadata,
): Promise<SubmitResponseResult> {
  const response: VideoEmbedResponse = {
    watched: true,
    watched_at: new Date().toISOString(),
    fully_watched: true, // Honor system for now
  };

  // Auto-complete if configured (defaults to true for videos)
  const autoComplete = metadata?.auto_complete !== false;

  const { error } = await supabase
    .from("recruit_checklist_progress")
    .update({
      response_data: response,
      ...(autoComplete && {
        status: "completed",
        completed_at: new Date().toISOString(),
      }),
    })
    .eq("id", progressId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, autoComplete };
}

// =============================================================================
// Response Retrieval
// =============================================================================

/**
 * Get the response data for a checklist item
 */
export async function getChecklistResponse(
  progressId: string,
): Promise<ChecklistResponse | null> {
  const { data, error } = await supabase
    .from("recruit_checklist_progress")
    .select("response_data")
    .eq("id", progressId)
    .single();

  if (error || !data?.response_data) {
    return null;
  }

  return data.response_data as ChecklistResponse;
}

/**
 * Get all responses for a user's checklist items in a phase
 */
export async function getPhaseResponses(
  userId: string,
  phaseId: string,
): Promise<Map<string, ChecklistResponse>> {
  // First get the checklist item IDs for this phase
  const { data: itemsData, error: itemsError } = await supabase
    .from("phase_checklist_items")
    .select("id")
    .eq("phase_id", phaseId);

  if (itemsError || !itemsData?.length) {
    return new Map();
  }

  const itemIds = itemsData.map((item) => item.id);

  // Then get the responses for these items
  const { data, error } = await supabase
    .from("recruit_checklist_progress")
    .select("checklist_item_id, response_data")
    .eq("user_id", userId)
    .in("checklist_item_id", itemIds);

  const responses = new Map<string, ChecklistResponse>();

  if (error || !data) {
    return responses;
  }

  for (const item of data) {
    if (item.response_data) {
      responses.set(
        item.checklist_item_id,
        item.response_data as ChecklistResponse,
      );
    }
  }

  return responses;
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Check if a text response meets the requirements
 */
export function validateTextResponse(
  text: string,
  minLength?: number,
  maxLength?: number,
  requiredKeywords?: string[],
  validationPattern?: string,
): { valid: boolean; error?: string } {
  if (minLength && text.length < minLength) {
    return {
      valid: false,
      error: `Response must be at least ${minLength} characters`,
    };
  }

  if (maxLength && text.length > maxLength) {
    return {
      valid: false,
      error: `Response must be at most ${maxLength} characters`,
    };
  }

  if (requiredKeywords?.length) {
    const lowerText = text.toLowerCase();
    const missing = requiredKeywords.filter(
      (kw) => !lowerText.includes(kw.toLowerCase()),
    );
    if (missing.length) {
      return {
        valid: false,
        error: `Response must include: ${missing.join(", ")}`,
      };
    }
  }

  if (validationPattern) {
    try {
      const regex = new RegExp(validationPattern);
      if (!regex.test(text)) {
        return { valid: false, error: "Response format is invalid" };
      }
    } catch {
      // Invalid regex pattern, skip validation
    }
  }

  return { valid: true };
}

/**
 * Check if multiple choice selection meets requirements
 */
export function validateMultipleChoiceSelection(
  selectedIds: string[],
  minSelections?: number,
  maxSelections?: number,
): { valid: boolean; error?: string } {
  if (minSelections && selectedIds.length < minSelections) {
    return {
      valid: false,
      error: `Select at least ${minSelections} option(s)`,
    };
  }

  if (maxSelections && selectedIds.length > maxSelections) {
    return {
      valid: false,
      error: `Select at most ${maxSelections} option(s)`,
    };
  }

  return { valid: true };
}

// =============================================================================
// Carrier Contracting Response Handler
// =============================================================================

/**
 * Submit a carrier contracting completion response
 */
export async function submitCarrierContractingResponse(
  progressId: string,
  carriersCompleted: number,
  carriersTotal: number,
): Promise<SubmitResponseResult> {
  const response: CarrierContractingResponse = {
    carriers_completed: carriersCompleted,
    carriers_total: carriersTotal,
    completed_at: new Date().toISOString(),
    completed: true,
  };

  const { error } = await supabase
    .from("recruit_checklist_progress")
    .update({
      response_data: response,
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", progressId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, autoComplete: true };
}

// =============================================================================
// Export Service Object
// =============================================================================

export const checklistResponseService = {
  submitBooleanQuestionResponse,
  submitAcknowledgmentResponse,
  submitTextResponse,
  submitMultipleChoiceResponse,
  recordFileDownload,
  acknowledgeFileDownload,
  recordExternalLinkClick,
  completeExternalLink,
  submitQuizAttempt,
  submitVideoWatchResponse,
  submitCarrierContractingResponse,
  getChecklistResponse,
  getPhaseResponses,
  validateTextResponse,
  validateMultipleChoiceSelection,
};
