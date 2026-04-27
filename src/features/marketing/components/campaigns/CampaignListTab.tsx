import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Trash2, Mail, MessageSquare, Loader2 } from "lucide-react";
import { format } from "date-fns";
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
import { useCampaigns, useDeleteCampaign } from "../../hooks/useCampaigns";
import type { CampaignStatus } from "../../types/marketing.types";
import type { EmailBlock } from "@/types/email.types";
import { CampaignDetailSheet } from "./CampaignDetailSheet";
import { saveCampaignPrefill } from "../../utils/campaign-prefill";

const STATUS_CONFIG: Record<
  CampaignStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className:
      "bg-v2-card-tinted text-v2-ink-muted dark:bg-v2-card-tinted dark:text-v2-ink-subtle border-v2-ring dark:border-v2-ring-strong",
  },
  sending: {
    label: "Sending",
    className:
      "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  },
  sent: {
    label: "Sent",
    className:
      "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 border-green-200 dark:border-green-800",
  },
  scheduled: {
    label: "Scheduled",
    className:
      "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  },
  paused: {
    label: "Paused",
    className:
      "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
  },
  failed: {
    label: "Failed",
    className:
      "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-800",
  },
};

function pct(num: number, denom: number): string {
  if (!denom) return "—";
  return `${((num / denom) * 100).toFixed(1)}%`;
}

interface CampaignListTabProps {
  initialBlocks?: EmailBlock[];
  initialSubject?: string;
}

export function CampaignListTab({
  initialBlocks,
  initialSubject,
}: CampaignListTabProps) {
  const navigate = useNavigate();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const didAutoPrefillNavigate = useRef(false);

  const { data: campaigns, isLoading, error } = useCampaigns();
  const deleteMutation = useDeleteCampaign();

  function handleDeleteConfirm() {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId, {
      onSuccess: () => {
        toast.success("Campaign deleted.");
        setDeleteId(null);
      },
      onError: () => {
        toast.error("Failed to delete campaign.");
        setDeleteId(null);
      },
    });
  }

  function handleRowClick(campaignId: string, status: CampaignStatus) {
    if (status === "draft") {
      navigate({ to: `/marketing/campaigns/${campaignId}/edit` });
    } else {
      setDetailId(campaignId);
    }
  }

  useEffect(() => {
    if (!initialBlocks || didAutoPrefillNavigate.current) return;

    const prefillId = saveCampaignPrefill({
      blocks: initialBlocks,
      subject: initialSubject,
    });
    didAutoPrefillNavigate.current = true;

    if (!prefillId) {
      toast.error(
        "Could not preload template content. Opening a blank campaign instead.",
      );
      navigate({ to: "/marketing/campaigns/new" });
      return;
    }

    navigate({
      to: "/marketing/campaigns/new",
      search: { prefill: prefillId },
    });
  }, [initialBlocks, initialSubject, navigate]);

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[11px] text-muted-foreground">
          {campaigns?.length ?? 0} campaign{campaigns?.length !== 1 ? "s" : ""}
        </p>
        <Button
          size="sm"
          className="h-6 px-2 text-[10px] gap-1"
          onClick={() => navigate({ to: "/marketing/campaigns/new" })}
        >
          <Plus className="h-3 w-3" />
          New Campaign
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border border-border bg-v2-canvas dark:bg-v2-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="h-8 bg-v2-card-tinted dark:bg-v2-card-tinted hover:bg-v2-card-tinted dark:hover:bg-v2-card-tinted">
              <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide py-0 pl-3 w-[220px]">
                Name
              </TableHead>
              <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide py-0 w-[70px]">
                Type
              </TableHead>
              <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide py-0 w-[90px]">
                Status
              </TableHead>
              <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide py-0 text-right w-[90px]">
                Recipients
              </TableHead>
              <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide py-0 text-right w-[70px]">
                Sent
              </TableHead>
              <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide py-0 text-right w-[80px]">
                Opened
              </TableHead>
              <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide py-0 text-right w-[80px]">
                Clicked
              </TableHead>
              <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide py-0 w-[100px]">
                Created
              </TableHead>
              <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide py-0 pr-3 w-[60px]">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}

            {error && !isLoading && (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-6 text-center text-[11px] text-red-500"
                >
                  Failed to load campaigns.
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !error && (!campaigns || campaigns.length === 0) && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <Mail className="h-5 w-5 text-muted-foreground/40" />
                    <p className="text-[11px] text-muted-foreground">
                      No campaigns yet.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[10px] gap-1 mt-1"
                      onClick={() =>
                        navigate({ to: "/marketing/campaigns/new" })
                      }
                    >
                      <Plus className="h-3 w-3" />
                      Create your first campaign
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              !error &&
              campaigns?.map((campaign) => {
                const statusCfg = STATUS_CONFIG[campaign.status];
                const openRate = pct(
                  campaign.opened_count,
                  campaign.sent_count,
                );
                const clickRate = pct(
                  campaign.clicked_count,
                  campaign.sent_count,
                );

                return (
                  <TableRow
                    key={campaign.id}
                    className="py-1.5 hover:bg-v2-card-tinted/60 dark:hover:bg-v2-card-tinted/60 border-b border-border/60 last:border-0 cursor-pointer"
                    onClick={() => handleRowClick(campaign.id, campaign.status)}
                  >
                    {/* Name */}
                    <TableCell className="py-1.5 pl-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-medium leading-tight truncate max-w-[200px]">
                          {campaign.name}
                        </span>
                        {campaign.subject_override && (
                          <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                            {campaign.subject_override}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Type */}
                    <TableCell className="py-1.5">
                      <div className="flex items-center gap-1">
                        {campaign.campaign_type === "email" ? (
                          <Mail className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <MessageSquare className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span className="text-[10px] text-muted-foreground capitalize">
                          {campaign.campaign_type}
                        </span>
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-1.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-medium px-1.5 py-0 h-4 border",
                          statusCfg.className,
                        )}
                      >
                        {statusCfg.label}
                      </Badge>
                    </TableCell>

                    {/* Recipients */}
                    <TableCell className="py-1.5 text-right">
                      <span className="text-[11px] tabular-nums">
                        {campaign.recipient_count.toLocaleString()}
                      </span>
                    </TableCell>

                    {/* Sent */}
                    <TableCell className="py-1.5 text-right">
                      <span className="text-[11px] tabular-nums">
                        {campaign.sent_count.toLocaleString()}
                      </span>
                    </TableCell>

                    {/* Opened */}
                    <TableCell className="py-1.5 text-right">
                      <div className="flex flex-col items-end gap-0">
                        <span className="text-[11px] tabular-nums">
                          {campaign.opened_count.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {openRate}
                        </span>
                      </div>
                    </TableCell>

                    {/* Clicked */}
                    <TableCell className="py-1.5 text-right">
                      <div className="flex flex-col items-end gap-0">
                        <span className="text-[11px] tabular-nums">
                          {campaign.clicked_count.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {clickRate}
                        </span>
                      </div>
                    </TableCell>

                    {/* Created */}
                    <TableCell className="py-1.5">
                      <span className="text-[11px] text-muted-foreground">
                        {campaign.created_at
                          ? format(new Date(campaign.created_at), "MMM d, yyyy")
                          : "—"}
                      </span>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-1.5 pr-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(campaign.id);
                        }}
                        disabled={
                          deleteMutation.isPending && deleteId === campaign.id
                        }
                      >
                        {deleteMutation.isPending &&
                        deleteId === campaign.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      {/* Campaign Detail Sheet */}
      <CampaignDetailSheet
        campaignId={detailId}
        open={!!detailId}
        onOpenChange={(v) => {
          if (!v) setDetailId(null);
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold">
              Delete Campaign
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[11px]">
              This will permanently delete the campaign and all its recipient
              data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-7 text-[11px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-7 text-[11px] bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
