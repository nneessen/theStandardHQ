// src/features/recruiting/components/ContractingTab.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, Briefcase, Info, Send, Loader2 } from "lucide-react";
import { ContractingRequestCard } from "./contracting/ContractingRequestCard";
import { AddCarrierDialog } from "./contracting/AddCarrierDialog";
import {
  useRecruitCarrierContracts,
  useUpdateCarrierContract,
  useAddCarrierContract,
  useDeleteCarrierContract,
} from "../hooks/useRecruitCarrierContracts";
import { useUplineCarrierContracts } from "../hooks/useUplineCarrierContracts";
import { useQuery } from "@tanstack/react-query";
// eslint-disable-next-line no-restricted-imports
import { supabase } from "@/services/base/supabase";
import { toast } from "sonner";
import type {
  RecruitEntity,
  RecruitPermissions,
} from "../types/recruit-detail.types";

interface ContractingTabProps {
  entity: RecruitEntity;
  permissions: RecruitPermissions;
}

export function ContractingTab({ entity, permissions }: ContractingTabProps) {
  const [showAddCarrierDialog, setShowAddCarrierDialog] = useState(false);
  const [requestingUpdate, setRequestingUpdate] = useState(false);

  // For invitations, don't fetch contracts
  const recruitId = entity.kind === "registered" ? entity.recruitId : undefined;

  // Extract upline info from the recruit
  const uplineId = entity.recruit?.upline_id ?? null;

  // Fetch upline name for all viewers
  const { data: uplineProfile } = useQuery({
    queryKey: ["upline-name", uplineId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("first_name, last_name")
        .eq("id", uplineId!)
        .single();
      return data;
    },
    enabled: !!uplineId,
  });

  const uplineName = uplineProfile
    ? `${uplineProfile.first_name || ""} ${uplineProfile.last_name || ""}`.trim()
    : undefined;

  // Fetch upline's active carrier count for the banner
  const { data: uplineCarrierIds } = useUplineCarrierContracts(uplineId);
  const uplineCarrierCount = uplineCarrierIds?.length ?? 0;

  const {
    data: contractRequests,
    isLoading,
    error,
  } = useRecruitCarrierContracts(recruitId);
  const updateContract = useUpdateCarrierContract(recruitId);
  const addContract = useAddCarrierContract(recruitId);
  const deleteContract = useDeleteCarrierContract(recruitId);

  if (entity.kind === "invitation") {
    return (
      <div className="py-8 text-center">
        <Briefcase className="h-8 w-8 text-v2-ink-subtle mx-auto mb-2" />
        <p className="text-xs text-v2-ink-muted">
          Available after registration
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
        <p className="text-xs text-destructive">Failed to load contracts</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="py-8 text-center">
        <Briefcase className="h-8 w-8 text-v2-ink-subtle mx-auto mb-2 animate-pulse" />
        <p className="text-xs text-v2-ink-muted">Loading contracts...</p>
      </div>
    );
  }

  const handleUpdate = async (id: string, updates: Record<string, unknown>) => {
    await updateContract.mutateAsync({ id, updates });
  };

  const handleAdd = async (carrierId: string) => {
    await addContract.mutateAsync(carrierId);
  };

  const handleDelete = async (id: string) => {
    await deleteContract.mutateAsync(id);
  };

  const handleRequestUpdate = async () => {
    if (!recruitId) return;

    setRequestingUpdate(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "request-upline-contract-update",
        { body: { recruitId } },
      );
      if (error) throw error;
      const method = data?.method === "sms" ? "SMS" : "email";
      toast.success(`Update request sent to ${uplineName} via ${method}`);
    } catch (err) {
      console.error("[ContractingTab] Request update failed:", err);
      toast.error("Failed to send update request");
    } finally {
      setRequestingUpdate(false);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-v2-ink-muted uppercase tracking-wide">
          Carrier Contracts
        </h3>
        {permissions.isStaff && (
          <Button
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => setShowAddCarrierDialog(true)}
          >
            Add Carrier
          </Button>
        )}
      </div>

      {/* Upline context banner */}
      {uplineId && uplineName && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-v2-canvas mb-2">
          <Info className="h-3 w-3 text-v2-ink-subtle flex-shrink-0" />
          <p className="text-[10px] text-v2-ink-muted">
            Carriers available through{" "}
            <span className="font-medium text-v2-ink-muted">{uplineName}</span>
            &apos;s contracts ({uplineCarrierCount} active)
          </p>
          {permissions.isStaff && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-[10px] px-1.5 ml-auto text-v2-ink-muted hover:text-v2-ink dark:hover:text-v2-ink-subtle"
              onClick={handleRequestUpdate}
              disabled={requestingUpdate}
            >
              {requestingUpdate ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Send className="h-3 w-3 mr-1" />
              )}
              Request Update
            </Button>
          )}
        </div>
      )}
      {!uplineId && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-v2-canvas mb-2">
          <Info className="h-3 w-3 text-v2-ink-subtle flex-shrink-0" />
          <p className="text-[10px] text-v2-ink-muted">
            No upline assigned — all carriers available
          </p>
        </div>
      )}

      {contractRequests?.map((request) => (
        <ContractingRequestCard
          key={request.id}
          request={request}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          isStaff={permissions.isStaff}
        />
      ))}

      {(!contractRequests || contractRequests.length === 0) && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No carrier contracts requested yet.
        </div>
      )}

      <AddCarrierDialog
        recruitId={entity.recruitId}
        open={showAddCarrierDialog}
        onClose={() => setShowAddCarrierDialog(false)}
        onAdd={handleAdd}
        uplineId={uplineId}
        uplineName={uplineName}
      />
    </div>
  );
}
