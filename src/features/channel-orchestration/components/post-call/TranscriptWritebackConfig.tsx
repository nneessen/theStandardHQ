// src/features/channel-orchestration/components/post-call/TranscriptWritebackConfig.tsx
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { TranscriptFormat } from "../../types/orchestration.types";

interface TranscriptConfig {
  enabled: boolean;
  autoWriteback: boolean;
  format: TranscriptFormat;
  includeRecordingLink: boolean;
}

interface Props {
  config: TranscriptConfig;
  onChange: (config: TranscriptConfig) => void;
}

const FORMATS: { value: TranscriptFormat; label: string; desc: string }[] = [
  {
    value: "full_transcript",
    label: "Full Transcript",
    desc: "Complete word-for-word conversation",
  },
  {
    value: "summary_only",
    label: "Summary Only",
    desc: "AI-generated summary of key points",
  },
  {
    value: "summary_with_highlights",
    label: "Summary + Highlights",
    desc: "Summary with notable excerpts",
  },
];

export function TranscriptWritebackConfig({ config, onChange }: Props) {
  const update = (patch: Partial<TranscriptConfig>) =>
    onChange({ ...config, ...patch });

  return (
    <div className="space-y-2">
      {/* Auto Writeback */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-[10px] font-medium">Auto Writeback</Label>
          <p className="text-[9px] text-v2-ink-muted">
            Automatically write transcript to Close after call ends
          </p>
        </div>
        <Switch
          checked={config.autoWriteback}
          onCheckedChange={(autoWriteback) => update({ autoWriteback })}
          className="h-4 w-7"
        />
      </div>

      {/* Format */}
      <div>
        <Label className="text-[10px] font-medium mb-1 block">Format</Label>
        <div className="space-y-0.5">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => update({ format: f.value })}
              className={cn(
                "w-full text-left px-2 py-1 rounded border text-[10px] transition-colors",
                config.format === f.value
                  ? "border-info/40 bg-info/10"
                  : "border-v2-ring dark:border-v2-ring-strong hover:border-v2-ring-strong",
              )}
            >
              <span className="font-medium">{f.label}</span>
              <span className="text-v2-ink-muted ml-1">— {f.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recording Link */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-[10px] font-medium">
            Include Recording Link
          </Label>
          <p className="text-[9px] text-v2-ink-muted">
            Add a link to the call recording in the Close note
          </p>
        </div>
        <Switch
          checked={config.includeRecordingLink}
          onCheckedChange={(includeRecordingLink) =>
            update({ includeRecordingLink })
          }
          className="h-4 w-7"
        />
      </div>
    </div>
  );
}
