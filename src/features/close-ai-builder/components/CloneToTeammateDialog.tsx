// CloneToTeammateDialog
//
// Confirmation dialog for the cross-org "Clone to teammate" action in the
// Close AI Builder library. Lets the caller pick one teammate (single-select),
// optionally rename the clone, then confirms with a destructive-styled action.
//
// The mutation goes to the close-ai-builder edge function which authorizes
// (downlines + immediate siblings + super-admin) and writes to the target
// teammate's Close org via their own API key. See plan
// `dazzling-hatching-flute.md` and migration 20260408085031.
//
// UX notes:
// - Single-select picker (not bulk) by design — prevents accidental mass-pushes
// - Pre-fills name with the source name; user can rename
// - Shows source/destination summary before confirming
// - Stays open on error for retry; closes only on success
// - Soft warnings (hardcoded names/phones/merge fields) surface in success toast

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDown,
  Building2,
  Loader2,
  Search,
  Send,
  UserCircle,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCloneEmailToUser,
  useCloneSequenceToUser,
  useCloneSmsToUser,
  useCloseAiConnectionStatus,
} from "../hooks/useCloseAiBuilder";
import { useCloneEligibleTeammates } from "../hooks/useCloneEligibleTeammates";
import { CloseAiBuilderError } from "../services/closeAiBuilderService";
import type {
  CloneEligibleTeammate,
  CloseEmailTemplate,
  CloseSequence,
  CloseSmsTemplate,
} from "../types/close-ai-builder.types";

export type CloneTarget =
  | { kind: "email"; item: CloseEmailTemplate }
  | { kind: "sms"; item: CloseSmsTemplate }
  | { kind: "sequence"; item: CloseSequence };

interface CloneToTeammateDialogProps {
  open: boolean;
  onClose: () => void;
  target: CloneTarget | null;
}

