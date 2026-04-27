import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Mail,
  MessageSquare,
  Loader2,
  Copy,
  RotateCcw,
  Trash2,
  Send,
  Eye,
  MousePointer,
  AlertTriangle,
  XCircle,
  Users,
} from "lucide-react";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import {
  useCampaign,
  useCampaignRecipients,
  useDeleteCampaign,
  useResetFailedRecipients,
  useDuplicateCampaign,
} from "../../hooks/useCampaigns";
import { processBulkCampaign } from "../../services/campaignService";
import type { CampaignStatus } from "../../types/marketing.types";

const STATUS_CONFIG: Record<
  CampaignStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className:
      "bg-v2-card-tinted text-v2-ink-muted dark:bg-v2-card-tinted dark:text-v2-ink-subtle",
  },
  sending: {
    label: "Sending",
    className: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  sent: {
    label: "Sent",
    className:
      "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
  scheduled: {
    label: "Scheduled",
    className:
      "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  paused: {
    label: "Paused",
    className:
      "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
  },
  failed: {
    label: "Failed",
    className: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
};

type RecipientFilter = "all" | "sent" | "failed" | "pending";

function pct(num: number, denom: number): string {
  if (!denom) return "0%";
  return `${((num / denom) * 100).toFixed(1)}%`;
}

interface CampaignDetailSheetProps {
  campaignId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CampaignDetailSheet({
  campaignId,
  open,
  onOpenChange,
}: CampaignDetailSheetProps) {
  const { user } = useAuth();
  const { data: campaign, isLoading } = useCampaign(campaignId);
  const { data: recipients, isLoading: recipientsLoading } =
    useCampaignRecipients(campaignId);
  const deleteMutation = useDeleteCampaign();
  const resetFailedMutation = useResetFailedRecipients();
  const duplicateMutation = useDuplicateCampaign();

  const [recipientFilter, setRecipientFilter] =
    useState<RecipientFilter>("all");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [resending, setResending] = useState(false);

  const filteredRecipients = (recipients || []).filter((r) => {
    if (recipientFilter === "all") return true;
    return r.status === recipientFilter;
  });

  const failedCount = (recipients || []).filter(
    (r) => r.status === "failed",
  ).length;
  const sentCount = (recipients || []).filter(
    (r) => r.status === "sent",
  ).length;
  const pendingCount = (recipients || []).filter(
    (r) => r.status === "pending",
  ).length;

  async function handleResendFailed() {
    if (!campaignId || !campaign) return;
    setResending(true);
    try {
      const resetCount = await resetFailedMutation.mutateAsync(campaignId);
      if (resetCount > 0 && campaign.subject_override) {
        let remaining = resetCount;
        while (remaining > 0) {
          const result = await processBulkCampaign(
            campaignId,
            campaign.subject_override,
            "",
          );
          remaining = result.remaining;
        }
      }
      toast.success(`Resent ${resetCount} failed recipients.`);
    } catch {
      toast.error("Failed to resend.");
    } finally {
      setResending(false);
    }
  }

  function handleDuplicate() {
    if (!campaignId || !user?.id) return;
    duplicateMutation.mutate(
      { id: campaignId, userId: user.id },
      {
        onSuccess: () => {
          toast.success("Campaign duplicated as draft.");
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to duplicate campaign."),
      },
    );
  }

  function handleDelete() {
    if (!campaignId) return;
    deleteMutation.mutate(campaignId, {
      onSuccess: () => {
        toast.success("Campaign deleted.");
        setDeleteConfirm(false);
        onOpenChange(false);
      },
      onError: () => toast.error("Failed to delete campaign."),
    });
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" size="lg" className="flex flex-col p-0">
          {isLoading || !campaign ? (
            <div className="flex items-center justify-center flex-1">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Header */}
              <SheetHeader className="px-4 py-3 border-b shrink-0">
                <div className="flex items-center gap-2">
                  {campaign.campaign_type === "email" ? (
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  )}
                  <SheetTitle className="text-sm font-semibold truncate flex-1">
                    {campaign.name}
                  </SheetTitle>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] px-1.5 py-0 h-4 border shrink-0",
                      STATUS_CONFIG[campaign.status].className,
                    )}
                  >
                    {STATUS_CONFIG[campaign.status].label}
                  </Badge>
                </div>
                {campaign.subject_override && (
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    Subject: {campaign.subject_override}
                  </p>
                )}
                <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
                  {campaign.created_at && (
                    <span>
                      Created{" "}
                      {format(new Date(campaign.created_at), "MMM d, yyyy")}
                    </span>
                  )}
                  {campaign.completed_at && (
                    <span>
                      Sent{" "}
                      {format(new Date(campaign.completed_at), "MMM d, yyyy")}
                    </span>
                  )}
                </div>
              </SheetHeader>

              {/* KPI Row */}
              <div className="grid grid-cols-6 gap-1.5 px-4 py-2.5 border-b bg-v2-canvas dark:bg-v2-card shrink-0">
                {[
                  {
                    label: "Recipients",
                    value: campaign.recipient_count,
                    icon: Users,
                    cls: "text-v2-ink-muted",
                  },
                  {
                    label: "Sent",
                    value: campaign.sent_count,
                    icon: Send,
                    cls: "text-blue-500",
                  },
                  {
                    label: "Opened",
                    value: pct(campaign.opened_count, campaign.sent_count),
                    icon: Eye,
                    cls: "text-green-500",
                  },
                  {
                    label: "Clicked",
                    value: pct(campaign.clicked_count, campaign.sent_count),
                    icon: MousePointer,
                    cls: "text-amber-500",
                  },
                  {
                    label: "Bounced",
                    value: pct(campaign.bounced_count, campaign.sent_count),
                    icon: AlertTriangle,
                    cls: "text-orange-500",
                  },
                  {
                    label: "Failed",
                    value: campaign.failed_count,
                    icon: XCircle,
                    cls: "text-red-500",
                  },
                ].map(({ label, value, icon: Icon, cls }) => (
                  <div key={label} className="text-center">
                    <Icon className={cn("h-3 w-3 mx-auto mb-0.5", cls)} />
                    <div className="text-[11px] font-semibold tabular-nums">
                      {value}
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                      {label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 px-4 py-2 border-b shrink-0">
                {failedCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2 gap-1"
                    onClick={handleResendFailed}
                    disabled={resending}
                  >
                    {resending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3 w-3" />
                    )}
                    Resend Failed ({failedCount})
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] px-2 gap-1"
                  onClick={handleDuplicate}
                  disabled={duplicateMutation.isPending}
                >
                  {duplicateMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  Duplicate
                </Button>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] px-2 gap-1 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  onClick={() => setDeleteConfirm(true)}
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </Button>
              </div>

              {/* Recipient Filter Tabs */}
              <div className="flex items-center gap-0.5 px-4 py-1.5 border-b shrink-0">
                {(
                  [
                    {
                      key: "all",
                      label: "All",
                      count: recipients?.length ?? 0,
                    },
                    { key: "sent", label: "Sent", count: sentCount },
                    { key: "failed", label: "Failed", count: failedCount },
                    { key: "pending", label: "Pending", count: pendingCount },
                  ] as const
                ).map(({ key, label, count }) => (
                  <button
                    key={key}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full transition-colors",
                      recipientFilter === key
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                    onClick={() => setRecipientFilter(key)}
                  >
                    {label} ({count})
                  </button>
                ))}
              </div>

              {/* Recipients Table */}
              <div className="flex-1 overflow-auto min-h-0">
                {recipientsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="text-[10px] font-medium text-muted-foreground h-7 py-0 px-3">
                          Email
                        </TableHead>
                        <TableHead className="text-[10px] font-medium text-muted-foreground h-7 py-0 px-3">
                          Name
                        </TableHead>
                        <TableHead className="text-[10px] font-medium text-muted-foreground h-7 py-0 px-3">
                          Status
                        </TableHead>
                        <TableHead className="text-[10px] font-medium text-muted-foreground h-7 py-0 px-3">
                          Sent At
                        </TableHead>
                        <TableHead className="text-[10px] font-medium text-muted-foreground h-7 py-0 px-3">
                          Error
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecipients.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="py-8 text-center text-[11px] text-muted-foreground"
                          >
                            No recipients match this filter.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredRecipients.map((r) => (
                          <TableRow key={r.id} className="hover:bg-muted/30">
                            <TableCell className="py-1 px-3 text-[11px] truncate max-w-[180px]">
                              {r.email_address}
                            </TableCell>
                            <TableCell className="py-1 px-3 text-[11px] text-muted-foreground">
                              {[r.first_name, r.last_name]
                                .filter(Boolean)
                                .join(" ") || "—"}
                            </TableCell>
                            <TableCell className="py-1 px-3">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[9px] h-3.5 px-1 font-normal capitalize",
                                  r.status === "sent" &&
                                    "bg-green-50 text-green-600 border-green-200",
                                  r.status === "failed" &&
                                    "bg-red-50 text-red-600 border-red-200",
                                  r.status === "pending" &&
                                    "bg-v2-canvas text-v2-ink-muted border-v2-ring",
                                )}
                              >
                                {r.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-1 px-3 text-[10px] text-muted-foreground whitespace-nowrap">
                              {r.sent_at
                                ? format(new Date(r.sent_at), "MMM d, h:mm a")
                                : "—"}
                            </TableCell>
                            <TableCell className="py-1 px-3 text-[10px] text-red-500 truncate max-w-[150px]">
                              {r.error_message || ""}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold">
              Delete Campaign
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[11px]">
              This will permanently delete the campaign and all recipient data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-7 text-[11px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-7 text-[11px] bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
