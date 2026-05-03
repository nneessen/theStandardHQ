// src/features/training-hub/components/TrainingHubPage.tsx
// Training Hub for trainers and contracting managers
// Note: Recruit pipeline management is now via the main /recruiting page
// Note: Automation/workflows moved to super-admin-only /system/workflows page
import { useState, useEffect } from "react";
import { Mail, Search, X, GraduationCap, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PillNav, SoftCard } from "@/components/v2";
import { useQuery } from "@tanstack/react-query";
// eslint-disable-next-line no-restricted-imports
import { supabase } from "@/services/base/supabase";
import { ActivityTab } from "./ActivityTab";
import { EmailTemplatesTab } from "./EmailTemplatesTab";
import { DocumentsTab } from "./DocumentsTab";
// eslint-disable-next-line no-restricted-imports
import { ModulesManagementTab } from "@/features/training-modules/components/admin/ModulesManagementTab";

type TabView = "templates" | "documents" | "modules" | "activity";

const TAB_STORAGE_KEY = "training-hub-active-tab";

const VALID_TABS: TabView[] = ["templates", "documents", "modules", "activity"];

export default function TrainingHubPage() {
  // Persist tab selection in localStorage
  const [activeView, setActiveView] = useState<TabView>(() => {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    if (saved && VALID_TABS.includes(saved as TabView)) {
      return saved as TabView;
    }
    return "templates";
  });
  const [searchQuery, setSearchQuery] = useState("");

  // Persist tab changes
  useEffect(() => {
    localStorage.setItem(TAB_STORAGE_KEY, activeView);
  }, [activeView]);

  // Fetch email templates count
  const { data: templateStats } = useQuery({
    queryKey: ["training-hub-template-stats"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("email_templates")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      if (error) throw error;
      return { count: count || 0 };
    },
  });

  // Fetch training documents count
  const { data: documentStats } = useQuery({
    queryKey: ["training-hub-document-stats"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("training_documents")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      if (error) throw error;
      return { count: count || 0 };
    },
  });

  const tabItems = [
    { label: "Email Templates", value: "templates" },
    { label: "Documents", value: "documents" },
    { label: "Modules", value: "modules" },
    { label: "Activity", value: "activity" },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Compact header — title + inline stats + search */}
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <GraduationCap className="h-4 w-4 text-v2-ink" />
            <h1 className="text-base font-semibold tracking-tight text-v2-ink">
              Training Hub
            </h1>
          </div>
          <div className="flex items-center gap-x-2 gap-y-0.5 text-[11px] text-v2-ink-muted flex-wrap leading-tight">
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3 w-3 text-info" />
              <span className="text-v2-ink font-semibold">
                {templateStats?.count ?? 0}
              </span>
              templates
            </span>
            <span className="text-v2-ink-subtle">·</span>
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3 w-3 text-success" />
              <span className="text-v2-ink font-semibold">
                {documentStats?.count ?? 0}
              </span>
              documents
            </span>
          </div>
        </div>
        <div className="relative w-56 flex-shrink-0">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-v2-ink-subtle" />
          <Input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-7 pr-7 text-xs bg-v2-card border-v2-ring"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0.5 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </header>

      <PillNav
        size="sm"
        activeValue={activeView}
        onChange={(v) => setActiveView(v as TabView)}
        items={tabItems}
      />

      <SoftCard padding="md">
        {activeView === "templates" && (
          <EmailTemplatesTab searchQuery={searchQuery} />
        )}
        {activeView === "documents" && (
          <DocumentsTab searchQuery={searchQuery} />
        )}
        {activeView === "modules" && <ModulesManagementTab />}
        {activeView === "activity" && <ActivityTab searchQuery={searchQuery} />}
      </SoftCard>
    </div>
  );
}
