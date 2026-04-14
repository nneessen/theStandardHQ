// src/features/training-modules/components/presentations/PresentationRecordPage.tsx
import { useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Video, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useImo } from "@/contexts/ImoContext";
import { useSubmitPresentation } from "../../hooks/usePresentationSubmissions";
import { PresentationRecorder } from "./PresentationRecorder";
import { PresentationUploader } from "./PresentationUploader";
import { getCurrentWeekStart } from "./PresentationWeekPicker";
import { toast } from "sonner";

type Mode = "choose" | "record" | "upload";

export default function PresentationRecordPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { imo, agency } = useImo();
  const submitMutation = useSubmitPresentation();

  const [mode, setMode] = useState<Mode>("choose");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // File from uploader or recorder
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedMimeType, setRecordedMimeType] = useState("");
  const [recordedDuration, setRecordedDuration] = useState(0);

  const hasContent = !!(selectedFile || recordedBlob);
  const canSubmit =
    hasContent && title.trim().length > 0 && !submitMutation.isPending;

  const handleRecordingComplete = useCallback(
    (blob: Blob, mimeType: string, durationSeconds: number) => {
      setRecordedBlob(blob);
      setRecordedMimeType(mimeType);
      setRecordedDuration(durationSeconds);
    },
    [],
  );

  const handleSubmit = async () => {
    if (!user?.id || !imo || !agency) return;

    const weekStart = getCurrentWeekStart();
    const isRecording = mode === "record" && recordedBlob;
    const fileOrBlob = isRecording ? recordedBlob! : selectedFile!;
    const fileName = isRecording
      ? `recording_${Date.now()}.webm`
      : selectedFile!.name;
    const mimeType = isRecording ? recordedMimeType : selectedFile!.type;

    submitMutation.mutate(
      {
        file: fileOrBlob,
        fileName,
        title: title.trim(),
        description: description.trim() || undefined,
        weekStart,
        userId: user.id,
        imoId: imo.id,
        agencyId: agency.id,
        mimeType,
        recordingType: isRecording ? "browser_recording" : "upload",
        durationSeconds: isRecording ? recordedDuration : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Presentation submitted!");
          navigate({ to: "/my-training" });
        },
        onError: (err) => {
          toast.error(`Failed to submit: ${err.message}`);
        },
      },
    );
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 rounded-lg px-3 py-2 border border-zinc-200 dark:border-zinc-800">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => navigate({ to: "/my-training" })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          New Presentation Submission
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Mode selection */}
          {mode === "choose" && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode("record")}
                className="p-4 rounded-lg border-2 border-zinc-200 dark:border-zinc-700 hover:border-blue-400 dark:hover:border-blue-600 transition-colors text-center space-y-2"
              >
                <Video className="h-6 w-6 mx-auto text-blue-500" />
                <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  Record
                </p>
                <p className="text-[10px] text-zinc-500">
                  Use your webcam to record a presentation
                </p>
              </button>
              <button
                onClick={() => setMode("upload")}
                className="p-4 rounded-lg border-2 border-zinc-200 dark:border-zinc-700 hover:border-blue-400 dark:hover:border-blue-600 transition-colors text-center space-y-2"
              >
                <Upload className="h-6 w-6 mx-auto text-emerald-500" />
                <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  Upload
                </p>
                <p className="text-[10px] text-zinc-500">
                  Upload an audio or video file
                </p>
              </button>
            </div>
          )}

          {/* Record mode */}
          {mode === "record" && (
            <div className="space-y-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] text-zinc-500"
                onClick={() => {
                  setMode("choose");
                  setRecordedBlob(null);
                }}
              >
                &larr; Back to options
              </Button>
              <PresentationRecorder
                onRecordingComplete={handleRecordingComplete}
              />
            </div>
          )}

          {/* Upload mode */}
          {mode === "upload" && (
            <div className="space-y-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] text-zinc-500"
                onClick={() => {
                  setMode("choose");
                  setSelectedFile(null);
                }}
              >
                &larr; Back to options
              </Button>
              <PresentationUploader
                onFileSelected={setSelectedFile}
                selectedFile={selectedFile}
                onClear={() => setSelectedFile(null)}
              />
            </div>
          )}

          {/* Title and description form (show after content is ready) */}
          {hasContent && (
            <div className="space-y-3 bg-white dark:bg-zinc-900 rounded-lg p-3 border border-zinc-200 dark:border-zinc-800">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                  Title <span className="text-red-500">*</span>
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Weekly IUL Presentation"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Optional notes about this presentation..."
                  className="w-full text-xs rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 resize-none"
                />
              </div>
              <Button
                size="sm"
                className="h-8 text-xs w-full"
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    Uploading...
                  </>
                ) : (
                  "Submit Presentation"
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
