// src/features/business-tools/components/BusinessToolsLanding.tsx
// Upsell landing page for users without business_tools feature access

import {
  FileSpreadsheet,
  PieChart,
  Download,
  CheckCircle2,
} from "lucide-react";
import { UpgradePrompt } from "@/components/subscription/UpgradePrompt";

const VALUE_PROPS = [
  {
    icon: FileSpreadsheet,
    title: "Statement Processing",
    desc: "Upload bank and credit card statements (PDF/CSV) for automatic transaction extraction.",
  },
  {
    icon: PieChart,
    title: "Smart Categorization",
    desc: "AI-powered transaction categorization with business/personal split tracking.",
  },
  {
    icon: CheckCircle2,
    title: "Review & Approve",
    desc: "Review flagged transactions, approve or exclude items, and manage trust state.",
  },
  {
    icon: Download,
    title: "Workbook Export",
    desc: "Export categorized transactions as an Excel workbook for tax prep or bookkeeping.",
  },
];

export function BusinessToolsLanding() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Business Tools
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
          Track business vs personal expenses directly in the platform. Upload
          statements, categorize transactions, and export workbooks.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {VALUE_PROPS.map((vp) => (
          <div
            key={vp.title}
            className="flex items-start gap-2.5 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
          >
            <div className="p-1.5 rounded bg-teal-50 dark:bg-teal-900/30 shrink-0">
              <vp.icon className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200">
                {vp.title}
              </p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {vp.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      <UpgradePrompt
        feature="business_tools"
        title="Unlock Business Tools"
        description="Business Tools is available on the Team plan. Upgrade to start processing your financial statements."
      />
    </div>
  );
}
