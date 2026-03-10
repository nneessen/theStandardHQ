// src/features/underwriting/components/WizardSteps/HealthConditionsStep.tsx

import { useState, useMemo, useCallback } from "react";
import {
  Search,
  ChevronDown,
  ChevronRight,
  X,
  Check,
  AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";
import {
  useHealthConditions,
  parseFollowUpSchema,
  groupConditionsByCategory,
} from "../../../hooks/shared/useHealthConditions";
import { isFollowUpValueAnswered } from "../../../utils/wizard/follow-up-validation";
import type {
  HealthInfo,
  ConditionResponse,
  HealthCondition,
  FollowUpQuestion,
  ConditionCategory,
} from "../../../types/underwriting.types";
import { CONDITION_CATEGORY_LABELS } from "../../../types/underwriting.types";

interface HealthConditionsStepProps {
  data: HealthInfo;
  onChange: (updates: Partial<HealthInfo>) => void;
  errors: Record<string, string>;
}

export default function HealthConditionsStep({
  data,
  onChange,
  errors,
}: HealthConditionsStepProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [activeConditionCode, setActiveConditionCode] = useState<string | null>(
    null,
  );

  const { data: conditions = [], isLoading, error } = useHealthConditions();

  const groupedConditions = useMemo(
    () => groupConditionsByCategory(conditions),
    [conditions],
  );

  // Filter and auto-expand categories when searching
  const { filteredGroups, matchingCategories } = useMemo(() => {
    if (!searchTerm.trim()) {
      return {
        filteredGroups: groupedConditions,
        matchingCategories: new Set<string>(),
      };
    }

    const term = searchTerm.toLowerCase();
    const filtered: Record<ConditionCategory, HealthCondition[]> = {} as Record<
      ConditionCategory,
      HealthCondition[]
    >;
    const matching = new Set<string>();

    Object.entries(groupedConditions).forEach(([category, items]) => {
      const matchingItems = items.filter(
        (item) =>
          item.name.toLowerCase().includes(term) ||
          item.code.toLowerCase().includes(term),
      );
      if (matchingItems.length > 0) {
        filtered[category as ConditionCategory] = matchingItems;
        matching.add(category);
      }
    });

    return { filteredGroups: filtered, matchingCategories: matching };
  }, [groupedConditions, searchTerm]);

  const selectedConditionCodes = useMemo(
    () => new Set(data.conditions.map((c) => c.conditionCode)),
    [data.conditions],
  );

  // Get the active condition for follow-up panel
  const activeCondition = useMemo(() => {
    if (!activeConditionCode) return null;
    return conditions.find((c) => c.code === activeConditionCode) || null;
  }, [activeConditionCode, conditions]);

  const activeConditionResponses = useMemo(() => {
    if (!activeConditionCode) return {};
    return (
      data.conditions.find((c) => c.conditionCode === activeConditionCode)
        ?.responses || {}
    );
  }, [activeConditionCode, data.conditions]);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const toggleCondition = useCallback(
    (condition: HealthCondition) => {
      const isSelected = selectedConditionCodes.has(condition.code);

      if (isSelected) {
        onChange({
          conditions: data.conditions.filter(
            (c) => c.conditionCode !== condition.code,
          ),
        });
        if (activeConditionCode === condition.code) {
          setActiveConditionCode(null);
        }
      } else {
        const newCondition: ConditionResponse = {
          conditionCode: condition.code,
          conditionName: condition.name,
          responses: {},
        };
        onChange({ conditions: [...data.conditions, newCondition] });
        // Auto-open follow-up panel for newly selected condition
        const schema = parseFollowUpSchema(condition);
        if (schema.questions.length > 0) {
          setActiveConditionCode(condition.code);
        }
      }
    },
    [selectedConditionCodes, data.conditions, onChange, activeConditionCode],
  );

  const updateConditionResponses = useCallback(
    (code: string, responses: Record<string, string | number | string[]>) => {
      const updatedConditions = data.conditions.map((c) =>
        c.conditionCode === code ? { ...c, responses } : c,
      );
      onChange({ conditions: updatedConditions });
    },
    [data.conditions, onChange],
  );

  const updateTobacco = useCallback(
    (updates: Partial<HealthInfo["tobacco"]>) => {
      onChange({ tobacco: { ...data.tobacco, ...updates } });
    },
    [data.tobacco, onChange],
  );

  // Check if category should be expanded
  const isCategoryExpanded = (category: string) => {
    // Auto-expand if search matches this category
    if (searchTerm.trim() && matchingCategories.has(category)) return true;
    // Auto-expand if has selected conditions
    const items = groupedConditions[category as ConditionCategory] || [];
    if (items.some((item) => selectedConditionCodes.has(item.code)))
      return true;
    // Manual expand
    return expandedCategories.has(category);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-zinc-500">
        Loading health conditions...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-300">
        Unable to load health conditions. Retry before using the wizard for
        underwriting screening.
      </div>
    );
  }

  const activeSchema = activeCondition
    ? parseFollowUpSchema(activeCondition)
    : null;
  const hasActiveFollowUps = activeSchema && activeSchema.questions.length > 0;

  return (
    <div className="flex gap-4 p-1 h-full">
      {/* Left Panel - Conditions List */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
          Select health conditions. Follow-up questions appear on the right.
        </div>

        {errors.health && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-300">
            <div className="font-medium">{errors.health}</div>
            {errors.healthDetails && (
              <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                {errors.healthDetails}
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Search conditions (e.g., diabetes, cancer)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>

        {/* Conditions List - Flex grow to fill available space */}
        <div className="flex-1 min-h-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg divide-y divide-zinc-200 dark:divide-zinc-700 overflow-y-auto shadow-sm">
          {Object.entries(filteredGroups).map(([category, items]) => (
            <Collapsible key={category} open={isCategoryExpanded(category)}>
              <CollapsibleTrigger
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {CONDITION_CATEGORY_LABELS[category as ConditionCategory] ||
                    category}
                </span>
                <div className="flex items-center gap-2">
                  {items.some((item) =>
                    selectedConditionCodes.has(item.code),
                  ) && (
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                      {
                        items.filter((item) =>
                          selectedConditionCodes.has(item.code),
                        ).length
                      }{" "}
                      selected
                    </span>
                  )}
                  {isCategoryExpanded(category) ? (
                    <ChevronDown className="h-4 w-4 text-zinc-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-zinc-400" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 py-2 bg-white dark:bg-zinc-900 grid grid-cols-2 gap-2">
                  {items.map((condition) => {
                    const isSelected = selectedConditionCodes.has(
                      condition.code,
                    );
                    const schema = parseFollowUpSchema(condition);
                    const hasFollowUps = schema.questions.length > 0;
                    const conditionResponses =
                      data.conditions.find(
                        (c) => c.conditionCode === condition.code,
                      )?.responses || {};
                    const hasUnanswered =
                      hasFollowUps &&
                      isSelected &&
                      schema.questions.some(
                        (q) =>
                          q.required &&
                          !isFollowUpValueAnswered(q, conditionResponses[q.id]),
                      );

                    return (
                      <div
                        key={condition.code}
                        className={cn(
                          "flex items-center gap-2 py-2 px-2.5 rounded-md cursor-pointer transition-all border",
                          isSelected
                            ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                            : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600",
                          activeConditionCode === condition.code &&
                            "ring-2 ring-amber-400 ring-offset-1",
                        )}
                        onClick={() => {
                          if (!isSelected) {
                            toggleCondition(condition);
                          } else if (hasFollowUps) {
                            setActiveConditionCode(condition.code);
                          }
                        }}
                      >
                        <div
                          className={cn(
                            "flex items-center justify-center w-4 h-4 rounded border-2 transition-colors flex-shrink-0",
                            isSelected
                              ? "bg-blue-600 border-blue-600"
                              : "bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-600",
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCondition(condition);
                          }}
                        >
                          {isSelected && (
                            <Check className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-sm truncate",
                            isSelected
                              ? "text-zinc-800 dark:text-zinc-200 font-medium"
                              : "text-zinc-600 dark:text-zinc-400",
                          )}
                        >
                          {condition.name}
                        </span>
                        {hasUnanswered && (
                          <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>

        {/* Selected Summary */}
        {data.conditions.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">
              Selected Conditions ({data.conditions.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.conditions.map((c) => (
                <span
                  key={c.conditionCode}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-zinc-800 border rounded-md text-xs cursor-pointer transition-colors",
                    activeConditionCode === c.conditionCode
                      ? "border-amber-400 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400"
                      : "border-blue-200 dark:border-blue-700 text-zinc-700 dark:text-zinc-300 hover:border-blue-300",
                  )}
                  onClick={() => {
                    const cond = conditions.find(
                      (x) => x.code === c.conditionCode,
                    );
                    if (cond) {
                      const schema = parseFollowUpSchema(cond);
                      if (schema.questions.length > 0) {
                        setActiveConditionCode(c.conditionCode);
                      }
                    }
                  }}
                >
                  {c.conditionName}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange({
                        conditions: data.conditions.filter(
                          (cond) => cond.conditionCode !== c.conditionCode,
                        ),
                      });
                      if (activeConditionCode === c.conditionCode) {
                        setActiveConditionCode(null);
                      }
                    }}
                    className="text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tobacco Section */}
        <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg">
            <Checkbox
              id="tobacco"
              checked={data.tobacco.currentUse}
              onCheckedChange={(checked) =>
                updateTobacco({ currentUse: checked === true })
              }
            />
            <Label
              htmlFor="tobacco"
              className="text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer"
            >
              Currently uses tobacco/nicotine
            </Label>
          </div>
          {data.tobacco.currentUse && (
            <div className="mt-3 ml-0 grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-500">
                  Type
                </Label>
                <Select
                  value={data.tobacco.type || ""}
                  onValueChange={(value) =>
                    updateTobacco({
                      type: value as HealthInfo["tobacco"]["type"],
                    })
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cigarettes">Cigarettes</SelectItem>
                    <SelectItem value="cigars">Cigars</SelectItem>
                    <SelectItem value="vape">Vape</SelectItem>
                    <SelectItem value="chewing">Chewing</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-500">
                  Frequency
                </Label>
                <Select
                  value={data.tobacco.frequency || ""}
                  onValueChange={(value) => updateTobacco({ frequency: value })}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="occasionally">Occasionally</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Follow-up Questions */}
      <div className="w-[320px] flex-shrink-0">
        <div className="sticky top-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 min-h-[320px] shadow-sm">
          {hasActiveFollowUps && activeCondition ? (
            <>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-200 dark:border-zinc-700">
                <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 truncate pr-2">
                  {activeCondition.name}
                </div>
                <button
                  onClick={() => setActiveConditionCode(null)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4">
                {activeSchema.questions.map((question) => (
                  <FollowUpQuestionField
                    key={question.id}
                    question={question}
                    value={activeConditionResponses[question.id]}
                    onChange={(value) =>
                      updateConditionResponses(
                        activeConditionCode!,
                        value === undefined
                          ? Object.fromEntries(
                              Object.entries(activeConditionResponses).filter(
                                ([key]) => key !== question.id,
                              ),
                            )
                          : {
                              ...activeConditionResponses,
                              [question.id]: value,
                            },
                      )
                    }
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-10">
              <AlertCircle className="h-8 w-8 text-zinc-300 dark:text-zinc-600 mb-3" />
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mb-1">
                No Follow-up Questions
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                {data.conditions.length === 0
                  ? "Select a condition from the list"
                  : "Click a selected condition to answer follow-up questions"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Follow-up question field component
interface FollowUpQuestionFieldProps {
  question: FollowUpQuestion;
  value: string | number | string[] | undefined;
  onChange: (value: string | number | string[] | undefined) => void;
}

/** Sort options alphabetically, keeping catch-all values ("Other", "Unknown", "N/A", "None") at the end */
function sortOptions(options: string[] | undefined): string[] {
  if (!options) return [];
  const tailValues = new Set(["Other", "Unknown", "N/A", "None"]);
  const main = options.filter((o) => !tailValues.has(o));
  const tail = options.filter((o) => tailValues.has(o));
  return [
    ...main.sort((a, b) => a.localeCompare(b)),
    ...tail.sort((a, b) => a.localeCompare(b)),
  ];
}

function FollowUpQuestionField({
  question,
  value,
  onChange,
}: FollowUpQuestionFieldProps) {
  const sortedOptions = useMemo(
    () => sortOptions(question.options),
    [question.options],
  );

  const renderField = () => {
    switch (question.type) {
      case "select":
        return (
          <Select
            value={(value as string) || ""}
            onValueChange={(nextValue) => onChange(nextValue || undefined)}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select an option..." />
            </SelectTrigger>
            <SelectContent>
              {sortedOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "multiselect": {
        const selectedValues = (value as string[]) || [];
        return (
          <div className="space-y-2 max-h-[150px] overflow-y-auto p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-md border border-zinc-200 dark:border-zinc-700">
            {sortedOptions.map((option) => (
              <div key={option} className="flex items-center gap-2">
                <Checkbox
                  id={`${question.id}-${option}`}
                  checked={selectedValues.includes(option)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onChange([...selectedValues, option]);
                    } else {
                      onChange(selectedValues.filter((v) => v !== option));
                    }
                  }}
                />
                <Label
                  htmlFor={`${question.id}-${option}`}
                  className="text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer"
                >
                  {option}
                </Label>
              </div>
            ))}
          </div>
        );
      }

      case "number":
        return (
          <Input
            type="number"
            min={question.min}
            max={question.max}
            step={question.step || 1}
            value={typeof value === "number" ? value : ""}
            onChange={(e) => {
              if (e.target.value === "") {
                onChange(undefined);
                return;
              }

              const parsed = Number(e.target.value);
              onChange(Number.isFinite(parsed) ? parsed : undefined);
            }}
            className="h-9 text-sm"
          />
        );

      case "date":
        return (
          <Input
            type="date"
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value || undefined)}
            className="h-9 text-sm"
          />
        );

      case "text":
      default:
        return (
          <Input
            type="text"
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value || undefined)}
            className="h-9 text-sm"
            placeholder="Enter response..."
          />
        );
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
        {question.label}
        {question.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {renderField()}
    </div>
  );
}
