// src/features/contracting/components/hub/RequestDifferentUplineDialog.tsx
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";
import {
  useHubCarriers,
  useEligibleSponsors,
  useCreateSponsorship,
} from "../../hooks/useContractingHub";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCarrierId?: string | null;
}

export function RequestDifferentUplineDialog({
  open,
  onOpenChange,
  defaultCarrierId,
}: Props) {
  const [carrierId, setCarrierId] = useState<string | null>(null);
  const [sponsorId, setSponsorId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const carriers = useHubCarriers();
  const sponsors = useEligibleSponsors(carrierId);
  const createMut = useCreateSponsorship();

  useEffect(() => {
    if (open) {
      setCarrierId(defaultCarrierId ?? null);
      setSponsorId(null);
      setReason("");
    }
  }, [open, defaultCarrierId]);

  const sponsorName =
    sponsors.data?.find((s) => s.agentId === sponsorId)?.agentName ?? "—";

  const canSubmit = !!carrierId && !!sponsorId && reason.trim().length > 0;

  const submit = () => {
    if (!carrierId || !sponsorId) return;
    createMut.mutate(
      { carrierId, alternateSponsorId: sponsorId, reason: reason.trim() },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request alternate sponsorship</DialogTitle>
          <DialogDescription>
            Contract with a carrier under a different upline when your normal
            upline is blocked. Requires approval from the alternate sponsor and
            their upline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Carrier</Label>
            <Select
              value={carrierId ?? undefined}
              onValueChange={(v) => {
                setCarrierId(v);
                setSponsorId(null);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select a carrier" />
              </SelectTrigger>
              <SelectContent>
                {(carriers.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">
              Alternate sponsor (approved for this carrier &amp; outranks you)
            </Label>
            <Select
              value={sponsorId ?? undefined}
              onValueChange={setSponsorId}
              disabled={!carrierId || sponsors.isLoading}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue
                  placeholder={
                    !carrierId
                      ? "Select a carrier first"
                      : sponsors.isLoading
                        ? "Loading…"
                        : (sponsors.data?.length ?? 0) === 0
                          ? "No eligible sponsors found"
                          : "Select a sponsor"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(sponsors.data ?? []).map((s) => (
                  <SelectItem key={s.agentId} value={s.agentId}>
                    {s.agentName}
                    {s.contractLevel != null ? ` · L${s.contractLevel}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Reason</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. normal upline not appointed / no business in 6 months / carrier denied them"
              className="text-xs"
              rows={2}
            />
          </div>

          {sponsorId && (
            <div className="rounded-md border border-dashed p-2.5 text-xs space-y-1 bg-muted/30">
              <div className="font-medium text-[11px] uppercase tracking-wide text-muted-foreground">
                Approval chain
              </div>
              <div>
                <span className="font-semibold">Step 1</span> → {sponsorName}{" "}
                (alternate sponsor)
              </div>
              <div>
                <span className="font-semibold">Step 2</span> → their upline
                (notified after step 1)
              </div>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-md border border-amber-300/40 bg-amber-50/50 dark:bg-amber-950/20 p-2.5 text-[11px] text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Once approved, the override on this carrier&apos;s business will
              roll up your alternate sponsor&apos;s leg for business written
              after approval.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={createMut.isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={submit}
            disabled={!canSubmit || createMut.isPending}
          >
            {createMut.isPending ? "Submitting…" : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
