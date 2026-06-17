// src/features/training-modules/services/trainingProgressService.ts
import { supabase } from "@/services/base";
import {
  workflowEventEmitter,
  WORKFLOW_EVENTS,
} from "@/services/events/workflowEventEmitter";
import type {
  TrainingProgress,
  ModuleProgressSummary,
  CompleteTrainingLessonResult,
} from "../types/training-module.types";

export const trainingProgressService = {
  async getByModule(
    moduleId: string,
    userId: string,
  ): Promise<TrainingProgress[]> {
    const { data, error } = await supabase
      .from("training_progress")
      .select("*")
      .eq("module_id", moduleId)
      .eq("user_id", userId);
    if (error) throw error;
    return data as TrainingProgress[];
  },

  async getModuleProgressSummary(
    moduleId: string,
    userId?: string,
  ): Promise<ModuleProgressSummary[]> {
    const { data, error } = await supabase.rpc("get_module_progress_summary", {
      p_module_id: moduleId,
      ...(userId ? { p_user_id: userId } : {}),
    });
    if (error) throw error;
    return data as ModuleProgressSummary[];
  },

  async startLesson(
    lessonId: string,
    moduleId: string,
    imoId: string,
    agencyId: string,
    userId: string,
  ): Promise<TrainingProgress> {
    // Upsert progress record
    const { data, error } = await supabase
      .from("training_progress")
      .upsert(
        {
          user_id: userId,
          lesson_id: lessonId,
          module_id: moduleId,
          imo_id: imoId,
          agency_id: agencyId,
          status: "in_progress",
          started_at: new Date().toISOString(),
          last_accessed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,lesson_id" },
      )
      .select()
      .single();
    if (error) throw error;
    return data as TrainingProgress;
  },

  async completeLesson(
    lessonId: string,
    timeSpentSeconds: number,
  ): Promise<CompleteTrainingLessonResult> {
    const { data, error } = await supabase.rpc("complete_training_lesson", {
      p_lesson_id: lessonId,
      p_time_spent_seconds: timeSpentSeconds,
    });
    if (error) throw error;
    const result = data as CompleteTrainingLessonResult;
    // Emit training.lesson_completed (non-fatal). recipientId = the current agent.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await workflowEventEmitter.emit(WORKFLOW_EVENTS.TRAINING_LESSON_COMPLETED, {
      recipientId: user?.id,
      lessonId,
      moduleCompleted: result.module_completed,
      timestamp: new Date().toISOString(),
    });
    return result;
  },
};
