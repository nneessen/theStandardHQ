import { useEffect, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  MessageCircle,
  Plus,
  Star,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { useChatBotAgent, useUpdateBotConfig } from "../hooks/useChatBot";
import {
  createBlankVariant,
  INTRO_VARIANT_LIMITS,
  INTRO_VARIANT_PLACEHOLDERS,
  validateVariants,
  type IntroMessageVariant,
  type VariantValidationError,
} from "../lib/intro-message-variants";

// ─── Local helpers ──────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {icon}
        </div>
        <div>
          <h2 className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Variant Row (collapsible summary + inline edit form) ──────

function VariantRow({
  variant,
  isExpanded,
  onToggle,
  onChange,
  onDelete,
  onSelectWinner,
  errors,
  disabled,
}: {
  variant: IntroMessageVariant;
  isExpanded: boolean;
  onToggle: () => void;
  onChange: (updated: IntroMessageVariant) => void;
  onDelete: () => void;
  onSelectWinner: (isWinner: boolean) => void;
  errors: VariantValidationError[];
  disabled?: boolean;
}) {
  const labelErrors = errors.filter((e) => e.field === "label");
  const templateErrors = errors.filter((e) => e.field === "template");
  const winnerErrors = errors.filter((e) => e.field === "isWinner");
  const idErrors = errors.filter((e) => e.field === "id");

  const labelDisplay = variant.label.trim() || "Untitled variant";

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div
        className={cn(
          "rounded-lg border bg-white dark:bg-zinc-900",
          errors.length > 0
            ? "border-red-300 dark:border-red-900"
            : "border-zinc-200 dark:border-zinc-800",
        )}
      >
        {/* Summary row */}
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
            disabled={disabled}
          >
            <span className="shrink-0 text-zinc-400 dark:text-zinc-500">
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </span>

            <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-zinc-800 dark:text-zinc-200">
              {labelDisplay}
            </span>

            {variant.active ? (
              <Badge
                variant="ghost"
                size="sm"
                className="shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
              >
                Active
              </Badge>
            ) : (
              <Badge
                variant="ghost"
                size="sm"
                className="shrink-0 bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
              >
                Inactive
              </Badge>
            )}

            {variant.isWinner ? (
              <Badge
                variant="ghost"
                size="sm"
                className="shrink-0 gap-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
              >
                <Star className="h-2.5 w-2.5 fill-current" />
                Winner
              </Badge>
            ) : null}
          </button>
        </CollapsibleTrigger>

        {/* Expanded edit form */}
        <CollapsibleContent>
          <div className="space-y-2.5 border-t border-zinc-100 bg-zinc-50/50 px-3 pb-3 pt-2.5 dark:border-zinc-800 dark:bg-zinc-800/30">
            {/* Label */}
            <div>
              <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                Label
              </label>
              <Input
                value={variant.label}
                onChange={(e) =>
                  onChange({ ...variant, label: e.target.value })
                }
                placeholder="e.g. Variant A — soft opener"
                className="mt-0.5 h-7 text-[11px]"
                maxLength={INTRO_VARIANT_LIMITS.LABEL_MAX}
                disabled={disabled}
              />
              {labelErrors.map((err, i) => (
                <p key={i} className="mt-0.5 text-[9px] text-red-500">
                  {err.message}
                </p>
              ))}
            </div>

            {/* Template */}
            <div>
              <label className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                Template
              </label>
              <Textarea
                value={variant.template}
                onChange={(e) =>
                  onChange({ ...variant, template: e.target.value })
                }
                placeholder="Hi {firstName}, this is {agentName} with {companyName}. I saw you recently looked into {productType}. Mind if I ask a couple quick questions?"
                className="mt-0.5 min-h-[72px] resize-y text-[11px]"
                disabled={disabled}
              />
              <div className="mt-0.5 flex items-start justify-between gap-2">
                <p className="text-[9px] text-zinc-400 dark:text-zinc-500">
                  Placeholders:{" "}
                  {INTRO_VARIANT_PLACEHOLDERS.map((p) => p.key).join(" · ")}
                </p>
                <p
                  className={cn(
                    "shrink-0 text-[9px]",
                    variant.template.length > INTRO_VARIANT_LIMITS.TEMPLATE_MAX
                      ? "text-red-500"
                      : "text-zinc-400 dark:text-zinc-500",
                  )}
                >
                  {variant.template.length}/{INTRO_VARIANT_LIMITS.TEMPLATE_MAX}
                </p>
              </div>
              {templateErrors.map((err, i) => (
                <p key={i} className="mt-0.5 text-[9px] text-red-500">
                  {err.message}
                </p>
              ))}
            </div>

            {/* Active + Winner toggles */}
            <div className="flex items-center justify-between gap-4 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 dark:border-zinc-700 dark:bg-zinc-900">
              <div className="flex items-center gap-2">
                <Switch
                  variant="success"
                  size="sm"
                  checked={variant.active}
                  onCheckedChange={(active) => onChange({ ...variant, active })}
                  disabled={disabled || variant.isWinner}
                />
                <span className="text-[10px] text-zinc-700 dark:text-zinc-300">
                  Active {variant.isWinner ? "(locked by winner)" : ""}
                </span>
              </div>

              <label className="flex items-center gap-1.5 text-[10px] text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={variant.isWinner}
                  onChange={(e) => onSelectWinner(e.target.checked)}
                  disabled={disabled}
                  className="h-3 w-3 accent-amber-500"
                />
                <Star
                  className={cn(
                    "h-3 w-3",
                    variant.isWinner
                      ? "fill-amber-500 text-amber-500"
                      : "text-zinc-400",
                  )}
                />
                Mark as winner
              </label>
            </div>
            {winnerErrors.map((err, i) => (
              <p key={i} className="text-[9px] text-red-500">
                {err.message}
              </p>
            ))}
            {idErrors.map((err, i) => (
              <p key={`id-${i}`} className="text-[9px] text-red-500">
                {err.message}
              </p>
            ))}

            {/* Delete */}
            <div className="flex justify-end border-t border-zinc-100 pt-2 dark:border-zinc-800">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 text-[10px] text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                onClick={onDelete}
                disabled={disabled}
              >
                <Trash2 className="h-3 w-3" />
                Delete variant
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ─── Main Editor ────────────────────────────────────────────────

export function IntroMessageVariantsEditor() {
  const { data: agent } = useChatBotAgent();
  const updateConfig = useUpdateBotConfig();

  const [localVariants, setLocalVariants] = useState<
    IntroMessageVariant[] | null
  >(null);
  const [dirty, setDirty] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const displayedVariants = localVariants ?? agent?.introMessageVariants ?? [];

  // Sync from server when not dirty
  useEffect(() => {
    if (!dirty) {
      setLocalVariants(null);
    }
  }, [agent?.introMessageVariants, dirty]);

  const errors = validateVariants(displayedVariants);

  // Bucket errors by variant id so each row only sees its own
  const errorsByVariant = new Map<string, VariantValidationError[]>();
  for (const err of errors) {
    if (err.variantId === null) continue;
    const bucket = errorsByVariant.get(err.variantId) ?? [];
    bucket.push(err);
    errorsByVariant.set(err.variantId, bucket);
  }

  function setVariants(updated: IntroMessageVariant[]) {
    setLocalVariants(updated);
    setDirty(true);
  }

  function addVariant() {
    const blank = createBlankVariant();
    setVariants([...displayedVariants, blank]);
    setExpandedId(blank.id); // auto-expand the new row so the user can start editing
  }

  function updateVariant(updated: IntroMessageVariant) {
    setVariants(
      displayedVariants.map((v) => (v.id === updated.id ? updated : v)),
    );
  }

  function deleteVariant(id: string) {
    setVariants(displayedVariants.filter((v) => v.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  function selectWinner(id: string, isWinner: boolean) {
    if (isWinner) {
      // Exactly one winner, and the winner is always active.
      setVariants(
        displayedVariants.map((v) => ({
          ...v,
          isWinner: v.id === id,
          active: v.id === id ? true : v.active,
        })),
      );
    } else {
      setVariants(
        displayedVariants.map((v) =>
          v.id === id ? { ...v, isWinner: false } : v,
        ),
      );
    }
  }

  function toggleExpand(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  function handleSave() {
    if (errors.length > 0) return;
    updateConfig.mutate(
      { introMessageVariants: displayedVariants },
      {
        onSuccess: () => {
          setDirty(false);
          setLocalVariants(null);
          setExpandedId(null);
        },
      },
    );
  }

  function handleDiscard() {
    setLocalVariants(null);
    setDirty(false);
    setExpandedId(null);
  }

  return (
    <SectionCard
      icon={<MessageCircle className="h-4 w-4" />}
      title="Intro SMS Variants"
      description="The first SMS the bot sends a new lead. Configure one or more variants to A/B test different openers. When multiple variants are active the bot picks one at random per lead; mark one as the winner to lock it in. Leave empty to use the default per-product template."
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
          {displayedVariants.length}{" "}
          {displayedVariants.length === 1 ? "variant" : "variants"}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-[10px]"
          onClick={addVariant}
          disabled={updateConfig.isPending}
        >
          <Plus className="h-3 w-3" />
          Add Variant
        </Button>
      </div>

      {/* Empty state */}
      {displayedVariants.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-200 px-4 py-6 text-center dark:border-zinc-700">
          <MessageCircle className="mx-auto h-5 w-5 text-zinc-300 dark:text-zinc-600" />
          <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            No intro variants configured. The bot will use a default template
            based on lead source. Add a variant to customize the first message.
          </p>
        </div>
      )}

      {/* Variant list */}
      <div className="space-y-1.5">
        {displayedVariants.map((variant) => (
          <VariantRow
            key={variant.id}
            variant={variant}
            isExpanded={expandedId === variant.id}
            onToggle={() => toggleExpand(variant.id)}
            onChange={updateVariant}
            onDelete={() => deleteVariant(variant.id)}
            onSelectWinner={(isWinner) => selectWinner(variant.id, isWinner)}
            errors={errorsByVariant.get(variant.id) ?? []}
            disabled={updateConfig.isPending}
          />
        ))}
      </div>

      {/* Save / Discard bar */}
      {dirty && (
        <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <Button
            size="sm"
            className="h-7 text-[10px]"
            disabled={updateConfig.isPending || errors.length > 0}
            onClick={handleSave}
          >
            {updateConfig.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Check className="mr-1 h-3 w-3" />
            )}
            Save Changes
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px]"
            disabled={updateConfig.isPending}
            onClick={handleDiscard}
          >
            Discard
          </Button>
          {errors.length > 0 && (
            <p className="text-[9px] text-red-500">
              Fix validation errors above to save.
            </p>
          )}
        </div>
      )}
    </SectionCard>
  );
}
