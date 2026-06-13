// src/features/contracting/components/hub/CarrierContractingInfo.tsx
// Per-carrier "what to expect" popover for agents: how this carrier is contracted
// (SureLC / emailed instructions / portal / paper), plus a standing reminder to ask
// the upline before submitting if anything is unclear. Always renders the reminder,
// even when no instructions have been recorded for the carrier yet.

import { Info, ExternalLink, Mail, Clock } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CARRIER_CONTRACTING_METHOD_LABEL,
  type CarrierContractingInstructions,
} from "@/types/carrier.types";

interface CarrierContractingInfoProps {
  carrierName: string;
  instructions: CarrierContractingInstructions | null;
}

export function CarrierContractingInfo({
  carrierName,
  instructions: ci,
}: CarrierContractingInfoProps) {
  const hasAny =
    !!ci &&
    Boolean(
      ci.method ||
      ci.instructions ||
      ci.portal_url ||
      ci.contact_email ||
      ci.processing_time_days,
    );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`How to contract ${carrierName}`}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-white/5 hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3 text-xs">
        <div className="mb-2 text-sm font-semibold">
          How to contract {carrierName}
        </div>

        {ci?.method && (
          <div className="mb-2 inline-flex items-center gap-1.5 rounded bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
            {CARRIER_CONTRACTING_METHOD_LABEL[ci.method]}
          </div>
        )}

        {ci?.instructions && (
          <p className="mb-2 whitespace-pre-wrap text-muted-foreground">
            {ci.instructions}
          </p>
        )}

        {(ci?.portal_url || ci?.contact_email || ci?.processing_time_days) && (
          <div className="mb-2 space-y-1">
            {ci?.portal_url && (
              <a
                href={ci.portal_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="truncate">Carrier portal</span>
              </a>
            )}
            {ci?.contact_email && (
              <a
                href={`mailto:${ci.contact_email}`}
                className="flex items-center gap-1.5 text-primary hover:underline"
              >
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{ci.contact_email}</span>
              </a>
            )}
            {ci?.processing_time_days && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" />
                Typically ~{ci.processing_time_days} day
                {ci.processing_time_days === 1 ? "" : "s"} to process
              </div>
            )}
          </div>
        )}

        {!hasAny && (
          <p className="mb-2 text-muted-foreground">
            No specific contracting instructions are recorded for this carrier
            yet.
          </p>
        )}

        <div className="mt-2 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
          Not sure? Ask your upline before submitting any contract.
        </div>
      </PopoverContent>
    </Popover>
  );
}
