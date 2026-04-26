// src/features/policies/PolicyDashboard.tsx

import React, { useState, useRef, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PolicyDialog } from "./components/PolicyDialog";
import { FirstSellerNamingDialog } from "./components/FirstSellerNamingDialog";
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
// eslint-disable-next-line no-restricted-imports
import { supabase } from "@/services/base/supabase";
import {
  transformFormToCreateData,
  transformFormToUpdateData,
} from "./utils/policyFormTransformer";
import type { NewPolicyForm } from "../../types/policy.types";
import { toast } from "sonner";
import { ValidationError } from "@/errors/ServiceErrors";

// Type for unified first-sale group (single dialog for all channels)
interface PendingFirstSaleGroup {
  groupId: string;
  agencyName: string;
  totalChannels: number;
  channelNames: string[];
}

// Type for pending lead source attribution
interface PendingLeadSource {
  policyId: string;
  policyNumber: string | null;
}

// Polling configuration for first-seller check
// Reduced from 15x1s to 5x3s to cut DB load while still catching edge function cold starts
const FIRST_SELLER_POLL_MAX_ATTEMPTS = 5;
const FIRST_SELLER_POLL_INTERVAL_MS = 3000;
// Background check interval to catch missed first sales (e.g., user returned to page)
const FIRST_SELLER_BACKGROUND_CHECK_INTERVAL_MS = 120000; // 2 minutes (was 30s)

