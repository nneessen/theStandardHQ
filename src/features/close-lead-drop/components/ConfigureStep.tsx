// Step 3: Choose recipient, lead source label, smart view name, and optional sequence.

import { useEffect, useState } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useLeadDropRecipients,
  useLeadDropRecipientSequences,
} from "../hooks/useLeadDrop";
import type {
  DropRecipient,
  RecipientSequence,
} from "../types/lead-drop.types";

interface ConfigureStepProps {
  recipient: DropRecipient | null;
  leadSourceLabel: string;
  recipientSmartViewName: string;
  sequence: RecipientSequence | null;
  selectedCount: number;
  onRecipientChange: (r: DropRecipient) => void;
  onLeadSourceChange: (label: string) => void;
  onRecipientSmartViewNameChange: (name: string) => void;
  onSequenceChange: (s: RecipientSequence | null) => void;
  onNext: () => void;
  onBack: () => void;
}

export function ConfigureStep({
  recipient,
  leadSourceLabel,
  recipientSmartViewName,
  sequence,
  selectedCount,
  onRecipientChange,
  onLeadSourceChange,
  onRecipientSmartViewNameChange,
  onSequenceChange,
  onNext,
  onBack,
}: ConfigureStepProps) {
  const [recipientSearch, setRecipientSearch] = useState("");

  const {
    data: recipientsData,
    isLoading: loadingRecipients,
    error: recipientsError,
  } = useLeadDropRecipients();
  const { data: seqData, isLoading: loadingSeqs } =
    useLeadDropRecipientSequences(recipient?.id ?? null);

  const recipients = (recipientsData?.recipients ?? []).filter((r) =>
    recipientSearch
      ? r.full_name.toLowerCase().includes(recipientSearch.toLowerCase()) ||
        r.email.toLowerCase().includes(recipientSearch.toLowerCase())
      : true,
  );

  const sequences = seqData?.sequences ?? [];
  const canNext =
    !!recipient &&
    leadSourceLabel.trim().length > 0 &&
    recipientSmartViewName.trim().length > 0;

  const todayStr = new Date().toISOString().slice(0, 10);

  // When the sender hasn't chosen a Smart View name yet, offer a sensible
  // default the moment they pick a lead source label. They can still edit it.
  useEffect(() => {
    if (!recipientSmartViewName && leadSourceLabel.trim()) {
      onRecipientSmartViewNameChange(`${leadSourceLabel.trim()} – ${todayStr}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadSourceLabel]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold">Configure Drop</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {selectedCount} lead{selectedCount !== 1 ? "s" : ""} will be created
          in the recipient's Close CRM.
        </p>
      </div>

      {/* Recipient picker */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Send to</Label>
        {recipientsError && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            {recipientsError.message}
          </div>
        )}
        {loadingRecipients && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading teammates…
          </div>
        )}
        {!loadingRecipients && !recipientsError && (
          <div className="space-y-1">
            <Input
              placeholder="Search teammates…"
              value={recipientSearch}
              onChange={(e) => setRecipientSearch(e.target.value)}
              className="h-8 text-xs"
            />
            <div className="border rounded-md divide-y divide-border max-h-40 overflow-y-auto overscroll-contain">
              {recipients.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  No teammates with Close connected found.
                </p>
              )}
              {recipients.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onRecipientChange(r)}
                  className={[
                    "w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/60 transition-colors",
                    recipient?.id === r.id ? "bg-muted" : "",
                  ].join(" ")}
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold overflow-hidden">
                    {r.profile_photo_url ? (
                      <img
                        src={r.profile_photo_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      r.full_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {r.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.organization_name
                        ? `${r.email} · ${r.organization_name}`
                        : r.email}
                    </p>
                  </div>
                  {recipient?.id === r.id && (
                    <div className="h-2 w-2 rounded-full bg-success shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lead source label */}
      <div className="space-y-1.5">
        <Label htmlFor="lead-source" className="text-xs font-medium">
          Lead Source Label
        </Label>
        <Input
          id="lead-source"
          placeholder="e.g. Aged Internet – April 2026"
          value={leadSourceLabel}
          onChange={(e) => onLeadSourceChange(e.target.value)}
          className="h-8 text-xs"
          maxLength={100}
        />
        <p className="text-xs text-muted-foreground">
          Stamped on each created lead as the Lead Source custom field.
        </p>
      </div>

      {/* Smart View name — what the recipient will see in their Close CRM */}
      <div className="space-y-1.5">
        <Label htmlFor="recipient-sv-name" className="text-xs font-medium">
          Smart View Name
        </Label>
        <Input
          id="recipient-sv-name"
          placeholder="e.g. Aged Internet – April 2026"
          value={recipientSmartViewName}
          onChange={(e) => onRecipientSmartViewNameChange(e.target.value)}
          className="h-8 text-xs"
          maxLength={100}
        />
        <p className="text-xs text-muted-foreground">
          The Smart View created in {recipient?.full_name ?? "the recipient"}'s
          Close CRM will use this exact name.
        </p>
      </div>

      {/* Sequence picker */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">
          Workflow / Sequence{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        {!recipient && (
          <p className="text-xs text-muted-foreground">
            Select a recipient first.
          </p>
        )}
        {recipient && loadingSeqs && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading sequences…
          </div>
        )}
        {recipient && !loadingSeqs && (
          <div className="border rounded-md divide-y divide-border max-h-36 overflow-y-auto overscroll-contain">
            <button
              onClick={() => onSequenceChange(null)}
              className={[
                "w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/60 transition-colors",
                sequence === null ? "bg-muted" : "",
              ].join(" ")}
            >
              <div
                className={[
                  "flex h-3.5 w-3.5 shrink-0 rounded-full border-2",
                  sequence === null
                    ? "border-success bg-success"
                    : "border-border",
                ].join(" ")}
              />
              <span className="text-xs text-muted-foreground">
                Skip — no sequence
              </span>
            </button>
            {sequences.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                No sequences found in {recipient.full_name}'s Close account.
              </p>
            )}
            {sequences.map((s) => (
              <button
                key={s.id}
                onClick={() => onSequenceChange(s)}
                className={[
                  "w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/60 transition-colors",
                  sequence?.id === s.id ? "bg-muted" : "",
                ].join(" ")}
              >
                <div
                  className={[
                    "flex h-3.5 w-3.5 shrink-0 rounded-full border-2",
                    sequence?.id === s.id
                      ? "border-success bg-success"
                      : "border-border",
                  ].join(" ")}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium truncate block">
                    {s.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {s.steps_count} step{s.steps_count !== 1 ? "s" : ""}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Smart View note */}
      {recipient && recipientSmartViewName.trim() && (
        <div className="flex items-start gap-2 rounded-md border border-info/20 bg-info/5 px-3 py-2">
          <Info className="h-3.5 w-3.5 text-info shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            A Smart View named{" "}
            <span className="font-medium text-foreground">
              "{recipientSmartViewName.trim()}"
            </span>{" "}
            will be created in{" "}
            <span className="font-medium text-foreground">
              {recipient.full_name}
            </span>
            's Close account, showing all dropped leads.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1.5 text-xs"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </Button>
        <Button
          size="sm"
          onClick={onNext}
          disabled={!canNext}
          className="gap-1.5 text-xs"
        >
          Review
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
