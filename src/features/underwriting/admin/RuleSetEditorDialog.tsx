import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showToast } from "@/utils/toast";
import {
  useCreateRule,
  useCreateRuleSet,
  useDeleteRule,
  useHealthConditions,
  useUpdateRule,
  useUpdateRuleSet,
  validatePredicate,
  type CreateRuleInput,
  type HealthClass,
  type PredicateGroup,
  type RuleSetScope,
  type RuleSetWithRules,
  type TableRating,
} from "./useUnderwritingAdmin";

const HEALTH_CLASS_OPTIONS: HealthClass[] = [
  "preferred_plus",
  "preferred",
  "standard_plus",
  "standard",
  "substandard",
  "graded",
  "modified",
  "guaranteed_issue",
  "refer",
  "decline",
  "unknown",
];

const TABLE_RATING_OPTIONS: TableRating[] = [
  "none",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
];

const ELIGIBILITY_OPTIONS = ["eligible", "ineligible", "refer"] as const;

const EMPTY_PREDICATE: PredicateGroup = { all: [] };

interface DraftRule {
  // existing rule id when editing; null for newly added rules
  id: string | null;
  name: string;
  description: string;
  priority: number;
  ageBandMin: string;
  ageBandMax: string;
  predicateText: string;
  outcomeEligibility: (typeof ELIGIBILITY_OPTIONS)[number];
  outcomeHealthClass: HealthClass;
  outcomeTableRating: TableRating;
  outcomeReason: string;
}

interface RuleSetEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carrierId: string;
  /** Pass an existing rule_set to edit; omit to create a new one. */
  ruleSet?: RuleSetWithRules;
}

function ruleToDraft(
  rule: RuleSetWithRules["rules"][number] | null,
  index: number,
): DraftRule {
  if (!rule) {
    return {
      id: null,
      name: "",
      description: "",
      priority: index + 1,
      ageBandMin: "",
      ageBandMax: "",
      predicateText: JSON.stringify(EMPTY_PREDICATE, null, 2),
      outcomeEligibility: "eligible",
      outcomeHealthClass: "standard",
      outcomeTableRating: "none",
      outcomeReason: "",
    };
  }
  return {
    id: rule.id,
    name: rule.name ?? "",
    description: rule.description ?? "",
    priority: rule.priority ?? index + 1,
    ageBandMin: rule.age_band_min == null ? "" : String(rule.age_band_min),
    ageBandMax: rule.age_band_max == null ? "" : String(rule.age_band_max),
    predicateText: JSON.stringify(rule.predicate ?? EMPTY_PREDICATE, null, 2),
    outcomeEligibility: (rule.outcome_eligibility ??
      "eligible") as DraftRule["outcomeEligibility"],
    outcomeHealthClass: (rule.outcome_health_class ??
      "standard") as HealthClass,
    outcomeTableRating: (rule.outcome_table_rating ?? "none") as TableRating,
    outcomeReason: rule.outcome_reason ?? "",
  };
}

