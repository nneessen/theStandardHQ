// src/features/training-modules/components/admin/QuizBuilder.tsx
import { useCallback, useState } from "react";
import {
  Plus,
  Loader2,
  Trash2,
  GripVertical,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useTrainingQuiz,
  useCreateQuiz,
  useUpdateQuiz,
  useCreateQuestion,
  useUpdateQuestion,
  useDeleteQuestion,
  useCreateOption,
  useUpdateOption,
  useDeleteOption,
} from "../../hooks/useTrainingQuizzes";
import { useDebouncedField } from "../../hooks/useDebouncedField";
import { QUESTION_TYPES } from "../../types/training-module.types";
import type {
  TrainingQuiz,
  TrainingQuizWithQuestions,
  TrainingQuizQuestion,
  TrainingQuizOption,
  QuestionType,
  CreateQuizInput,
  CreateQuestionInput,
} from "../../types/training-module.types";

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: "Multiple Choice",
  true_false: "True / False",
};

interface QuizBuilderProps {
  lessonId: string;
}

export function QuizBuilder({ lessonId }: QuizBuilderProps) {
  const { data: quiz, isLoading } = useTrainingQuiz(lessonId);
  const createQuiz = useCreateQuiz();

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="text-center py-6 space-y-2">
        <p className="text-[11px] text-v2-ink-muted">
          No quiz created for this lesson yet.
        </p>
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={() => createQuiz.mutate({ lesson_id: lessonId })}
          disabled={createQuiz.isPending}
        >
          {createQuiz.isPending ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Plus className="h-3 w-3 mr-1" />
          )}
          Create Quiz
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <QuizSettingsEditor quiz={quiz} lessonId={lessonId} />

      <div className="border-t border-v2-ring dark:border-v2-ring" />

      <QuestionList
        quizId={quiz.id}
        lessonId={lessonId}
        questions={quiz.questions || []}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Quiz settings — each typable field owns its own useDebouncedField so the
// input is locally-authoritative and only saves ~500ms after the user pauses.
// Checkboxes stay direct (single-click mutations can't produce typing glitches).
// ----------------------------------------------------------------------------

function QuizSettingsEditor({
  quiz,
  lessonId,
}: {
  quiz: TrainingQuiz | TrainingQuizWithQuestions;
  lessonId: string;
}) {
  const updateQuiz = useUpdateQuiz();

  // Loose-typed patch — widens the Partial<CreateQuizInput> mutation input
  // so we can pass `null` to clear nullable columns (e.g., time_limit_minutes).
  const save = useCallback(
    (patch: Record<string, unknown>) => {
      updateQuiz.mutate({
        id: quiz.id,
        lessonId,
        input: patch as Partial<CreateQuizInput>,
      });
    },
    [updateQuiz, quiz.id, lessonId],
  );

  const savePassThreshold = useCallback(
    (v: string) => save({ pass_threshold: Number(v) || 70 }),
    [save],
  );
  const saveMaxAttempts = useCallback(
    (v: string) => save({ max_attempts: Number(v) || 3 }),
    [save],
  );
  const saveTimeLimit = useCallback(
    (v: string) => save({ time_limit_minutes: v ? Number(v) : null }),
    [save],
  );
  const saveXpBonus = useCallback(
    (v: string) => save({ xp_bonus_perfect: Number(v) || 0 }),
    [save],
  );

  const [passThreshold, setPassThreshold] = useDebouncedField(
    String(quiz.pass_threshold),
    savePassThreshold,
  );
  const [maxAttempts, setMaxAttempts] = useDebouncedField(
    String(quiz.max_attempts),
    saveMaxAttempts,
  );
  const [timeLimit, setTimeLimit] = useDebouncedField(
    quiz.time_limit_minutes != null ? String(quiz.time_limit_minutes) : "",
    saveTimeLimit,
  );
  const [xpBonus, setXpBonus] = useDebouncedField(
    String(quiz.xp_bonus_perfect),
    saveXpBonus,
  );

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-v2-ink dark:text-v2-ink-muted">
        Quiz Settings
      </h3>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] text-v2-ink-muted">
            Pass Threshold (%)
          </label>
          <Input
            type="number"
            min={0}
            max={100}
            value={passThreshold}
            onChange={(e) => setPassThreshold(e.target.value)}
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-v2-ink-muted">Max Attempts</label>
          <Input
            type="number"
            min={1}
            value={maxAttempts}
            onChange={(e) => setMaxAttempts(e.target.value)}
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-v2-ink-muted">
            Time Limit (min)
          </label>
          <Input
            type="number"
            value={timeLimit}
            onChange={(e) => setTimeLimit(e.target.value)}
            className="h-7 text-xs"
            placeholder="None"
          />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <label className="flex items-center gap-1.5 text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
          <input
            type="checkbox"
            checked={quiz.shuffle_questions}
            onChange={(e) => save({ shuffle_questions: e.target.checked })}
            className="h-3 w-3 rounded"
          />
          Shuffle Questions
        </label>
        <label className="flex items-center gap-1.5 text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
          <input
            type="checkbox"
            checked={quiz.shuffle_options}
            onChange={(e) => save({ shuffle_options: e.target.checked })}
            className="h-3 w-3 rounded"
          />
          Shuffle Options
        </label>
        <label className="flex items-center gap-1.5 text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
          <input
            type="checkbox"
            checked={quiz.show_correct_answers}
            onChange={(e) => save({ show_correct_answers: e.target.checked })}
            className="h-3 w-3 rounded"
          />
          Show Answers
        </label>
        <div className="space-y-1">
          <label className="text-[10px] text-v2-ink-muted">
            Perfect Score XP
          </label>
          <Input
            type="number"
            value={xpBonus}
            onChange={(e) => setXpBonus(e.target.value)}
            className="h-7 text-xs"
          />
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Questions
// ----------------------------------------------------------------------------

