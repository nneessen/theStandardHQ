// src/features/underwriting/components/UnderwritingSettingsTab.tsx

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  History,
  FileText,
  ClipboardCheck,
  DollarSign,
  Shield,
  LayoutGrid,
} from "lucide-react";
import { useCanManageUnderwriting } from "../../hooks/wizard/useUnderwritingFeatureFlag";
import { SessionHistoryList } from "../SessionHistory";
import { GuideList } from "../GuideManager";
import { CarrierRuleCoveragePanel } from "../CoverageDashboard";
import { CriteriaReviewDashboard } from "../CriteriaReview";
import { RateEntryTab } from "../RateEntry";
import { AcceptanceRulesTab } from "../AcceptanceRules";
import { CoverageTab } from "../CoverageBuilder";

export function UnderwritingSettingsTab() {
  const { canManage, isLoading } = useCanManageUnderwriting();
  const [activeTab, setActiveTab] = useState("criteria");

  if (isLoading) {
    return (
      <div className="bg-v2-card rounded-lg border border-v2-ring p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-v2-ink dark:border-v2-ring" />
        </div>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="bg-v2-card rounded-lg border border-v2-ring p-6">
        <div className="text-center text-v2-ink-muted text-[11px]">
          You don't have permission to manage underwriting settings.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-v2-card rounded-lg border border-v2-ring">
      {/* Header */}
      <div className="px-3 py-2 border-b border-v2-ring/60">
        <h2 className="text-[12px] font-semibold text-v2-ink">
          AI Underwriting Wizard
        </h2>
        <p className="text-[10px] text-v2-ink-muted mt-0.5">
          Manage carrier criteria, premium rates, acceptance rules, and view
          session history
        </p>
      </div>

      {/* Sub-tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex items-center gap-0 bg-v2-card-tinted/50 dark:bg-v2-card-tinted/50 mx-3 mt-2 rounded-md p-0.5 h-auto w-fit">
          <TabsTrigger
            value="criteria"
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-v2-card data-[state=active]:shadow-sm data-[state=active]:text-v2-ink dark:data-[state=active]:text-v2-canvas text-v2-ink-muted hover:text-v2-ink dark:hover:text-v2-ink-subtle"
          >
            <ClipboardCheck className="h-3 w-3 shrink-0" />
            <span>Criteria</span>
          </TabsTrigger>
          <TabsTrigger
            value="rates"
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-v2-card data-[state=active]:shadow-sm data-[state=active]:text-v2-ink dark:data-[state=active]:text-v2-canvas text-v2-ink-muted hover:text-v2-ink dark:hover:text-v2-ink-subtle"
          >
            <DollarSign className="h-3 w-3 shrink-0" />
            <span>Rates</span>
          </TabsTrigger>
          <TabsTrigger
            value="acceptance"
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-v2-card data-[state=active]:shadow-sm data-[state=active]:text-v2-ink dark:data-[state=active]:text-v2-canvas text-v2-ink-muted hover:text-v2-ink dark:hover:text-v2-ink-subtle"
          >
            <Shield className="h-3 w-3 shrink-0" />
            <span>Acceptance</span>
          </TabsTrigger>
          <TabsTrigger
            value="coverage"
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-v2-card data-[state=active]:shadow-sm data-[state=active]:text-v2-ink dark:data-[state=active]:text-v2-canvas text-v2-ink-muted hover:text-v2-ink dark:hover:text-v2-ink-subtle"
          >
            <LayoutGrid className="h-3 w-3 shrink-0" />
            <span>Coverage</span>
          </TabsTrigger>
          <TabsTrigger
            value="guides"
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-v2-card data-[state=active]:shadow-sm data-[state=active]:text-v2-ink dark:data-[state=active]:text-v2-canvas text-v2-ink-muted hover:text-v2-ink dark:hover:text-v2-ink-subtle"
          >
            <FileText className="h-3 w-3 shrink-0" />
            <span>Guides</span>
          </TabsTrigger>
          <TabsTrigger
            value="sessions"
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-v2-card data-[state=active]:shadow-sm data-[state=active]:text-v2-ink dark:data-[state=active]:text-v2-canvas text-v2-ink-muted hover:text-v2-ink dark:hover:text-v2-ink-subtle"
          >
            <History className="h-3 w-3 shrink-0" />
            <span>History</span>
          </TabsTrigger>
        </TabsList>

        <div className="p-3">
          <TabsContent value="criteria" className="mt-0">
            <CriteriaReviewDashboard />
          </TabsContent>

          <TabsContent value="rates" className="mt-0">
            <RateEntryTab />
          </TabsContent>

          <TabsContent value="acceptance" className="mt-0">
            <AcceptanceRulesTab />
          </TabsContent>

          <TabsContent value="coverage" className="mt-0">
            <CoverageTab />
          </TabsContent>

          <TabsContent value="guides" className="mt-0 space-y-3">
            <CarrierRuleCoveragePanel />
            <GuideList />
          </TabsContent>

          <TabsContent value="sessions" className="mt-0">
            <SessionHistoryList />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
