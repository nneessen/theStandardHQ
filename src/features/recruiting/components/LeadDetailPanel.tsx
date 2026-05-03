// src/features/recruiting/components/LeadDetailPanel.tsx
// Slide-out panel showing lead details with accept/reject actions

import { useState } from "react";
import {
  X,
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import {
  STATUS_COLORS,
  STATUS_LABELS,
  AVAILABILITY_LABELS,
  EXPERIENCE_LABELS,
  type LeadStatus,
  type EnrichedLead,
} from "@/types/leads.types";
import { format, formatDistanceToNow } from "date-fns";

interface LeadDetailPanelProps {
  lead: EnrichedLead;
  onClose: () => void;
  onAccept: () => void;
  onReject: (reason?: string) => void;
  isAccepting: boolean;
  isRejecting: boolean;
}

export function LeadDetailPanel({
  lead,
  onClose,
  onAccept,
  onReject,
  isAccepting,
  isRejecting,
}: LeadDetailPanelProps) {
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);

  const isPending = lead.status === "pending";
  const statusColors = STATUS_COLORS[lead.status as LeadStatus];

  const handleConfirmReject = () => {
    onReject(rejectReason || undefined);
    setShowRejectDialog(false);
    setRejectReason("");
  };

  return (
    <>
      <Sheet open={true} onOpenChange={onClose}>
        <SheetContent className="w-[450px] p-0 overflow-hidden">
          <SheetHeader className="p-4 border-b border-border">
            <div className="flex items-start justify-between">
              <div>
                <SheetTitle className="text-base font-semibold">
                  {lead.first_name} {lead.last_name}
                </SheetTitle>
                <div className="flex items-center gap-2 mt-1">
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
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          <div className="overflow-y-auto h-[calc(100vh-180px)]">
            {/* Contact Info */}
            <div className="p-4 border-b border-border">
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
                    <p className="text-[10px] text-muted-foreground">
                      Location
                    </p>
                    <p className="text-[12px] text-foreground">
                      {lead.city}, {lead.state}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Qualification Info */}
            <div className="p-4 border-b border-border">
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
            <div className="p-4 border-b border-border">
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
            <div className="p-4 border-b border-border">
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase mb-3">
                Timeline
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-md bg-success/20 dark:bg-success/10/50 flex items-center justify-center flex-shrink-0">
                    <Calendar className="h-3.5 w-3.5 text-success" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">
                      Submitted
                    </p>
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
                      <div className="h-7 w-7 rounded-md bg-info/20 dark:bg-info/10/50 flex items-center justify-center flex-shrink-0">
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
                          ? "bg-success/20 dark:bg-success/10/50"
                          : "bg-destructive/20 dark:bg-destructive/10/50"
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

            {/* Rejection Reason */}
            {lead.status === "rejected" && lead.rejection_reason && (
              <div className="p-4 border-b border-border">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase mb-3">
                  Rejection Reason
                </h3>
                <p className="text-[12px] text-muted-foreground bg-destructive/10 border border-destructive/20 dark:border-destructive/50 rounded-md p-3">
                  {lead.rejection_reason}
                </p>
              </div>
            )}

            {/* Converted Recruit Link */}
            {lead.status === "accepted" && lead.converted_recruit_id && (
              <div className="p-4 border-b border-border">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase mb-3">
                  Converted Recruit
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => {
                    // Navigate to recruit detail - would need to implement
                    onClose();
                  }}
                >
                  <ExternalLink className="h-3 w-3 mr-1.5" />
                  View Recruit Profile
                </Button>
              </div>
            )}

            {/* UTM Tracking */}
            {(lead.utm_source || lead.utm_medium || lead.utm_campaign) && (
              <div className="p-4">
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
          </div>

          {/* Actions Footer */}
          {isPending && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-card border-t border-border">
              <div className="flex gap-2">
                <Button
                  className="flex-1 h-9"
                  onClick={() => setShowAcceptDialog(true)}
                  disabled={isAccepting || isRejecting}
                >
                  {isAccepting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-2" />
                  )}
                  Accept Lead
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 h-9 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setShowRejectDialog(true)}
                  disabled={isAccepting || isRejecting}
                >
                  {isRejecting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  Reject
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

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
              onClick={() => {
                onAccept();
                setShowAcceptDialog(false);
              }}
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
    </>
  );
}
