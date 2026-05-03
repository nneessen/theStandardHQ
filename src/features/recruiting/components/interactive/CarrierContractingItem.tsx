// src/features/recruiting/components/interactive/CarrierContractingItem.tsx

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Check, AlertCircle, FileText } from "lucide-react";
import { toast } from "sonner";
// eslint-disable-next-line no-restricted-imports
import { carrierContractRequestService } from "@/services/recruiting/carrierContractRequestService";
// eslint-disable-next-line no-restricted-imports
import { checklistResponseService } from "@/services/recruiting/checklistResponseService";
import type {
  CarrierContractingMetadata,
  CarrierContractingResponse,
} from "@/types/recruiting.types";

interface CarrierContractingItemProps {
  progressId: string;
  metadata: CarrierContractingMetadata;
  existingResponse?: CarrierContractingResponse | null;
  recruitId: string;
  isUpline?: boolean;
  onComplete?: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  requested: {
    label: "Requested",
    className:
      "bg-v2-ring text-v2-ink-muted border-v2-ring  dark:text-v2-ink-subtle ",
  },
  in_progress: {
    label: "In Progress",
    className:
      "bg-info/10 text-info border-info/30 dark:bg-info/10 dark:text-info dark:border-info",
  },
  writing_received: {
    label: "Writing Received",
    className:
      "bg-warning/10 text-warning border-warning/30 dark:bg-warning/10 dark:text-warning dark:border-warning",
  },
  completed: {
    label: "Completed",
    className:
      "bg-success/10 text-success border-success/30 dark:bg-success/10 dark:text-success dark:border-success",
  },
  rejected: {
    label: "Rejected",
    className:
      "bg-destructive/10 text-destructive border-destructive/30 dark:bg-destructive/10 dark:text-destructive dark:border-destructive",
  },
  cancelled: {
    label: "Cancelled",
    className:
      "bg-v2-canvas text-v2-ink-subtle border-v2-ring  dark:text-v2-ink-muted ",
  },
};

