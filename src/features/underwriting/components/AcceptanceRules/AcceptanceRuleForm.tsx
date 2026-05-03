// src/features/underwriting/components/AcceptanceRules/AcceptanceRuleForm.tsx
// Form for entering carrier condition acceptance rules

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
// Input not currently used but kept for future expansion
// import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import {
  useCarrierAcceptance,
  useUpsertAcceptanceRule,
  useDeleteAcceptanceRule,
  useHealthConditions,
} from "../../hooks/rules/useAcceptance";
// eslint-disable-next-line no-restricted-imports
import {
  ACCEPTANCE_OPTIONS,
  HEALTH_CLASS_RESULT_OPTIONS,
  getAcceptanceDisplay,
  groupConditionsByCategory,
  type AcceptanceDecision,
  type CarrierAcceptance,
} from "@/services/underwriting/repositories/acceptanceService";
import { toast } from "sonner";

interface AcceptanceRuleFormProps {
  carrierId: string;
  carrierName: string;
}

export function AcceptanceRuleForm({
  carrierId,
  carrierName,
}: AcceptanceRuleFormProps) {
  const [selectedCondition, setSelectedCondition] = useState<string>("");
  const [acceptance, setAcceptance] = useState<AcceptanceDecision>("approved");
  const [healthClassResult, setHealthClassResult] = useState<string>("");
  const [approvalLikelihood, setApprovalLikelihood] = useState<number>(80);
  const [notes, setNotes] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const { data: existingRules, isLoading: loadingRules } =
    useCarrierAcceptance(carrierId);
  const { data: conditions, isLoading: loadingConditions } =
    useHealthConditions();
  const upsertRule = useUpsertAcceptanceRule();
  const deleteRule = useDeleteAcceptanceRule();

  // Group conditions by category for better UX
  const groupedConditions = useMemo(() => {
    if (!conditions) return {};
    return groupConditionsByCategory(conditions);
  }, [conditions]);

  // Check if a condition already has a rule
  const conditionHasRule = (conditionCode: string) => {
    return (
      existingRules?.some((r) => r.condition_code === conditionCode) || false
    );
  };

  // Get rule for a condition
  const _getRuleForCondition = (conditionCode: string) => {
    return existingRules?.find((r) => r.condition_code === conditionCode);
  };

  // Handle save
  const handleSave = async () => {
    if (!selectedCondition) {
      toast.error("Please select a condition");
      return;
    }

    setIsSaving(true);
    try {
      await upsertRule.mutateAsync({
        carrierId,
        conditionCode: selectedCondition,
        acceptance,
        healthClassResult: healthClassResult || null,
        approvalLikelihood: approvalLikelihood / 100,
        notes: notes || null,
      });

      toast.success("Acceptance rule saved");

      // Reset form
      setSelectedCondition("");
      setAcceptance("approved");
      setHealthClassResult("");
      setApprovalLikelihood(80);
      setNotes("");
    } catch (error) {
      console.error("Error saving rule:", error);
      toast.error("Failed to save rule");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async (ruleId: string) => {
    try {
      await deleteRule.mutateAsync({ ruleId, carrierId });
      toast.success("Rule deleted");
    } catch (error) {
      console.error("Error deleting rule:", error);
      toast.error("Failed to delete rule");
    }
  };

  // Get acceptance icon
  const getAcceptanceIcon = (acc: string) => {
    switch (acc) {
      case "approved":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "table_rated":
        return <AlertCircle className="h-4 w-4 text-warning" />;
      case "case_by_case":
        return <HelpCircle className="h-4 w-4 text-warning" />;
      case "declined":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  if (loadingRules || loadingConditions) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add New Rule Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add Acceptance Rule</CardTitle>
          <CardDescription>
            Define how {carrierName} handles specific health conditions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Condition Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs">Health Condition</Label>
              <Select
                value={selectedCondition}
                onValueChange={setSelectedCondition}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select condition..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {Object.entries(groupedConditions).map(
                    ([category, items]) => (
                      <SelectGroup key={category}>
                        <SelectLabel className="text-xs text-muted-foreground">
                          {category}
                        </SelectLabel>
                        {items.map((condition) => {
                          const hasRule = conditionHasRule(condition.code);
                          return (
                            <SelectItem
                              key={condition.code}
                              value={condition.code}
                            >
                              <div className="flex items-center gap-2">
                                <span>{condition.name}</span>
                                {hasRule && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    has rule
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectGroup>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Acceptance Decision */}
            <div className="space-y-1.5">
              <Label className="text-xs">Acceptance Decision</Label>
              <Select
                value={acceptance}
                onValueChange={(v) => setAcceptance(v as AcceptanceDecision)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCEPTANCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        {getAcceptanceIcon(opt.value)}
                        <span>{opt.label}</span>
                        <span className="text-xs text-muted-foreground">
                          - {opt.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Health Class Result */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                Health Class Result (if approved)
              </Label>
              <Select
                value={healthClassResult}
                onValueChange={setHealthClassResult}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select class..." />
                </SelectTrigger>
                <SelectContent>
                  {HEALTH_CLASS_RESULT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Approval Likelihood */}
            <div className="space-y-1.5">
              <Label className="text-xs">
                Approval Likelihood: {approvalLikelihood}%
              </Label>
              <Slider
                value={[approvalLikelihood]}
                onValueChange={([v]) => setApprovalLikelihood(v)}
                min={0}
                max={100}
                step={5}
                className="mt-2"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any specific requirements, time since diagnosis, severity thresholds..."
              className="h-16 resize-none"
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSave}
              disabled={isSaving || !selectedCondition}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add Rule
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing Rules Table */}
      {existingRules && existingRules.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Existing Rules
              <Badge variant="outline" className="ml-2">
                {existingRules.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Condition</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead>Class Result</TableHead>
                    <TableHead>Likelihood</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {existingRules.map((rule) => {
                    const display = getAcceptanceDisplay(rule.acceptance);
                    return (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <div className="font-medium">
                            {rule.condition?.name || rule.condition_code}
                          </div>
                          {rule.condition?.category && (
                            <div className="text-xs text-muted-foreground">
                              {rule.condition.category}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {getAcceptanceIcon(rule.acceptance)}
                            <span>{display.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {rule.health_class_result ? (
                            HEALTH_CLASS_RESULT_OPTIONS.find(
                              (o) => o.value === rule.health_class_result,
                            )?.label || rule.health_class_result
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {rule.approval_likelihood !== null ? (
                            <Badge
                              variant={
                                rule.approval_likelihood >= 0.8
                                  ? "default"
                                  : rule.approval_likelihood >= 0.5
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {Math.round(rule.approval_likelihood * 100)}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(rule.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {existingRules.some((r: CarrierAcceptance) => r.notes) && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Notes:
                </p>
                {existingRules
                  .filter((r: CarrierAcceptance) => r.notes)
                  .map((rule: CarrierAcceptance) => (
                    <div
                      key={rule.id}
                      className="text-xs text-muted-foreground pl-2 border-l-2"
                    >
                      <span className="font-medium">
                        {rule.condition?.name}:
                      </span>{" "}
                      {rule.notes}
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
