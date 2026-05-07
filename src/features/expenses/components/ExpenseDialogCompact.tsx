// src/features/expenses/components/ExpenseDialogCompact.tsx - Ultra-compact expense modal

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PillButton } from "@/components/v2";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DollarSign, Calendar, Info, Plus, Users } from "lucide-react";
import type {
  Expense,
  CreateExpenseData,
  RecurringFrequency,
} from "@/types/expense.types";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/types/expense.types";
import {
  RECURRING_FREQUENCY_OPTIONS,
  TAX_DEDUCTIBLE_TOOLTIP,
} from "../config/recurringConfig";
import { useCreateExpenseTemplate } from "../../../hooks/expenses/useExpenseTemplates";
import { getTodayString } from "../../../lib/date";
import { toast } from "sonner";
import { useLeadVendors, useCreateLeadVendor } from "@/hooks/lead-purchases";
import type {
  LeadFreshness,
  LeadVendor,
  LeadPurchase,
} from "@/types/lead-purchase.types";
import { LeadVendorDialog } from "../leads/LeadVendorDialog";

// Lead purchase fields when "Life Insurance Leads" category is selected
interface LeadPurchaseFields {
  vendorId: string;
  leadCount: string;
  leadFreshness: LeadFreshness;
  purchaseName: string;
}

// Extended expense data that may include lead purchase info
export interface CreateExpenseWithLeadData extends CreateExpenseData {
  leadPurchase?: {
    vendorId: string;
    leadCount: number;
    leadFreshness: LeadFreshness;
    purchaseName: string | null;
  };
}

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense | null;
  linkedLeadPurchase?: LeadPurchase | null;
  onSave: (data: CreateExpenseWithLeadData) => void;
  isSubmitting: boolean;
}

