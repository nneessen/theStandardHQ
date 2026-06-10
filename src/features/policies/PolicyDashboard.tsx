// src/features/policies/PolicyDashboard.tsx

import React, { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionShell } from "@/components/v2";
import { PolicyDialog } from "./components/PolicyDialog";
import { LeadSourceDialog } from "./components/LeadSourceDialog";
import { useFeatureAccess } from "@/hooks/subscription";
import { LogoSpinner } from "@/components/ui/logo-spinner";
import { PolicyList } from "./PolicyList";
import {
  usePolicies,
  useCreatePolicy,
  useUpdatePolicy,
  usePolicy,
} from "../../hooks/policies";
import { useCarriers } from "../../hooks/carriers";
import { useAuth } from "../../contexts/AuthContext";
// eslint-disable-next-line no-restricted-imports
import { clientService } from "@/services/clients";
import {
  transformFormToCreateData,
  transformFormToUpdateData,
} from "./utils/policyFormTransformer";
import type { NewPolicyForm } from "../../types/policy.types";
import { toast } from "sonner";
import { ValidationError } from "@/errors/ServiceErrors";

// Type for pending lead source attribution
interface PendingLeadSource {
  policyId: string;
  policyNumber: string | null;
}

export const PolicyDashboard: React.FC = () => {
  const [isPolicyFormOpen, setIsPolicyFormOpen] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | undefined>();
  // Lead source attribution dialog state
  const [pendingLeadSource, setPendingLeadSource] =
    useState<PendingLeadSource | null>(null);

  // Field-level validation errors from service layer (e.g., duplicate policy number)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { user } = useAuth();

  // Lead source tracking is a Pro feature
  const {
    hasAccess: canTrackLeadSource,
    isLoading: isLeadSourceAccessLoading,
  } = useFeatureAccess("dashboard");

  // If lead source access resolves to false after policy creation (e.g. the
  // feature check was still loading when the policy was saved), clear the
  // pending lead-source state so the dialog never shows for non-eligible tiers.
  useEffect(() => {
    if (!pendingLeadSource || !user?.id) return;
    if (isLeadSourceAccessLoading || canTrackLeadSource) return;

    setPendingLeadSource(null);
  }, [
    pendingLeadSource,
    user?.id,
    canTrackLeadSource,
    isLeadSourceAccessLoading,
  ]);

  const { isLoading, error, refetch } = usePolicies();
  const { data: editingPolicy, isLoading: isEditingPolicyLoading } =
    usePolicy(editingPolicyId);
  useCarriers();

  const createPolicyMutation = useCreatePolicy();
  const updatePolicyMutation = useUpdatePolicy();

  const handleEditPolicy = (policyId: string) => {
    setEditingPolicyId(policyId);
    setIsPolicyFormOpen(true);
  };

  if (isLoading) {
    return (
      <SectionShell className="dashboard-canvas">
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-v2-ink-muted">
          <LogoSpinner size="sm" className="mr-2" />
          Loading policies...
        </div>
      </SectionShell>
    );
  }

  if (error) {
    return (
      <SectionShell className="dashboard-canvas">
        <div className="mx-auto mt-8 flex max-w-[1820px] items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <AlertCircle size={20} className="text-destructive" />
          <span className="text-destructive font-medium">
            Error loading policies: {(error as Error).message}
          </span>
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            className="ml-auto"
          >
            Retry
          </Button>
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell className="dashboard-canvas">
      <div className="mx-auto flex w-full max-w-[1820px] flex-col gap-5 px-4 py-5 sm:px-8 lg:px-12 lg:py-6">
        <PolicyList
          onEditPolicy={handleEditPolicy}
          onNewPolicy={() => setIsPolicyFormOpen(true)}
        />

        {canTrackLeadSource && pendingLeadSource && (
          <LeadSourceDialog
            open={true}
            onOpenChange={() => {}}
            policyId={pendingLeadSource.policyId}
            policyNumber={pendingLeadSource.policyNumber}
            onComplete={() => {
              setPendingLeadSource(null);
            }}
          />
        )}

        {/* Policy Dialog */}
        <PolicyDialog
          open={isPolicyFormOpen}
          onOpenChange={(open) => {
            setIsPolicyFormOpen(open);
            if (!open) {
              setEditingPolicyId(undefined);
              setFormErrors({});
            }
          }}
          onSave={async (formData: NewPolicyForm) => {
            setFormErrors({});

            if (!user?.id) {
              toast.error("You must be logged in");
              return null;
            }

            try {
              const clientResult = await clientService.createOrFind(
                {
                  name: formData.clientName,
                  email: formData.clientEmail || undefined,
                  phone: formData.clientPhone || undefined,
                  address: JSON.stringify({
                    state: formData.clientState,
                    street: formData.clientStreet || undefined,
                    city: formData.clientCity || undefined,
                    zipCode: formData.clientZipCode || undefined,
                  }),
                  date_of_birth: formData.clientDOB,
                },
                user.id,
              );

              if (!clientResult.success || !clientResult.data) {
                throw (
                  clientResult.error ||
                  new Error("Failed to create/find client")
                );
              }
              const client = clientResult.data;

              if (editingPolicyId) {
                // Update existing policy
                const updateData = transformFormToUpdateData(
                  formData,
                  client.id,
                );
                await updatePolicyMutation.mutateAsync({
                  id: editingPolicyId,
                  updates: updateData,
                });
                toast.success("Policy updated successfully");
                return null;
              } else {
                // Create new policy
                const createData = transformFormToCreateData(
                  formData,
                  client.id,
                  user.id,
                );
                const result =
                  await createPolicyMutation.mutateAsync(createData);
                toast.success(
                  `Policy ${result.policyNumber} created successfully!`,
                );

                if (canTrackLeadSource || isLeadSourceAccessLoading) {
                  // Show the lead-source attribution dialog for eligible tiers.
                  setPendingLeadSource({
                    policyId: result.id,
                    policyNumber: result.policyNumber,
                  });
                }

                return result;
              }
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);

              // Detect network errors and show friendly message
              if (
                errorMessage.toLowerCase().includes("failed to fetch") ||
                errorMessage.toLowerCase().includes("network")
              ) {
                toast.error(
                  "Network error occurred. Please check your connection and try again.",
                  { duration: 5000 },
                );
                throw error;
              }

              // Extract field-level errors from ValidationError
              if (error instanceof ValidationError && error.validationErrors) {
                const fieldErrors: Record<string, string> = {};
                error.validationErrors.forEach((ve) => {
                  fieldErrors[ve.field] = ve.message;
                });
                setFormErrors(fieldErrors);
              } else {
                // Clear any previous field errors if this is a different type of error
                setFormErrors({});
              }

              toast.error(errorMessage);
              throw error;
            }
          }}
          policyId={editingPolicyId}
          policy={editingPolicy}
          isLoadingPolicy={isEditingPolicyLoading}
          externalErrors={formErrors}
          isPending={
            createPolicyMutation.isPending || updatePolicyMutation.isPending
          }
        />
      </div>
    </SectionShell>
  );
};
