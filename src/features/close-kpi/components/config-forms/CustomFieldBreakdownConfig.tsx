// src/features/close-kpi/components/config-forms/CustomFieldBreakdownConfig.tsx

import React from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CustomFieldBreakdownConfig as CFConfigType } from "../../types/close-kpi.types";

interface CustomFieldBreakdownConfigProps {
  config: CFConfigType;
  onChange: (config: CFConfigType) => void;
}

// Insurance-specific custom fields from the Close org
// These are the most useful fields for KPI tracking
const INSURANCE_FIELDS = [
  {
    key: "cf_DpAj0GUc0IEugvFBFCaGNPyuiQWrpqXOyK0xw2hILaP",
    label: "Carriers",
    type: "choices",
  },
  {
    key: "cf_hFSXaMgisDPfuURiDRHTHHV5sE6bXHrdpmA0iEtHjBL",
    label: "Application Status",
    type: "choices",
  },
  {
    key: "cf_VlUCHDrEU2MvqnZfTUqLpPlBlML8maQHk5DzSXJLNis",
    label: "Policy Status",
    type: "choices",
  },
  {
    key: "cf_kSUGlWxGYo0yL5xUm6FY258NXfw8r1SipGmvLoAkTnD",
    label: "Agent",
    type: "text",
  },
  {
    key: "cf_DrJS8LEz5uvObHXe47Q6ypJFyUwIHx5GZr3MWau261b",
    label: "Campaign Name",
    type: "text",
  },
  {
    key: "cf_XyM0q3rnu7B61P87NTwGgAjRutd7osz2FAENTyJCdgt",
    label: "Lead Source",
    type: "text",
  },
  {
    key: "cf_DRu8lQqWvup2ROOjiolRioxJL2rPymb7b16G691YTS1",
    label: "Platform",
    type: "text",
  },
  {
    key: "cf_3pAb5SqRVtQoedufljhYgFFvaHwzzWlWx0dYWPF9mjr",
    label: "Monthly Premium",
    type: "text",
  },
  {
    key: "cf_k9CylfMuVQWrFOG00E6xOm30x7vt4jGN4RObV9dI8f9",
    label: "Annual Premium",
    type: "text",
  },
  {
    key: "cf_rwQXrcsUnCuGfu5XtOO9JQZcrCwHVWQLOlHqe4drMn1",
    label: "Face Amount",
    type: "text",
  },
  {
    key: "cf_160xVvqjR222nDq5LTu7Kfvpp1DLgFnseN82TCJGvNb",
    label: "MY AGENTS",
    type: "choices",
  },
  {
    key: "cf_vOWVj4mLqfzD2eBK6qbr6qchoWiJ4YIniGz56ZzV2NP",
    label: "Marital Status",
    type: "text",
  },
  {
    key: "cf_WGuJ1wjVmDonxUw12bIupLtQlPKY3iVN9wySkIcdcnC",
    label: "Military Status",
    type: "text",
  },
  {
    key: "cf_08gyrxKs4Gub1Pj8JK7Yl75KL7ihp65RRcEhGVs0kA5",
    label: "Branch of Service",
    type: "text",
  },
  {
    key: "cf_1dgr3W40WmEh29ZxHLVquZGo3gWQj5UK6QKbJUn1P2f",
    label: "Gender",
    type: "text",
  },
  {
    key: "cf_QxWhUTpCrPtOF2O7SOKxNBswZUbPnuwWazQ1xJXC3B5",
    label: "GOAT Lead Status",
    type: "text",
  },
  {
    key: "cf_tBaIiYTAfmx3QmxrC4EHTWOzt8B4gbsB8r2uChRd09E",
    label: "Policy Pending",
    type: "text",
  },
];

// Group by type for better UX
const POLICY_FIELDS = INSURANCE_FIELDS.filter((f) =>
  [
    "Carriers",
    "Application Status",
    "Policy Status",
    "Policy Pending",
    "Monthly Premium",
    "Annual Premium",
    "Face Amount",
  ].includes(f.label),
);
const LEAD_FIELDS = INSURANCE_FIELDS.filter((f) =>
  [
    "Agent",
    "Campaign Name",
    "Lead Source",
    "Platform",
    "MY AGENTS",
    "GOAT Lead Status",
  ].includes(f.label),
);
const DEMOGRAPHIC_FIELDS = INSURANCE_FIELDS.filter((f) =>
  ["Marital Status", "Military Status", "Branch of Service", "Gender"].includes(
    f.label,
  ),
);

export const CustomFieldBreakdownConfig: React.FC<
  CustomFieldBreakdownConfigProps
> = ({ config, onChange }) => {
  const selectedField = INSURANCE_FIELDS.find(
    (f) => f.key === config.customFieldKey,
  );

  return (
    <div className="space-y-2">
      {/* Custom Field Selection */}
      <div>
        <Label className="text-[10px] text-muted-foreground">
          Custom Field
        </Label>
        <Select
          value={config.customFieldKey || "__none__"}
          onValueChange={(v) => {
            const field = INSURANCE_FIELDS.find((f) => f.key === v);
            onChange({
              ...config,
              customFieldKey: v === "__none__" ? "" : v,
              customFieldLabel: field?.label,
            });
          }}
        >
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue placeholder="Select a field..." />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <SelectGroup>
              <SelectLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Policy & Coverage
              </SelectLabel>
              {POLICY_FIELDS.map((f) => (
                <SelectItem key={f.key} value={f.key} className="text-[11px]">
                  {f.label}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Lead & Source
              </SelectLabel>
              {LEAD_FIELDS.map((f) => (
                <SelectItem key={f.key} value={f.key} className="text-[11px]">
                  {f.label}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectGroup>
              <SelectLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Demographics
              </SelectLabel>
              {DEMOGRAPHIC_FIELDS.map((f) => (
                <SelectItem key={f.key} value={f.key} className="text-[11px]">
                  {f.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {selectedField && (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Field type: {selectedField.type}
          </p>
        )}
      </div>

      {/* Aggregation Type */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Aggregation</Label>
        <Select
          value={config.aggregation}
          onValueChange={(v) =>
            onChange({
              ...config,
              aggregation: v as "count" | "sum" | "average",
            })
          }
        >
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="count">Count of leads</SelectItem>
            <SelectItem value="sum">Sum of values</SelectItem>
            <SelectItem value="average">Average of values</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sort */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Sort</Label>
        <Select
          value={config.sortOrder ?? "count_desc"}
          onValueChange={(v) =>
            onChange({ ...config, sortOrder: v as CFConfigType["sortOrder"] })
          }
        >
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="count_desc">Highest First</SelectItem>
            <SelectItem value="count_asc">Lowest First</SelectItem>
            <SelectItem value="alpha">Alphabetical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Date Range */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Date Range</Label>
        <Select
          value={config.dateRange}
          onValueChange={(v) =>
            onChange({ ...config, dateRange: v as CFConfigType["dateRange"] })
          }
        >
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this_week">This Week</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_30_days">Last 30 Days</SelectItem>
            <SelectItem value="last_90_days">Last 90 Days</SelectItem>
            <SelectItem value="this_quarter">This Quarter</SelectItem>
            <SelectItem value="this_year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
