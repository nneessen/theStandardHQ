// src/features/settings/integrations/components/elevenlabs/ElevenLabsIntegrationCard.tsx
import { useState, useCallback } from "react";
import {
  Volume2,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// eslint-disable-next-line no-restricted-imports
import { supabase } from "@/services/base/supabase";
import { useImo } from "@/contexts/ImoContext";
import { toast } from "sonner";

interface ElevenLabsConfig {
  id: string;
  imo_id: string;
  api_key_encrypted: string;
  default_voice_id: string | null;
  default_voice_name: string | null;
  is_active: boolean;
}

const elevenlabsKeys = {
  config: (imoId: string) => ["elevenlabs-config", imoId] as const,
};

function useElevenLabsConfig(imoId: string | undefined) {
  return useQuery({
    queryKey: elevenlabsKeys.config(imoId!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("elevenlabs_config")
        .select("*")
        .eq("imo_id", imoId!)
        .maybeSingle();
      if (error) throw error;
      return data as ElevenLabsConfig | null;
    },
    enabled: !!imoId,
  });
}

export function ElevenLabsIntegrationCard() {
  const { imo } = useImo();
  const queryClient = useQueryClient();
  const { data: config, isLoading } = useElevenLabsConfig(imo?.id);

  const [apiKey, setApiKey] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [voiceName, setVoiceName] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [editing, setEditing] = useState(false);
  const [testing, setTesting] = useState(false);

  // Save config via edge function (encrypts API key server-side)
  const saveMutation = useMutation({
    mutationFn: async (params: {
      apiKey: string;
      voiceId: string;
      voiceName: string;
      imoId: string;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "save-elevenlabs-config",
        {
          body: {
            imoId: params.imoId,
            apiKey: params.apiKey,
            voiceId: params.voiceId || undefined,
            voiceName: params.voiceName || undefined,
            existingId: config?.id || undefined,
          },
        },
      );
      if (error) throw new Error(error.message || "Failed to save config");
      if (data && !data.ok)
        throw new Error(data.error || "Failed to save config");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: elevenlabsKeys.config(imo!.id),
      });
      setEditing(false);
      setApiKey("");
      toast.success("ElevenLabs configuration saved");
    },
    onError: (err) => {
      toast.error(
        `Failed to save: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    },
  });

  // Toggle active
  const toggleMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      if (!config) return;
      const { error } = await supabase
        .from("elevenlabs_config")
        .update({ is_active: isActive })
        .eq("id", config.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: elevenlabsKeys.config(imo!.id),
      });
    },
  });

  // Test the API key
  const handleTest = useCallback(async () => {
    setTesting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("text-to-speech", {
        body: { text: "Testing ElevenLabs text to speech integration." },
      });

      if (response.error) throw new Error(response.error.message);
      toast.success("TTS test successful! Audio generated.");
    } catch (err) {
      toast.error(
        `Test failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setTesting(false);
    }
  }, []);

  const handleSave = () => {
    if (!imo || !apiKey.trim()) return;
    saveMutation.mutate({
      apiKey: apiKey.trim(),
      voiceId: voiceId.trim(),
      voiceName: voiceName.trim(),
      imoId: imo.id,
    });
  };

  const startEdit = () => {
    setEditing(true);
    setVoiceId(config?.default_voice_id || "");
    setVoiceName(config?.default_voice_name || "");
    setApiKey("");
  };

  if (isLoading) {
    return (
      <div className="p-2.5 bg-v2-card rounded-md border border-v2-ring">
        <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  return (
    <div className="p-2.5 bg-v2-card rounded-md border border-v2-ring space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-info/20 dark:bg-info/15 text-info">
            <Volume2 className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-v2-ink">
                ElevenLabs TTS
              </span>
              {config ? (
                <Badge
                  variant={config.is_active ? "default" : "secondary"}
                  className="text-[9px] h-4 px-1.5"
                >
                  {config.is_active ? "Active" : "Disabled"}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                  Not configured
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-v2-ink-muted">
              Text-to-speech for script practice prompts
            </p>
          </div>
        </div>

        {config && !editing && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={handleTest}
              disabled={testing || !config.is_active}
            >
              {testing ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Play className="h-3 w-3 mr-1" />
              )}
              Test
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={startEdit}
            >
              Edit
            </Button>
          </div>
        )}
      </div>

      {/* Config display (when not editing) */}
      {config && !editing && (
        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-3">
            {config.default_voice_name && (
              <span className="text-v2-ink-muted">
                Voice:{" "}
                <span className="text-v2-ink-muted">
                  {config.default_voice_name}
                </span>
              </span>
            )}
            <span className="text-v2-ink-muted">
              API Key: <span className="text-v2-ink-muted">••••••••</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Label
              htmlFor="elevenlabs-active"
              className="text-[10px] text-v2-ink-muted"
            >
              {config.is_active ? "Enabled" : "Disabled"}
            </Label>
            <Switch
              id="elevenlabs-active"
              checked={config.is_active}
              onCheckedChange={(checked) => toggleMutation.mutate(checked)}
              disabled={toggleMutation.isPending}
            />
          </div>
        </div>
      )}

      {/* Edit / setup form */}
      {(editing || !config) && (
        <div className="space-y-2 pt-1">
          <div className="space-y-1">
            <label className="text-[10px] text-v2-ink-muted">
              API Key <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={config ? "Enter new key to update" : "sk_..."}
                className="h-7 text-xs pr-8"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-v2-ink-subtle hover:text-v2-ink-muted"
              >
                {showKey ? (
                  <EyeOff className="h-3 w-3" />
                ) : (
                  <Eye className="h-3 w-3" />
                )}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-v2-ink-muted">Voice ID</label>
              <Input
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                placeholder="e.g., 21m00Tcm4TlvDq8ikWAM"
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-v2-ink-muted">
                Voice Name
              </label>
              <Input
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                placeholder="e.g., Rachel"
                className="h-7 text-xs"
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              className="h-7 text-[11px]"
              onClick={handleSave}
              disabled={!apiKey.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <CheckCircle2 className="h-3 w-3 mr-1" />
              )}
              Save
            </Button>
            {editing && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px]"
                onClick={() => setEditing(false)}
              >
                <XCircle className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
