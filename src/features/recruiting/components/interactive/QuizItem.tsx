// src/features/recruiting/components/interactive/QuizItem.tsx

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { QuizMetadata, QuizResponse } from "@/types/recruiting.types";
// eslint-disable-next-line no-restricted-imports
import { checklistResponseService } from "@/services/recruiting/checklistResponseService";

interface QuizItemProps {
  progressId: string;
  metadata: QuizMetadata;
  existingResponse?: QuizResponse | null;
  onComplete?: () => void;
}

export function QuizItem({
  progressId,
  metadata,
  existingResponse,
  onComplete,
}: QuizItemProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [lastAttemptResult, setLastAttemptResult] = useState<{
    passed: boolean;
    score: number;
    canRetry: boolean;
    attemptsRemaining: number | null;
  } | null>(null);

  // Shuffle questions if configured
  const questions = useMemo(() => {
    if (!metadata?.questions || !Array.isArray(metadata.questions)) {
      return [];
    }
    if (metadata.randomize_questions) {
      return [...metadata.questions].sort(() => Math.random() - 0.5);
    }
    return metadata.questions;
  }, [metadata?.questions, metadata?.randomize_questions]);

  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;

  // Shuffle options if configured
  const displayOptions = useMemo(() => {
    if (!currentQuestion?.options || !Array.isArray(currentQuestion.options)) {
      return [];
    }
    if (metadata?.randomize_options) {
      return [...currentQuestion.options].sort(() => Math.random() - 0.5);
    }
    return currentQuestion.options;
  }, [currentQuestion?.options, metadata?.randomize_options]);

  const handleToggleOption = useCallback(
    (questionId: string, optionId: string, allowMultiple: boolean) => {
      setAnswers((prev) => {
        const current = prev[questionId] ?? [];
        if (allowMultiple) {
          if (current.includes(optionId)) {
            return {
              ...prev,
              [questionId]: current.filter((id) => id !== optionId),
            };
          }
          return { ...prev, [questionId]: [...current, optionId] };
        }
        return { ...prev, [questionId]: [optionId] };
      });
    },
    [],
  );

  const handleNext = useCallback(() => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((i) => i + 1);
    }
  }, [currentQuestionIndex, totalQuestions]);

  const handlePrev = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((i) => i - 1);
    }
  }, [currentQuestionIndex]);

  const handleSubmitQuiz = useCallback(async () => {
    // Check all questions answered
    const unanswered = questions.filter((q) => !answers[q.id]?.length);
    if (unanswered.length > 0) {
      toast.error(
        `Please answer all questions (${unanswered.length} remaining)`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await checklistResponseService.submitQuizAttempt(
        progressId,
        answers,
        metadata,
      );

      if (!result.success) {
        toast.error(result.error || "Failed to submit quiz");
        return;
      }

      const details = result.completionDetails as {
        score_percent: number;
        passed: boolean;
        can_retry: boolean;
        attempts_remaining: number | null;
      };

      setLastAttemptResult({
        passed: details.passed,
        score: details.score_percent,
        canRetry: details.can_retry,
        attemptsRemaining: details.attempts_remaining,
      });
      setShowResults(true);

      if (details.passed) {
        toast.success(`Quiz passed with ${details.score_percent}%!`);
        onComplete?.();
      } else if (details.can_retry) {
        toast.info(
          `Score: ${details.score_percent}%. Required: ${metadata.passing_score_percent}%. You can retry.`,
        );
      } else {
        toast.error(
          `Score: ${details.score_percent}%. Required: ${metadata.passing_score_percent}%. No more retries.`,
        );
      }
    } catch (error) {
      console.error("Failed to submit quiz:", error);
      toast.error("Failed to submit quiz");
    } finally {
      setIsSubmitting(false);
    }
  }, [progressId, answers, questions, metadata, onComplete]);

  const handleRetry = useCallback(() => {
    setAnswers({});
    setCurrentQuestionIndex(0);
    setShowResults(false);
    setLastAttemptResult(null);
  }, []);

  // If already passed
  if (existingResponse?.passed) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Quiz passed {existingResponse.best_score_percent}% (
        {existingResponse.total_attempts} attempt
        {existingResponse.total_attempts !== 1 ? "s" : ""})
      </span>
    );
  }

  // Error state - no questions
  if (questions.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>Quiz configuration error: No questions available</span>
      </div>
    );
  }

  // Show results screen
  if (showResults && lastAttemptResult) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {lastAttemptResult.passed ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          )}
          <div>
            <p className="text-xs font-medium text-v2-ink">
              {lastAttemptResult.passed ? "Quiz Passed!" : "Quiz Not Passed"}
            </p>
            <p className="text-[10px] text-v2-ink-muted">
              Score: {lastAttemptResult.score}% (required:{" "}
              {metadata.passing_score_percent}%)
            </p>
          </div>
        </div>

        {lastAttemptResult.canRetry && (
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
              {lastAttemptResult.attemptsRemaining !== null
                ? `${lastAttemptResult.attemptsRemaining} attempt(s) remaining`
                : "Unlimited retries"}
            </p>
            <Button
              onClick={handleRetry}
              variant="outline"
              size="sm"
              className="h-7 text-xs px-3 gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        )}

        {!lastAttemptResult.passed && !lastAttemptResult.canRetry && (
          <p className="text-[10px] text-red-600 dark:text-red-400">
            No more attempts. Contact your recruiter.
          </p>
        )}
      </div>
    );
  }

  const currentAnswers = answers[currentQuestion.id] ?? [];
  const hasMultipleCorrect =
    currentQuestion.options.filter((o) => o.is_correct).length > 1;

  return (
    <div className="space-y-2">
      {/* Quiz header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-v2-ink">{metadata.title}</h3>
        <Badge variant="outline" className="h-4 text-[10px] px-1.5">
          {metadata.passing_score_percent}% pass
        </Badge>
      </div>

      {/* Progress */}
      <div className="space-y-0.5">
        <div className="flex justify-between text-[10px] text-v2-ink-muted">
          <span>
            Q{currentQuestionIndex + 1}/{totalQuestions}
          </span>
          <span>
            {Object.keys(answers).length}/{totalQuestions} answered
          </span>
        </div>
        <Progress
          value={((currentQuestionIndex + 1) / totalQuestions) * 100}
          className="h-1"
        />
      </div>

      {/* Question */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-v2-ink">
          {currentQuestion.question_text}
        </p>
        {hasMultipleCorrect && (
          <p className="text-[10px] text-v2-ink-muted">Select all that apply</p>
        )}

        {/* Options */}
        <div className="space-y-1">
          {displayOptions.map((option) => {
            const isSelected = currentAnswers.includes(option.id);

            return (
              <div
                key={option.id}
                className={`flex items-start gap-2 p-1.5 rounded border cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-primary/10 border-primary"
                    : "bg-white  border-v2-ring hover:border-v2-ring"
                }`}
                onClick={() =>
                  handleToggleOption(
                    currentQuestion.id,
                    option.id,
                    hasMultipleCorrect,
                  )
                }
              >
                {hasMultipleCorrect ? (
                  <Checkbox checked={isSelected} className="mt-0.5" />
                ) : (
                  <div
                    className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                      isSelected
                        ? "border-primary bg-primary"
                        : "border-v2-ring "
                    }`}
                  >
                    {isSelected && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                )}
                <span className="text-xs text-v2-ink">{option.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrev}
          disabled={currentQuestionIndex === 0}
          className="h-7 text-xs px-3 gap-1.5"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </Button>

        <div className="flex items-center gap-2">
          {metadata.time_limit_minutes && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400">
              {metadata.time_limit_minutes}min limit
            </span>
          )}

          {currentQuestionIndex === totalQuestions - 1 ? (
            <Button
              onClick={handleSubmitQuiz}
              disabled={
                isSubmitting || Object.keys(answers).length < totalQuestions
              }
              size="sm"
              className="h-7 text-xs px-3 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Submit
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              className="h-7 text-xs px-3 gap-1.5"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
