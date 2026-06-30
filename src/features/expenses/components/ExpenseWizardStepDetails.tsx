// src/features/expenses/components/ExpenseWizardStepDetails.tsx

import React from "react";
import {
  Briefcase,
  User,
  DollarSign,
  Calendar,
  Plus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CreateExpenseData } from "@/types/expense.types";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/types/expense.types";
import type { LeadFreshness, LeadVendor } from "@/types/lead-purchase.types";
import { ExpenseStepIntro } from "./ExpenseStepIntro";
import { fieldClass, LABEL, ERROR_TEXT } from "./expenseFormStyles";
import { costPerLead, formatUSD } from "./expenseWizardCalc";
import type {
  LeadPurchaseFields,
  ExpenseFormErrors,
} from "./expenseWizardTypes";

interface ExpenseWizardStepDetailsProps {
  formData: CreateExpenseData;
  setFormData: React.Dispatch<React.SetStateAction<CreateExpenseData>>;
  leadFields: LeadPurchaseFields;
  setLeadFields: React.Dispatch<React.SetStateAction<LeadPurchaseFields>>;
  errors: ExpenseFormErrors;
  vendors: LeadVendor[];
  onAddVendor: () => void;
}

// Quick category buttons for common expenses.
// label = button text, name = actual category value stored in DB.
const QUICK_CATEGORIES: Array<{
  label: string;
  name: string;
  type: "business" | "personal";
}> = [
  { label: "Meals", name: "Meals & Entertainment", type: "business" },
  { label: "Travel", name: "Travel", type: "business" },
  { label: "Office", name: "Office Supplies", type: "business" },
  { label: "Leads", name: "Life Insurance Leads", type: "business" },
  { label: "Groceries", name: "Groceries", type: "personal" },
];

/** Step 1 — the required essentials plus the conditional lead-purchase block. */
export const ExpenseWizardStepDetails: React.FC<
  ExpenseWizardStepDetailsProps
> = ({
  formData,
  setFormData,
  leadFields,
  setLeadFields,
  errors,
  vendors,
  onAddVendor,
}) => {
  const isLeadCategory = formData.category === "Life Insurance Leads";
  const parsedLeads = parseInt(leadFields.leadCount, 10);
  const perLead =
    parsedLeads > 0 ? costPerLead(formData.amount || 0, parsedLeads) : 0;

  return (
    <div className="space-y-5">
      <ExpenseStepIntro title="Expense details">
        Start with the basics — what it was, how much, when, and which bucket it
        belongs in.
      </ExpenseStepIntro>

      {/* Name */}
      <div className="space-y-1.5">
        <Label className={LABEL}>
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className={fieldClass(!!errors.name)}
          placeholder="e.g., Lunch with client"
          autoFocus
        />
        {errors.name && <p className={ERROR_TEXT}>{errors.name}</p>}
      </div>

      {/* Amount + Date */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className={LABEL}>
            Amount <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formData.amount || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  amount:
                    e.target.value === "" ? 0 : parseFloat(e.target.value),
                })
              }
              className={cn(fieldClass(!!errors.amount), "pl-9 font-mono")}
              placeholder="0.00"
            />
          </div>
          {errors.amount && <p className={ERROR_TEXT}>{errors.amount}</p>}
        </div>

        <div className="space-y-1.5">
          <Label className={LABEL}>
            Date <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
              className={cn(fieldClass(false), "pl-9")}
            />
          </div>
        </div>
      </div>

      {/* Type — segmented control */}
      <div className="space-y-1.5">
        <Label className={LABEL}>
          Type <span className="text-destructive">*</span>
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: "business", label: "Business", Icon: Briefcase },
              { value: "personal", label: "Personal", Icon: User },
            ] as const
          ).map(({ value, label, Icon }) => {
            const active = formData.expense_type === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setFormData({ ...formData, expense_type: value })
                }
                className={cn(
                  "flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors",
                  active
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border/60 bg-background text-muted-foreground hover:border-border",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Category — quick pills + grouped select */}
      <div className="space-y-1.5">
        <Label className={LABEL}>
          Category <span className="text-destructive">*</span>
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              type="button"
              onClick={() =>
                setFormData({
                  ...formData,
                  category: cat.name,
                  expense_type: cat.type,
                })
              }
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                formData.category === cat.name
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border/60 bg-background text-muted-foreground hover:border-border",
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <Select
          value={formData.category}
          onValueChange={(value) =>
            setFormData({ ...formData, category: value })
          }
        >
          <SelectTrigger className={fieldClass(!!errors.category)}>
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Business
            </div>
            {DEFAULT_EXPENSE_CATEGORIES.filter(
              (cat) => cat.type === "business",
            ).map((cat) => (
              <SelectItem key={cat.name} value={cat.name}>
                {cat.name}
              </SelectItem>
            ))}
            <div className="mt-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Personal
            </div>
            {DEFAULT_EXPENSE_CATEGORIES.filter(
              (cat) => cat.type === "personal",
            ).map((cat) => (
              <SelectItem key={cat.name} value={cat.name}>
                {cat.name}
              </SelectItem>
            ))}
            <div className="mt-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Other
            </div>
            {DEFAULT_EXPENSE_CATEGORIES.filter(
              (cat) => cat.type === "general",
            ).map((cat) => (
              <SelectItem key={cat.name} value={cat.name}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.category && <p className={ERROR_TEXT}>{errors.category}</p>}
      </div>

      {/* Lead purchase block — only for the Life Insurance Leads category */}
      {isLeadCategory && (
        <div className="space-y-3 rounded-xl border border-info/30 bg-info/10 p-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-info" />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-info">
              Lead purchase details
            </span>
          </div>

          <div className="space-y-1.5">
            <Label className={LABEL}>
              Vendor <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <Select
                value={leadFields.vendorId}
                onValueChange={(value) =>
                  setLeadFields({ ...leadFields, vendorId: value })
                }
              >
                <SelectTrigger
                  className={cn(fieldClass(!!errors.vendorId), "flex-1")}
                >
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={onAddVendor}
                className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-border/60 bg-background text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                aria-label="Add vendor"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {errors.vendorId && <p className={ERROR_TEXT}>{errors.vendorId}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className={LABEL}>
                # of Leads <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                min="1"
                value={leadFields.leadCount}
                onChange={(e) =>
                  setLeadFields({ ...leadFields, leadCount: e.target.value })
                }
                className={fieldClass(!!errors.leadCount)}
                placeholder="50"
              />
              {errors.leadCount && (
                <p className={ERROR_TEXT}>{errors.leadCount}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className={LABEL}>Lead type</Label>
              <Select
                value={leadFields.leadFreshness}
                onValueChange={(value: LeadFreshness) =>
                  setLeadFields({ ...leadFields, leadFreshness: value })
                }
              >
                <SelectTrigger className={fieldClass(false)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fresh">Fresh (High-Intent)</SelectItem>
                  <SelectItem value="aged">Aged</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className={LABEL}>Pack name (optional)</Label>
            <Input
              value={leadFields.purchaseName}
              onChange={(e) =>
                setLeadFields({ ...leadFields, purchaseName: e.target.value })
              }
              className={fieldClass(false)}
              placeholder="e.g., January 2026 Pack"
            />
          </div>

          {perLead > 0 && (
            <div className="rounded-lg bg-info/15 px-3 py-2 text-xs font-medium text-info">
              Cost per lead: {formatUSD(perLead)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
