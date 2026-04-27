// src/features/underwriting/components/AcceptanceRules/AcceptanceRulesTab.tsx
// Tab for managing carrier acceptance rules (v2 - compound predicates)
// NOTE: Approval workflow removed - single-user system, rules are active immediately

import { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Shield,
  Wand2,
  Calendar,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useCarriersWithProducts } from "../../hooks/coverage/useCarriersWithProducts";
import {
  useRuleSets,
  useRuleSet,
  useCreateRuleSet,
  useUpdateRuleSet,
  useDeleteRuleSet,
  type RuleSetWithRules,
} from "../../hooks/rules/useRuleSets";
import {
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  useReorderRules,
} from "../../hooks/rules/useRules";
import {
  useGenerateKnockoutRules,
  useGenerateAgeRules,
  useGenerateGuaranteedIssueRules,
  useKnockoutCodes,
  type GenerationStrategy,
} from "../../hooks/rules/useGenerateRules";
import {
  RuleSetList,
  RuleSetEditor,
  type RuleSetFormData,
  type RuleFormData,
} from "../RuleEngine";

export function AcceptanceRulesTab() {
  const [selectedCarrierId, setSelectedCarrierId] = useState<string>("");
  const [selectedRuleSet, setSelectedRuleSet] =
    useState<RuleSetWithRules | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Generation dialog state
  const [knockoutDialogOpen, setKnockoutDialogOpen] = useState(false);
  const [ageRulesDialogOpen, setAgeRulesDialogOpen] = useState(false);
  const [guaranteedIssueDialogOpen, setGuaranteedIssueDialogOpen] =
    useState(false);
  const [generationStrategy, setGenerationStrategy] =
    useState<GenerationStrategy>("skip_if_exists");
  const [
    selectedGuaranteedIssueProductIds,
    setSelectedGuaranteedIssueProductIds,
  ] = useState<string[]>([]);

  // Queries
  const { data: carriers, isLoading: loadingCarriers } =
    useCarriersWithProducts();
  const { data: knockoutCodes } = useKnockoutCodes();
  const { data: ruleSets, isLoading: loadingRuleSets } = useRuleSets(
    selectedCarrierId || undefined,
    { includeInactive: true },
  );
  const { data: ruleSetDetail, isLoading: loadingDetail } = useRuleSet(
    selectedRuleSet?.id,
  );

  // Mutations
  const createRuleSet = useCreateRuleSet();
  const updateRuleSet = useUpdateRuleSet();
  const deleteRuleSet = useDeleteRuleSet();
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();
  const reorderRules = useReorderRules();

  // Generation mutations
  const generateKnockout = useGenerateKnockoutRules();
  const generateAge = useGenerateAgeRules();
  const generateGuaranteedIssue = useGenerateGuaranteedIssueRules();

  // Carriers list
  const carriersList = useMemo(() => {
    if (!carriers) return [];
    return carriers.map((c) => ({ id: c.id, name: c.name }));
  }, [carriers]);

  const selectedCarrierProducts = useMemo(() => {
    if (!carriers || !selectedCarrierId) return [];
    return (
      carriers.find((carrier) => carrier.id === selectedCarrierId)?.products ??
      []
    );
  }, [carriers, selectedCarrierId]);

  useEffect(() => {
    setSelectedGuaranteedIssueProductIds([]);
  }, [selectedCarrierId]);

  const toggleGuaranteedIssueProduct = (productId: string) => {
    setSelectedGuaranteedIssueProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  };

  // Get carriers with rule sets
  const _carriersWithRuleSets = useMemo(() => {
    if (!ruleSets) return new Set<string>();
    return new Set(ruleSets.map((rs) => rs.carrier_id));
  }, [ruleSets]);

  // Handle select rule set
  const handleSelectRuleSet = (rs: RuleSetWithRules) => {
    setSelectedRuleSet(rs);
    setIsCreating(false);
    setEditorOpen(true);
  };

  // Handle create new rule set
  const handleCreateNew = () => {
    setSelectedRuleSet(null);
    setIsCreating(true);
    setEditorOpen(true);
  };

  // Save rule set (create or update)
  const handleSaveRuleSet = async (data: RuleSetFormData) => {
    try {
      if (isCreating) {
        const created = await createRuleSet.mutateAsync({
          carrierId: selectedCarrierId,
          productId: data.productId,
          scope: data.scope,
          conditionCode: data.conditionCode,
          name: data.name,
          description: data.description || undefined,
        });
        setSelectedRuleSet(created as unknown as RuleSetWithRules);
        setIsCreating(false);
        toast.success("Rule set created");
      } else if (selectedRuleSet) {
        await updateRuleSet.mutateAsync({
          id: selectedRuleSet.id,
          updates: {
            name: data.name,
            description: data.description || null,
            scope: data.scope,
            condition_code: data.conditionCode,
            product_id: data.productId,
            is_active: data.isActive,
          },
        });
        toast.success("Rule set updated");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save rule set",
      );
    }
  };

  // Delete rule set
  const handleDeleteRuleSet = async (ruleSetId: string) => {
    try {
      await deleteRuleSet.mutateAsync({
        id: ruleSetId,
        carrierId: selectedCarrierId,
      });
      if (selectedRuleSet?.id === ruleSetId) {
        setEditorOpen(false);
        setSelectedRuleSet(null);
      }
      toast.success("Rule set deleted");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete rule set",
      );
    }
  };

  // Toggle active
  const handleToggleActive = async (ruleSetId: string, isActive: boolean) => {
    try {
      await updateRuleSet.mutateAsync({
        id: ruleSetId,
        updates: { is_active: isActive },
      });
      toast.success(isActive ? "Rule set activated" : "Rule set deactivated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update rule set",
      );
    }
  };

  // Rule operations
  const handleCreateRule = async (data: RuleFormData) => {
    if (!selectedRuleSet) return;
    try {
      await createRule.mutateAsync({
        ruleSetId: selectedRuleSet.id,
        priority: data.priority,
        name: data.name,
        description: data.description || undefined,
        ageBandMin: data.ageBandMin,
        ageBandMax: data.ageBandMax,
        gender: data.gender,
        predicate: data.predicate,
        outcomeEligibility: data.outcome.eligibility,
        outcomeHealthClass: data.outcome.healthClass,
        outcomeTableRating: data.outcome.tableRating,
        outcomeFlatExtraPerThousand: data.outcome.flatExtraPerThousand,
        outcomeFlatExtraYears: data.outcome.flatExtraYears,
        outcomeReason: data.outcome.reason,
        outcomeConcerns: data.outcome.concerns,
      });
      toast.success("Rule created");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create rule",
      );
    }
  };

  const handleUpdateRule = async (ruleId: string, data: RuleFormData) => {
    if (!selectedRuleSet) return;
    try {
      await updateRule.mutateAsync({
        id: ruleId,
        carrierId: selectedCarrierId,
        ruleSetId: selectedRuleSet.id,
        updates: {
          priority: data.priority,
          name: data.name,
          description: data.description || null,
          ageBandMin: data.ageBandMin,
          ageBandMax: data.ageBandMax,
          gender: data.gender,
          predicate: data.predicate,
          outcomeEligibility: data.outcome.eligibility,
          outcomeHealthClass: data.outcome.healthClass,
          outcomeTableRating: data.outcome.tableRating,
          outcomeFlatExtraPerThousand: data.outcome.flatExtraPerThousand,
          outcomeFlatExtraYears: data.outcome.flatExtraYears,
          outcomeReason: data.outcome.reason,
          outcomeConcerns: data.outcome.concerns,
        },
      });
      toast.success("Rule updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update rule",
      );
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!selectedRuleSet) return;
    try {
      await deleteRule.mutateAsync({
        id: ruleId,
        carrierId: selectedCarrierId,
        ruleSetId: selectedRuleSet.id,
      });
      toast.success("Rule deleted");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete rule",
      );
    }
  };

  const handleReorderRules = async (ruleIds: string[]) => {
    if (!selectedRuleSet) return;
    try {
      await reorderRules.mutateAsync({
        ruleSetId: selectedRuleSet.id,
        carrierId: selectedCarrierId,
        ruleIds,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reorder rules",
      );
    }
  };

  // Handle generate knockout rules
  const handleGenerateKnockout = async () => {
    if (!selectedCarrierId) return;
    try {
      const result = await generateKnockout.mutateAsync({
        carrierId: selectedCarrierId,
        strategy: generationStrategy,
      });
      if (result.success) {
        toast.success(
          `Generated ${result.created} knockout rule sets (${result.skipped} skipped)`,
        );
        setKnockoutDialogOpen(false);
      } else {
        toast.error(result.error || "Failed to generate knockout rules");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to generate knockout rules",
      );
    }
  };

  // Handle generate age rules from products
  const handleGenerateAgeRules = async () => {
    if (!selectedCarrierId) return;
    try {
      const result = await generateAge.mutateAsync({
        carrierId: selectedCarrierId,
        strategy: generationStrategy,
      });
      if (result.success) {
        toast.success(
          `Generated ${result.created} age rule sets from ${result.productsProcessed} products (${result.skipped} skipped)`,
        );
        setAgeRulesDialogOpen(false);
      } else {
        toast.error(result.error || "Failed to generate age rules");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate age rules",
      );
    }
  };

  const handleGenerateGuaranteedIssueRules = async () => {
    if (!selectedCarrierId || selectedGuaranteedIssueProductIds.length === 0) {
      return;
    }

    try {
      const result = await generateGuaranteedIssue.mutateAsync({
        carrierId: selectedCarrierId,
        productIds: selectedGuaranteedIssueProductIds,
        strategy: generationStrategy,
      });

      if (result.success) {
        toast.success(
          `Generated ${result.created} guaranteed-issue draft rule sets across ${result.productsProcessed} products (${result.skipped} skipped)`,
        );
        setGuaranteedIssueDialogOpen(false);
        setSelectedGuaranteedIssueProductIds([]);
      } else {
        toast.error(
          result.error || "Failed to generate guaranteed-issue draft rules",
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to generate guaranteed-issue draft rules",
      );
    }
  };

  // Loading state
  if (loadingCarriers) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  const isAnyMutating =
    createRuleSet.isPending ||
    updateRuleSet.isPending ||
    deleteRuleSet.isPending ||
    createRule.isPending ||
    updateRule.isPending ||
    deleteRule.isPending ||
    reorderRules.isPending ||
    generateKnockout.isPending ||
    generateAge.isPending ||
    generateGuaranteedIssue.isPending;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-v2-card rounded-lg px-3 py-2 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-v2-ink-muted" />
            <span className="text-sm font-semibold text-v2-ink dark:text-v2-ink">
              Carrier Acceptance Rules
            </span>
            <span className="text-[10px] text-v2-ink-subtle hidden sm:inline">
              Define carrier acceptance criteria with compound rules
            </span>
          </div>

          {/* Generate Rules Dropdown - only show when carrier is selected */}
          {selectedCarrierId && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  disabled={isAnyMutating}
                >
                  <Wand2 className="h-3 w-3 mr-1" />
                  Generate Rules
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-[10px] text-v2-ink-subtle">
                  Auto-Generate Draft Rules
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setKnockoutDialogOpen(true)}
                  className="text-[11px]"
                >
                  <AlertTriangle className="h-3 w-3 mr-2 text-red-500" />
                  <div>
                    <div>Knockout Rules</div>
                    <div className="text-[9px] text-v2-ink-subtle">
                      {knockoutCodes?.length ?? 0} conditions available
                    </div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setAgeRulesDialogOpen(true)}
                  className="text-[11px]"
                >
                  <Calendar className="h-3 w-3 mr-2 text-blue-500" />
                  <div>
                    <div>Age Rules from Products</div>
                    <div className="text-[9px] text-v2-ink-subtle">
                      Based on product min/max age
                    </div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setGuaranteedIssueDialogOpen(true)}
                  className="text-[11px]"
                >
                  <ShieldCheck className="h-3 w-3 mr-2 text-emerald-500" />
                  <div>
                    <div>Guaranteed Issue Drafts</div>
                    <div className="text-[9px] text-v2-ink-subtle">
                      For explicitly selected accept-all products
                    </div>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Carrier Selector */}
        <div className="mt-2">
          <Select
            value={selectedCarrierId}
            onValueChange={setSelectedCarrierId}
          >
            <SelectTrigger className="w-full max-w-md h-7 text-[11px]">
              <SelectValue placeholder="Select a carrier to manage rules..." />
            </SelectTrigger>
            <SelectContent>
              {carriersList.map((carrier) => (
                <SelectItem
                  key={carrier.id}
                  value={carrier.id}
                  className="text-[11px]"
                >
                  <div className="flex items-center gap-2">
                    <span>{carrier.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Rule Sets List */}
      {selectedCarrierId ? (
        <div className="bg-v2-card rounded-lg p-3 shadow-sm">
          <RuleSetList
            ruleSets={ruleSets || []}
            isLoading={loadingRuleSets}
            onSelect={handleSelectRuleSet}
            onCreate={handleCreateNew}
            onDelete={handleDeleteRuleSet}
            onToggleActive={handleToggleActive}
          />
        </div>
      ) : (
        <div className="bg-v2-card rounded-lg p-8 text-center shadow-sm">
          <Shield className="h-10 w-10 mx-auto mb-3 text-v2-canvas dark:text-v2-ink" />
          <p className="text-[11px] font-medium text-v2-ink-muted">
            Select a carrier to manage acceptance rules
          </p>
          <p className="text-[10px] text-v2-ink-subtle mt-1">
            Start with your most-used carriers: Mutual of Omaha, Baltimore Life,
            Transamerica
          </p>
        </div>
      )}

      {/* Rule Set Editor Sheet */}
      <RuleSetEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        ruleSet={isCreating ? null : ruleSetDetail || selectedRuleSet}
        carrierId={selectedCarrierId}
        onSaveRuleSet={handleSaveRuleSet}
        onCreateRule={handleCreateRule}
        onUpdateRule={handleUpdateRule}
        onDeleteRule={handleDeleteRule}
        onReorderRules={handleReorderRules}
        isLoading={isAnyMutating || loadingDetail}
      />

      {/* Generate Knockout Rules Dialog */}
      <AlertDialog
        open={knockoutDialogOpen}
        onOpenChange={setKnockoutDialogOpen}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Generate Knockout Rules
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-[11px] text-muted-foreground space-y-2">
                <p>
                  This will create <strong>draft</strong> rule sets for{" "}
                  {knockoutCodes?.length ?? 0} knockout conditions (AIDS/HIV,
                  ALS, Alzheimer's, etc.)
                </p>
                <p>
                  Knockout rules automatically decline or refer applicants with
                  specific high-risk conditions.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-2">
            <Label className="text-[10px] text-v2-ink-muted uppercase tracking-wider">
              If rule set already exists:
            </Label>
            <Select
              value={generationStrategy}
              onValueChange={(v) =>
                setGenerationStrategy(v as GenerationStrategy)
              }
            >
              <SelectTrigger className="h-7 text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skip_if_exists" className="text-[11px]">
                  Skip (don't overwrite)
                </SelectItem>
                <SelectItem value="create_new_draft" className="text-[11px]">
                  Create new version
                </SelectItem>
                <SelectItem value="upsert_draft" className="text-[11px]">
                  Update existing draft
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-v2-ink-subtle">
              Note: Approved rule sets are never modified.
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-[10px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleGenerateKnockout}
              disabled={generateKnockout.isPending}
              className="h-7 text-[10px]"
            >
              {generateKnockout.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Knockout Rules"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Generate Age Rules Dialog */}
      <AlertDialog
        open={guaranteedIssueDialogOpen}
        onOpenChange={setGuaranteedIssueDialogOpen}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Generate Guaranteed-Issue Draft Rules
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-[11px] text-muted-foreground space-y-2">
                <p>
                  This creates <strong>draft</strong> product-specific rule sets
                  that always return <strong>Guaranteed Issue</strong> for every
                  active wizard condition on the selected products.
                </p>
                <p>
                  Only use this for products that truly accept applicants
                  regardless of reported medical conditions. Existing approved
                  rule sets are never modified.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-[10px] text-v2-ink-muted uppercase tracking-wider">
                  Products
                </Label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() =>
                      setSelectedGuaranteedIssueProductIds(
                        selectedCarrierProducts.map((product) => product.id),
                      )
                    }
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => setSelectedGuaranteedIssueProductIds([])}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              {!selectedCarrierProducts.length ? (
                <div className="rounded border border-v2-ring px-3 py-2 text-[10px] text-muted-foreground dark:border-v2-ring">
                  No active products found for this carrier.
                </div>
              ) : (
                <div className="max-h-52 space-y-1 overflow-y-auto rounded border border-v2-ring p-2 dark:border-v2-ring">
                  {selectedCarrierProducts.map((product) => {
                    const checked = selectedGuaranteedIssueProductIds.includes(
                      product.id,
                    );

                    return (
                      <label
                        key={product.id}
                        className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 hover:bg-v2-canvas dark:hover:bg-v2-card-tinted"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            toggleGuaranteedIssueProduct(product.id)
                          }
                          className="mt-0.5"
                        />
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium text-foreground">
                            {product.name}
                          </div>
                          <div className="text-[9px] text-muted-foreground">
                            {product.product_type.replaceAll("_", " ")}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] text-v2-ink-muted uppercase tracking-wider">
                If draft rule set already exists:
              </Label>
              <Select
                value={generationStrategy}
                onValueChange={(v) =>
                  setGenerationStrategy(v as GenerationStrategy)
                }
              >
                <SelectTrigger className="h-7 text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip_if_exists" className="text-[11px]">
                    Skip existing drafts
                  </SelectItem>
                  <SelectItem value="create_new_draft" className="text-[11px]">
                    Create new draft version
                  </SelectItem>
                  <SelectItem value="upsert_draft" className="text-[11px]">
                    Replace existing draft
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-[10px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleGenerateGuaranteedIssueRules}
              disabled={
                generateGuaranteedIssue.isPending ||
                selectedGuaranteedIssueProductIds.length === 0
              }
              className="h-7 text-[10px]"
            >
              {generateGuaranteedIssue.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate GI Drafts"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Generate Age Rules Dialog */}
      <AlertDialog
        open={ageRulesDialogOpen}
        onOpenChange={setAgeRulesDialogOpen}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              Generate Age Rules from Products
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-[11px] text-muted-foreground space-y-2">
                <p>
                  This will create <strong>draft</strong> rule sets based on the
                  min/max age defined in each product's metadata.
                </p>
                <p>
                  For example, if a product has min_age=18 and max_age=85, rules
                  will be created to decline applicants outside that range.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-2">
            <Label className="text-[10px] text-v2-ink-muted uppercase tracking-wider">
              If rule set already exists:
            </Label>
            <Select
              value={generationStrategy}
              onValueChange={(v) =>
                setGenerationStrategy(v as GenerationStrategy)
              }
            >
              <SelectTrigger className="h-7 text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skip_if_exists" className="text-[11px]">
                  Skip (don't overwrite)
                </SelectItem>
                <SelectItem value="create_new_draft" className="text-[11px]">
                  Create new version
                </SelectItem>
                <SelectItem value="upsert_draft" className="text-[11px]">
                  Update existing draft
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-v2-ink-subtle">
              Note: Approved rule sets are never modified.
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-[10px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleGenerateAgeRules}
              disabled={generateAge.isPending}
              className="h-7 text-[10px]"
            >
              {generateAge.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Age Rules"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
