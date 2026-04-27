// src/features/settings/integrations/IntegrationsTab.tsx

import { useState } from "react";
import {
  Calendar,
  CalendarDays,
  Video,
  Plus,
  Loader2,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useSchedulingIntegrations,
  useDeleteSchedulingIntegration,
  useToggleSchedulingIntegration,
} from "@/hooks/integrations";
import { IntegrationDialog } from "./components/IntegrationDialog";
import { SlackIntegrationCard } from "./components/slack";
import { InstagramIntegrationCard } from "./components/instagram";
import { GmailIntegrationCard } from "./components/gmail";
import { ElevenLabsIntegrationCard } from "./components/elevenlabs/ElevenLabsIntegrationCard";
import type {
  SchedulingIntegration,
  SchedulingIntegrationType,
} from "@/types/integration.types";
import {
  INTEGRATION_TYPE_LABELS,
  INTEGRATION_TYPE_DESCRIPTIONS,
} from "@/types/integration.types";
import { toast } from "sonner";

const INTEGRATION_ICONS: Record<SchedulingIntegrationType, typeof Calendar> = {
  calendly: Calendar,
  google_calendar: CalendarDays,
  zoom: Video,
  google_meet: Video,
};

const INTEGRATION_COLORS: Record<SchedulingIntegrationType, string> = {
  calendly: "text-blue-600 dark:text-blue-400",
  google_calendar: "text-green-600 dark:text-green-400",
  zoom: "text-indigo-600 dark:text-indigo-400",
  google_meet: "text-purple-600 dark:text-purple-400",
};

export function IntegrationsTab() {
  const { data: integrations, isLoading } = useSchedulingIntegrations();
  const deleteIntegration = useDeleteSchedulingIntegration();
  const toggleIntegration = useToggleSchedulingIntegration();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] =
    useState<SchedulingIntegration | null>(null);
  const [selectedType, setSelectedType] =
    useState<SchedulingIntegrationType | null>(null);

  const handleEdit = (integration: SchedulingIntegration) => {
    setEditingIntegration(integration);
    setSelectedType(integration.integration_type);
    setDialogOpen(true);
  };

  const handleAdd = (type: SchedulingIntegrationType) => {
    setEditingIntegration(null);
    setSelectedType(type);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteIntegration.mutateAsync(id);
      toast.success("Integration removed");
    } catch {
      toast.error("Failed to remove integration");
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await toggleIntegration.mutateAsync({ id, isActive });
      toast.success(isActive ? "Integration enabled" : "Integration disabled");
    } catch {
      toast.error("Failed to update integration");
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingIntegration(null);
    setSelectedType(null);
  };

  // Get existing integration types
  const existingTypes = new Set(
    integrations?.map((i) => i.integration_type) || [],
  );

  // Available types to add
  const availableTypes: SchedulingIntegrationType[] = [
    "calendly",
    "google_calendar",
    "zoom",
  ];
  const typesToAdd = availableTypes.filter((t) => !existingTypes.has(t));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Email Integration Section */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-muted px-1">
          Email Integration
        </h3>
        <GmailIntegrationCard />
      </div>

      {/* Messaging Integrations Section */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-muted px-1">
          Messaging Integrations
        </h3>
        <SlackIntegrationCard />
        <InstagramIntegrationCard />
      </div>

      {/* Training Integrations Section */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-muted px-1">
          Training Integrations
        </h3>
        <ElevenLabsIntegrationCard />
      </div>

      {/* Scheduling Integrations Section */}
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between bg-v2-card rounded-lg px-3 py-2 border border-v2-ring">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-v2-ink-muted" />
            <div>
              <h2 className="text-sm font-semibold text-v2-ink">
                Scheduling Integrations
              </h2>
              <p className="text-[10px] text-v2-ink-muted">
                Connect your scheduling tools for recruiting pipeline
              </p>
            </div>
          </div>
        </div>

        {/* Existing Integrations */}
        {integrations && integrations.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-muted px-1">
              Connected Integrations
            </h3>
            <div className="space-y-1.5">
              {integrations.map((integration) => {
                const Icon = INTEGRATION_ICONS[integration.integration_type];
                const colorClass =
                  INTEGRATION_COLORS[integration.integration_type];

                return (
                  <div
                    key={integration.id}
                    className="flex items-center gap-3 p-2.5 bg-v2-card rounded-md border border-v2-ring"
                  >
                    <div className={`p-1.5 rounded ${colorClass} bg-v2-ring`}>
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-v2-ink">
                          {
                            INTEGRATION_TYPE_LABELS[
                              integration.integration_type
                            ]
                          }
                        </span>
                        {integration.display_name && (
                          <span className="text-[10px] text-v2-ink-muted">
                            — {integration.display_name}
                          </span>
                        )}
                        <Badge
                          variant={
                            integration.is_active ? "default" : "secondary"
                          }
                          className="text-[9px] h-4 px-1.5"
                        >
                          {integration.is_active ? "Active" : "Disabled"}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-v2-ink-muted truncate">
                        {integration.booking_url}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() =>
                          handleToggle(integration.id, !integration.is_active)
                        }
                        disabled={toggleIntegration.isPending}
                      >
                        {integration.is_active ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => handleEdit(integration)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] text-red-500 hover:text-red-600 dark:text-red-400"
                        onClick={() => handleDelete(integration.id)}
                        disabled={deleteIntegration.isPending}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Available Integrations to Add */}
        {typesToAdd.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-muted px-1">
              Available Integrations
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {typesToAdd.map((type) => {
                const Icon = INTEGRATION_ICONS[type];
                const colorClass = INTEGRATION_COLORS[type];

                return (
                  <button
                    key={type}
                    onClick={() => handleAdd(type)}
                    className="flex items-center gap-2.5 p-2.5 bg-v2-card rounded-md border border-dashed border-v2-ring dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-v2-ring transition-colors text-left"
                  >
                    <div className={`p-1.5 rounded ${colorClass} bg-v2-ring`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-v2-ink">
                          {INTEGRATION_TYPE_LABELS[type]}
                        </span>
                        <Plus className="h-3 w-3 text-v2-ink-subtle" />
                      </div>
                      <p className="text-[10px] text-v2-ink-muted">
                        {INTEGRATION_TYPE_DESCRIPTIONS[type]}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {(!integrations || integrations.length === 0) &&
          typesToAdd.length === 0 && (
            <div className="text-center py-8 text-[11px] text-v2-ink-muted">
              All integrations are connected.
            </div>
          )}

        {/* Integration Dialog */}
        <IntegrationDialog
          open={dialogOpen}
          onClose={handleDialogClose}
          integrationType={selectedType}
          existingIntegration={editingIntegration}
        />
      </div>
    </div>
  );
}
