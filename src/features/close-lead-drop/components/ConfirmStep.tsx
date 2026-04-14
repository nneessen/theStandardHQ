// Step 4: Review summary and confirm the drop.

import type { ReactNode } from "react";
import {
  ChevronLeft,
  Users,
  Tag,
  GitBranch,
  Layers,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  DropRecipient,
  RecipientSequence,
  SmartView,
} from "../types/lead-drop.types";

interface ConfirmStepProps {
  smartView: SmartView;
  selectedCount: number;
  recipient: DropRecipient;
  leadSourceLabel: string;
  sequence: RecipientSequence | null;
  isDropping: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

export function ConfirmStep({
  smartView,
  selectedCount,
  recipient,
  leadSourceLabel,
  sequence,
  isDropping,
  onConfirm,
  onBack,
}: ConfirmStepProps) {
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Confirm Lead Drop</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Review everything before dropping. This action cannot be undone.
        </p>
      </div>

      <div className="border rounded-md divide-y divide-border">
        <SummaryRow
          icon={<Layers className="h-3.5 w-3.5 text-muted-foreground" />}
          label="Smart View"
          value={smartView.name}
        />
        <SummaryRow
          icon={<Users className="h-3.5 w-3.5 text-muted-foreground" />}
          label="Leads"
          value={`${selectedCount} lead${selectedCount !== 1 ? "s" : ""}`}
        />
        <SummaryRow
          icon={
            recipient.profile_photo_url ? (
              <img
                src={recipient.profile_photo_url}
                alt=""
                className="h-3.5 w-3.5 rounded-full object-cover"
              />
            ) : (
              <div className="h-3.5 w-3.5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold">
                {recipient.full_name.charAt(0)}
              </div>
            )
          }
          label="Recipient"
          value={recipient.full_name}
        />
        <SummaryRow
          icon={<Tag className="h-3.5 w-3.5 text-muted-foreground" />}
          label="Lead Source"
          value={leadSourceLabel}
        />
        <SummaryRow
          icon={<GitBranch className="h-3.5 w-3.5 text-muted-foreground" />}
          label="Sequence"
          value={sequence ? sequence.name : "None"}
          muted={!sequence}
        />
        <SummaryRow
          icon={<ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />}
          label="Smart View in recipient's CRM"
          value={`Lead Drop from You – ${todayStr}`}
        />
      </div>

      <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
        {selectedCount} lead{selectedCount !== 1 ? "s" : ""} will be{" "}
        <strong>created</strong> in {recipient.full_name}'s Close CRM. This
        cannot be undone.
      </div>

      <div className="flex items-center justify-between pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          disabled={isDropping}
          className="gap-1.5 text-xs"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </Button>
        <Button
          size="sm"
          onClick={onConfirm}
          disabled={isDropping}
          className="gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white"
        >
          {isDropping
            ? "Starting…"
            : `Drop ${selectedCount} Lead${selectedCount !== 1 ? "s" : ""}`}
        </Button>
      </div>
    </div>
  );
}

function SummaryRow({
  icon,
  label,
  value,
  muted = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className="shrink-0">{icon}</span>
      <span className="text-xs text-muted-foreground w-36 shrink-0">
        {label}
      </span>
      <span
        className={[
          "text-xs font-medium truncate",
          muted ? "text-muted-foreground" : "",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}
