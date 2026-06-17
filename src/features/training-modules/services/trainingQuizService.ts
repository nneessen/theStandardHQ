// src/features/training-modules/services/trainingQuizService.ts
import { supabase } from "@/services/base";
import {
  workflowEventEmitter,
  WORKFLOW_EVENTS,
} from "@/services/events/workflowEventEmitter";
import type {
  TrainingQuiz,
  TrainingQuizWithQuestions,
  TrainingQuizQuestion,
  TrainingQuizOption,
  TrainingQuizAttempt,
  SubmitQuizAttemptResult,
  CreateQuizInput,
  CreateQuestionInput,
  CreateOptionInput,
} from "../types/training-module.types";

export const trainingQuizService = {
  async getByLessonId(
    lessonId: string,
  ): Promise<TrainingQuizWithQuestions | null> {
    const { data, error } = await supabase
      .from("training_quizzes")
      .select(
        "*, questions:training_quiz_questions(*, options:training_quiz_options(*))",
      )
      .eq("lesson_id", lessonId)
      .order("sort_order", { referencedTable: "training_quiz_questions" })
      .single();
    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }
    return data as unknown as TrainingQuizWithQuestions;
  },

  async getAttempts(
    quizId: string,
    userId: string,
  ): Promise<TrainingQuizAttempt[]> {
    const { data, error } = await supabase
      .from("training_quiz_attempts")
      .select("*")
      .eq("quiz_id", quizId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as TrainingQuizAttempt[];
  },

  async submitAttempt(
    quizId: string,
    answers: { question_id: string; selected_option_ids: string[] }[],
    timeTakenSeconds: number,
  ): Promise<SubmitQuizAttemptResult> {
    const { data, error } = await supabase.rpc("submit_training_quiz_attempt", {
      p_quiz_id: quizId,
      p_answers: answers,
      p_time_taken_seconds: timeTakenSeconds,
    });
    if (error) throw error;
    const result = data as SubmitQuizAttemptResult;
    // Emit training.quiz_passed / quiz_failed (non-fatal, mutually exclusive).
    // recipientId = the current agent.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await workflowEventEmitter.emit(
      result.passed
        ? WORKFLOW_EVENTS.TRAINING_QUIZ_PASSED
        : WORKFLOW_EVENTS.TRAINING_QUIZ_FAILED,
      {
        recipientId: user?.id,
        quizId,
        scorePercentage: result.score_percentage,
        attemptNumber: result.attempt_number,
        timestamp: new Date().toISOString(),
      },
    );
    return result;
  },

  // ── Quiz CRUD ──────────────────────────────────────────────────────

  async createQuiz(
    input: CreateQuizInput,
    imoId: string,
  ): Promise<TrainingQuiz> {
    const { data, error } = await supabase
      .from("training_quizzes")
      .insert({ ...input, imo_id: imoId })
      .select()
      .single();
    if (error) throw error;
    return data as TrainingQuiz;
  },

  async updateQuiz(
    id: string,
    input: Partial<CreateQuizInput>,
  ): Promise<TrainingQuiz> {
    const { data, error } = await supabase
      .from("training_quizzes")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as TrainingQuiz;
  },

  // ── Question CRUD ──────────────────────────────────────────────────

  async createQuestion(
    input: CreateQuestionInput,
    imoId: string,
  ): Promise<TrainingQuizQuestion> {
    const { data, error } = await supabase
      .from("training_quiz_questions")
      .insert({ ...input, imo_id: imoId })
      .select()
      .single();
    if (error) throw error;
    return data as TrainingQuizQuestion;
  },

  async updateQuestion(
    id: string,
    input: Partial<Omit<CreateQuestionInput, "quiz_id">>,
  ): Promise<TrainingQuizQuestion> {
    const { data, error } = await supabase
      .from("training_quiz_questions")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as TrainingQuizQuestion;
  },

  async deleteQuestion(id: string): Promise<void> {
    const { error } = await supabase
      .from("training_quiz_questions")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  // ── Option CRUD ────────────────────────────────────────────────────

  async createOption(input: CreateOptionInput): Promise<TrainingQuizOption> {
    const { data, error } = await supabase
      .from("training_quiz_options")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as TrainingQuizOption;
  },

  async updateOption(
    id: string,
    input: Partial<Omit<CreateOptionInput, "question_id">>,
  ): Promise<TrainingQuizOption> {
    const { data, error } = await supabase
      .from("training_quiz_options")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as TrainingQuizOption;
  },

  async deleteOption(id: string): Promise<void> {
    const { error } = await supabase
      .from("training_quiz_options")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },
};