export function CarrierContractingItem({
  progressId,
  metadata,
  existingResponse,
  recruitId,
  isUpline,
  onComplete,
}: CarrierContractingItemProps) {
  const queryClient = useQueryClient();
  const [editingWritingNumbers, setEditingWritingNumbers] = useState<
    Record<string, string>
  >({});
  const autoCompleteInFlight = useRef(false);

  // Fetch carrier contract requests for this recruit
  const {
    data: contracts,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["recruit-carrier-contracts", recruitId],
    queryFn: () =>
      carrierContractRequestService.getRecruitContractRequests(recruitId),
    enabled: !!recruitId,
  });

  // Mutation for updating writing number
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      writingNumber,
    }: {
      id: string;
      writingNumber: string;
    }) =>
      carrierContractRequestService.updateContractRequest(id, {
        writing_number: writingNumber || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["recruit-carrier-contracts", recruitId],
      });
      // Invalidate contracting dashboard queries for bidirectional sync
      queryClient.invalidateQueries({
        queryKey: ["contract-requests-filtered"],
      });
    },
    onError: (err: Error) => {
      toast.error(`Failed to save writing number: ${err.message}`);
    },
  });

  // Calculate completion state based on writing numbers being filled
  const completedCount =
    contracts?.filter((c) => !!c.writing_number?.trim()).length ?? 0;
  const totalCount = contracts?.length ?? 0;
  const requiredCount =
    metadata.completion_criteria === "count"
      ? (metadata.required_count ?? totalCount)
      : totalCount;
  const isComplete = totalCount > 0 && completedCount >= requiredCount;

  // Auto-complete when criteria met
  useEffect(() => {
    if (
      !isComplete ||
      autoCompleteInFlight.current ||
      existingResponse?.completed
    ) {
      return;
    }
    if (totalCount === 0) return;

    autoCompleteInFlight.current = true;

    checklistResponseService
      .submitCarrierContractingResponse(progressId, completedCount, totalCount)
      .then((result) => {
        if (result.success) {
          onComplete?.();
        } else {
          autoCompleteInFlight.current = false;
        }
      })
      .catch(() => {
        autoCompleteInFlight.current = false;
      });
  }, [
    isComplete,
    totalCount,
    completedCount,
    progressId,
    existingResponse?.completed,
    onComplete,
  ]);

  const canEditWritingNumber =
    isUpline || metadata.allow_recruit_edit_writing_number;

  const handleWritingNumberChange = useCallback(
    (contractId: string, value: string) => {
      setEditingWritingNumbers((prev) => ({ ...prev, [contractId]: value }));
    },
    [],
  );

  const handleWritingNumberSave = useCallback(
    (contractId: string, currentValue: string | null) => {
      const newValue = editingWritingNumbers[contractId];
      if (newValue === undefined) return;
      if (newValue === (currentValue ?? "")) return;

      updateMutation.mutate({ id: contractId, writingNumber: newValue });
      setEditingWritingNumbers((prev) => {
        const next = { ...prev };
        delete next[contractId];
        return next;
      });
    },
    [editingWritingNumbers, updateMutation],
  );

  // Completed state - minimal inline indicator
  if (existingResponse?.completed) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success dark:text-success">
        <Check className="h-3.5 w-3.5" />
        {existingResponse.carriers_completed} of{" "}
        {existingResponse.carriers_total} carriers contracted
      </span>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-v2-ink-subtle">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading carriers...
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-destructive">
        <AlertCircle className="h-3.5 w-3.5" />
        Failed to load carrier contracts
      </div>
    );
  }

  // Empty state
  if (!contracts || contracts.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-v2-ink-subtle">
        <FileText className="h-3.5 w-3.5" />
        No carriers assigned yet. Carriers are added via the Contracting tab.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-v2-ink-muted">
          {completedCount} of {requiredCount} carriers contracted
        </span>
        <div className="flex-1 h-1.5 bg-v2-ring rounded-full overflow-hidden max-w-[200px]">
          <div
            className="h-full bg-success rounded-full transition-all duration-300"
            style={{
              width: `${requiredCount > 0 ? Math.min((completedCount / requiredCount) * 100, 100) : 0}%`,
            }}
          />
        </div>
      </div>

      {/* General instructions */}
      {metadata.general_instructions && (
        <p className="text-xs text-v2-ink-muted italic">
          {metadata.general_instructions}
        </p>
      )}

      {/* Carrier list */}
      <div className="space-y-1">
        {contracts.map((contract) => {
          const statusConfig =
            STATUS_CONFIG[contract.status] ?? STATUS_CONFIG.requested;
          const editValue = editingWritingNumbers[contract.id];
          const displayValue = editValue ?? contract.writing_number ?? "";
          const isSaving =
            updateMutation.isPending &&
            updateMutation.variables?.id === contract.id;

          return (
            <div key={contract.id} className="flex items-center gap-2 py-0.5">
              {/* Carrier name */}
              <span className="text-sm font-medium text-v2-ink-muted min-w-[120px] truncate">
                {contract.carrier?.name ?? "Unknown Carrier"}
              </span>

              {/* Status badge */}
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 h-5 font-normal ${statusConfig.className}`}
              >
                {statusConfig.label}
              </Badge>

              {/* Writing number */}
              {canEditWritingNumber ? (
                <Input
                  value={displayValue}
                  onChange={(e) =>
                    handleWritingNumberChange(contract.id, e.target.value)
                  }
                  onBlur={() =>
                    handleWritingNumberSave(
                      contract.id,
                      contract.writing_number,
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleWritingNumberSave(
                        contract.id,
                        contract.writing_number,
                      );
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  placeholder="Writing #"
                  className="h-7 text-xs w-32 px-2"
                  disabled={isSaving}
                />
              ) : (
                <span className="text-xs text-v2-ink-muted min-w-[80px]">
                  {contract.writing_number || "—"}
                </span>
              )}

              {/* Writing number filled indicator */}
              {contract.writing_number?.trim() && (
                <Check className="h-3 w-3 text-success flex-shrink-0" />
              )}

              {/* Saving indicator */}
              {isSaving && (
                <Loader2 className="h-3 w-3 animate-spin text-v2-ink-subtle flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
