import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PromptWizardFormData } from "../../../lib/prompt-wizard-types";

interface QualificationSectionProps {
  data: Pick<PromptWizardFormData, "qualificationQuestions">;
  onChange: (patch: Partial<PromptWizardFormData>) => void;
}

export function QualificationSection({
  data,
  onChange,
}: QualificationSectionProps) {
  const questions = data.qualificationQuestions;

  const updateQuestion = (index: number, value: string) => {
    const next = [...questions];
    next[index] = value;
    onChange({ qualificationQuestions: next });
  };

  const removeQuestion = (index: number) => {
    onChange({
      qualificationQuestions: questions.filter((_, i) => i !== index),
    });
  };

  const addQuestion = () => {
    onChange({ qualificationQuestions: [...questions, ""] });
  };

  const moveQuestion = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ qualificationQuestions: next });
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
        These questions help qualify the caller before connecting them with you.
        The agent asks them naturally during the conversation.
      </p>

      <div className="space-y-2">
        {questions.map((q, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="w-5 text-right text-[10px] font-medium text-v2-ink-subtle flex-shrink-0">
              {i + 1}.
            </span>
            <Input
              value={q}
              onChange={(e) => updateQuestion(i, e.target.value)}
              placeholder="Type a question..."
              className="h-8 text-xs flex-1"
            />
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => moveQuestion(i, -1)}
                disabled={i === 0}
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => moveQuestion(i, 1)}
                disabled={i === questions.length - 1}
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-v2-ink-subtle hover:text-red-500"
                onClick={() => removeQuestion(i)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-[11px]"
        onClick={addQuestion}
      >
        <Plus className="h-3 w-3" />
        Add question
      </Button>
    </div>
  );
}
