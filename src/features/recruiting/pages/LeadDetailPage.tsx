// src/features/recruiting/pages/LeadDetailPage.tsx
// Full-page lead detail view. Replaces the right-side slide-out panel.

import { useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Clock,
  Calendar,
  Target,
  MessageSquare,
  UserPlus,
  XCircle,
  CheckCircle2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { useLeadById, useAcceptLead, useRejectLead } from "../hooks";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  AVAILABILITY_LABELS,
  EXPERIENCE_LABELS,
  type LeadStatus,
} from "@/types/leads.types";
import { format, formatDistanceToNow } from "date-fns";

export function LeadDetailPage() {
  const navigate = useNavigate();
  const { leadId } = useParams({ from: "/recruiting/lead/$leadId" });

  const { data: lead, isLoading, error } = useLeadById(leadId);
  const acceptMutation = useAcceptLead();
  const rejectMutation = useRejectLead();

  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);

  const goBack = () => navigate({ to: "/recruiting" });

  const handleAccept = async () => {
    if (!lead) return;
    await acceptMutation.mutateAsync({ leadId: lead.id });
    setShowAcceptDialog(false);
    goBack();
  };

  const handleConfirmReject = async () => {
    if (!lead) return;
    await rejectMutation.mutateAsync({
      leadId: lead.id,
      reason: rejectReason || undefined,
    });
    setShowRejectDialog(false);
    setRejectReason("");
    goBack();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-v2-ink-subtle mb-3" />
        <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-v2-ink-muted">
          Loading lead…
        </p>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <p className="text-[12px] text-v2-ink-muted">
          {error ? `Couldn't load lead: ${error.message}` : "Lead not found."}
        </p>
        <Button variant="outline" size="sm" onClick={goBack} className="h-7">
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          Back to Recruiting
        </Button>
      </div>
    );
  }

  const isPending = lead.status === "pending";
  const statusColors = STATUS_COLORS[lead.status as LeadStatus];
  const isAccepting = acceptMutation.isPending;
  const isRejecting = rejectMutation.isPending;

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={goBack}
            className="h-7 px-2 -ml-2"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            <span className="text-[11px]">Recruiting</span>
          </Button>
          <div className="h-4 w-px bg-v2-ring" />
          <div className="flex flex-col">
            <h1 className="text-sm font-semibold tracking-tight text-v2-ink leading-tight">
              {lead.first_name} {lead.last_name}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge
                variant="outline"
                className={`text-[9px] ${statusColors?.bg} ${statusColors?.text} ${statusColors?.border}`}
              >
                {STATUS_LABELS[lead.status as LeadStatus]}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                Submitted{" "}
                {formatDistanceToNow(new Date(lead.submitted_at), {
                  addSuffix: true,
                })}
              </span>
            </div>
          </div>
        </div>

        {isPending && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-8"
              disabled={isAccepting || isRejecting}
              onClick={() => setShowAcceptDialog(true)}
            >
              {isAccepting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
              )}
              Accept Lead
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
              disabled={isAccepting || isRejecting}
              onClick={() => setShowRejectDialog(true)}
            >
              {isRejecting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
              )}
              Reject
            </Button>
          </div>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Contact Info */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase mb-3">
            Contact Information
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Email</p>
                <a
                  href={`mailto:${lead.email}`}
                  className="text-[12px] text-foreground hover:underline"
                >
                  {lead.email}
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Phone</p>
                <a
                  href={`tel:${lead.phone}`}
                  className="text-[12px] text-foreground hover:underline"
                >
                  {lead.phone}
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Location</p>
                <p className="text-[12px] text-foreground">
                  {lead.city}, {lead.state}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Qualification Info */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase mb-3">
            Qualification Details
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">
                  Availability
                </p>
                <p className="text-[12px] text-foreground">
                  {
                    AVAILABILITY_LABELS[
                      lead.availability as keyof typeof AVAILABILITY_LABELS
                    ]
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">
                  Insurance Experience
                </p>
                <p className="text-[12px] text-foreground">
                  {
                    EXPERIENCE_LABELS[
                      lead.insurance_experience as keyof typeof EXPERIENCE_LABELS
                    ]
                  }
                </p>
              </div>
            </div>
            {lead.income_goals && (
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                  <Target className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">
                    Income Goals
                  </p>
                  <p className="text-[12px] text-foreground">
                    {lead.income_goals}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Why Interested */}
        <div className="rounded-lg border border-border bg-card p-4 md:col-span-2">
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase mb-3">
            Why They&apos;re Interested
          </h3>
          <div className="flex items-start gap-3">
            <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              {lead.why_interested}
            </p>
          </div>
        </div>

        {/* Timeline */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-[11px] font-semibold text-muted-foreground uppercase mb-3">
            Timeline
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-md bg-success/20 flex items-center justify-center flex-shrink-0">
                <Calendar className="h-3.5 w-3.5 text-success" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Submitted</p>
                <p className="text-[12px] text-foreground">
                  {format(
                    new Date(lead.submitted_at),
                    "MMM d, yyyy 'at' h:mm a",
                  )}
                </p>
              </div>
            </div>
            {lead.discovery_call_scheduled &&
              lead.discovery_call_scheduled_at && (
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-md bg-info/20 flex items-center justify-center flex-shrink-0">
                    <Phone className="h-3.5 w-3.5 text-info" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">
                      Discovery Call Scheduled
                    </p>
                    <p className="text-[12px] text-foreground">
                      {format(
                        new Date(lead.discovery_call_scheduled_at),
                        "MMM d, yyyy 'at' h:mm a",
                      )}
                    </p>
                  </div>
                </div>
              )}
            {lead.reviewed_at && (
              <div className="flex items-center gap-3">
                <div
                  className={`h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                    lead.status === "accepted"
                      ? "bg-success/20"
                      : "bg-destructive/20"
                  }`}
                >
                  {lead.status === "accepted" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">
                    {lead.status === "accepted" ? "Accepted" : "Rejected"}
                  </p>
                  <p className="text-[12px] text-foreground">
                    {format(
                      new Date(lead.reviewed_at),
                      "MMM d, yyyy 'at' h:mm a",
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* UTM Tracking */}
        {(lead.utm_source || lead.utm_medium || lead.utm_campaign) && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase mb-3">
              Source Tracking
            </h3>
            <div className="flex flex-wrap gap-2">
              {lead.utm_source && (
                <Badge variant="secondary" className="text-[9px]">
                  Source: {lead.utm_source}
                </Badge>
              )}
              {lead.utm_medium && (
                <Badge variant="secondary" className="text-[9px]">
                  Medium: {lead.utm_medium}
                </Badge>
              )}
              {lead.utm_campaign && (
                <Badge variant="secondary" className="text-[9px]">
                  Campaign: {lead.utm_campaign}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Rejection reason */}
        {lead.status === "rejected" && lead.rejection_reason && (
          <div className="rounded-lg border border-border bg-card p-4 md:col-span-2">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase mb-3">
              Rejection Reason
            </h3>
            <p className="text-[12px] text-muted-foreground bg-destructive/10 border border-destructive/20 rounded-md p-3">
              {lead.rejection_reason}
            </p>
          </div>
        )}

        {/* Converted recruit link */}
        {lead.status === "accepted" && lead.converted_recruit_id && (
          <div className="rounded-lg border border-border bg-card p-4 md:col-span-2">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase mb-3">
              Converted Recruit
            </h3>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() =>
                navigate({
                  to: "/recruiting/$recruitId",
                  params: { recruitId: lead.converted_recruit_id! },
                })
              }
            >
              <ExternalLink className="h-3 w-3 mr-1.5" />
              View Recruit Profile
            </Button>
          </div>
        )}
      </div>

      {/* Accept Confirmation Dialog */}
      <AlertDialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              Accept Lead?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[12px]">
              This will create a new recruit record for{" "}
              <strong>
                {lead.first_name} {lead.last_name}
              </strong>{" "}
              and add them to your recruiting pipeline as a prospect.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-[11px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-8 text-[11px]"
              onClick={handleAccept}
            >
              Accept Lead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              Reject Lead?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[12px]">
              This will reject the lead from{" "}
              <strong>
                {lead.first_name} {lead.last_name}
              </strong>
              . You can optionally add a reason for your records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="rejectReason" className="text-[11px]">
              Reason (Optional)
            </Label>
            <Textarea
              id="rejectReason"
              placeholder="e.g., Not a good fit, location too far, etc."
              className="mt-1.5 text-[12px] min-h-[80px]"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-[11px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-8 text-[11px] bg-destructive hover:bg-destructive"
              onClick={handleConfirmReject}
            >
              Reject Lead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default LeadDetailPage;
