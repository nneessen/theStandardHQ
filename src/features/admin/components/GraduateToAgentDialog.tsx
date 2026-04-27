// src/features/admin/components/GraduateToAgentDialog.tsx

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { GraduationCap, AlertCircle, CheckCircle2 } from "lucide-react";
import { VALID_CONTRACT_LEVELS } from "@/lib/constants";
import type { UserProfile } from "@/types/user.types";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useGraduateRecruit } from "@/hooks/admin";
import { toast } from "sonner";

interface GraduateToAgentDialogProps {
  recruit: UserProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GraduateToAgentDialog({
  recruit,
  open,
  onOpenChange,
}: GraduateToAgentDialogProps) {
  const { user: currentUser } = useAuth();
  const graduateMutation = useGraduateRecruit();
  const [contractLevel, setContractLevel] = useState<string>("80");
  const [notes, setNotes] = useState("");

  const handleGraduate = async () => {
    try {
      console.log(
        "[GraduateToAgentDialog] Starting graduation for:",
        recruit.id,
      );
      const result = await graduateMutation.mutateAsync({
        recruit,
        contractLevel: Number.parseInt(contractLevel, 10),
        notes: notes || undefined,
        graduatedBy: currentUser?.id ?? null,
      });

      console.log("[GraduateToAgentDialog] Graduation result:", result);

      if (!result.success) {
        toast.error(result.error || "Failed to graduate recruit");
        return;
      }

      toast.success(
        `${recruit.first_name} ${recruit.last_name} has been graduated to agent!`,
      );
      onOpenChange(false);
      setNotes("");
      setContractLevel("80");
    } catch (error) {
      console.error("[GraduateToAgentDialog] Graduation error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to graduate recruit",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-3 bg-v2-card border-v2-ring">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-1.5">
            <GraduationCap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <DialogTitle className="text-sm font-semibold text-v2-ink">
              Graduate to Agent
            </DialogTitle>
          </div>
          <DialogDescription className="text-[10px] text-v2-ink-muted">
            Promote {recruit.first_name} {recruit.last_name} from recruit to
            licensed agent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* What will happen - compact info box */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded p-2">
            <div className="flex items-start gap-1.5">
              <AlertCircle className="h-3 w-3 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="text-[10px] text-amber-800 dark:text-amber-200">
                <span className="font-medium">This action will:</span>
                <ul className="mt-1 space-y-0.5 ml-3 list-disc">
                  <li>Change role from Recruit to Agent</li>
                  <li>Grant access to full agent dashboard</li>
                  <li>Mark onboarding as completed</li>
                  <li>Set their initial contract level</li>
                  <li>Enable commission tracking</li>
                  <li>Notify their upline manager</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Contract Level */}
          <div className="space-y-1">
            <Label
              htmlFor="contract-level"
              className="text-[11px] text-v2-ink-muted"
            >
              Initial Contract Level
            </Label>
            <Select value={contractLevel} onValueChange={setContractLevel}>
              <SelectTrigger
                id="contract-level"
                className="h-7 text-[11px] bg-v2-card border-v2-ring"
              >
                <SelectValue />
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
            <p className="text-[10px] text-v2-ink-muted">
              Determines commission percentage on new business
            </p>
          </div>

          {/* Graduation Notes */}
          <div className="space-y-1">
            <Label htmlFor="notes" className="text-[11px] text-v2-ink-muted">
              Graduation Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              placeholder="Notes about graduation, achievements..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-[11px] bg-v2-card border-v2-ring resize-none"
            />
          </div>

          {/* Recruit Info - compact */}
          <div className="bg-v2-canvas rounded p-2 border border-v2-ring/50">
            <div className="flex items-center gap-1.5 mb-1.5">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span className="text-[11px] font-medium text-v2-ink">
                Recruit Information
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
              <div>
                <span className="text-v2-ink-muted">Started: </span>
                <span className="text-v2-ink-muted">
                  {format(
                    new Date(recruit.created_at || new Date()),
                    "MMM d, yyyy",
                  )}
                </span>
              </div>
              <div>
                <span className="text-v2-ink-muted">Phase: </span>
                <span className="text-v2-ink-muted">
                  {recruit.current_onboarding_phase?.replace(/_/g, " ") || "-"}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-v2-ink-muted">Email: </span>
                <span className="text-v2-ink-muted">{recruit.email}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-1 pt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            size="sm"
            className="h-6 px-2 text-[10px]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleGraduate}
            disabled={graduateMutation.isPending}
            size="sm"
            className="h-6 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {graduateMutation.isPending ? "Graduating..." : "Graduate to Agent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
