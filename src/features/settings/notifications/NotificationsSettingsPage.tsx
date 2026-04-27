/**
 * Notifications Settings Page
 *
 * Allows users to manage notification preferences and alert rules.
 */

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, AlertTriangle } from "lucide-react";
import { NotificationPreferencesSection } from "./components/NotificationPreferencesSection";
import { AlertRulesSection } from "./components/AlertRulesSection";

export function NotificationsSettingsPage() {
  const [activeTab, setActiveTab] = useState("preferences");

  return (
    <div className="bg-v2-card rounded-lg border border-v2-ring">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-v2-ring/60">
        <div className="flex items-center gap-2">
          <Bell className="h-3.5 w-3.5 text-v2-ink-subtle" />
          <div>
            <h3 className="text-[11px] font-semibold text-v2-ink uppercase tracking-wide">
              Notifications & Alerts
            </h3>
            <p className="text-[10px] text-v2-ink-muted">
              Manage notifications and custom alerts
            </p>
          </div>
        </div>
      </div>

      <div className="p-3">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 max-w-xs h-7">
            <TabsTrigger value="preferences" className="text-[10px] h-6 gap-1">
              <Bell className="h-3 w-3" />
              Preferences
            </TabsTrigger>
            <TabsTrigger value="alerts" className="text-[10px] h-6 gap-1">
              <AlertTriangle className="h-3 w-3" />
              Alert Rules
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preferences" className="mt-3">
            <NotificationPreferencesSection />
          </TabsContent>

          <TabsContent value="alerts" className="mt-3">
            <AlertRulesSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
