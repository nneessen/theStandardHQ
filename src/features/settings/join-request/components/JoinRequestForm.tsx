import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Send, Building2, Users } from "lucide-react";
import {
  useAvailableImos,
  useAgenciesForImo,
  useCreateJoinRequest,
} from "@/hooks/join-request";

interface JoinRequestFormProps {
  onSuccess?: () => void;
}

export function JoinRequestForm({ onSuccess }: JoinRequestFormProps) {
  const [selectedImoId, setSelectedImoId] = useState<string>("");
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>("");
  const [message, setMessage] = useState("");

  const { data: imos, isLoading: imosLoading } = useAvailableImos();
  const { data: agencies, isLoading: agenciesLoading } = useAgenciesForImo(
    selectedImoId || null,
  );
  const createRequest = useCreateJoinRequest();

  const handleImoChange = (value: string) => {
    setSelectedImoId(value);
    setSelectedAgencyId("__none__"); // Reset agency when IMO changes
  };

  const handleAgencyChange = (value: string) => {
    setSelectedAgencyId(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedImoId) {
      toast.error("Please select an IMO");
      return;
    }

    try {
      await createRequest.mutateAsync({
        imo_id: selectedImoId,
        agency_id:
          selectedAgencyId === "__none__" ? null : selectedAgencyId || null,
        message: message.trim() || null,
      });

      toast.success("Join request submitted successfully");
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit request",
      );
    }
  };

  const selectedImo = imos?.find((i) => i.id === selectedImoId);

  return (
    <div className="border border-v2-ring rounded-lg p-3">
      <div className="flex items-center gap-2 mb-3">
        <Send className="h-3.5 w-3.5 text-v2-ink-subtle" />
        <div>
          <h4 className="text-[11px] font-semibold text-v2-ink">
            Request to Join
          </h4>
          <p className="text-[10px] text-v2-ink-muted">
            Select an organization to join
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* IMO Selection */}
        <div className="space-y-1.5">
          <Label htmlFor="imo" className="text-[11px] text-v2-ink-muted">
            <Building2 className="h-3 w-3 inline mr-1" />
            Select IMO *
          </Label>
          <Select value={selectedImoId} onValueChange={handleImoChange}>
            <SelectTrigger id="imo" className="h-7 text-[11px]">
              <SelectValue
                placeholder={imosLoading ? "Loading..." : "Select an IMO"}
              />
            </SelectTrigger>
            <SelectContent>
              {imos?.map((imo) => (
                <SelectItem key={imo.id} value={imo.id} className="text-[11px]">
                  <span className="font-medium">{imo.name}</span>
                  <span className="text-v2-ink-muted ml-2">({imo.code})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedImo?.description && (
            <p className="text-[10px] text-v2-ink-muted mt-1">
              {selectedImo.description}
            </p>
          )}
        </div>

        {/* Agency Selection (Optional) */}
        {selectedImoId && (
          <div className="space-y-1.5">
            <Label htmlFor="agency" className="text-[11px] text-v2-ink-muted">
              <Users className="h-3 w-3 inline mr-1" />
              Select Agency (Optional)
            </Label>
            <Select value={selectedAgencyId} onValueChange={handleAgencyChange}>
              <SelectTrigger id="agency" className="h-7 text-[11px]">
                <SelectValue
                  placeholder={
                    agenciesLoading
                      ? "Loading..."
                      : agencies?.length
                        ? "Select an agency"
                        : "No agencies available"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  value="__none__"
                  className="text-[11px] text-v2-ink-muted"
                >
                  No specific agency
                </SelectItem>
                {agencies?.map((agency) => (
                  <SelectItem
                    key={agency.id}
                    value={agency.id}
                    className="text-[11px]"
                  >
                    <span className="font-medium">{agency.name}</span>
                    <span className="text-v2-ink-muted ml-2">
                      ({agency.code})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Message */}
        <div className="space-y-1.5">
          <Label htmlFor="message" className="text-[11px] text-v2-ink-muted">
            Message (Optional)
          </Label>
          <Textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell them a bit about yourself..."
            className="text-[11px] resize-none"
            rows={3}
          />
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={!selectedImoId || createRequest.isPending}
          size="sm"
          className="w-full h-7 text-[10px]"
        >
          {createRequest.isPending ? (
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
    </div>
  );
}
