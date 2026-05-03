// src/features/recruiting/admin/QuizConfig.tsx

import { useState, useRef, useCallback, useEffect } from "react";
import {
  ClipboardCheck,
  Plus,
  Trash2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  GripVertical,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type {
  QuizMetadata,
  QuizQuestion,
  QuizQuestionOption,
  QuizQuestionType,
} from "@/types/recruiting.types";
import { QUIZ_QUESTION_TYPE_LABELS } from "@/types/recruiting.types";
import { createQuizMetadata } from "@/types/checklist-metadata.types";

interface QuizConfigProps {
  metadata: QuizMetadata | null;
  onChange: (metadata: QuizMetadata & { _type: "quiz" }) => void;
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function createEmptyQuestion(): QuizQuestion {
  return {
    id: generateId(),
    question_text: "",
    question_type: "single",
    options: [
      { id: generateId(), label: "", is_correct: false },
      { id: generateId(), label: "", is_correct: false },
    ],
  };
}

export function QuizConfig({ metadata, onChange }: QuizConfigProps) {
  const [title, setTitle] = useState(metadata?.title ?? "");
  const [description, setDescription] = useState(metadata?.description ?? "");
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    metadata?.questions ?? [createEmptyQuestion()],
  );
  const [passingScorePercent, setPassingScorePercent] = useState(
    metadata?.passing_score_percent ?? 70,
  );
  const [allowRetries, setAllowRetries] = useState(
    metadata?.allow_retries ?? true,
  );
  const [maxRetries, setMaxRetries] = useState<number | undefined>(
    metadata?.max_retries,
  );
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(
    metadata?.show_correct_answers ?? true,
  );
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number | undefined>(
    metadata?.time_limit_minutes,
  );
  const [randomizeQuestions, setRandomizeQuestions] = useState(
    metadata?.randomize_questions ?? false,
  );
  const [randomizeOptions, setRandomizeOptions] = useState(
    metadata?.randomize_options ?? false,
  );

  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(
    new Set(questions.map((q) => q.id)),
  );

  const prevMetadataRef = useRef<string>("");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const notifyChange = useCallback(() => {
    // Validate: need title, at least 1 question with text and 2+ options
    const validQuestions = questions.filter(
      (q) =>
        q.question_text.trim() &&
        q.options.filter((o) => o.label.trim()).length >= 2 &&
        q.options.some((o) => o.is_correct),
    );

    if (!title.trim() || validQuestions.length === 0) {
      return;
    }

    const data: QuizMetadata = {
      title,
      description: description || undefined,
      questions: validQuestions,
      passing_score_percent: passingScorePercent,
      allow_retries: allowRetries,
      max_retries: allowRetries ? maxRetries : undefined,
      show_correct_answers: showCorrectAnswers,
      time_limit_minutes: timeLimitMinutes,
      randomize_questions: randomizeQuestions,
      randomize_options: randomizeOptions,
    };

    const newMetadata = createQuizMetadata(data);
    const metadataString = JSON.stringify(newMetadata);

    if (metadataString !== prevMetadataRef.current) {
      prevMetadataRef.current = metadataString;
      onChangeRef.current(newMetadata);
    }
  }, [
    title,
    description,
    questions,
    passingScorePercent,
    allowRetries,
    maxRetries,
    showCorrectAnswers,
    timeLimitMinutes,
    randomizeQuestions,
    randomizeOptions,
  ]);

  useEffect(() => {
    notifyChange();
  }, [notifyChange]);

  const toggleQuestion = (id: string) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedQuestions(newExpanded);
  };

  const addQuestion = () => {
    const newQ = createEmptyQuestion();
    setQuestions([...questions, newQ]);
    setExpandedQuestions(new Set([...expandedQuestions, newQ.id]));
  };

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const updateQuestion = (
    index: number,
    field: keyof QuizQuestion,
    value: unknown,
  ) => {
    setQuestions(
      questions.map((q, i) => (i === index ? { ...q, [field]: value } : q)),
    );
  };

  const addOption = (questionIndex: number) => {
    const newOptions = [
      ...questions[questionIndex].options,
      { id: generateId(), label: "", is_correct: false },
    ];
    updateQuestion(questionIndex, "options", newOptions);
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const opts = questions[questionIndex].options;
    if (opts.length > 2) {
      updateQuestion(
        questionIndex,
        "options",
        opts.filter((_, i) => i !== optionIndex),
      );
    }
  };

  const updateOption = (
    questionIndex: number,
    optionIndex: number,
    field: keyof QuizQuestionOption,
    value: string | boolean,
  ) => {
    const newOptions = questions[questionIndex].options.map((opt, i) => {
      if (i === optionIndex) {
        // For single-answer questions, uncheck other options when marking one as correct
        if (
          field === "is_correct" &&
          value === true &&
          questions[questionIndex].question_type === "single"
        ) {
          return { ...opt, is_correct: true };
        }
        return { ...opt, [field]: value };
      }
      // Uncheck other options for single-answer
      if (
        field === "is_correct" &&
        value === true &&
        questions[questionIndex].question_type === "single"
      ) {
        return { ...opt, is_correct: false };
      }
      return opt;
    });
    updateQuestion(questionIndex, "options", newOptions);
  };

  const handleNumberChange = (
    value: string,
    setter: (val: number | undefined) => void,
    min?: number,
    max?: number,
  ) => {
    if (value === "") {
      setter(undefined);
    } else {
      let num = parseInt(value, 10);
      if (!isNaN(num)) {
        if (min !== undefined) num = Math.max(min, num);
        if (max !== undefined) num = Math.min(max, num);
        setter(num);
      }
    }
  };

  const validQuestionsCount = questions.filter(
    (q) =>
      q.question_text.trim() &&
      q.options.filter((o) => o.label.trim()).length >= 2 &&
      q.options.some((o) => o.is_correct),
  ).length;

  return (
    <div className="space-y-3 p-2.5 bg-background rounded-md shadow-sm">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Quiz Configuration
        </span>
      </div>

      {/* Title */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
          Quiz Title <span className="text-destructive">*</span>
        </Label>
        <Input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Product Knowledge Quiz"
          className="h-7 text-[11px]"
        />
        {!title.trim() && (
          <div className="flex items-center gap-1 text-[10px] text-warning">
            <AlertCircle className="h-3 w-3" />
            Title is required
          </div>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
          Description (Optional)
        </Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Instructions or context for the quiz..."
          className="min-h-[40px] text-[11px] resize-none"
        />
      </div>

      {/* Quiz Settings */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
            Passing Score (%)
          </Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={passingScorePercent}
            onChange={(e) =>
              handleNumberChange(
                e.target.value,
                (v) => setPassingScorePercent(v ?? 70),
                0,
                100,
              )
            }
            className="h-7 text-[11px]"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
            Time Limit (minutes)
          </Label>
          <Input
            type="number"
            min={1}
            value={timeLimitMinutes ?? ""}
            onChange={(e) =>
              handleNumberChange(e.target.value, setTimeLimitMinutes, 1)
            }
            placeholder="No limit"
            className="h-7 text-[11px]"
          />
        </div>
      </div>

      {/* Retry Settings */}
      <div className="flex items-center justify-between py-1">
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
            Allow Retries
          </Label>
          <p className="text-[9px] text-muted-foreground">
            Let recruit retry if they fail
          </p>
        </div>
        <Switch
          checked={allowRetries}
          onCheckedChange={setAllowRetries}
          className="scale-75"
        />
      </div>

      {allowRetries && (
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
            Max Retries
          </Label>
          <Input
            type="number"
            min={1}
            value={maxRetries ?? ""}
            onChange={(e) =>
              handleNumberChange(e.target.value, setMaxRetries, 1)
            }
            placeholder="Unlimited"
            className="h-7 text-[11px]"
          />
        </div>
      )}

      {/* Show Correct Answers */}
      <div className="flex items-center justify-between py-1">
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
            Show Correct Answers
          </Label>
          <p className="text-[9px] text-muted-foreground">
            Show corrections after quiz completion
          </p>
        </div>
        <Switch
          checked={showCorrectAnswers}
          onCheckedChange={setShowCorrectAnswers}
          className="scale-75"
        />
      </div>

      {/* Randomization */}
      <div className="flex gap-4">
        <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Checkbox
            checked={randomizeQuestions}
            onCheckedChange={(c) => setRandomizeQuestions(c === true)}
            className="h-3 w-3"
          />
          Randomize Questions
        </label>
        <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Checkbox
            checked={randomizeOptions}
            onCheckedChange={(c) => setRandomizeOptions(c === true)}
            className="h-3 w-3"
          />
          Randomize Options
        </label>
      </div>

      {/* Questions */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
            Questions <span className="text-destructive">*</span>
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addQuestion}
            className="h-6 text-[10px] gap-1"
          >
            <Plus className="h-3 w-3" />
            Add Question
          </Button>
        </div>

        <div className="space-y-2">
          {questions.map((question, qIndex) => (
            <Collapsible
              key={question.id}
              open={expandedQuestions.has(question.id)}
              onOpenChange={() => toggleQuestion(question.id)}
            >
              <div className="border rounded bg-card">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center gap-2 p-2 cursor-pointer hover:bg-background">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                    {expandedQuestions.has(question.id) ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="flex-1 text-[11px] font-medium truncate">
                      {question.question_text || `Question ${qIndex + 1}`}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeQuestion(qIndex);
                      }}
                      disabled={questions.length <= 1}
                      className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="p-2 pt-0 space-y-2 border-t">
                    {/* Question Text */}
                    <div className="space-y-1">
                      <Label className="text-[9px] text-muted-foreground">
                        Question Text
                      </Label>
                      <Textarea
                        value={question.question_text}
                        onChange={(e) =>
                          updateQuestion(
                            qIndex,
                            "question_text",
                            e.target.value,
                          )
                        }
                        placeholder="Enter the question..."
                        className="min-h-[40px] text-[11px] resize-none"
                      />
                    </div>

                    {/* Question Type */}
                    <div className="space-y-1">
                      <Label className="text-[9px] text-muted-foreground">
                        Answer Type
                      </Label>
                      <Select
                        value={question.question_type}
                        onValueChange={(value: QuizQuestionType) =>
                          updateQuestion(qIndex, "question_type", value)
                        }
                      >
                        <SelectTrigger className="h-6 text-[10px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(QUIZ_QUESTION_TYPE_LABELS).map(
                            ([value, label]) => (
                              <SelectItem
                                key={value}
                                value={value}
                                className="text-[10px]"
                              >
                                {label}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Options */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-[9px] text-muted-foreground">
                          Options (mark correct ones)
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => addOption(qIndex)}
                          className="h-5 text-[9px] gap-0.5"
                        >
                          <Plus className="h-2.5 w-2.5" />
                          Add
                        </Button>
                      </div>

                      <div className="space-y-1">
                        {question.options.map((option, oIndex) => (
                          <div
                            key={option.id}
                            className="flex items-center gap-1.5"
                          >
                            <Checkbox
                              checked={option.is_correct}
                              onCheckedChange={(checked) =>
                                updateOption(
                                  qIndex,
                                  oIndex,
                                  "is_correct",
                                  checked === true,
                                )
                              }
                              className="h-3 w-3"
                            />
                            <Input
                              type="text"
                              value={option.label}
                              onChange={(e) =>
                                updateOption(
                                  qIndex,
                                  oIndex,
                                  "label",
                                  e.target.value,
                                )
                              }
                              placeholder={`Option ${oIndex + 1}`}
                              className="h-6 text-[10px] flex-1"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeOption(qIndex, oIndex)}
                              disabled={question.options.length <= 2}
                              className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Explanation */}
                    <div className="space-y-1">
                      <Label className="text-[9px] text-muted-foreground">
                        Explanation (shown after answer)
                      </Label>
                      <Input
                        type="text"
                        value={question.explanation ?? ""}
                        onChange={(e) =>
                          updateQuestion(qIndex, "explanation", e.target.value)
                        }
                        placeholder="Optional explanation..."
                        className="h-6 text-[10px]"
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>

        {validQuestionsCount === 0 && (
          <div className="flex items-center gap-1 text-[10px] text-warning">
            <AlertCircle className="h-3 w-3" />
            Add at least 1 question with text, 2+ options, and 1+ correct answer
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="p-2 bg-info/10 rounded border border-info/30">
        <p className="text-[9px] text-info">
          <strong>Summary:</strong> {validQuestionsCount} valid question(s),{" "}
          {passingScorePercent}% to pass
          {timeLimitMinutes && `, ${timeLimitMinutes} min limit`}
          {allowRetries && ", retries allowed"}
        </p>
      </div>
    </div>
  );
}