function QuestionList({
  quizId,
  lessonId,
  questions,
}: {
  quizId: string;
  lessonId: string;
  questions: TrainingQuizQuestion[];
}) {
  const createQuestion = useCreateQuestion();

  const handleAddQuestion = () => {
    createQuestion.mutate({
      input: {
        quiz_id: quizId,
        question_text: "New Question",
        question_type: "multiple_choice",
        sort_order: questions.length,
        points: 1,
      },
      lessonId,
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-v2-ink dark:text-v2-ink-muted">
          Questions ({questions.length})
        </h3>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[10px]"
          onClick={handleAddQuestion}
          disabled={createQuestion.isPending}
        >
          {createQuestion.isPending ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Plus className="h-3 w-3 mr-1" />
          )}
          Add Question
        </Button>
      </div>

      {questions.length === 0 ? (
        <div className="text-center py-4 text-[10px] text-v2-ink-subtle border border-dashed border-v2-ring dark:border-v2-ring rounded-lg">
          No questions yet. Add one above.
        </div>
      ) : (
        <div className="space-y-2">
          {questions
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((question, index) => (
              <QuestionEditor
                key={question.id}
                question={question}
                index={index}
                lessonId={lessonId}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function QuestionEditor({
  question,
  index,
  lessonId,
}: {
  question: TrainingQuizQuestion;
  index: number;
  lessonId: string;
}) {
  const updateQuestion = useUpdateQuestion();
  const deleteQuestion = useDeleteQuestion();
  const [expanded, setExpanded] = useState(true);

  // Loose-typed patch for same reason as QuizSettingsEditor — allows `null`
  // for nullable columns like `explanation`.
  const save = useCallback(
    (patch: Record<string, unknown>) => {
      updateQuestion.mutate({
        id: question.id,
        lessonId,
        input: patch as Partial<Omit<CreateQuestionInput, "quiz_id">>,
      });
    },
    [updateQuestion, question.id, lessonId],
  );

  const saveQuestionText = useCallback(
    (v: string) => save({ question_text: v }),
    [save],
  );
  const savePoints = useCallback(
    (v: string) => save({ points: Number(v) || 1 }),
    [save],
  );
  const saveExplanation = useCallback(
    (v: string) => save({ explanation: v ? v : null }),
    [save],
  );

  const [questionText, setQuestionText] = useDebouncedField(
    question.question_text,
    saveQuestionText,
  );
  const [points, setPoints] = useDebouncedField(
    String(question.points),
    savePoints,
  );
  const [explanation, setExplanation] = useDebouncedField(
    question.explanation ?? "",
    saveExplanation,
  );

  const handleDelete = () => {
    if (!window.confirm("Delete this question and all its options?")) return;
    deleteQuestion.mutate({ id: question.id, lessonId });
  };

  return (
    <div className="border border-v2-ring dark:border-v2-ring rounded-lg bg-v2-card">
      {/* Question header */}
      <div
        className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <GripVertical className="h-3 w-3 text-v2-ink-subtle flex-shrink-0" />
        <span className="text-[10px] font-bold text-v2-ink-subtle flex-shrink-0">
          Q{index + 1}
        </span>
        <span className="text-[11px] text-v2-ink dark:text-v2-ink-muted truncate flex-1">
          {questionText || question.question_text}
        </span>
        <span className="text-[9px] text-v2-ink-subtle">
          {question.points}pt{question.points !== 1 ? "s" : ""}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
        >
          <Trash2 className="h-3 w-3 text-v2-ink-subtle hover:text-destructive" />
        </button>
      </div>

      {expanded && (
        <div className="px-2 pb-2 space-y-2 border-t border-v2-ring dark:border-v2-ring pt-2">
          {/* Question text */}
          <Input
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            className="h-7 text-xs"
            placeholder="Question text"
          />

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-v2-ink-muted">Type</label>
              <select
                value={question.question_type}
                onChange={(e) =>
                  save({ question_type: e.target.value as QuestionType })
                }
                className="w-full h-7 text-xs border border-v2-ring dark:border-v2-ring-strong rounded-md px-2 bg-v2-card"
              >
                {QUESTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {QUESTION_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-v2-ink-muted">Points</label>
              <Input
                type="number"
                min={1}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-v2-ink-muted">
                Explanation
              </label>
              <Input
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                className="h-7 text-xs"
                placeholder="Shown after answer"
              />
            </div>
          </div>

          {/* Options */}
          <OptionList
            questionId={question.id}
            lessonId={lessonId}
            options={question.options || []}
            questionType={question.question_type as QuestionType}
          />
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Options — each row is extracted into its own subcomponent so it can host
// a per-row useDebouncedField (hooks cannot be called inside .map()).
// ----------------------------------------------------------------------------

function OptionList({
  questionId,
  lessonId,
  options,
  questionType,
}: {
  questionId: string;
  lessonId: string;
  options: TrainingQuizOption[];
  questionType: QuestionType;
}) {
  const createOption = useCreateOption();
  const deleteOption = useDeleteOption();

  const handleAddOption = () => {
    createOption.mutate({
      input: {
        question_id: questionId,
        option_text:
          questionType === "true_false"
            ? options.length === 0
              ? "True"
              : "False"
            : "",
        is_correct: false,
        sort_order: options.length,
      },
      lessonId,
    });
  };

  const handleDelete = (optionId: string) => {
    deleteOption.mutate({ id: optionId, lessonId });
  };

  const sorted = [...options].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-medium text-v2-ink-muted">
          Options
        </label>
        {questionType !== "true_false" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-[9px] px-1"
            onClick={handleAddOption}
            disabled={createOption.isPending}
          >
            {createOption.isPending ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : (
              <Plus className="h-2.5 w-2.5 mr-0.5" />
            )}
            Add
          </Button>
        )}
      </div>

      {sorted.map((option) => (
        <OptionRow
          key={option.id}
          option={option}
          lessonId={lessonId}
          questionType={questionType}
          onDelete={handleDelete}
        />
      ))}

      {/* Auto-create True/False options if missing */}
      {questionType === "true_false" && options.length === 0 && (
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[10px] w-full"
          onClick={() => {
            createOption.mutate({
              input: {
                question_id: questionId,
                option_text: "True",
                is_correct: true,
                sort_order: 0,
              },
              lessonId,
            });
            createOption.mutate({
              input: {
                question_id: questionId,
                option_text: "False",
                is_correct: false,
                sort_order: 1,
              },
              lessonId,
            });
          }}
          disabled={createOption.isPending}
        >
          Create True/False Options
        </Button>
      )}
    </div>
  );
}

function OptionRow({
  option,
  lessonId,
  questionType,
  onDelete,
}: {
  option: TrainingQuizOption;
  lessonId: string;
  questionType: QuestionType;
  onDelete: (optionId: string) => void;
}) {
  const updateOption = useUpdateOption();

  const saveText = useCallback(
    (v: string) => {
      updateOption.mutate({
        id: option.id,
        lessonId,
        input: { option_text: v },
      });
    },
    [updateOption, option.id, lessonId],
  );

  const [text, setText] = useDebouncedField(option.option_text, saveText);

  const toggleCorrect = () => {
    updateOption.mutate({
      id: option.id,
      lessonId,
      input: { is_correct: !option.is_correct },
    });
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={toggleCorrect}
        className="flex-shrink-0"
        title={option.is_correct ? "Correct answer" : "Mark as correct"}
      >
        {option.is_correct ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
        ) : (
          <Circle className="h-3.5 w-3.5 text-v2-ink-subtle" />
        )}
      </button>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="h-6 text-[11px] flex-1"
        placeholder="Option text"
      />
      {questionType !== "true_false" && (
        <button onClick={() => onDelete(option.id)}>
          <Trash2 className="h-3 w-3 text-v2-ink-subtle hover:text-destructive" />
        </button>
      )}
    </div>
  );
}
