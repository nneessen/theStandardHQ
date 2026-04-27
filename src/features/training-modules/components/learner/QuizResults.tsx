import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RotateCcw, Trophy } from "lucide-react";
import type {
  SubmitQuizAttemptResult,
  TrainingQuizWithQuestions,
} from "../../types/training-module.types";

interface QuizResultsProps {
  result: SubmitQuizAttemptResult;
  quiz: TrainingQuizWithQuestions;
  onRetake?: () => void;
}

export function QuizResults({ result, quiz, onRetake }: QuizResultsProps) {
  return (
    <div className="max-w-lg mx-auto p-6 text-center space-y-4">
      {result.passed ? (
        <>
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              {result.score_percentage === 100 ? (
                <Trophy className="h-8 w-8 text-amber-500" />
              ) : (
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              )}
            </div>
          </div>
          <h2 className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
            {result.score_percentage === 100 ? "Perfect Score!" : "Passed!"}
          </h2>
        </>
      ) : (
        <>
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </div>
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">
            Not Quite
          </h2>
        </>
      )}

      <div className="space-y-1">
        <div className="text-3xl font-bold text-v2-ink dark:text-v2-ink">
          {Math.round(result.score_percentage)}%
        </div>
        <div className="text-xs text-v2-ink-muted">
          {result.score_points}/{result.max_points} points
        </div>
        {result.xp_earned > 0 && (
          <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            +{result.xp_earned} XP earned
          </div>
        )}
      </div>

      {/* Answer review */}
      {quiz.show_correct_answers && (
        <div className="text-left space-y-2 pt-4 border-t border-v2-ring dark:border-v2-ring">
          {result.answers.map((answer, i) => {
            const question = quiz.questions[i];
            return (
              <div
                key={answer.question_id}
                className="flex items-start gap-2 text-xs"
              >
                {answer.is_correct ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <span className="text-v2-ink dark:text-v2-ink-muted">
                    {question?.question_text}
                  </span>
                  {!answer.is_correct && question?.explanation && (
                    <p className="text-[10px] text-v2-ink-muted mt-0.5">
                      {question.explanation}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {onRetake && !result.passed && (
        <Button variant="outline" onClick={onRetake} className="h-8 text-xs">
          <RotateCcw className="h-3 w-3 mr-1.5" /> Try Again
        </Button>
      )}
    </div>
  );
}
