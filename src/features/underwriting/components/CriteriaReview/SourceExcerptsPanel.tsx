// src/features/underwriting/components/CriteriaReview/SourceExcerptsPanel.tsx

import { FileText, Quote, FileCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SourceExcerpt } from "../../types/underwriting.types";

interface SourceExcerptsPanelProps {
  excerpts: SourceExcerpt[];
  maxHeight?: string;
}

const fieldLabels: Record<string, string> = {
  ageLimits: "Age Limits",
  faceAmountLimits: "Face Amount Limits",
  knockoutConditions: "Knockout Conditions",
  buildRequirements: "Build/BMI Requirements",
  tobaccoRules: "Tobacco Rules",
  medicationRestrictions: "Medication Restrictions",
  stateAvailability: "State Availability",
  coverageOptions: "Coverage Options",
};

export function SourceExcerptsPanel({
  excerpts,
  maxHeight = "400px",
}: SourceExcerptsPanelProps) {
  if (!excerpts || excerpts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-v2-ink-subtle dark:text-v2-ink-muted">
        <FileCode className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-[10px]">No source excerpts available</p>
        <p className="text-[9px] mt-1 text-v2-ink-subtle/70">
          Source citations help verify extracted data
        </p>
      </div>
    );
  }

  // Group excerpts by field
  const groupedExcerpts = excerpts.reduce(
    (acc, excerpt) => {
      const field = excerpt.field || "other";
      if (!acc[field]) {
        acc[field] = [];
      }
      acc[field].push(excerpt);
      return acc;
    },
    {} as Record<string, SourceExcerpt[]>,
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-2">
        <Quote className="h-3 w-3 text-v2-ink-subtle" />
        <h4 className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle">
          Source Citations ({excerpts.length})
        </h4>
      </div>

      <ScrollArea style={{ maxHeight }} className="pr-2">
        <div className="space-y-3">
          {Object.entries(groupedExcerpts).map(([field, fieldExcerpts]) => (
            <div
              key={field}
              className="border border-v2-ring dark:border-v2-ring-strong rounded-md overflow-hidden"
            >
              <div className="bg-v2-canvas dark:bg-v2-card-tinted/50 px-2.5 py-1.5 border-b border-v2-ring dark:border-v2-ring-strong">
                <span className="text-[10px] font-medium text-v2-ink dark:text-v2-ink-muted">
                  {fieldLabels[field] || field}
                </span>
              </div>
              <div className="p-2 space-y-2">
                {fieldExcerpts.map((excerpt, idx) => (
                  <div
                    key={idx}
                    className="bg-v2-card/50 border border-v2-ring dark:border-v2-ring rounded p-2"
                  >
                    <div className="flex items-start gap-2">
                      <FileText className="h-3 w-3 text-v2-ink-subtle shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-v2-ink dark:text-v2-ink-muted whitespace-pre-wrap break-words leading-relaxed">
                          "{excerpt.excerpt}"
                        </p>
                        {excerpt.pageNumber && (
                          <Badge
                            variant="outline"
                            className="mt-1.5 text-[8px] px-1 py-0 h-4"
                          >
                            Page {excerpt.pageNumber}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
