import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  useSubmitQuizAttempt,
  useQuizAttempts,
} from "../../hooks/useQuizAttempts";
import type {
  TrainingQuizWithQuestions,
  SubmitQuizAttemptResult,
} from "../../types/training-module.types";
import { QuizResults } from "./QuizResults";
import { ChevronRight, Send, Loader2 } from "lucide-react";

interface QuizPlayerProps {
  quiz: TrainingQuizWithQuestions;
  lessonId: string;
  moduleId: string;
}

export function QuizPlayer({ quiz, lessonId: _lessonId }: QuizPlayerProps) {
  const { data: previousAttempts = [] } = useQuizAttempts(quiz.id);
  const submitAttempt = useSubmitQuizAttempt();

  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<string, string[]>
  >({});
  const [startTime] = useState(Date.now());
  const [result, setResult] = useState<SubmitQuizAttemptResult | null>(null);
  const [showResults, setShowResults] = useState(false);

  const questions = quiz.questions;
  const question = questions[currentQ];
  const canRetake =
    quiz.max_attempts === 0 || previousAttempts.length < quiz.max_attempts;

  const handleSelectOption = useCallback(
    (optionId: string) => {
      if (!question) return;
      // For single-answer question types, replace the selection
      if (
        question.question_type === "true_false" ||
        question.question_type === "multiple_choice"
      ) {
        setSelectedAnswers((prev) => ({ ...prev, [question.id]: [optionId] }));
      }
    },
    [question],
  );

  const handleSubmit = useCallback(async () => {
    const answers = questions.map((q) => ({
      question_id: q.id,
      selected_option_ids: selectedAnswers[q.id] || [],
    }));

    const timeTaken = Math.round((Date.now() - startTime) / 1000);
    const res = await submitAttempt.mutateAsync({
      quizId: quiz.id,
      answers,
      timeTakenSeconds: timeTaken,
    });
    setResult(res);
    setShowResults(true);
  }, [questions, selectedAnswers, startTime, submitAttempt, quiz.id]);

  const handleRetake = useCallback(() => {
    setShowResults(false);
    setCurrentQ(0);
    setSelectedAnswers({});
    setResult(null);
  }, []);

  if (showResults && result) {
    return (
      <QuizResults
        result={result}
        quiz={quiz}
        onRetake={canRetake ? handleRetake : undefined}
      />
    );
  }

  // Quiz has no questions yet — show a placeholder instead of a blank page.
  if (questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center space-y-2">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Quiz not ready
        </h3>
        <p className="text-xs text-zinc-500">
          This quiz doesn't have any questions yet. Please check back later or
          contact your trainer.
        </p>
      </div>
    );
  }

  if (!question) return null;

  const selectedForQ = selectedAnswers[question.id] || [];

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between text-[11px] text-zinc-500">
        <span>
          Question {currentQ + 1} of {questions.length}
        </span>
        <span>{quiz.pass_threshold}% needed to pass</span>
      </div>

      <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-1">
        <div
          className="h-1 rounded-full bg-blue-500 transition-all"
          style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {question.question_text}
        </h3>

        <div className="space-y-1.5">
          {question.options?.map((option) => {
            const isSelected = selectedForQ.includes(option.id);
            return (
              <button
                key={option.id}
                onClick={() => handleSelectOption(option.id)}
                className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                    : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                }`}
              >
                {option.option_text}
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={currentQ === 0}
          onClick={() => setCurrentQ(currentQ - 1)}
        >
          Previous
        </Button>

        {currentQ < questions.length - 1 ? (
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={selectedForQ.length === 0}
            onClick={() => setCurrentQ(currentQ + 1)}
          >
            Next <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={
              Object.keys(selectedAnswers).length < questions.length ||
              submitAttempt.isPending
            }
            onClick={handleSubmit}
          >
            {submitAttempt.isPending ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Send className="h-3 w-3 mr-1" />
            )}
            Submit
          </Button>
        )}
      </div>
    </div>
  );
}
