// src/features/recruiting/components/interactive/SignatureRequiredItem.tsx

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CheckCircle2,
  PenTool,
  Clock,
  AlertCircle,
  Users,
  Send,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { SignatureRequiredMetadata } from "@/types/signature.types";
import type { SignatureResponse } from "@/types/recruiting.types";
import {
  useSubmissionByChecklistProgress,
  useCreateSignatureSubmission,
} from "@/hooks/signatures";
import { useAgencyWithOwner } from "@/hooks/imo";
import { useAuth } from "@/contexts/AuthContext";
import { useImo } from "@/contexts/ImoContext";
import { SIGNER_ROLE_LABELS } from "@/types/signature.types";

interface SignatureRequiredItemProps {
  progressId: string;
  metadata: SignatureRequiredMetadata;
  existingResponse?: SignatureResponse | null;
  recruitId: string;
  recruitEmail: string;
  recruitName: string;
  onComplete?: () => void;
}

import type { SubmissionStatus } from "@/types/signature.types";

type StatusConfig = {
  label: string;
  color: string;
  icon: typeof PenTool;
};

const STATUS_CONFIG: Record<SubmissionStatus, StatusConfig> = {
  pending: {
    label: "Pending Signatures",
    color: "bg-warning/20 text-warning dark:bg-warning/30 dark:text-warning",
    icon: Clock,
  },
  in_progress: {
    label: "In Progress",
    color: "bg-info/20 text-info dark:bg-info/30 dark:text-info",
    icon: Send,
  },
  completed: {
    label: "Completed",
    color: "bg-success/20 text-success dark:bg-success/30 dark:text-success",
    icon: CheckCircle2,
  },
  declined: {
    label: "Declined",
    color:
      "bg-destructive/20 text-destructive dark:bg-destructive/30 dark:text-destructive",
    icon: XCircle,
  },
  expired: {
    label: "Expired",
    color:
      "bg-destructive/20 text-destructive dark:bg-destructive/30 dark:text-destructive",
    icon: AlertCircle,
  },
  voided: {
    label: "Voided",
    color: "bg-v2-ring text-v2-ink  dark:text-v2-ink-subtle",
    icon: XCircle,
  },
};

