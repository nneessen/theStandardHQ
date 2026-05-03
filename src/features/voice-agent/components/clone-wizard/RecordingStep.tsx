import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  useVoiceCloneScripts,
  useVoiceCloneSession,
  type VoiceCloneSessionSegment,
} from "@/features/chat-bot";
import { ScriptSidebar } from "./ScriptSidebar";
import { SegmentRecorder } from "./SegmentRecorder";

interface RecordingStepProps {
  cloneId: string;
  onReadyToSubmit: () => void;
}

export function RecordingStep({
  cloneId,
  onReadyToSubmit,
}: RecordingStepProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const { data: scriptsData, isLoading: scriptsLoading } =
    useVoiceCloneScripts();
  const {
    data: session,
    isLoading: sessionLoading,
    refetch: refetchSession,
  } = useVoiceCloneSession(cloneId);

  const scripts = scriptsData?.scripts ?? [];

  // Build lookup: segmentIndex → segment data
  const segmentMap = useMemo(() => {
    const map = new Map<number, VoiceCloneSessionSegment>();
    if (session?.segments) {
      for (const seg of session.segments) {
        map.set(seg.index, seg);
      }
    }
    return map;
  }, [session?.segments]);

  const completedIndices = useMemo(
    () => new Set(segmentMap.keys()),
    [segmentMap],
  );

  const activeScript = scripts.find((s) => s.segmentIndex === activeIndex);

  // Auto-advance to next unrecorded script after upload
  const handleSegmentUploaded = useCallback(() => {
    void refetchSession();
    // Find next unrecorded script
    const currentIdx = scripts.findIndex((s) => s.segmentIndex === activeIndex);
    for (let i = 1; i < scripts.length; i++) {
      const next = scripts[(currentIdx + i) % scripts.length];
      if (!completedIndices.has(next.segmentIndex)) {
        setActiveIndex(next.segmentIndex);
        return;
      }
    }
    // All done — stay on current
  }, [refetchSession, scripts, activeIndex, completedIndices]);

  if (scriptsLoading || sessionLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  if (!scripts.length) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[12px] text-v2-ink-muted">
          No recording scripts available.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <ScriptSidebar
        scripts={scripts}
        completedIndices={completedIndices}
        activeIndex={activeIndex}
        onSelectScript={setActiveIndex}
        completedSegments={session?.completedSegments ?? 0}
        totalSegments={
          session?.totalSegments ?? scriptsData?.totalSegments ?? 25
        }
        totalAudioMinutes={session?.totalAudioMinutes ?? 0}
        minimumAudioMinutes={
          session?.minimumAudioMinutes ?? scriptsData?.minimumAudioMinutes ?? 60
        }
      />

      <div className="flex flex-1 flex-col">
        {activeScript ? (
          <SegmentRecorder
            key={activeScript.segmentIndex}
            script={activeScript}
            existingSegment={segmentMap.get(activeScript.segmentIndex) ?? null}
            cloneId={cloneId}
            onSegmentUploaded={handleSegmentUploaded}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-[12px] text-v2-ink-muted">
              Select a script from the sidebar.
            </p>
          </div>
        )}

        {/* Submit bar */}
        {session && (
          <div className="border-t border-v2-ring bg-white px-4 py-2.5 dark:border-v2-ring dark:bg-v2-card">
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
                {session.canSubmit ? (
                  <span className="text-success font-medium">
                    Ready to submit
                  </span>
                ) : (
                  (session.submitBlockReason ??
                  "Keep recording to meet minimums")
                )}
              </div>
              <Button
                size="sm"
                className="h-7 text-[11px] px-4"
                onClick={onReadyToSubmit}
                disabled={!session.canSubmit}
              >
                Submit for Processing
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
