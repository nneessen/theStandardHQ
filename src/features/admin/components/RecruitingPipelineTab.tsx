// src/features/admin/components/RecruitingPipelineTab.tsx

import { useState } from "react";
import { UserPlus, ExternalLink, GraduationCap } from "lucide-react";
import type { UserProfile } from "@/types/user.types";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { GraduateToAgentDialog } from "./GraduateToAgentDialog";
import { RecruitDetailPanel } from "@/features/recruiting";

interface RecruitingPipelineTabProps {
  recruits: UserProfile[];
  allUsers: UserProfile[] | undefined;
  isLoading: boolean;
  canGraduateRecruits: boolean;
  graduationEligiblePhases: string[];
}

export function RecruitingPipelineTab({
  recruits,
  allUsers,
  isLoading,
  canGraduateRecruits,
  graduationEligiblePhases,
}: RecruitingPipelineTabProps) {
  const { user } = useAuth();
  const [graduatingRecruit, setGraduatingRecruit] =
    useState<UserProfile | null>(null);
  const [isGraduateDialogOpen, setIsGraduateDialogOpen] = useState(false);
  const [selectedRecruit, setSelectedRecruit] = useState<UserProfile | null>(
    null,
  );
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  const pendingCount = recruits.length;

  const openRecruitDetail = (recruit: UserProfile) => {
    setSelectedRecruit(recruit);
    setDetailSheetOpen(true);
  };

  const handleRecruitDeleted = () => {
    setSelectedRecruit(null);
    setDetailSheetOpen(false);
  };

  return (
    <div className="flex flex-col h-full space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5">
            <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium text-foreground">{pendingCount}</span>
            <span className="text-muted-foreground">pending recruits</span>
          </div>
        </div>
      </div>

      {/* Recruits table */}
      <div className="flex-1 overflow-auto rounded-lg bg-card border border-border">
        {isLoading ? (
          <div className="p-3 space-y-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground w-[180px]">
                  Recruit
                </TableHead>
                <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground w-[130px]">
                  Upline
                </TableHead>
                <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground w-[100px]">
                  Resident State
                </TableHead>
                <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground w-[90px]">
                  Applied
                </TableHead>
                <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground w-[100px]">
                  Phase
                </TableHead>
                <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground w-[100px] text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recruits.map((recruit) => {
                const recruitName =
                  recruit.first_name && recruit.last_name
                    ? `${recruit.first_name} ${recruit.last_name}`
                    : recruit.email;

                // Look up the upline user from allUsers by ID
                const uplineUser = recruit.upline_id
                  ? allUsers?.find((u) => u.id === recruit.upline_id)
                  : null;

                const uplineName = uplineUser
                  ? uplineUser.first_name && uplineUser.last_name
                    ? `${uplineUser.first_name} ${uplineUser.last_name}`
                    : uplineUser.email
                  : null;

                const currentPhase =
                  recruit.current_onboarding_phase ||
                  recruit.onboarding_status ||
                  "Not Started";

                return (
                  <TableRow
                    key={recruit.id}
                    className="hover:bg-background border-b border-border/60 cursor-pointer"
                    onClick={() => openRecruitDetail(recruit)}
                  >
                    <TableCell className="py-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="h-5 w-5 rounded-full bg-warning/20 dark:bg-warning/50 flex items-center justify-center text-[10px] font-semibold text-warning shrink-0">
                          {recruitName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-[11px] text-foreground truncate leading-tight">
                            {recruitName}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate leading-tight">
                            {recruit.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-1.5">
                      {uplineName ? (
                        <div className="text-[10px] text-muted-foreground dark:text-muted-foreground truncate">
                          {uplineName}
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">
                          -
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <span className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                        {recruit.resident_state || recruit.state || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="py-1.5">
                      <span className="text-[10px] text-muted-foreground">
                        {recruit.created_at
                          ? new Date(recruit.created_at).toLocaleDateString()
                          : "-"}
                      </span>
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Badge
                        variant="outline"
                        className="text-info border-info/30 text-[10px] h-4 px-1"
                      >
                        {currentPhase.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="py-1.5 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 px-1.5 text-[10px] text-muted-foreground dark:text-muted-foreground hover:text-foreground"
                          onClick={() => openRecruitDetail(recruit)}
                          title="Open pipeline detail"
                        >
                          <ExternalLink className="h-2.5 w-2.5 mr-0.5" />
                          Open
                        </Button>
                        {canGraduateRecruits &&
                          graduationEligiblePhases.includes(
                            recruit.current_onboarding_phase || "",
                          ) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 px-1.5 text-[10px] text-success hover:text-success hover:bg-success/10 dark:hover:bg-success/20"
                              onClick={() => {
                                setGraduatingRecruit(recruit);
                                setIsGraduateDialogOpen(true);
                              }}
                              title="Graduate to Agent"
                            >
                              <GraduationCap className="h-2.5 w-2.5 mr-0.5" />
                              Graduate
                            </Button>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {recruits.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-[11px] text-muted-foreground py-6"
                  >
                    No pending recruits
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Recruit pipeline detail sheet — same panel used by /recruiting */}
      <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[480px] md:max-w-[560px] lg:max-w-[640px] p-0 overflow-hidden"
        >
          <SheetTitle className="sr-only">Recruit Details</SheetTitle>
          <SheetDescription className="sr-only">
            View and manage recruit pipeline progress, documents, and Slack
            notifications
          </SheetDescription>
          {selectedRecruit && (
            <RecruitDetailPanel
              key={selectedRecruit.id}
              recruit={selectedRecruit}
              currentUserId={user?.id}
              isUpline={true}
              onRecruitDeleted={handleRecruitDeleted}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Graduate to Agent Dialog */}
      {graduatingRecruit && (
        <GraduateToAgentDialog
          recruit={graduatingRecruit}
          open={isGraduateDialogOpen}
          onOpenChange={(open) => {
            setIsGraduateDialogOpen(open);
            if (!open) setGraduatingRecruit(null);
          }}
        />
      )}
    </div>
  );
}
