// src/features/recruiting/components/RecruitingAddButtons.tsx
// The three "add" entry points for the recruiting header, each with a hover
// tooltip explaining who it's for. Shared by the staff/admin and free-upline
// recruiting views (both PillButton-based) so the copy lives in one place.

import { PillButton } from "@/components/v2";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserPlus, Users, UserCheck } from "lucide-react";

interface RecruitingAddButtonsProps {
  onAddProspect: () => void;
  onAddRecruit: () => void;
  onAddAgent: () => void;
}

export function RecruitingAddButtons({
  onAddProspect,
  onAddRecruit,
  onAddAgent,
}: RecruitingAddButtonsProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PillButton
            tone="yellow"
            size="sm"
            onClick={onAddProspect}
            leadingIcon={<Users className="h-3.5 w-3.5" />}
          >
            Add prospect
          </PillButton>
        </TooltipTrigger>
        <TooltipContent className="max-w-[220px]">
          Someone you&apos;re talking to who&apos;s interested in joining but
          hasn&apos;t committed yet.
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <PillButton
            tone="black"
            size="sm"
            onClick={onAddRecruit}
            leadingIcon={<UserPlus className="h-3.5 w-3.5" />}
          >
            Add recruit
          </PillButton>
        </TooltipTrigger>
        <TooltipContent className="max-w-[220px]">
          Someone who&apos;s interested and ready to commit — runs them through
          a licensing pipeline.
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <PillButton
            tone="white"
            size="sm"
            onClick={onAddAgent}
            leadingIcon={<UserCheck className="h-3.5 w-3.5" />}
          >
            Add agent
          </PillButton>
        </TooltipTrigger>
        <TooltipContent className="max-w-[220px]">
          Already a licensed agent — adds them to your team (you&apos;re their
          upline) and skips the pipelines.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
