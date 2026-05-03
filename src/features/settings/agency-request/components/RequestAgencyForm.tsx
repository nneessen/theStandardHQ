// src/features/settings/agency-request/components/RequestAgencyForm.tsx
// Form for agents to request agency status - compact zinc styling

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Info, Loader2, Send, XCircle } from "lucide-react";
import {
  useCreateAgencyRequest,
  useIsAgencyCodeAvailable,
} from "@/hooks/agency-request";

export function RequestAgencyForm() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");

  const createRequest = useCreateAgencyRequest();

  // Debounced code availability check
  const [debouncedCode, setDebouncedCode] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCode(code.toUpperCase().trim());
    }, 500);
    return () => clearTimeout(timer);
  }, [code]);

  const { data: isCodeAvailable, isLoading: isCheckingCode } =
    useIsAgencyCodeAvailable(debouncedCode, debouncedCode.length >= 2);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !code.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!isCodeAvailable) {
      toast.error("Please choose a different agency code");
      return;
    }

    try {
      await createRequest.mutateAsync({
        proposed_name: name.trim(),
        proposed_code: code.toUpperCase().trim(),
        proposed_description: description.trim() || undefined,
      });
      toast.success("Agency request submitted successfully");
      // Reset form
      setName("");
      setCode("");
      setDescription("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to submit request";
      toast.error(message);
    }
  };

  const isSubmitting = createRequest.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Agency Name */}
      <div className="space-y-1.5">
        <Label htmlFor="agency-name" className="text-[11px] text-v2-ink-muted">
          Agency Name *
        </Label>
        <Input
          id="agency-name"
          placeholder="e.g., Johnson Insurance Group"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isSubmitting}
          maxLength={100}
          className="h-7 text-[11px] bg-v2-card border-v2-ring"
        />
      </div>

      {/* Agency Code */}
      <div className="space-y-1.5">
        <Label htmlFor="agency-code" className="text-[11px] text-v2-ink-muted">
          Agency Code *
        </Label>
        <div className="relative">
          <Input
            id="agency-code"
            placeholder="e.g., JIG"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            disabled={isSubmitting}
            maxLength={20}
            className="h-7 text-[11px] uppercase pr-8 bg-v2-card border-v2-ring"
          />
          {debouncedCode.length >= 2 && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              {isCheckingCode ? (
                <Loader2 className="h-3 w-3 animate-spin text-v2-ink-subtle" />
              ) : isCodeAvailable ? (
                <CheckCircle className="h-3 w-3 text-success" />
              ) : (
                <XCircle className="h-3 w-3 text-destructive" />
              )}
            </div>
          )}
        </div>
        {debouncedCode.length >= 2 && !isCheckingCode && (
          <p
            className={`text-[10px] ${isCodeAvailable ? "text-success" : "text-destructive"}`}
          >
            {isCodeAvailable ? "Code is available" : "Code is already in use"}
          </p>
        )}
        <p className="text-[10px] text-v2-ink-subtle">
          Unique code to identify your agency (2-20 characters)
        </p>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label
          htmlFor="agency-description"
          className="text-[11px] text-v2-ink-muted"
        >
          Description (Optional)
        </Label>
        <Textarea
          id="agency-description"
          placeholder="Brief description of your agency..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isSubmitting}
          rows={2}
          maxLength={500}
          className="text-[11px] resize-none bg-v2-card border-v2-ring"
        />
      </div>

      {/* Info notice */}
      <div className="flex items-start gap-2 p-2 bg-v2-canvas rounded text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
        <Info className="h-3 w-3 mt-0.5 shrink-0 text-v2-ink-subtle" />
        <p>
          Your request will be sent to your direct upline for approval. Once
          approved, your agency will be created and your downline agents will be
          moved to your new agency.
        </p>
      </div>

      {/* Submit */}
      <Button
        type="submit"
        disabled={
          isSubmitting || !name.trim() || !code.trim() || !isCodeAvailable
        }
        size="sm"
        className="w-full h-7 text-[10px]"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="h-3 w-3 mr-1" />
            Submit Request
          </>
        )}
      </Button>
    </form>
  );
}
