// src/features/recruiting/components/BasicRecruitingView.tsx
// Simplified recruiting view for free tier users with recruiting_basic feature

import React, { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  UserPlus,
  Mail,
  Phone,
  User,
  Sparkles,
  ArrowRight,
  GraduationCap,
  Info,
  ChevronDown,
  ChevronUp,
  Hash,
  Check,
  Loader2,
  Pencil,
  Trash2,
  SendHorizontal,
  Layers,
  ListChecks,
  FolderOpen,
  Inbox,
  Zap,
  Globe,
  Building2,
  MessageSquare,
} from "lucide-react";
import { GraduateToAgentDialog } from "@/features/admin";
import { RecruitBottomPanel } from "./RecruitBottomPanel";
import {
  useRecruits,
  useCreateRecruit,
  useUpdateRecruit,
  useDeleteRecruit,
} from "../hooks";
import { useResendInvite } from "../hooks/useAuthUser";
import { useAuth } from "@/contexts/AuthContext";
import { useRecruitNotificationStatus } from "@/hooks/slack";
// eslint-disable-next-line no-restricted-imports -- pre-existing: RecruitSlackActions + BasicAddRecruitDialog use raw service fns
import {
  autoPostRecruitNotification,
  checkNotificationSent,
} from "@/services/slack";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { STAFF_ONLY_ROLES } from "@/constants/roles";
import { US_STATES } from "@/constants/states";
import { VALID_CONTRACT_LEVELS } from "@/lib/constants";
import type { RecruitFilters } from "@/types/recruiting.types";
import { TERMINAL_STATUS_COLORS } from "@/types/recruiting.types";
import type { UserProfile } from "@/types/hierarchy.types";
import { Link, useSearch } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";

interface BasicRecruitingViewProps {
  className?: string;
}

