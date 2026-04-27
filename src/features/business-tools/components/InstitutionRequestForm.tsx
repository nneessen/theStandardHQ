// src/features/business-tools/components/InstitutionRequestForm.tsx
// Compact form to request support for a new bank/institution

import { useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRequestInstitution } from "../hooks/useBusinessTools";

export function InstitutionRequestForm() {
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState("");
  const [details, setDetails] = useState("");

  const requestInst = useRequestInstitution();

  const handleSubmit = () => {
    if (!name.trim()) return;
    requestInst.mutate(
      {
        institution_name: name.trim(),
        account_type: accountType || undefined,
        details: details.trim() || undefined,
      },
      {
        onSuccess: () => {
          setName("");
          setAccountType("");
          setDetails("");
        },
      },
    );
  };

  return (
    <div className="rounded-lg border border-v2-ring bg-v2-card p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Building2 className="h-3.5 w-3.5 text-v2-ink-muted" />
        <span className="text-[11px] font-medium text-v2-ink-muted">
          Request Institution Support
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Institution name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-7 px-2 text-[11px] border border-v2-ring  rounded bg-v2-card text-v2-ink-muted placeholder:text-v2-ink-subtle flex-1 min-w-[160px]"
        />
        <select
          value={accountType}
          onChange={(e) => setAccountType(e.target.value)}
          className="h-7 px-2 text-[11px] border border-v2-ring  rounded bg-v2-card text-v2-ink-muted"
        >
          <option value="">Account type</option>
          <option value="bank">Bank</option>
          <option value="credit_card">Credit Card</option>
          <option value="investment">Investment</option>
          <option value="loan">Loan</option>
        </select>
      </div>

      <textarea
        placeholder="Additional details (optional)"
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        rows={2}
        className="w-full px-2 py-1.5 text-[11px] border border-v2-ring  rounded bg-v2-card text-v2-ink-muted placeholder:text-v2-ink-subtle resize-none"
      />

      <Button
        size="sm"
        variant="outline"
        className="h-7 text-[11px]"
        disabled={!name.trim() || requestInst.isPending}
        onClick={handleSubmit}
      >
        {requestInst.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
        ) : null}
        Submit Request
      </Button>
    </div>
  );
}