export function ExpenseDialogCompact({
  open,
  onOpenChange,
  expense,
  linkedLeadPurchase = null,
  onSave,
  isSubmitting,
}: ExpenseDialogProps) {
  const [formData, setFormData] = useState<CreateExpenseData>({
    name: "",
    description: "",
    amount: 0,
    category: "",
    expense_type: "personal",
    date: getTodayString(),
    is_recurring: false,
    recurring_frequency: null,
    is_tax_deductible: false,
    receipt_url: "",
    notes: "",
  });

  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const createTemplate = useCreateExpenseTemplate();

  // Lead purchase fields (shown when category is "Life Insurance Leads")
  const [leadFields, setLeadFields] = useState<LeadPurchaseFields>({
    vendorId: "",
    leadCount: "",
    leadFreshness: "fresh",
    purchaseName: "",
  });
  const [showVendorDialog, setShowVendorDialog] = useState(false);
  const { data: vendors = [] } = useLeadVendors();
  const createVendor = useCreateLeadVendor();

  // Check if lead fields should be shown
  const isLeadCategory = formData.category === "Life Insurance Leads";

  useEffect(() => {
    if (expense) {
      setFormData({
        name: expense.name,
        description: expense.description || "",
        amount: expense.amount,
        category: expense.category,
        expense_type: expense.expense_type,
        date: expense.date,
        is_recurring: expense.is_recurring || false,
        recurring_frequency: expense.recurring_frequency || null,
        is_tax_deductible: expense.is_tax_deductible || false,
        receipt_url: expense.receipt_url || "",
        notes: expense.notes || "",
      });

      // Preload linked lead purchase details when editing a lead expense.
      // This enables full edit parity from the Expense tab.
      if (expense.category === "Life Insurance Leads" && linkedLeadPurchase) {
        setLeadFields({
          vendorId: linkedLeadPurchase.vendorId,
          leadCount: String(linkedLeadPurchase.leadCount),
          leadFreshness: linkedLeadPurchase.leadFreshness,
          purchaseName: linkedLeadPurchase.purchaseName || "",
        });
      } else {
        setLeadFields({
          vendorId: "",
          leadCount: "",
          leadFreshness: "fresh",
          purchaseName: "",
        });
      }
    } else {
      setFormData({
        name: "",
        description: "",
        amount: 0,
        category: "",
        expense_type: "personal",
        date: getTodayString(),
        is_recurring: false,
        recurring_frequency: null,
        is_tax_deductible: false,
        receipt_url: "",
        notes: "",
      });
      // Reset lead fields when dialog opens for new expense
      setLeadFields({
        vendorId: "",
        leadCount: "",
        leadFreshness: "fresh",
        purchaseName: "",
      });
    }
  }, [expense, linkedLeadPurchase, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name || formData.amount <= 0 || !formData.category) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.is_recurring && !formData.recurring_frequency) {
      toast.error("Please select a frequency for recurring expense");
      return;
    }

    // Validate lead fields if lead category selected
    // For edits, only require lead fields when a linked lead purchase is present.
    // (Historical unlinked lead expenses exist from earlier flows.)
    const shouldRequireLeadFields =
      isLeadCategory && (!expense || !!linkedLeadPurchase);

    if (shouldRequireLeadFields) {
      if (!leadFields.vendorId) {
        toast.error("Please select a lead vendor");
        return;
      }
      const leadCount = parseInt(leadFields.leadCount, 10);
      if (!leadCount || leadCount <= 0) {
        toast.error("Please enter the number of leads");
        return;
      }
    }

    // Build save data with optional lead purchase info
    const saveData: CreateExpenseWithLeadData = {
      ...formData,
    };

    if (isLeadCategory && leadFields.vendorId && leadFields.leadCount) {
      saveData.leadPurchase = {
        vendorId: leadFields.vendorId,
        leadCount: parseInt(leadFields.leadCount, 10),
        leadFreshness: leadFields.leadFreshness,
        purchaseName: leadFields.purchaseName.trim() || null,
      };
    }

    // Save expense (parent handles lead purchase creation)
    onSave(saveData);

    // Save as template if checkbox is checked (only for new expenses, not edits)
    if (!expense && saveAsTemplate && templateName.trim()) {
      try {
        await createTemplate.mutateAsync({
          template_name: templateName.trim(),
          amount: formData.amount,
          category: formData.category,
          expense_type: formData.expense_type,
          is_tax_deductible: formData.is_tax_deductible,
          recurring_frequency: formData.recurring_frequency,
          notes: formData.notes,
          description: formData.description,
        });
        toast.success("Template saved!");
      } catch (error) {
        console.error("Failed to save template:", error);
        toast.error("Failed to save template");
      }
    }

    // Reset template fields
    setSaveAsTemplate(false);
    setTemplateName("");
  };

  // Quick category buttons for common expenses
  // label = button text, name = actual category value stored in DB
  const quickCategories = [
    { label: "Meals", name: "Meals & Entertainment", type: "business" },
    { label: "Travel", name: "Travel", type: "business" },
    { label: "Office", name: "Office Supplies", type: "business" },
    { label: "Leads", name: "Life Insurance Leads", type: "business" },
    { label: "Groceries", name: "Groceries", type: "personal" },
  ];

  // Handle adding a new vendor
  const handleAddVendor = async (data: { name: string }) => {
    try {
      const newVendor = await createVendor.mutateAsync(data);
      setLeadFields({ ...leadFields, vendorId: newVendor.id });
      setShowVendorDialog(false);
      toast.success("Vendor added!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add vendor",
      );
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="theme-v2 font-display p-0 gap-0 overflow-hidden rounded-v2-lg bg-card text-foreground border border-border shadow-v2-lift w-[calc(100vw-1.5rem)] sm:w-auto max-w-md max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3rem)] flex flex-col"
          hideCloseButton
        >
          <DialogHeader className="px-5 py-3 border-b border-border bg-card-tinted flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-accent" />
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em]">
                  {expense ? "Edit" : "New"}
                </span>
                <DialogTitle className="text-base font-semibold tracking-tight text-foreground text-left">
                  {expense ? "Edit expense" : "Add expense"}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          <form
            onSubmit={handleSubmit}
            className="flex flex-col flex-1 min-h-0"
          >
            {/* Body — only this region scrolls */}
            <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1 min-h-0">
              {/* Essential Fields - Compact Grid */}
              <div className="grid gap-2">
                {/* Name & Amount Row */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">
                      Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                      className="h-7 text-xs"
                      placeholder="e.g., Lunch with client"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">
                      Amount <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.amount || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            amount:
                              e.target.value === ""
                                ? 0
                                : parseFloat(e.target.value),
                          })
                        }
                        required
                        className="h-7 text-xs pl-7 font-mono"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Date & Type Row */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px] text-muted-foreground">
                      Date <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Calendar className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) =>
                          setFormData({ ...formData, date: e.target.value })
                        }
                        required
                        className="h-7 text-xs pl-7"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-[11px] text-muted-foreground">
                      Type <span className="text-destructive">*</span>
                    </Label>
                    <div className="grid grid-cols-2 gap-1">
                      <Button
                        type="button"
                        variant={
                          formData.expense_type === "business"
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        className={cn(
                          "h-7 text-[10px]",
                          formData.expense_type === "business" &&
                            "bg-v2-ink text-v2-canvas hover:bg-v2-ink/90 border-v2-ink",
                        )}
                        onClick={() =>
                          setFormData({ ...formData, expense_type: "business" })
                        }
                      >
                        Business
                      </Button>
                      <Button
                        type="button"
                        variant={
                          formData.expense_type === "personal"
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        className={cn(
                          "h-7 text-[10px]",
                          formData.expense_type === "personal" &&
                            "bg-v2-ink text-v2-canvas hover:bg-v2-ink/90 border-v2-ink",
                        )}
                        onClick={() =>
                          setFormData({ ...formData, expense_type: "personal" })
                        }
                      >
                        Personal
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Category */}
                <div>
                  <Label className="text-[11px] text-muted-foreground">
                    Category <span className="text-destructive">*</span>
                  </Label>

                  {/* Quick Category Buttons */}
                  <div className="flex gap-1 mb-1">
                    {quickCategories.map((cat) => (
                      <Button
                        key={cat.name}
                        type="button"
                        variant={
                          formData.category === cat.name ? "default" : "ghost"
                        }
                        size="sm"
                        className={cn(
                          "h-6 px-2 text-[10px]",
                          formData.category === cat.name &&
                            "bg-v2-ink text-v2-canvas hover:bg-v2-ink/90 border-v2-ink",
                        )}
                        onClick={() =>
                          setFormData({
                            ...formData,
                            category: cat.name,
                            expense_type: cat.type as "business" | "personal",
                          })
                        }
                      >
                        {cat.label}
                      </Button>
                    ))}
                  </div>

                  <Select
                    value={formData.category}
                    onValueChange={(value) =>
                      setFormData({ ...formData, category: value })
                    }
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="text-[10px] font-semibold text-muted-foreground px-2 py-1">
                        Business
                      </div>
                      {DEFAULT_EXPENSE_CATEGORIES.filter(
                        (cat) => cat.type === "business",
                      ).map((cat) => (
                        <SelectItem
                          key={cat.name}
                          value={cat.name}
                          className="text-xs"
                        >
                          {cat.name}
                        </SelectItem>
                      ))}
                      <div className="text-[10px] font-semibold text-muted-foreground px-2 py-1 mt-1">
                        Personal
                      </div>
                      {DEFAULT_EXPENSE_CATEGORIES.filter(
                        (cat) => cat.type === "personal",
                      ).map((cat) => (
                        <SelectItem
                          key={cat.name}
                          value={cat.name}
                          className="text-xs"
                        >
                          {cat.name}
                        </SelectItem>
                      ))}
                      <div className="text-[10px] font-semibold text-muted-foreground px-2 py-1 mt-1">
                        Other
                      </div>
                      {DEFAULT_EXPENSE_CATEGORIES.filter(
                        (cat) => cat.type === "general",
                      ).map((cat) => (
                        <SelectItem
                          key={cat.name}
                          value={cat.name}
                          className="text-xs"
                        >
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Lead Purchase Fields - Only shown when Life Insurance Leads category */}
                {isLeadCategory && (
                  <div className="bg-info/10 border border-info/30 rounded-lg p-2.5 space-y-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Users className="h-3 w-3 text-info" />
                      <span className="text-[10px] font-semibold text-info uppercase tracking-[0.18em]">
                        Lead Purchase Details
                      </span>
                    </div>

                    {/* Vendor Selection */}
                    <div>
                      <Label className="text-[10px] text-muted-foreground">
                        Vendor <span className="text-destructive">*</span>
                      </Label>
                      <div className="flex gap-1">
                        <Select
                          value={leadFields.vendorId}
                          onValueChange={(value) =>
                            setLeadFields({ ...leadFields, vendorId: value })
                          }
                        >
                          <SelectTrigger className="h-7 text-xs flex-1">
                            <SelectValue placeholder="Select vendor" />
                          </SelectTrigger>
                          <SelectContent>
                            {vendors.map((vendor: LeadVendor) => (
                              <SelectItem key={vendor.id} value={vendor.id}>
                                {vendor.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => setShowVendorDialog(true)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Lead Count & Freshness */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">
                          # of Leads <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          value={leadFields.leadCount}
                          onChange={(e) =>
                            setLeadFields({
                              ...leadFields,
                              leadCount: e.target.value,
                            })
                          }
                          className="h-7 text-xs"
                          placeholder="50"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">
                          Lead Type
                        </Label>
                        <Select
                          value={leadFields.leadFreshness}
                          onValueChange={(value: LeadFreshness) =>
                            setLeadFields({
                              ...leadFields,
                              leadFreshness: value,
                            })
                          }
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fresh">
                              Fresh (High-Intent)
                            </SelectItem>
                            <SelectItem value="aged">Aged</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Purchase Name (optional) */}
                    <div>
                      <Label className="text-[10px] text-muted-foreground">
                        Pack Name (optional)
                      </Label>
                      <Input
                        value={leadFields.purchaseName}
                        onChange={(e) =>
                          setLeadFields({
                            ...leadFields,
                            purchaseName: e.target.value,
                          })
                        }
                        className="h-7 text-xs"
                        placeholder="e.g., January 2026 Pack"
                      />
                    </div>

                    {/* Cost per lead calculation */}
                    {leadFields.leadCount && formData.amount > 0 && (
                      <div className="text-[10px] text-info bg-info/15 rounded px-2 py-1">
                        Cost per lead: $
                        {(
                          formData.amount /
                            parseInt(leadFields.leadCount, 10) || 0
                        ).toFixed(2)}
                      </div>
                    )}
                  </div>
                )}

                {/* Description - Optional */}
                <div>
                  <Label className="text-[11px] text-muted-foreground">
                    Description
                  </Label>
                  <Input
                    value={formData.description || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="h-7 text-xs"
                    placeholder="Optional details"
                  />
                </div>

                {/* Flags Row - Compact Checkboxes */}
                <div className="flex gap-4 py-1">
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      id="is_tax_deductible"
                      checked={formData.is_tax_deductible || false}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          is_tax_deductible: checked as boolean,
                        })
                      }
                      className="h-3 w-3"
                    />
                    <Label
                      htmlFor="is_tax_deductible"
                      className="cursor-pointer text-[11px]"
                      title={TAX_DEDUCTIBLE_TOOLTIP}
                    >
                      Tax Deductible
                    </Label>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      id="is_recurring"
                      checked={formData.is_recurring || false}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          is_recurring: checked as boolean,
                          recurring_frequency: checked
                            ? formData.recurring_frequency || "monthly"
                            : null,
                        })
                      }
                      className="h-3 w-3"
                    />
                    <Label
                      htmlFor="is_recurring"
                      className="cursor-pointer text-[11px]"
                    >
                      Recurring
                    </Label>
                  </div>

                  {!expense && (
                    <div className="flex items-center gap-1.5">
                      <Checkbox
                        id="save_as_template"
                        checked={saveAsTemplate}
                        onCheckedChange={(checked) =>
                          setSaveAsTemplate(checked as boolean)
                        }
                        className="h-3 w-3"
                      />
                      <Label
                        htmlFor="save_as_template"
                        className="cursor-pointer text-[11px]"
                      >
                        Save Template
                      </Label>
                    </div>
                  )}
                </div>

                {/* Recurring Options - Only show if recurring */}
                {formData.is_recurring && (
                  <div className="bg-muted/30 p-2 rounded space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">
                          Frequency <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          value={formData.recurring_frequency || "monthly"}
                          onValueChange={(value) =>
                            setFormData({
                              ...formData,
                              recurring_frequency: value as RecurringFrequency,
                            })
                          }
                        >
                          <SelectTrigger className="h-6 text-[10px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RECURRING_FREQUENCY_OPTIONS.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                                className="text-xs"
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-[10px] text-muted-foreground">
                          End Date
                        </Label>
                        <Input
                          type="date"
                          value={formData.recurring_end_date || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              recurring_end_date: e.target.value || null,
                            })
                          }
                          min={formData.date}
                          className="h-6 text-[10px]"
                        />
                      </div>
                    </div>

                    <Alert className="p-1.5">
                      <Info className="h-3 w-3" />
                      <AlertDescription className="text-[10px] ml-4">
                        Next 12 occurrences will be auto-generated
                      </AlertDescription>
                    </Alert>
                  </div>
                )}

                {/* Template Name - Only show if saving as template */}
                {saveAsTemplate && !expense && (
                  <div className="bg-muted/30 p-2 rounded">
                    <Label className="text-[10px] text-muted-foreground">
                      Template Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="e.g., Monthly Office Rent"
                      className="h-6 text-[10px] mt-1"
                    />
                  </div>
                )}

                {/* Notes - Optional, Collapsible */}
                <details className="group">
                  <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                    Additional Fields
                  </summary>
                  <div className="mt-2 space-y-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">
                        Receipt URL
                      </Label>
                      <Input
                        type="url"
                        placeholder="https://..."
                        value={formData.receipt_url || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            receipt_url: e.target.value,
                          })
                        }
                        className="h-6 text-[10px]"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">
                        Notes
                      </Label>
                      <Textarea
                        value={formData.notes || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, notes: e.target.value })
                        }
                        rows={2}
                        className="text-[10px] resize-none"
                      />
                    </div>
                  </div>
                </details>
              </div>
            </div>

            {/* Footer — fixed, no scroll */}
            <DialogFooter className="px-5 py-3 border-t border-border bg-card-tinted flex-shrink-0 gap-2 sm:justify-end">
              <PillButton
                type="button"
                tone="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </PillButton>
              <PillButton
                type="submit"
                tone="black"
                size="sm"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? "Saving…"
                  : expense
                    ? "Update expense"
                    : "Add expense"}
              </PillButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Vendor Dialog for adding new lead vendors */}
      <LeadVendorDialog
        open={showVendorDialog}
        onOpenChange={setShowVendorDialog}
        onSave={handleAddVendor}
        isLoading={createVendor.isPending}
      />
    </>
  );
}
