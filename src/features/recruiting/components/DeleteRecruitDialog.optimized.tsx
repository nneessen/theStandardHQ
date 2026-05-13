// DeleteRecruitDialog - HARD DELETE only (no soft delete/archive)

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
// eslint-disable-next-line no-restricted-imports
import { enhancedRecruitingService } from "@/services/recruiting/recruitingService.enhanced";
// eslint-disable-next-line no-restricted-imports
import { supabase } from "@/services/base/supabase";
import type { UserProfile } from "@/types/hierarchy.types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { hierarchyKeys } from "@/hooks";
import { UserSearchCombobox } from "@/components/shared/user-search-combobox";

interface DeleteRecruitDialogProps {
  recruit: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DeleteRecruitDialogOptimized({
  recruit,
  open,
  onOpenChange,
  onSuccess,
}: DeleteRecruitDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [reassignUplineId, setReassignUplineId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Get current user for audit trail
  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user;
    },
  });

  // Fetch downlines for reassignment check
  const { data: downlines, isLoading: checkingDownlines } = useQuery({
    queryKey: hierarchyKeys.downline(
      recruit?.id ?? "unknown",
      undefined,
      "direct",
    ),
    queryFn: async () => {
      if (!recruit) return [];
      const { data } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("upline_id", recruit.id);
      return data || [];
    },
    enabled: open && !!recruit,
  });

  // Compute exclude IDs for upline search (recruit + their downlines)
  const excludeIdsForUplineSearch = useMemo(() => {
    if (!recruit) return [];
    const downlineIds = downlines?.map((d) => d.id) || [];
    return [recruit.id, ...downlineIds];
  }, [recruit, downlines]);

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      setReassignUplineId(null);
    }
  }, [open]);

  const handleReassignAndDelete = useCallback(async () => {
    if (!recruit || !currentUser || !reassignUplineId) return;

    setDeleting(true);
    try {
      const reassignResult = await enhancedRecruitingService.reassignDownlines(
        recruit.id,
        reassignUplineId,
      );

      if (!reassignResult.success) {
        throw new Error(reassignResult.error || "Failed to reassign downlines");
      }

      toast.success(`Reassigned ${reassignResult.count} downline(s)`);
      await handleDelete();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- error object type
    } catch (error: any) {
      console.error("Failed to reassign and delete:", error);
      toast.error(error.message || "Failed to reassign downlines");
      setDeleting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleDelete is defined below but stable
  }, [recruit, currentUser, reassignUplineId]);

  const handleDelete = useCallback(async () => {
    if (!recruit || !currentUser) return;

    const recruitName =
      `${recruit.first_name} ${recruit.last_name}`.trim() || recruit.email;

    setDeleting(true);
    try {
      // Use admin_deleteuser RPC for hard delete
      const { data, error } = await supabase.rpc("admin_deleteuser", {
        target_user_id: recruit.id,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data && typeof data === "object" && data.success === false) {
        throw new Error(data.error || "Failed to delete recruit");
      }

      toast.success(`Permanently deleted ${recruitName}`);

      // Wipe per-recruit caches that are now invalid (useRecruitById, etc.)
      queryClient.removeQueries({ queryKey: ["recruits", recruit.id] });
      queryClient.removeQueries({ queryKey: ["user-profiles", recruit.id] });

      // Invalidate every recruit-related list/count/stat so currently-mounted
      // observers refetch immediately and any inactive queries are marked stale.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["recruits"] }),
        queryClient.invalidateQueries({ queryKey: ["user-profiles"] }),
        queryClient.invalidateQueries({ queryKey: ["recruit-invitations"] }),
        queryClient.invalidateQueries({
          queryKey: ["pending-invitations-count"],
        }),
        queryClient.invalidateQueries({ queryKey: ["recruiting-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["recruit-phase-progress"] }),
        queryClient.invalidateQueries({ queryKey: ["current-phase"] }),
      ]);

      // Force inactive recruits queries (e.g. dashboard list while user is on
      // the detail page) to refetch BEFORE we navigate, so landing on /recruiting
      // shows fresh data with no flash of stale-cache.
      await queryClient.refetchQueries({
        queryKey: ["recruits"],
        type: "all",
      });

      onOpenChange(false);
      onSuccess?.();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- error object type
    } catch (error: any) {
      console.error("Failed to delete recruit:", error);
      toast.error(
        error.message || `Failed to delete ${recruitName}. Please try again.`,
      );
    } finally {
      setDeleting(false);
    }
  }, [recruit, currentUser, onOpenChange, onSuccess, queryClient]);

  if (!recruit) return null;

  const hasDownlines = (downlines?.length ?? 0) > 0;
  const downlineCount = downlines?.length ?? 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-1 text-sm">
            <AlertTriangle className="h-3 w-3 text-destructive" />
            Delete Recruit
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-1">
              <p className="text-xs">
                Permanently delete{" "}
                <span className="font-medium">
                  {recruit.first_name} {recruit.last_name}
                </span>
                ?
              </p>

              {/* Loading state */}
              {checkingDownlines && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  Checking downlines...
                </div>
              )}

              {/* Downlines warning and reassignment */}
              {!checkingDownlines && hasDownlines && (
                <Alert className="py-1 px-1.5 border-warning/50 bg-warning/10">
                  <Users className="h-2.5 w-2.5" />
                  <AlertDescription className="text-[11px]">
                    <p className="font-medium mb-0.5">
                      Has {downlineCount} downline
                      {downlineCount > 1 ? "s" : ""}
                    </p>
                    <div className="space-y-0.5">
                      <p className="text-[10px]">Reassign to:</p>
                      <UserSearchCombobox
                        value={reassignUplineId}
                        onChange={setReassignUplineId}
                        excludeIds={excludeIdsForUplineSearch}
                        roles={["agent", "admin"]}
                        approvalStatus="approved"
                        placeholder="Search for new upline..."
                        showNoUplineOption={false}
                        className="h-6"
                      />
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Warning - CASCADE delete will handle all related data */}
              {!checkingDownlines && (
                <Alert className="py-1 px-1.5 border-destructive bg-destructive/10">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  <AlertDescription className="text-[10px] text-destructive font-medium">
                    This action cannot be undone! All related data (policies,
                    commissions, etc.) will be deleted.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-1">
          <AlertDialogCancel disabled={deleting} className="h-7 text-xs">
            Cancel
          </AlertDialogCancel>
          {hasDownlines && reassignUplineId ? (
            <AlertDialogAction
              onClick={handleReassignAndDelete}
              disabled={deleting || checkingDownlines}
              className="bg-warning hover:bg-warning h-7 text-xs"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Reassigning...
                </>
              ) : (
                <>
                  <Users className="mr-1 h-3 w-3" />
                  Reassign & Delete
                </>
              )}
            </AlertDialogAction>
          ) : (
            <AlertDialogAction
              onClick={handleDelete}
              disabled={
                deleting ||
                checkingDownlines ||
                (hasDownlines && !reassignUplineId)
              }
              className="bg-destructive hover:bg-destructive/90 h-7 text-xs"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-1 h-3 w-3" />
                  {hasDownlines && !reassignUplineId
                    ? "Select Upline"
                    : "Delete"}
                </>
              )}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