export function SignatureRequiredItem({
  progressId,
  metadata,
  existingResponse,
  recruitId,
  recruitEmail,
  recruitName,
  onComplete,
}: SignatureRequiredItemProps) {
  const { user } = useAuth();
  const { agency } = useImo();
  const [isInitiating, setIsInitiating] = useState(false);

  // Fetch agency with owner info for agency_owner role
  const { data: agencyWithOwner } = useAgencyWithOwner(agency?.id);

  const { data: submission, isLoading: submissionLoading } =
    useSubmissionByChecklistProgress(progressId, {
      enabled: !existingResponse,
    });

  const createSubmission = useCreateSignatureSubmission();

  const handleInitiateSignature = useCallback(async () => {
    if (!user || !agency) {
      toast.error("Unable to initiate signature request");
      return;
    }

    setIsInitiating(true);
    try {
      // Get user display name from email (first part before @)
      const getUserName = (email: string | undefined): string => {
        if (!email) return "";
        return email.split("@")[0];
      };

      // Build submitter list based on required signer roles
      const submitters = metadata.required_signer_roles.map((role, index) => {
        if (role === "recruit") {
          return {
            role,
            email: recruitEmail,
            name: recruitName,
            userId: recruitId,
            signingOrder:
              metadata.signing_order === "sequential" ? index + 1 : undefined,
          };
        } else if (role === "recruiter") {
          // The current user is the recruiter initiating the request
          return {
            role,
            email: user.email || "",
            name: getUserName(user.email),
            userId: user.id,
            signingOrder:
              metadata.signing_order === "sequential" ? index + 1 : undefined,
          };
        } else if (role === "agency_owner") {
          // Use actual agency owner from fetched data
          const owner = agencyWithOwner?.owner;
          if (owner) {
            const ownerName =
              [owner.first_name, owner.last_name].filter(Boolean).join(" ") ||
              getUserName(owner.email);
            return {
              role,
              email: owner.email || "",
              name: ownerName,
              userId: owner.id,
              signingOrder:
                metadata.signing_order === "sequential" ? index + 1 : undefined,
            };
          }
          // Fallback to current user if owner not loaded (shouldn't happen)
          return {
            role,
            email: user.email || "",
            name: getUserName(user.email),
            userId: user.id,
            signingOrder:
              metadata.signing_order === "sequential" ? index + 1 : undefined,
          };
        }
        return {
          role,
          email: "",
          name: "",
          signingOrder:
            metadata.signing_order === "sequential" ? index + 1 : undefined,
        };
      });

      await createSubmission.mutateAsync({
        templateId: metadata.template_id,
        agencyId: agency.id,
        targetUserId: recruitId,
        checklistProgressId: progressId,
        initiatedBy: user.id,
        expiresAt: metadata.expires_in_days
          ? new Date(
              Date.now() + metadata.expires_in_days * 24 * 60 * 60 * 1000,
            ).toISOString()
          : undefined,
        submitters,
      });

      toast.success("Signature request initiated");
      onComplete?.();
    } catch (error) {
      console.error("Failed to initiate signature request:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to initiate signature request",
      );
    } finally {
      setIsInitiating(false);
    }
  }, [
    user,
    agency,
    agencyWithOwner,
    metadata,
    recruitId,
    recruitEmail,
    recruitName,
    progressId,
    createSubmission,
    onComplete,
  ]);

  // Loading state
  if (submissionLoading && !existingResponse) {
    return (
      <div className="flex items-center gap-1 text-xs text-v2-ink-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading...
      </div>
    );
  }

  // Determine current status from response or submission
  const currentStatus =
    existingResponse?.submission_status || submission?.status;
  const signersCompleted = existingResponse?.signers_completed || 0;
  const signersTotal =
    existingResponse?.signers_total || metadata.required_signer_roles.length;

  // If completed, show success state
  if (currentStatus === "completed") {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-xs text-success">
          <CheckCircle2 className="h-3.5 w-3.5" />
          All signatures complete ({signersTotal}/{signersTotal})
        </span>
        {existingResponse?.completed_at && (
          <span className="text-[10px] text-v2-ink-muted">
            {new Date(existingResponse.completed_at).toLocaleDateString()}
          </span>
        )}
      </div>
    );
  }

  // If no submission yet, show initiate button
  if (!currentStatus) {
    return (
      <div className="space-y-1">
        <div className="flex items-start gap-2">
          <PenTool className="h-3.5 w-3.5 text-v2-ink-subtle mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-medium text-v2-ink-muted">
              E-Signature Required
            </p>
            <div className="flex flex-wrap gap-1">
              {metadata.required_signer_roles.map((role) => (
                <Badge
                  key={role}
                  variant="outline"
                  className="h-4 text-[10px] px-1.5 gap-1"
                >
                  <Users className="h-2.5 w-2.5" />
                  {SIGNER_ROLE_LABELS[role]}
                </Badge>
              ))}
            </div>
            {metadata.custom_message && (
              <p className="text-[10px] text-v2-ink-muted italic">
                "{metadata.custom_message}"
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handleInitiateSignature}
            disabled={isInitiating || createSubmission.isPending}
            size="sm"
            className="h-7 text-xs px-3 gap-1.5 bg-success hover:bg-success"
          >
            {isInitiating || createSubmission.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {metadata.auto_send ? "Send Request" : "Initiate"}
          </Button>

          {metadata.expires_in_days && (
            <span className="text-[10px] text-v2-ink-subtle">
              Expires in {metadata.expires_in_days} days
            </span>
          )}
        </div>
      </div>
    );
  }

  // In-progress state
  const statusConfig = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-1">
      {/* Status Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <StatusIcon className="h-3.5 w-3.5 text-v2-ink-muted" />
          <Badge className={`${statusConfig.color} h-4 text-[10px] px-1.5`}>
            {statusConfig.label}
          </Badge>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-v2-ink-muted">
          <Users className="h-3 w-3" />
          {signersCompleted}/{signersTotal}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-0.5">
        <div className="h-1.5 bg-v2-ring rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(signersCompleted / signersTotal) * 100}%` }}
          />
        </div>
        <p className="text-[10px] text-v2-ink-muted">
          Waiting for signatures...
        </p>
      </div>

      {/* Signer Status */}
      <div className="space-y-0.5">
        {metadata.required_signer_roles.map((role, index) => {
          const hasSigned = index < signersCompleted;
          return (
            <div
              key={role}
              className="flex items-center justify-between p-1 bg-v2-canvas rounded text-[10px]"
            >
              <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
                {SIGNER_ROLE_LABELS[role]}
              </span>
              {hasSigned ? (
                <span className="inline-flex items-center gap-0.5 text-success">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Signed
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-v2-ink-muted">
                  <Clock className="h-2.5 w-2.5" />
                  Pending
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