export function RuleSetEditorDialog({
  open,
  onOpenChange,
  carrierId,
  ruleSet,
}: RuleSetEditorDialogProps) {
  const isEdit = !!ruleSet;
  const { data: conditions = [] } = useHealthConditions();

  const createRuleSet = useCreateRuleSet();
  const updateRuleSet = useUpdateRuleSet();
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();

  const [name, setName] = useState(ruleSet?.name ?? "");
  const [description, setDescription] = useState(ruleSet?.description ?? "");
  const [scope, setScope] = useState<RuleSetScope>(
    (ruleSet?.scope as RuleSetScope) ?? "global",
  );
  const [conditionCode, setConditionCode] = useState<string>(
    ruleSet?.condition_code ?? "",
  );
  const [drafts, setDrafts] = useState<DraftRule[]>(() =>
    ruleSet?.rules?.length
      ? ruleSet.rules.map((r, i) => ruleToDraft(r, i))
      : [ruleToDraft(null, 0)],
  );
  const [topError, setTopError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset internal state when the dialog reopens with a different rule_set
  useEffect(() => {
    if (!open) return;
    setName(ruleSet?.name ?? "");
    setDescription(ruleSet?.description ?? "");
    setScope((ruleSet?.scope as RuleSetScope) ?? "global");
    setConditionCode(ruleSet?.condition_code ?? "");
    setDrafts(
      ruleSet?.rules?.length
        ? ruleSet.rules.map((r, i) => ruleToDraft(r, i))
        : [ruleToDraft(null, 0)],
    );
    setTopError(null);
    setSaving(false);
  }, [open, ruleSet]);

  const conditionOptions = useMemo(() => {
    return [...conditions]
      .map((c) => ({ code: c.code, name: c.name, category: c.category }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [conditions]);

  const updateDraft = (idx: number, patch: Partial<DraftRule>) => {
    setDrafts((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)),
    );
  };

  const addDraftRule = () => {
    setDrafts((prev) => [...prev, ruleToDraft(null, prev.length)]);
  };

  const removeDraftRule = async (idx: number) => {
    const draft = drafts[idx];
    if (draft?.id) {
      try {
        await deleteRule.mutateAsync({
          id: draft.id,
          carrierId,
          ruleSetId: ruleSet?.id ?? "",
        });
      } catch (err) {
        showToast.error(
          err instanceof Error ? err.message : "Failed to delete rule",
        );
        return;
      }
    }
    setDrafts((prev) => prev.filter((_, i) => i !== idx));
  };

  const validateDraft = (
    draft: DraftRule,
    idx: number,
  ): { ok: true; predicate: PredicateGroup } | { ok: false; error: string } => {
    if (!draft.name.trim()) {
      return { ok: false, error: `Rule #${idx + 1}: name is required` };
    }
    if (!draft.outcomeReason.trim()) {
      return {
        ok: false,
        error: `Rule #${idx + 1}: outcome reason is required`,
      };
    }
    let parsed: PredicateGroup;
    try {
      parsed = JSON.parse(draft.predicateText) as PredicateGroup;
    } catch (e) {
      return {
        ok: false,
        error: `Rule #${idx + 1}: predicate is not valid JSON (${
          e instanceof Error ? e.message : "parse error"
        })`,
      };
    }
    const validation = validatePredicate(parsed);
    if (!validation.valid) {
      return {
        ok: false,
        error: `Rule #${idx + 1}: predicate failed validation — ${
          validation.errors.join("; ") || "unknown"
        }`,
      };
    }
    return { ok: true, predicate: parsed };
  };

  const handleSave = async () => {
    setTopError(null);

    if (!name.trim()) {
      setTopError("Rule set name is required.");
      return;
    }
    if (scope === "condition" && !conditionCode) {
      setTopError("Condition scope requires a condition code.");
      return;
    }
    if (drafts.length === 0) {
      setTopError("Add at least one rule.");
      return;
    }

    const prepared: { draft: DraftRule; predicate: PredicateGroup }[] = [];
    for (let i = 0; i < drafts.length; i++) {
      const result = validateDraft(drafts[i], i);
      if (!result.ok) {
        setTopError(result.error);
        return;
      }
      prepared.push({ draft: drafts[i], predicate: result.predicate });
    }

    setSaving(true);
    try {
      // 1. Upsert the rule_set
      let ruleSetId: string;
      if (isEdit && ruleSet) {
        await updateRuleSet.mutateAsync({
          id: ruleSet.id,
          updates: {
            name: name.trim(),
            description: description.trim() || null,
            scope,
            condition_code: scope === "condition" ? conditionCode : null,
          },
        });
        ruleSetId = ruleSet.id;
      } else {
        const newSet = await createRuleSet.mutateAsync({
          carrierId,
          scope,
          conditionCode: scope === "condition" ? conditionCode : null,
          name: name.trim(),
          description: description.trim() || undefined,
          source: "manual",
        });
        ruleSetId = newSet.id;
      }

      // 2. Upsert rules — update existing, create new
      for (const { draft, predicate } of prepared) {
        const ageMin = draft.ageBandMin.trim()
          ? Number(draft.ageBandMin)
          : null;
        const ageMax = draft.ageBandMax.trim()
          ? Number(draft.ageBandMax)
          : null;
        if (draft.id) {
          await updateRule.mutateAsync({
            id: draft.id,
            ruleSetId,
            carrierId,
            updates: {
              name: draft.name.trim(),
              description: draft.description.trim() || null,
              priority: draft.priority,
              ageBandMin: ageMin,
              ageBandMax: ageMax,
              predicate,
              outcomeEligibility: draft.outcomeEligibility,
              outcomeHealthClass: draft.outcomeHealthClass,
              outcomeTableRating: draft.outcomeTableRating,
              outcomeReason: draft.outcomeReason.trim(),
            },
          });
        } else {
          const input: CreateRuleInput = {
            ruleSetId,
            priority: draft.priority,
            name: draft.name.trim(),
            description: draft.description.trim() || undefined,
            ageBandMin: ageMin,
            ageBandMax: ageMax,
            predicate,
            outcomeEligibility: draft.outcomeEligibility,
            outcomeHealthClass: draft.outcomeHealthClass,
            outcomeTableRating: draft.outcomeTableRating,
            outcomeReason: draft.outcomeReason.trim(),
          };
          await createRule.mutateAsync(input);
        }
      }

      showToast.success(
        isEdit ? "Rule set updated" : "Rule set created (saved as draft)",
      );
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      setTopError(message);
      showToast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {isEdit ? "Edit rule set" : "Create rule set"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-[11px]">Name</Label>
              <Input
                className="h-7 text-[12px]"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Diabetes Type 2 — Standard"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-[11px]">Description (optional)</Label>
              <Input
                className="h-7 text-[12px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-[11px]">Scope</Label>
              <Select
                value={scope}
                onValueChange={(v) => setScope(v as RuleSetScope)}
              >
                <SelectTrigger className="h-7 text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">global</SelectItem>
                  <SelectItem value="condition">condition</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {scope === "condition" ? (
              <div>
                <Label className="text-[11px]">Condition</Label>
                <Select value={conditionCode} onValueChange={setConditionCode}>
                  <SelectTrigger className="h-7 text-[12px]">
                    <SelectValue placeholder="Pick a condition…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {conditionOptions.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name} ({c.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <div className="border-t border-v2-ring pt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-semibold text-v2-ink">
                Rules ({drafts.length})
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addDraftRule}
                className="h-6 text-[10px]"
              >
                <Plus className="h-2.5 w-2.5 mr-1" /> Add rule
              </Button>
            </div>

            <div className="space-y-3">
              {drafts.map((draft, idx) => (
                <div
                  key={idx}
                  className="rounded border border-v2-ring p-2.5 space-y-2 bg-v2-card-tinted/40"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-v2-ink-subtle w-8">
                      #{idx + 1}
                    </span>
                    <Input
                      className="h-6 text-[11px] flex-1"
                      placeholder="Rule name"
                      value={draft.name}
                      onChange={(e) =>
                        updateDraft(idx, { name: e.target.value })
                      }
                    />
                    <Input
                      className="h-6 text-[11px] w-16"
                      type="number"
                      placeholder="prio"
                      value={draft.priority}
                      onChange={(e) =>
                        updateDraft(idx, {
                          priority: Number(e.target.value) || 0,
                        })
                      }
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeDraftRule(idx)}
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      title="Delete rule"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px]">Eligibility</Label>
                      <Select
                        value={draft.outcomeEligibility}
                        onValueChange={(v) =>
                          updateDraft(idx, {
                            outcomeEligibility:
                              v as DraftRule["outcomeEligibility"],
                          })
                        }
                      >
                        <SelectTrigger className="h-6 text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ELIGIBILITY_OPTIONS.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px]">Health class</Label>
                      <Select
                        value={draft.outcomeHealthClass}
                        onValueChange={(v) =>
                          updateDraft(idx, {
                            outcomeHealthClass: v as HealthClass,
                          })
                        }
                      >
                        <SelectTrigger className="h-6 text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HEALTH_CLASS_OPTIONS.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px]">Table rating</Label>
                      <Select
                        value={draft.outcomeTableRating}
                        onValueChange={(v) =>
                          updateDraft(idx, {
                            outcomeTableRating: v as TableRating,
                          })
                        }
                      >
                        <SelectTrigger className="h-6 text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TABLE_RATING_OPTIONS.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Age band min</Label>
                      <Input
                        type="number"
                        className="h-6 text-[11px]"
                        value={draft.ageBandMin}
                        onChange={(e) =>
                          updateDraft(idx, { ageBandMin: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Age band max</Label>
                      <Input
                        type="number"
                        className="h-6 text-[11px]"
                        value={draft.ageBandMax}
                        onChange={(e) =>
                          updateDraft(idx, { ageBandMax: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-[10px]">Outcome reason</Label>
                    <Input
                      className="h-6 text-[11px]"
                      value={draft.outcomeReason}
                      onChange={(e) =>
                        updateDraft(idx, { outcomeReason: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <Label className="text-[10px]">
                      Predicate (JSON — uses the v2 rule DSL)
                    </Label>
                    <textarea
                      className="w-full h-32 text-[10px] font-mono p-2 rounded border border-v2-ring bg-v2-card"
                      value={draft.predicateText}
                      onChange={(e) =>
                        updateDraft(idx, { predicateText: e.target.value })
                      }
                      spellCheck={false}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {topError ? (
            <div className="text-[11px] text-destructive border border-destructive/40 bg-destructive/5 rounded px-2 py-1.5">
              {topError}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="h-7 text-[11px]"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-7 text-[11px]"
          >
            {saving ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Saving
              </>
            ) : isEdit ? (
              "Save changes"
            ) : (
              "Create rule set"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
