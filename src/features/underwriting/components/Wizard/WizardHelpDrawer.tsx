import { AlertTriangle, FileWarning, ShieldAlert } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { KNOWN_LIMITATIONS } from "./wizard-content";

interface WizardHelpDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WizardHelpDrawer({
  open,
  onOpenChange,
}: WizardHelpDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <SheetHeader className="px-4 py-3 border-b border-border">
          <SheetTitle className="text-sm">About the UW Wizard</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto h-[calc(100%-3.5rem)] px-4 py-4 space-y-4">
          <section className="rounded-v2-md border border-v2-ring bg-v2-card-tinted p-4">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="h-4 w-4 mt-0.5 text-v2-ink-muted flex-shrink-0" />
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-v2-ink">
                  Decision support, not final underwriting authority
                </h3>
                <p className="text-xs leading-5 text-v2-ink-muted">
                  This wizard helps screen likely fits using stored underwriting
                  data, but the flow is still evolving. Favorable results should
                  be treated as directional until an agent verifies the case
                  against current carrier rules.
                </p>
              </div>
            </div>
          </section>

          <Alert variant="warning" className="text-xs">
            <AlertTriangle className="h-3.5 w-3.5" />
            <AlertTitle className="text-xs">How to use it</AlertTitle>
            <AlertDescription className="text-xs leading-5">
              Use this tool to narrow options and identify follow-up needs. Do
              not use it as the sole basis for quoting a medically complex case.
            </AlertDescription>
          </Alert>

          <section className="rounded-v2-md border border-v2-ring bg-v2-card p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <FileWarning className="h-3.5 w-3.5 text-v2-ink-muted" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-v2-ink-muted">
                Known limitations
              </h3>
            </div>
            <ul className="space-y-2 text-xs leading-5 text-v2-ink-muted">
              {KNOWN_LIMITATIONS.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-v2-ink-muted flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default WizardHelpDrawer;