export const PolicyDashboard: React.FC = () => {
  const [isPolicyFormOpen, setIsPolicyFormOpen] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | undefined>();
  // Unified first sale group - single dialog for all channels
  const [pendingFirstSaleGroup, setPendingFirstSaleGroup] =
    useState<PendingFirstSaleGroup | null>(null);
  // Lead source attribution dialog state
  const [pendingLeadSource, setPendingLeadSource] =
    useState<PendingLeadSource | null>(null);

  // Field-level validation errors from service layer (e.g., duplicate policy number)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Ref to track active polling and allow cancellation
  const pollingAbortRef = useRef<AbortController | null>(null);

  const { user } = useAuth();

  // Lead source tracking is a Pro feature
  const {
    hasAccess: canTrackLeadSource,
    isLoading: isLeadSourceAccessLoading,
  } = useFeatureAccess("dashboard");

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingAbortRef.current) {
        pollingAbortRef.current.abort();
      }
    };
  }, []);

  // Background check for pending first sales on mount and periodically
  // This catches cases where user missed the dialog or returned to the page
  useEffect(() => {
    if (!user?.id) return;

    // Check immediately on mount (handles page refresh, navigation back, etc.)
    const checkOnMount = async () => {
      // Don't interfere if LeadSourceDialog or FirstSellerNamingDialog is open
      if (pendingLeadSource || pendingFirstSaleGroup) return;

      try {
        const { data, error } = await supabase.rpc(
          "check_first_seller_naming_unified",
          { p_user_id: user.id },
        );

        if (error) {
          console.error("Background first seller check error:", error);
          return;
        }

        if (data && data.length > 0) {
          const groupData = data[0];
          if (groupData.needs_naming || groupData.has_pending_notification) {
            console.log(
              "Background check found pending first sale:",
              groupData.first_sale_group_id,
            );
            setPendingFirstSaleGroup({
              groupId: groupData.first_sale_group_id,
              agencyName: groupData.agency_name,
              totalChannels: groupData.total_channels,
              channelNames: groupData.channel_names || [],
            });
          }
        }
      } catch (err) {
        console.error("Background first seller check failed:", err);
      }
    };

    // Initial check on mount
    checkOnMount();

    // Periodic background check to catch missed first sales
    const intervalId = setInterval(() => {
      // Only check if no dialogs are open
      if (!pendingLeadSource && !pendingFirstSaleGroup) {
        checkOnMount();
      }
    }, FIRST_SELLER_BACKGROUND_CHECK_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [user?.id, pendingLeadSource, pendingFirstSaleGroup]);

  const checkFirstSeller = async (userId: string) => {
    // Cancel any existing polling before starting new one
    if (pollingAbortRef.current) {
      pollingAbortRef.current.abort();
    }

    const abortController = new AbortController();
    pollingAbortRef.current = abortController;

    // The edge function triggered by the DB runs asynchronously and takes ~1-2 seconds.
    // We poll multiple times to catch the first-sale pending state when it's created.
    for (let attempt = 0; attempt < FIRST_SELLER_POLL_MAX_ATTEMPTS; attempt++) {
      // Check if polling was cancelled
      if (abortController.signal.aborted) {
        return;
      }

      try {
        // Use unified RPC that returns single group with all channel info
        const { data, error } = await supabase.rpc(
          "check_first_seller_naming_unified",
          {
            p_user_id: userId,
          },
        );

        if (abortController.signal.aborted) {
          return;
        }

        if (error) {
          console.error("Error checking first seller:", error);
          return;
        }

        // RPC returns a single row with group info (or empty if no pending first sale)
        if (data && data.length > 0) {
          const groupData = data[0];
          if (groupData.needs_naming || groupData.has_pending_notification) {
            setPendingFirstSaleGroup({
              groupId: groupData.first_sale_group_id,
              agencyName: groupData.agency_name,
              totalChannels: groupData.total_channels,
              channelNames: groupData.channel_names || [],
            });
            return; // Found pending group, stop polling
          }
        }

        // If no data yet and we haven't exhausted attempts, wait and try again
        if (attempt < FIRST_SELLER_POLL_MAX_ATTEMPTS - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, FIRST_SELLER_POLL_INTERVAL_MS),
          );
        }
      } catch (err) {
        if (abortController.signal.aborted) {
          return;
        }
        console.error("Error checking first seller:", err);
        return;
      }
    }
  };

  // If lead source access resolves to false after policy creation, clear the pending
  // lead-source state and continue to first-seller detection for all tiers.
  useEffect(() => {
    if (!pendingLeadSource || pendingFirstSaleGroup || !user?.id) return;
    if (isLeadSourceAccessLoading || canTrackLeadSource) return;

    setPendingLeadSource(null);
    checkFirstSeller(user.id);
  }, [
    pendingLeadSource,
    pendingFirstSaleGroup,
    user?.id,
    canTrackLeadSource,
    isLeadSourceAccessLoading,
    checkFirstSeller,
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
      <>
        <LogoSpinner size="sm" className="mr-2" />
        Loading policies...
      </>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-500/10 rounded-lg border border-red-200 dark:border-red-800">
        <AlertCircle size={20} className="text-red-600 dark:text-red-400" />
        <span className="text-red-600 dark:text-red-400 font-medium">
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
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PolicyList
        onEditPolicy={handleEditPolicy}
        onNewPolicy={() => setIsPolicyFormOpen(true)}
      />

      {canTrackLeadSource && pendingLeadSource && !pendingFirstSaleGroup && (
        <LeadSourceDialog
          open={true}
          onOpenChange={() => {}}
          policyId={pendingLeadSource.policyId}
          policyNumber={pendingLeadSource.policyNumber}
          onComplete={() => {
            setPendingLeadSource(null);
            if (user?.id && !pendingFirstSaleGroup) {
              checkFirstSeller(user.id);
            }
          }}
        />
      )}

      {/* First Seller Naming Dialog - unified single dialog for all channels */}
      {pendingFirstSaleGroup && (
        <FirstSellerNamingDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setPendingFirstSaleGroup(null);
            }
          }}
          groupId={pendingFirstSaleGroup.groupId}
          agencyName={pendingFirstSaleGroup.agencyName}
          totalChannels={pendingFirstSaleGroup.totalChannels}
          channelNames={pendingFirstSaleGroup.channelNames}
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
                clientResult.error || new Error("Failed to create/find client")
              );
            }
            const client = clientResult.data;

            if (editingPolicyId) {
              // Update existing policy
              const updateData = transformFormToUpdateData(formData, client.id);
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
              const result = await createPolicyMutation.mutateAsync(createData);
              toast.success(
                `Policy ${result.policyNumber} created successfully!`,
              );

              if (canTrackLeadSource || isLeadSourceAccessLoading) {
                // Show lead source dialog BEFORE checking first seller
                // The dialog's onComplete will trigger checkFirstSeller
                setPendingLeadSource({
                  policyId: result.id,
                  policyNumber: result.policyNumber,
                });
              } else {
                // Free tier skips lead source attribution, but should still
                // continue to first-seller detection.
                checkFirstSeller(user.id);
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
  );
};