export function CloneToTeammateDialog({
  open,
  onClose,
  target,
}: CloneToTeammateDialogProps) {
  const teammatesQuery = useCloneEligibleTeammates(open);
  const connectionStatus = useCloseAiConnectionStatus();
  const cloneEmail = useCloneEmailToUser();
  const cloneSms = useCloneSmsToUser();
  const cloneSequence = useCloneSequenceToUser();

  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [nameOverride, setNameOverride] = useState("");

  // Reset internal state every time the dialog opens with a new target.
  useEffect(() => {
    if (open && target) {
      setSearch("");
      setSelectedUserId(null);
      setNameOverride(target.item.name);
    }
  }, [open, target]);

  const teammates = teammatesQuery.data ?? [];
  const filteredTeammates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teammates;
    return teammates.filter((t) => {
      const name = `${t.first_name ?? ""} ${t.last_name ?? ""}`.toLowerCase();
      return (
        name.includes(q) ||
        t.email.toLowerCase().includes(q) ||
        (t.organization_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [teammates, search]);

  const selectedTeammate = useMemo(
    () => teammates.find((t) => t.user_id === selectedUserId) ?? null,
    [teammates, selectedUserId],
  );

  const isPending =
    cloneEmail.isPending || cloneSms.isPending || cloneSequence.isPending;

  const itemKindLabel = target
    ? target.kind === "email"
      ? "email template"
      : target.kind === "sms"
        ? "SMS template"
        : "workflow"
    : "item";

  const handleConfirm = () => {
    if (!target || !selectedTeammate) return;
    const trimmedName = nameOverride.trim();
    const finalName =
      trimmedName && trimmedName !== target.item.name ? trimmedName : undefined;

    const onSuccess = (res: { warnings: string[] }) => {
      const teammateName =
        selectedTeammate.first_name?.trim() ||
        selectedTeammate.last_name?.trim() ||
        selectedTeammate.email;
      const warningSuffix =
        res.warnings.length > 0
          ? ` (${res.warnings.length} warning${res.warnings.length > 1 ? "s" : ""})`
          : "";
      toast.success(
        `Cloned ${itemKindLabel} to ${teammateName}${warningSuffix}`,
        {
          description:
            res.warnings.length > 0 ? res.warnings.join(" • ") : undefined,
        },
      );
      onClose();
    };

    const onError = (err: unknown) => {
      const e = err instanceof CloseAiBuilderError ? err : null;
      const msg = e?.isCrossOrgForbidden
        ? "You can only clone to your downline or peers under the same upline."
        : e?.isTargetNotConnected
          ? "Your teammate's Close account is not connected or is inactive."
          : e?.isSourceChildMissing
            ? "One of the workflow's templates was deleted from your Close org. Cannot clone."
            : e?.isInvalidCloneTarget
              ? "Invalid clone target."
              : err instanceof Error
                ? err.message
                : "Clone failed";
      toast.error(msg);
      // Dialog stays open so the user can retry or pick another teammate.
    };

    if (target.kind === "email") {
      cloneEmail.mutate(
        {
          sourceTemplateId: target.item.id,
          targetUserId: selectedTeammate.user_id,
          nameOverride: finalName,
        },
        { onSuccess, onError },
      );
    } else if (target.kind === "sms") {
      cloneSms.mutate(
        {
          sourceTemplateId: target.item.id,
          targetUserId: selectedTeammate.user_id,
          nameOverride: finalName,
        },
        { onSuccess, onError },
      );
    } else {
      cloneSequence.mutate(
        {
          sourceSequenceId: target.item.id,
          targetUserId: selectedTeammate.user_id,
          nameOverride: finalName,
        },
        { onSuccess, onError },
      );
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && !isPending) onClose();
  };

  const teammateButtonLabel = selectedTeammate
    ? `Clone to ${selectedTeammate.first_name?.trim() || "teammate"}`
    : "Clone to teammate";

  const callerOrgName = connectionStatus.data?.organization_name ?? null;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4 text-blue-500" />
            Clone {itemKindLabel} to teammate
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs">
            {target ? (
              <>
                Source:{" "}
                <span className="font-medium text-foreground">
                  {target.item.name}
                </span>
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Warning callout */}
        <div className="flex items-start gap-2 rounded-md border border-amber-300/50 bg-amber-50/60 p-2.5 text-[11px] text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            This creates an <strong>independent copy</strong> in your teammate's
            Close CRM. Future edits to your version will not sync. The clone
            cannot be undone automatically — your teammate would need to delete
            it themselves.
          </span>
        </div>

        {/* Teammate picker */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Send to teammate</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teammates…"
              className="h-8 pl-8 text-xs"
              disabled={isPending}
            />
          </div>
          <div className="max-h-48 overflow-y-auto rounded-md border">
            {teammatesQuery.isLoading ? (
              <div className="space-y-1 p-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded p-1.5"
                  >
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : teammatesQuery.isError ? (
              <div className="p-3 text-center text-xs text-red-500">
                Failed to load teammates.
              </div>
            ) : filteredTeammates.length === 0 ? (
              <div className="p-3 text-center text-xs text-muted-foreground">
                {teammates.length === 0
                  ? "No teammates with Close connected yet. Invite a teammate or have them connect their Close account in Settings."
                  : "No teammates match your search."}
              </div>
            ) : (
              <ul className="divide-y">
                {filteredTeammates.map((t) => (
                  <TeammateRow
                    key={t.user_id}
                    teammate={t}
                    selected={selectedUserId === t.user_id}
                    disabled={isPending}
                    onSelect={() => setSelectedUserId(t.user_id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Name override */}
        <div className="space-y-1.5">
          <Label htmlFor="clone-name" className="text-xs font-medium">
            Name in their library
          </Label>
          <Input
            id="clone-name"
            value={nameOverride}
            onChange={(e) => setNameOverride(e.target.value)}
            placeholder="Template name"
            className="h-8 text-xs"
            disabled={isPending || !selectedTeammate}
          />
        </div>

        {/* Confirmation summary — only when a teammate is picked */}
        {selectedTeammate && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <UserCircle className="h-3.5 w-3.5" />
              <span>
                From: <span className="font-medium text-foreground">You</span>
                {callerOrgName ? (
                  <span className="text-muted-foreground">
                    {" "}
                    ({callerOrgName})
                  </span>
                ) : null}
              </span>
            </div>
            <div className="my-1 flex justify-center text-muted-foreground">
              <ArrowDown className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              <span>
                To:{" "}
                <span className="font-medium text-foreground">
                  {[selectedTeammate.first_name, selectedTeammate.last_name]
                    .filter(Boolean)
                    .join(" ") || selectedTeammate.email}
                </span>
                {selectedTeammate.organization_name ? (
                  <span className="text-muted-foreground">
                    {" "}
                    ({selectedTeammate.organization_name})
                  </span>
                ) : null}
              </span>
            </div>
            <div className="mt-1 truncate text-[11px] text-muted-foreground">
              Will appear as:{" "}
              <span className="font-medium text-foreground">
                {nameOverride.trim() || target?.item.name || "(unnamed)"}
              </span>
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!selectedTeammate || isPending}
          >
            {isPending && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            {teammateButtonLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function TeammateRow({
  teammate,
  selected,
  disabled,
  onSelect,
}: {
  teammate: CloneEligibleTeammate;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const displayName =
    [teammate.first_name, teammate.last_name].filter(Boolean).join(" ") ||
    teammate.email;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors ${
          selected ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-muted/50"
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium">{displayName}</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {teammate.organization_name ?? "Close connected"}
          </div>
        </div>
        {selected && (
          <span className="shrink-0 rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
            selected
          </span>
        )}
      </button>
    </li>
  );
}
