// src/features/underwriting/components/UWWizardDisclaimerGate.tsx

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UWWizardDisclaimerGateProps {
  onAcknowledge: () => void;
}

export function UWWizardDisclaimerGate({
  onAcknowledge,
}: UWWizardDisclaimerGateProps) {
  return (
    <Dialog open>
      <DialogContent
        className="max-w-md p-5"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
            Important: Use With Caution
          </DialogTitle>
        </DialogHeader>

        <ul className="space-y-2 text-xs text-muted-foreground pl-1">
          <li className="flex gap-2">
            <span className="text-amber-500 flex-shrink-0 mt-0.5">•</span>
            <span>
              This tool is still under active development and may not cover all
              scenarios.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-500 flex-shrink-0 mt-0.5">•</span>
            <span>
              Results marked{" "}
              <strong className="text-foreground">
                &quot;Needs Manual Review&quot;
              </strong>{" "}
              or{" "}
              <strong className="text-foreground">
                &quot;Unknown Eligibility&quot;
              </strong>{" "}
              require actual manual underwriting review — the system does not
              have enough data to give a definitive answer.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-500 flex-shrink-0 mt-0.5">•</span>
            <span>
              Do not rely solely on this tool for final underwriting decisions.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-amber-500 flex-shrink-0 mt-0.5">•</span>
            <span>Always verify results against carrier guidelines.</span>
          </li>
        </ul>

        <Button
          onClick={onAcknowledge}
          size="sm"
          className="w-full h-8 text-xs mt-2"
        >
          I Understand
        </Button>
      </DialogContent>
    </Dialog>
  );
}
