import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  useAssistantPreferences,
  useUpdateAssistantPreferences,
} from "../hooks/useAssistantPreferences";

export function AssistantSettingsSheet() {
  const { data: prefs } = useAssistantPreferences();
  const update = useUpdateAssistantPreferences();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [realtimeVoice, setRealtimeVoice] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    if (prefs && open) {
      setName(prefs.assistant_name);
      setVoiceEnabled(prefs.voice_enabled);
      setRealtimeVoice(prefs.voice_engine === "realtime");
      setSoundEnabled(prefs.sound_enabled);
    }
  }, [prefs, open]);

  const save = async () => {
    try {
      await update.mutateAsync({
        assistant_name: name.trim() || "Jarvis",
        voice_enabled: voiceEnabled,
        voice_engine: realtimeVoice ? "realtime" : "legacy",
        sound_enabled: soundEnabled,
      });
      toast.success("Preferences saved.");
      setOpen(false);
    } catch {
      toast.error("Couldn't save preferences.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label="Assistant settings"
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Assistant settings</SheetTitle>
          <SheetDescription>Personalize your command center.</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 py-5">
          <div className="space-y-1.5">
            <Label htmlFor="assistant-name">Assistant name</Label>
            <Input
              id="assistant-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jarvis"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div className="pr-3">
              <div className="text-sm font-medium">Voice</div>
              <div className="text-xs text-muted-foreground">
                Talk hands-free and hear replies. Click the mic to start a
                session; your speech is transcribed and spoken back. Needs
                microphone access (Chrome or Safari).
              </div>
            </div>
            <Switch
              checked={voiceEnabled}
              onCheckedChange={setVoiceEnabled}
              aria-label="Enable voice"
            />
          </div>
          <div
            className={`ml-4 flex items-center justify-between rounded-md border border-border p-3 transition-opacity ${
              voiceEnabled ? "" : "pointer-events-none opacity-50"
            }`}
          >
            <div className="pr-3">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                Realtime voice
                <span className="rounded bg-primary/15 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Beta
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Streams audio over a live connection for natural, low-latency
                conversation with barge-in — you can interrupt mid-reply. Off
                uses the classic record-then-transcribe mode.
              </div>
            </div>
            <Switch
              checked={realtimeVoice}
              onCheckedChange={setRealtimeVoice}
              disabled={!voiceEnabled}
              aria-label="Enable realtime voice"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div className="pr-3">
              <div className="text-sm font-medium">Sound</div>
              <div className="text-xs text-muted-foreground">
                Subtle interface cues — a soft tone on send, on each tool the
                assistant runs, and when a reply lands.
              </div>
            </div>
            <Switch
              checked={soundEnabled}
              onCheckedChange={setSoundEnabled}
              aria-label="Enable sound"
            />
          </div>
        </div>
        <SheetFooter>
          <Button onClick={save} disabled={update.isPending}>
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
