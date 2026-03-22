// src/features/channel-orchestration/components/post-call/PostCallTab.tsx
import { useState, useEffect } from "react";
import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  usePostCallConfig,
  useUpdatePostCallConfig,
} from "../../hooks/useOrchestration";
import type { PostCallConfig } from "../../types/orchestration.types";
import { StatusMappingEditor } from "./StatusMappingEditor";
import { CustomFieldMappingEditor } from "./CustomFieldMappingEditor";
import { TranscriptWritebackConfig } from "./TranscriptWritebackConfig";

const DEFAULT_CONFIG: PostCallConfig = {
  statusMapping: { enabled: false, mappings: [] },
  customFieldMapping: { enabled: false, mappings: [] },
  transcriptWriteback: {
    enabled: false,
    autoWriteback: false,
    format: "summary_with_highlights",
    includeRecordingLink: true,
  },
};

export function PostCallTab() {
  const { data: serverConfig, isLoading } = usePostCallConfig();
  const updateConfig = useUpdatePostCallConfig();

  const [config, setConfig] = useState<PostCallConfig>(DEFAULT_CONFIG);
  const [dirty, setDirty] = useState(false);

  // Sync server data to local state
  useEffect(() => {
    if (serverConfig) {
      setConfig(serverConfig);
      setDirty(false);
    }
  }, [serverConfig]);

  const update = (patch: Partial<PostCallConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const handleSave = () => {
    updateConfig.mutate(config, {
      onSuccess: () => setDirty(false),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-zinc-500">
        Configure what happens after voice calls — update lead statuses, custom
        fields, and write transcripts back to Close CRM.
      </p>

      {/* Status Mapping */}
      <Section
        label="Status Mapping"
        description="Change lead status based on voice call or appointment events"
        enabled={config.statusMapping.enabled}
        onToggle={(enabled) =>
          update({
            statusMapping: { ...config.statusMapping, enabled },
          })
        }
      >
        <StatusMappingEditor
          mappings={config.statusMapping.mappings}
          onChange={(mappings) =>
            update({
              statusMapping: { ...config.statusMapping, mappings },
            })
          }
        />
      </Section>

      {/* Custom Field Mapping */}
      <Section
        label="Custom Field Mapping"
        description="Update Close custom fields based on events"
        enabled={config.customFieldMapping.enabled}
        onToggle={(enabled) =>
          update({
            customFieldMapping: { ...config.customFieldMapping, enabled },
          })
        }
      >
        <CustomFieldMappingEditor
          mappings={config.customFieldMapping.mappings}
          onChange={(mappings) =>
            update({
              customFieldMapping: {
                ...config.customFieldMapping,
                mappings,
              },
            })
          }
        />
      </Section>

      {/* Transcript Writeback */}
      <Section
        label="Transcript Writeback"
        description="Write call transcripts and summaries to Close CRM notes"
        enabled={config.transcriptWriteback.enabled}
        onToggle={(enabled) =>
          update({
            transcriptWriteback: { ...config.transcriptWriteback, enabled },
          })
        }
      >
        <TranscriptWritebackConfig
          config={config.transcriptWriteback}
          onChange={(transcriptWriteback) => update({ transcriptWriteback })}
        />
      </Section>

      {/* Save */}
      <Button
        size="sm"
        className="h-7 text-[10px]"
        onClick={handleSave}
        disabled={!dirty || updateConfig.isPending}
      >
        {updateConfig.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
        ) : (
          <Save className="h-3 w-3 mr-1" />
        )}
        Save Changes
      </Button>
    </div>
  );
}

function Section({
  label,
  description,
  enabled,
  onToggle,
  children,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-md p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-[11px] font-medium">{label}</Label>
          <p className="text-[9px] text-zinc-500">{description}</p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          className="h-4 w-7"
        />
      </div>
      {enabled && children}
    </div>
  );
}