export function BasicRecruitingView({ className }: BasicRecruitingViewProps) {
  const { user } = useAuth();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [graduatingRecruit, setGraduatingRecruit] =
    useState<UserProfile | null>(null);
  const [editingRecruit, setEditingRecruit] = useState<UserProfile | null>(
    null,
  );
  const [deletingRecruit, setDeletingRecruit] = useState<UserProfile | null>(
    null,
  );
  const [showInstructions, setShowInstructions] = useState(false);
  const [showUpgradeDetails, setShowUpgradeDetails] = useState(false);
  const [resendingRecruitId, setResendingRecruitId] = useState<string | null>(
    null,
  );
  const [selectedRecruit, setSelectedRecruit] = useState<UserProfile | null>(
    null,
  );
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const resendInvite = useResendInvite();

  // Read recruitId from URL search params (for deep linking)
  const { recruitId } = useSearch({ from: "/recruiting" });

  // Detect staff role
  const isStaffRole =
    user?.roles?.some((role) =>
      STAFF_ONLY_ROLES.includes(role as (typeof STAFF_ONLY_ROLES)[number]),
    ) ?? false;

  // Build filters based on user role
  const recruitFilters: RecruitFilters | undefined = (() => {
    if (!user?.id) return undefined;

    if (isStaffRole && user.imo_id) {
      return { imo_id: user.imo_id, exclude_prospects: false };
    }

    // Show all recruits where user is recruiter OR upline (including prospects)
    return { my_recruits_user_id: user.id, exclude_prospects: false };
  })();

  const { data: recruitsData, isLoading } = useRecruits(recruitFilters, 1, 50, {
    enabled: !!user?.id,
  });

  const recruits = useMemo(
    () => (recruitsData?.data || []) as UserProfile[],
    [recruitsData?.data],
  );

  // Auto-select recruit from URL param (deep link)
  useEffect(() => {
    if (recruitId && recruits.length > 0 && !selectedRecruit) {
      const recruit = recruits.find((r) => r.id === recruitId);
      if (recruit) {
        setSelectedRecruit(recruit);
        setDetailSheetOpen(true);
      }
    }
  }, [recruitId, recruits, selectedRecruit]);

  // Sync selectedRecruit with latest query data after mutations (e.g. NPN update)

  useEffect(() => {
    if (!selectedRecruit) return;
    const fresh = recruits.find((r) => r.id === selectedRecruit.id);
    if (fresh && fresh !== selectedRecruit) setSelectedRecruit(fresh);
  }, [recruits]);

  const handleSelectRecruit = (recruit: UserProfile) => {
    setSelectedRecruit(recruit);
    setDetailSheetOpen(true);
  };

  // Slack is available if user has an imo_id (autoPostRecruitNotification resolves integration + channel internally)
  const slackAvailable = !!user?.imo_id;

  // Simple status badge mapping
  const getStatusBadge = (status: string | null) => {
    const statusMap: Record<
      string,
      {
        label: string;
        variant: "default" | "secondary" | "destructive" | "outline";
      }
    > = {
      pending: { label: "Pending", variant: "secondary" },
      active: { label: "Active", variant: "default" },
      approved: { label: "Approved", variant: "default" },
      contracted: { label: "Contracted", variant: "default" },
      inactive: { label: "Inactive", variant: "outline" },
      declined: { label: "Declined", variant: "destructive" },
    };

    const statusInfo = statusMap[status || "pending"] || {
      label: status || "Unknown",
      variant: "outline" as const,
    };
    return (
      <Badge variant={statusInfo.variant} className="text-[9px] h-4">
        {statusInfo.label}
      </Badge>
    );
  };

  const handleResendInvite = async (recruit: UserProfile) => {
    if (!recruit.email) return;
    setResendingRecruitId(recruit.id);
    try {
      await resendInvite.mutateAsync({
        email: recruit.email,
        fullName:
          `${recruit.first_name || ""} ${recruit.last_name || ""}`.trim(),
        roles: recruit.roles || ["recruit"],
        existingProfileId: recruit.id,
      });
    } finally {
      setResendingRecruitId(null);
    }
  };

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Recruiting
          </h1>
          <Badge variant="secondary" className="text-[9px] h-4">
            {recruits.length} recruits
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <BasicAddRecruitDialog
            open={addDialogOpen}
            onOpenChange={setAddDialogOpen}
          />
        </div>
      </div>

      {/* Full Pipeline Upgrade Card */}
      <Collapsible
        open={showUpgradeDetails}
        onOpenChange={setShowUpgradeDetails}
      >
        <div className="rounded-lg border-2 border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 via-white to-indigo-50 dark:from-violet-950/40 dark:via-zinc-900 dark:to-indigo-950/30">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full p-4 text-left hover:bg-violet-50/60 dark:hover:bg-violet-950/10 transition-colors rounded-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/50 flex-shrink-0">
                    <Sparkles className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-violet-900 dark:text-violet-100 leading-tight">
                      Unlock the Full Recruiting Pipeline
                    </p>
                    <p className="text-[10px] text-violet-600 dark:text-violet-400 mt-0.5">
                      Expand to preview Team plan features and upgrade options
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-violet-700 dark:text-violet-300 bg-white/80 dark:bg-zinc-900/60 border border-violet-200 dark:border-violet-800 rounded-md px-2.5 py-1 text-[10px] font-semibold flex-shrink-0">
                  {showUpgradeDetails ? "Hide" : "View"}
                  {showUpgradeDetails ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </div>
              </div>
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent className="px-4 pb-4">
            <div className="border-t border-violet-200/80 dark:border-violet-800/80 pt-3">
              <Link to="/billing" className="block group">
                <div className="rounded-md border border-violet-100 dark:border-violet-900/50 bg-white/80 dark:bg-zinc-900/40 p-3 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-sm transition-all cursor-pointer">
                  {/* CTA row */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <p className="text-[10px] text-violet-700 dark:text-violet-300 leading-tight">
                      Everything you need to build, onboard, and grow your team
                      on the <span className="font-semibold">Team plan</span>
                    </p>
                    <div className="flex items-center gap-1.5 bg-violet-600 group-hover:bg-violet-700 text-white rounded-md px-3 py-1.5 text-[11px] font-semibold flex-shrink-0 transition-colors shadow-sm">
                      Upgrade to Team
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>

                  {/* Feature grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(
                      [
                        {
                          icon: Layers,
                          label: "Custom Pipeline Stages",
                          desc: "Define unlimited phases with your own names, order, and requirements",
                        },
                        {
                          icon: ListChecks,
                          label: "Interactive Checklists",
                          desc: "Embed videos, quizzes, e-sign docs, file downloads, and more per phase",
                        },
                        {
                          icon: FolderOpen,
                          label: "Document Management",
                          desc: "Track uploads, approvals, and expiration dates for every recruit",
                        },
                        {
                          icon: Inbox,
                          label: "Leads Queue",
                          desc: "Accept inbound leads directly from your public recruiting landing page",
                        },
                        {
                          icon: Zap,
                          label: "Automated Workflows",
                          desc: "Trigger emails and notifications automatically on phase changes",
                        },
                        {
                          icon: Globe,
                          label: "Public Recruiting Page",
                          desc: "Branded landing page at your own personalized recruiting URL",
                        },
                        {
                          icon: Building2,
                          label: "Recruit Portal",
                          desc: "Give recruits a guided portal to complete tasks, upload docs, track progress, and message their recruiter",
                        },
                        {
                          icon: MessageSquare,
                          label: "Communication Hub",
                          desc: "Send emails and track every recruit interaction in one place",
                        },
                      ] as {
                        icon: React.ElementType;
                        label: string;
                        desc: string;
                      }[]
                    ).map(({ icon: Icon, label, desc }) => (
                      <div
                        key={label}
                        className="flex items-start gap-2 p-2 rounded-md bg-white/80 dark:bg-zinc-800/60 border border-violet-100 dark:border-violet-900/50"
                      >
                        <Icon className="h-3.5 w-3.5 text-violet-500 dark:text-violet-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] font-semibold text-zinc-800 dark:text-zinc-200 leading-tight">
                            {label}
                          </p>
                          <p className="text-[9px] text-zinc-500 dark:text-zinc-400 leading-tight mt-0.5">
                            {desc}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Click hint */}
                  <p className="text-center text-[9px] text-violet-500 dark:text-violet-500 mt-2.5 group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
                    Click anywhere in this panel to see pricing and upgrade →
                  </p>
                </div>
              </Link>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Recruiting Process Instructions */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2">
            <Info className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
              How the Recruiting Process Works
            </span>
          </div>
          {showInstructions ? (
            <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
          )}
        </button>
        {showInstructions && (
          <div className="px-3 pb-3 space-y-2">
            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2" />
            <ol className="space-y-1.5 text-[10px] text-zinc-600 dark:text-zinc-400 list-decimal list-inside">
              <li>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  Add a new recruit
                </span>{" "}
                — Click "Add Recruit" and enter their name, email, and phone
                number.
              </li>
              <li>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  Recruit receives a password email
                </span>{" "}
                — They will be emailed a link to set their password and log in
                to the system.
              </li>
              <li>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  Licensing status determines next steps
                </span>{" "}
                — If the recruit is <em>not already licensed</em>, they are
                added as "unlicensed" and their details are automatically posted
                to the Slack channel (
                <code className="text-[9px] bg-zinc-100 dark:bg-zinc-800 px-1 rounded">
                  #new-agent-testing-odette
                </code>
                ).
              </li>
              <li>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  Recruit enters the onboarding pipeline
                </span>{" "}
                — They are enrolled in the standard pipeline where you can track
                their progress through each phase.
              </li>
              <li>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  NPN received triggers a second notification
                </span>{" "}
                — When the recruit's NPN (National Producer Number) is entered,
                a second Slack notification is posted requesting email #2 be
                sent.
              </li>
              <li>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  Graduate to agent
                </span>{" "}
                — Once onboarding is complete, use the "Graduate" button to
                promote the recruit to a full agent.
              </li>
            </ol>
          </div>
        )}
      </div>

      {/* Recruits Table */}
      <div className="flex-1 overflow-hidden bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-[11px] text-zinc-500">
            Loading recruits...
          </div>
        ) : recruits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-zinc-500">
            <User className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
            <p className="text-[11px]">No recruits yet</p>
            <p className="text-[10px] text-zinc-400">
              Add your first recruit to get started
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[10px] font-semibold h-8">
                  Name
                </TableHead>
                <TableHead className="text-[10px] font-semibold h-8">
                  Contact
                </TableHead>
                <TableHead className="text-[10px] font-semibold h-8">
                  Upline
                </TableHead>
                <TableHead className="text-[10px] font-semibold h-8">
                  Status
                </TableHead>
                <TableHead className="text-[10px] font-semibold h-8">
                  Added
                </TableHead>
                <TableHead className="text-[10px] font-semibold h-8">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recruits.map((recruit) => (
                <TableRow
                  key={recruit.id}
                  className={cn(
                    "cursor-pointer transition-colors",
                    selectedRecruit?.id === recruit.id
                      ? "bg-zinc-100 dark:bg-zinc-800"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
                  )}
                  onClick={() => handleSelectRecruit(recruit)}
                >
                  <TableCell className="py-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage
                          src={recruit.profile_photo_url || undefined}
                        />
                        <AvatarFallback className="text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          {(recruit.first_name?.[0] || "").toUpperCase()}
                          {(recruit.last_name?.[0] || "").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[11px] font-medium text-zinc-900 dark:text-zinc-100">
                        {recruit.first_name} {recruit.last_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex flex-col gap-0.5">
                      {recruit.email && (
                        <div className="flex items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                          <Mail className="h-3 w-3" />
                          {recruit.email}
                        </div>
                      )}
                      {recruit.phone && (
                        <div className="flex items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                          <Phone className="h-3 w-3" />
                          {recruit.phone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(recruit as any).upline ? (
                      <span className="text-[10px] text-zinc-700 dark:text-zinc-300">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(recruit as any).upline.first_name}{" "}
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(recruit as any).upline.last_name}
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 italic">
                        {recruit.upline_id ? "Loading..." : "Not assigned"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    {(() => {
                      const terminalStatuses = [
                        "completed",
                        "dropped",
                        "withdrawn",
                      ];
                      const isTerminal = terminalStatuses.includes(
                        recruit.onboarding_status || "",
                      );
                      if (isTerminal) {
                        return (
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-[9px] h-4",
                              TERMINAL_STATUS_COLORS[
                                recruit.onboarding_status!
                              ],
                            )}
                          >
                            {recruit.onboarding_status!.replace(/_/g, " ")}
                          </Badge>
                        );
                      }
                      if (recruit.pipeline_template_id) {
                        return (
                          <Badge
                            variant="secondary"
                            className="text-[9px] h-4 bg-blue-100 text-blue-800"
                          >
                            {recruit.current_onboarding_phase || "In Pipeline"}
                          </Badge>
                        );
                      }
                      return getStatusBadge(recruit.approval_status);
                    })()}
                  </TableCell>
                  <TableCell className="py-2">
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {recruit.created_at
                        ? formatDistanceToNow(new Date(recruit.created_at), {
                            addSuffix: true,
                          })
                        : "Unknown"}
                    </span>
                  </TableCell>
                  <TableCell
                    className="py-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1">
                      {slackAvailable && (
                        <RecruitSlackActions
                          recruit={recruit}
                          imoId={user!.imo_id!}
                        />
                      )}
                      {recruit.email && (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                disabled={resendingRecruitId === recruit.id}
                                onClick={() => handleResendInvite(recruit)}
                              >
                                {resendingRecruitId === recruit.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <SendHorizontal className="h-3 w-3" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-[10px]">
                              Resend password setup email
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                        onClick={() => setEditingRecruit(recruit)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0 text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                        onClick={() => setDeletingRecruit(recruit)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      {(recruit.approval_status === "pending" ||
                        recruit.approval_status === "approved" ||
                        recruit.approval_status === "active") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 px-1.5 text-[10px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:text-emerald-300 dark:hover:bg-emerald-900/20"
                          onClick={() => setGraduatingRecruit(recruit)}
                        >
                          <GraduationCap className="h-3 w-3 mr-0.5" />
                          Graduate
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Recruit Bottom Panel (slide-up drawer) */}
      {detailSheetOpen && selectedRecruit && (
        <div className="fixed inset-0 z-[200]">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDetailSheetOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 rounded-t-xl shadow-2xl h-[60vh] animate-in slide-in-from-bottom duration-300">
            <RecruitBottomPanel
              recruit={selectedRecruit}
              onClose={() => setDetailSheetOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Graduate to Agent Dialog */}
      {graduatingRecruit && (
        <GraduateToAgentDialog
          recruit={graduatingRecruit}
          open={!!graduatingRecruit}
          onOpenChange={(open) => {
            if (!open) setGraduatingRecruit(null);
          }}
        />
      )}

      {/* Edit Recruit Dialog */}
      {editingRecruit && (
        <BasicEditRecruitDialog
          recruit={editingRecruit}
          open={!!editingRecruit}
          onOpenChange={(open) => {
            if (!open) setEditingRecruit(null);
          }}
        />
      )}

      {/* Delete Recruit Dialog */}
      {deletingRecruit && (
        <BasicDeleteRecruitDialog
          recruit={deletingRecruit}
          open={!!deletingRecruit}
          onOpenChange={(open) => {
            if (!open) setDeletingRecruit(null);
          }}
        />
      )}
    </div>
  );
}

// Per-recruit Slack notification action buttons
// Separate component so each recruit can use its own notification status hook
// Uses autoPostRecruitNotification which resolves integration + channel internally
// (avoids dependency on slack-list-channels edge function CORS for rendering buttons)
interface RecruitSlackActionsProps {
  recruit: UserProfile;
  imoId: string;
}

function RecruitSlackActions({ recruit, imoId }: RecruitSlackActionsProps) {
  const queryClient = useQueryClient();
  const { data: notificationStatus } = useRecruitNotificationStatus(recruit.id);
  const [sendingType, setSendingType] = useState<
    "new_recruit" | "npn_received" | null
  >(null);

  const showNewRecruit =
    recruit.agent_status === "unlicensed" || !recruit.agent_status;
  // Always show the NPN button — it's the 2nd Slack notification (exam passed, NPN received)
  const showNpn = true;

  const handleSend = async (type: "new_recruit" | "npn_received") => {
    // NPN notification requires the recruit to have an NPN set first
    if (type === "npn_received" && !recruit.npn) {
      toast.error("Set the recruit's NPN first (edit recruit), then post.");
      return;
    }

    setSendingType(type);
    try {
      // Check duplicate before sending
      const alreadySent = await checkNotificationSent(recruit.id, type);
      if (alreadySent) {
        toast.error("This notification has already been sent.");
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- upline joined by RecruitRepository
      const upline = (recruit as any).upline as
        | { first_name?: string; last_name?: string; email?: string }
        | undefined;
      const uplineName =
        upline?.first_name && upline?.last_name
          ? `${upline.first_name} ${upline.last_name}`
          : upline?.email || null;
      await autoPostRecruitNotification(
        { ...recruit, upline_name: uplineName },
        type,
        imoId,
      );

      // Invalidate to refresh button state
      queryClient.invalidateQueries({
        queryKey: ["slack", "recruit-notification-status", recruit.id],
      });
      toast.success("Slack notification sent");
    } catch {
      toast.error("Failed to send Slack notification");
    } finally {
      setSendingType(null);
    }
  };

  return (
    <>
      {showNewRecruit && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={notificationStatus?.newRecruitSent || !!sendingType}
                onClick={() => handleSend("new_recruit")}
                className={cn(
                  "h-5 text-[9px] px-1.5",
                  notificationStatus?.newRecruitSent &&
                    "text-emerald-600 border-emerald-300",
                )}
              >
                {sendingType === "new_recruit" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : notificationStatus?.newRecruitSent ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Hash className="h-3 w-3 mr-0.5" />
                )}
                {notificationStatus?.newRecruitSent ? "Sent" : "New"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-[10px]">
                {notificationStatus?.newRecruitSent
                  ? "New recruit notification already sent"
                  : "Post to #new-agent-testing-odette"}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {showNpn && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={notificationStatus?.npnReceivedSent || !!sendingType}
                onClick={() => handleSend("npn_received")}
                className={cn(
                  "h-5 text-[9px] px-1.5",
                  notificationStatus?.npnReceivedSent &&
                    "text-emerald-600 border-emerald-300",
                )}
              >
                {sendingType === "npn_received" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : notificationStatus?.npnReceivedSent ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Hash className="h-3 w-3 mr-0.5" />
                )}
                {notificationStatus?.npnReceivedSent ? "Sent" : "NPN"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-[10px]">
                {notificationStatus?.npnReceivedSent
                  ? "NPN received notification already sent"
                  : "Post NPN received to #new-agent-testing-odette"}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </>
  );
}

// Simple edit recruit dialog for basic tier
interface BasicEditRecruitDialogProps {
  recruit: UserProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function BasicEditRecruitDialog({
  recruit,
  open,
  onOpenChange,
}: BasicEditRecruitDialogProps) {
  const updateRecruit = useUpdateRecruit();
  const [formData, setFormData] = useState({
    first_name: recruit.first_name || "",
    last_name: recruit.last_name || "",
    email: recruit.email || "",
    phone: recruit.phone || "",
    resident_state: recruit.resident_state || "",
    npn: recruit.npn || "",
    agent_status: recruit.agent_status || "unlicensed",
    contract_level: recruit.contract_level?.toString() || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const newErrors: Record<string, string> = {};
    if (!formData.first_name.trim())
      newErrors.first_name = "First name is required";
    if (!formData.last_name.trim())
      newErrors.last_name = "Last name is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const contractLevel = formData.contract_level
        ? parseInt(formData.contract_level, 10)
        : undefined;

      await updateRecruit.mutateAsync({
        id: recruit.id,
        updates: {
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim() || undefined,
          resident_state: formData.resident_state || undefined,
          npn: formData.npn.trim() || undefined,
          agent_status: formData.agent_status as
            | "licensed"
            | "unlicensed"
            | "not_applicable",
          contract_level:
            contractLevel && !isNaN(contractLevel) ? contractLevel : undefined,
        },
      });
      onOpenChange(false);
    } catch (error) {
      console.error("[BasicRecruitingView] Update recruit failed:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-sm">Edit Recruit</DialogTitle>
          <DialogDescription className="text-[11px] text-zinc-500">
            Update {recruit.first_name} {recruit.last_name}&apos;s information.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="edit_first_name" className="text-[10px]">
                First Name *
              </Label>
              <Input
                id="edit_first_name"
                value={formData.first_name}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    first_name: e.target.value,
                  }))
                }
                className="h-8 text-[11px]"
              />
              {errors.first_name && (
                <p className="text-[9px] text-red-500">{errors.first_name}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_last_name" className="text-[10px]">
                Last Name *
              </Label>
              <Input
                id="edit_last_name"
                value={formData.last_name}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    last_name: e.target.value,
                  }))
                }
                className="h-8 text-[11px]"
              />
              {errors.last_name && (
                <p className="text-[9px] text-red-500">{errors.last_name}</p>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit_email" className="text-[10px]">
              Email *
            </Label>
            <Input
              id="edit_email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
              className="h-8 text-[11px]"
            />
            {errors.email && (
              <p className="text-[9px] text-red-500">{errors.email}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="edit_phone" className="text-[10px]">
                Phone
              </Label>
              <Input
                id="edit_phone"
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, phone: e.target.value }))
                }
                className="h-8 text-[11px]"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_resident_state" className="text-[10px]">
                Resident State
              </Label>
              <Select
                value={formData.resident_state}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, resident_state: value }))
                }
              >
                <SelectTrigger
                  id="edit_resident_state"
                  className="h-8 text-[11px]"
                >
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => (
                    <SelectItem
                      key={s.value}
                      value={s.value}
                      className="text-[11px]"
                    >
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="edit_npn" className="text-[10px]">
                NPN
              </Label>
              <Input
                id="edit_npn"
                value={formData.npn}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, npn: e.target.value }))
                }
                className="h-8 text-[11px]"
                placeholder="National Producer Number"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit_contract_level" className="text-[10px]">
                Starting Comp %
              </Label>
              <Select
                value={formData.contract_level}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    contract_level: value,
                  }))
                }
              >
                <SelectTrigger
                  id="edit_contract_level"
                  className="h-8 text-[11px] bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700"
                >
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  {VALID_CONTRACT_LEVELS.map((level) => (
                    <SelectItem
                      key={level}
                      value={level.toString()}
                      className="text-[11px]"
                    >
                      {level}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2">
            <Label
              htmlFor="edit_is_licensed"
              className="text-[10px] cursor-pointer"
            >
              Licensed Agent?
            </Label>
            <Switch
              id="edit_is_licensed"
              checked={formData.agent_status === "licensed"}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  agent_status: checked ? "licensed" : "unlicensed",
                }))
              }
              className="scale-75"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[10px]"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-7 text-[10px]"
              disabled={updateRecruit.isPending}
            >
              {updateRecruit.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Simple delete confirm dialog for basic tier
interface BasicDeleteRecruitDialogProps {
  recruit: UserProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function BasicDeleteRecruitDialog({
  recruit,
  open,
  onOpenChange,
}: BasicDeleteRecruitDialogProps) {
  const deleteRecruit = useDeleteRecruit();

  const handleDelete = async () => {
    try {
      await deleteRecruit.mutateAsync(recruit.id);
      toast.success(
        `${recruit.first_name} ${recruit.last_name} has been removed.`,
      );
      onOpenChange(false);
    } catch (error) {
      console.error("[BasicRecruitingView] Delete recruit failed:", error);
      toast.error("Failed to delete recruit. Please try again.");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-sm">
            Delete Recruit
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[11px]">
            Are you sure you want to permanently delete{" "}
            <span className="font-semibold">
              {recruit.first_name} {recruit.last_name}
            </span>
            ? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-7 text-[10px]">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="h-7 text-[10px] bg-red-600 hover:bg-red-700 text-white"
            onClick={handleDelete}
            disabled={deleteRecruit.isPending}
          >
            {deleteRecruit.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Simple add recruit dialog for basic tier
interface BasicAddRecruitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function BasicAddRecruitDialog({
  open,
  onOpenChange,
}: BasicAddRecruitDialogProps) {
  const { user } = useAuth();
  const createRecruit = useCreateRecruit();
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    resident_state: "",
    is_licensed: false,
    contract_level: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Basic validation
    const newErrors: Record<string, string> = {};
    if (!formData.first_name.trim())
      newErrors.first_name = "First name is required";
    if (!formData.last_name.trim())
      newErrors.last_name = "Last name is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const agentStatus = formData.is_licensed ? "licensed" : "unlicensed";
      const contractLevel = formData.contract_level
        ? parseInt(formData.contract_level, 10)
        : undefined;

      await createRecruit.mutateAsync({
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim() || undefined,
        resident_state: formData.resident_state || undefined,
        agent_status: agentStatus,
        contract_level:
          contractLevel && !isNaN(contractLevel) ? contractLevel : undefined,
        recruiter_id: user?.id,
        upline_id: user?.id,
        imo_id: user?.imo_id ?? undefined,
        agency_id: user?.agency_id ?? undefined,
      });

      // Success toast is handled by the mutation's onSuccess callback
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        resident_state: "",
        is_licensed: false,
        contract_level: "",
      });
      onOpenChange(false);
    } catch (error) {
      // Error toast is handled by the mutation's onError callback
      console.error("[BasicRecruitingView] Create recruit failed:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="h-6 text-[10px] px-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900"
        >
          <UserPlus className="h-3 w-3 mr-1" />
          Add Recruit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-sm">Add New Recruit</DialogTitle>
          <DialogDescription className="text-[11px] text-zinc-500">
            Add basic contact information for your new recruit.
          </DialogDescription>
        </DialogHeader>

        {/* Upline Assignment Info */}
        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-md border border-zinc-200 dark:border-zinc-700">
          <User className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
          <div className="flex-1">
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              Assigned Upline
            </p>
            <p className="text-[11px] font-medium text-zinc-900 dark:text-zinc-100">
              {user?.first_name} {user?.last_name}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="first_name" className="text-[10px]">
                First Name *
              </Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    first_name: e.target.value,
                  }))
                }
                className="h-8 text-[11px]"
                placeholder="John"
              />
              {errors.first_name && (
                <p className="text-[9px] text-red-500">{errors.first_name}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="last_name" className="text-[10px]">
                Last Name *
              </Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    last_name: e.target.value,
                  }))
                }
                className="h-8 text-[11px]"
                placeholder="Doe"
              />
              {errors.last_name && (
                <p className="text-[9px] text-red-500">{errors.last_name}</p>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="email" className="text-[10px]">
              Email *
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
              className="h-8 text-[11px]"
              placeholder="john.doe@example.com"
            />
            {errors.email && (
              <p className="text-[9px] text-red-500">{errors.email}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="phone" className="text-[10px]">
                Phone
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, phone: e.target.value }))
                }
                className="h-8 text-[11px]"
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="resident_state" className="text-[10px]">
                Resident State
              </Label>
              <Select
                value={formData.resident_state}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, resident_state: value }))
                }
              >
                <SelectTrigger id="resident_state" className="h-8 text-[11px]">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => (
                    <SelectItem
                      key={s.value}
                      value={s.value}
                      className="text-[11px]"
                    >
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2">
              <Label
                htmlFor="is_licensed"
                className="text-[10px] cursor-pointer"
              >
                Already Licensed?
              </Label>
              <Switch
                id="is_licensed"
                checked={formData.is_licensed}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, is_licensed: checked }))
                }
                className="scale-75"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contract_level" className="text-[10px]">
                Starting Comp %
              </Label>
              <Select
                value={formData.contract_level}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    contract_level: value,
                  }))
                }
              >
                <SelectTrigger
                  id="contract_level"
                  className="h-8 text-[11px] bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700"
                >
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  {VALID_CONTRACT_LEVELS.map((level) => (
                    <SelectItem
                      key={level}
                      value={level.toString()}
                      className="text-[11px]"
                    >
                      {level}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[10px]"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-7 text-[10px]"
              disabled={createRecruit.isPending}
            >
              {createRecruit.isPending ? "Adding..." : "Add Recruit"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default BasicRecruitingView;
