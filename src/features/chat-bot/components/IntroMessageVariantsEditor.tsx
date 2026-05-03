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
    <div className="rounded-lg border border-v2-ring bg-white p-4 dark:border-v2-ring dark:bg-v2-card">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-v2-card-tinted text-v2-ink dark:bg-v2-card-tinted dark:text-v2-ink">
          {icon}
        </div>
        <div>
          <h2 className="text-[12px] font-semibold text-v2-ink dark:text-v2-ink">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
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
          "rounded-lg border bg-v2-card",
          errors.length > 0
            ? "border-destructive/40 dark:border-destructive"
            : "border-v2-ring dark:border-v2-ring",
        )}
      >
        {/* Summary row */}
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
            disabled={disabled}
          >
            <span className="shrink-0 text-v2-ink-subtle dark:text-v2-ink-muted">
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </span>

            <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-v2-ink dark:text-v2-ink">
              {labelDisplay}
            </span>

            {variant.active ? (
              <Badge
                variant="ghost"
                size="sm"
                className="shrink-0 bg-success/20 text-success dark:bg-success/50 dark:text-success"
              >
                Active
              </Badge>
            ) : (
              <Badge
                variant="ghost"
                size="sm"
                className="shrink-0 bg-v2-card-tinted text-v2-ink-muted dark:bg-v2-card-tinted dark:text-v2-ink-subtle"
              >
                Inactive
              </Badge>
            )}

            {variant.isWinner ? (
              <Badge
                variant="ghost"
                size="sm"
                className="shrink-0 gap-0.5 bg-warning/20 text-warning dark:bg-warning/50 dark:text-warning"
              >
                <Star className="h-2.5 w-2.5 fill-current" />
                Winner
              </Badge>
            ) : null}
          </button>
        </CollapsibleTrigger>

        {/* Expanded edit form */}
        <CollapsibleContent>
          <div className="space-y-2.5 border-t border-v2-ring bg-v2-canvas/50 px-3 pb-3 pt-2.5 dark:border-v2-ring dark:bg-v2-card-tinted/30">
            {/* Label */}
            <div>
              <label className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle">
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
                <p key={i} className="mt-0.5 text-[9px] text-destructive">
                  {err.message}
                </p>
              ))}
            </div>

            {/* Template */}
            <div>
              <label className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle">
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
                <p className="text-[9px] text-v2-ink-subtle dark:text-v2-ink-muted">
                  Placeholders:{" "}
                  {INTRO_VARIANT_PLACEHOLDERS.map((p) => p.key).join(" · ")}
                </p>
                <p
                  className={cn(
                    "shrink-0 text-[9px]",
                    variant.template.length > INTRO_VARIANT_LIMITS.TEMPLATE_MAX
                      ? "text-destructive"
                      : "text-v2-ink-subtle dark:text-v2-ink-muted",
                  )}
                >
                  {variant.template.length}/{INTRO_VARIANT_LIMITS.TEMPLATE_MAX}
                </p>
              </div>
              {templateErrors.map((err, i) => (
                <p key={i} className="mt-0.5 text-[9px] text-destructive">
                  {err.message}
                </p>
              ))}
            </div>

            {/* Active + Winner toggles */}
            <div className="flex items-center justify-between gap-4 rounded-md border border-v2-ring bg-white px-2.5 py-1.5 dark:border-v2-ring-strong dark:bg-v2-card">
              <div className="flex items-center gap-2">
                <Switch
                  variant="success"
                  size="sm"
                  checked={variant.active}
                  onCheckedChange={(active) => onChange({ ...variant, active })}
                  disabled={disabled || variant.isWinner}
                />
                <span className="text-[10px] text-v2-ink dark:text-v2-ink-muted">
                  Active {variant.isWinner ? "(locked by winner)" : ""}
                </span>
              </div>

              <label className="flex items-center gap-1.5 text-[10px] text-v2-ink dark:text-v2-ink-muted">
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
                      ? "fill-amber-500 text-warning"
                      : "text-v2-ink-subtle",
                  )}
                />
                Mark as winner
              </label>
            </div>
            {winnerErrors.map((err, i) => (
              <p key={i} className="text-[9px] text-destructive">
                {err.message}
              </p>
            ))}
            {idErrors.map((err, i) => (
              <p key={`id-${i}`} className="text-[9px] text-destructive">
                {err.message}
              </p>
            ))}

            {/* Delete */}
            <div className="flex justify-end border-t border-v2-ring pt-2 dark:border-v2-ring">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 text-[10px] text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/15"
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
        <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
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
        <div className="rounded-lg border border-dashed border-v2-ring px-4 py-6 text-center dark:border-v2-ring-strong">
          <MessageCircle className="mx-auto h-5 w-5 text-v2-ink-subtle dark:text-v2-ink-muted" />
          <p className="mt-2 text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
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
        <div className="mt-3 flex items-center gap-2 border-t border-v2-ring pt-3 dark:border-v2-ring">
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
            <p className="text-[9px] text-destructive">
              Fix validation errors above to save.
            </p>
          )}
        </div>
      )}
    </SectionCard>
  );
}
