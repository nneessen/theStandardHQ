// Main page for the Close AI Builder feature. Tabs: Email / SMS / Workflow / Library.
// Gating is done at the route level via <RouteGuard subscriptionFeature="close_ai_builder">.
// This page additionally checks for a connected Close account and shows
// NotConnectedPrompt if missing.

import {
  Sparkles,
  Mail,
  MessageSquare,
  GitBranch,
  Library,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailBuilderTab } from "./components/EmailBuilderTab";
import { SmsBuilderTab } from "./components/SmsBuilderTab";
import { SequenceBuilderTab } from "./components/SequenceBuilderTab";
import { LibraryTab } from "./components/LibraryTab";
import { NotConnectedPrompt } from "./components/NotConnectedPrompt";
import { useCloseAiConnectionStatus } from "./hooks/useCloseAiBuilder";

export function CloseAiBuilderPage() {
  const { data: connection, isLoading } = useCloseAiConnectionStatus();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-gradient-to-br from-amber-500/10 to-violet-500/10 p-2">
            <Sparkles className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">AI Template Builder</h1>
            <p className="text-xs text-muted-foreground">
              Generate Close CRM email templates, SMS templates, and workflows
              from a prompt
            </p>
          </div>
        </div>
        {connection?.connected && connection.organization_name && (
          <div className="text-xs text-muted-foreground">
            Connected to{" "}
            <span className="font-medium text-foreground">
              {connection.organization_name}
            </span>
          </div>
        )}
      </div>

      {!isLoading && !connection?.connected ? (
        <NotConnectedPrompt />
      ) : (
        <Tabs defaultValue="email" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-4 gap-1 rounded-lg bg-v2-card-tinted p-1 dark:bg-v2-card-tinted/70">
            <TabsTrigger value="email" className="gap-2">
              <Mail className="h-3.5 w-3.5" />
              <span className="text-xs">Email</span>
            </TabsTrigger>
            <TabsTrigger value="sms" className="gap-2">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="text-xs">SMS</span>
            </TabsTrigger>
            <TabsTrigger value="sequence" className="gap-2">
              <GitBranch className="h-3.5 w-3.5" />
              <span className="text-xs">Workflow</span>
            </TabsTrigger>
            <TabsTrigger value="library" className="gap-2">
              <Library className="h-3.5 w-3.5" />
              <span className="text-xs">Library</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email">
            <EmailBuilderTab />
          </TabsContent>
          <TabsContent value="sms">
            <SmsBuilderTab />
          </TabsContent>
          <TabsContent value="sequence">
            <SequenceBuilderTab />
          </TabsContent>
          <TabsContent value="library">
            <LibraryTab />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
