// Domain Setup Guide
// Collapsible guide showing the 4-step domain setup process with time estimates

import { useState } from "react";
import { ChevronDown, ChevronRight, Clock } from "lucide-react";

interface DomainSetupGuideProps {
  defaultOpen?: boolean;
}

const SETUP_STEPS = [
  {
    step: 1,
    name: "Add Domain",
    time: "~1 min",
    description: "Enter your subdomain (e.g., join.yourdomain.com)",
  },
  {
    step: 2,
    name: "Configure DNS",
    time: "5-15 min",
    description: "Add CNAME + TXT records at your domain registrar",
  },
  {
    step: 3,
    name: "Verify DNS",
    time: "~1 min",
    description: "We check your DNS records are configured correctly",
  },
  {
    step: 4,
    name: "SSL Provisioning",
    time: "1-15 min",
    description: "Vercel generates your SSL certificate automatically",
  },
];

export function DomainSetupGuide({
  defaultOpen = false,
}: DomainSetupGuideProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-md border border-v2-ring bg-v2-canvas">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-xs font-medium text-v2-ink">How It Works</span>
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 text-v2-ink-muted" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-v2-ink-muted" />
        )}
      </button>

      {isOpen && (
        <div className="border-t border-v2-ring px-3 py-2">
          <div className="space-y-2">
            {SETUP_STEPS.map((step) => (
              <div key={step.step} className="flex items-start gap-2">
                <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-v2-ring text-[10px] font-medium text-v2-ink-muted">
                  {step.step}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-v2-ink">
                      {step.name}
                    </span>
                    <span className="flex items-center gap-0.5 text-[10px] text-v2-ink-muted">
                      <Clock className="h-2.5 w-2.5" />
                      {step.time}
                    </span>
                  </div>
                  <p className="text-[10px] text-v2-ink-muted">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 border-t border-v2-ring pt-2 text-[10px] text-v2-ink-muted">
            Total setup time: 10-30 minutes depending on DNS propagation
          </p>
        </div>
      )}
    </div>
  );
}
