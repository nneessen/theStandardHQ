// src/features/recruiting/components/AddProspectDialog.tsx
// Add / edit a Prospect — a lightweight follow-up contact. No auth account,
// no email is sent (unlike Add Recruit). Mirrors the BasicAddRecruitDialog form.

import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { US_STATES } from "@/constants/states";
import {
  useCreateProspect,
  useUpdateProspect,
} from "../hooks/useProspectMutations";
import {
  PROSPECT_STATUSES,
  PROSPECT_STATUS_LABELS,
  type Prospect,
  type ProspectStatus,
} from "@/types/prospect.types";

interface AddProspectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When present the dialog edits this prospect instead of creating one. */
  prospect?: Prospect | null;
}

const EMPTY = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  state: "",
  source: "",
  status: "new" as ProspectStatus,
  notes: "",
  next_follow_up_at: "",
  last_contacted_at: "",
};

// timestamptz <-> <input type="date"> ("YYYY-MM-DD")
function toDateInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}
function fromDateInput(value: string): string | null {
  if (!value) return null;
  // Anchor at local noon to avoid a timezone day-shift when stored as UTC.
  return new Date(`${value}T12:00:00`).toISOString();
}

export function AddProspectDialog({
  open,
  onOpenChange,
  prospect,
}: AddProspectDialogProps) {
  const isEdit = !!prospect;
  const createProspect = useCreateProspect();
  const updateProspect = useUpdateProspect();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Seed the form whenever the dialog opens (or the target prospect changes).
  useEffect(() => {
    if (!open) return;
    if (prospect) {
      setForm({
        first_name: prospect.first_name ?? "",
        last_name: prospect.last_name ?? "",
        email: prospect.email ?? "",
        phone: prospect.phone ?? "",
        state: prospect.state ?? "",
        source: prospect.source ?? "",
        status: (prospect.status as ProspectStatus) ?? "new",
        notes: prospect.notes ?? "",
        next_follow_up_at: toDateInput(prospect.next_follow_up_at),
        last_contacted_at: toDateInput(prospect.last_contacted_at),
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
  }, [open, prospect]);

  const set = (key: keyof typeof EMPTY, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!form.first_name.trim())
      newErrors.first_name = "First name is required";
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      newErrors.email = "Invalid email format";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      state: form.state || null,
      source: form.source.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null,
      next_follow_up_at: fromDateInput(form.next_follow_up_at),
      last_contacted_at: fromDateInput(form.last_contacted_at),
    };

    try {
      if (isEdit && prospect) {
        await updateProspect.mutateAsync({ id: prospect.id, patch: payload });
      } else {
        await createProspect.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch {
      // toast handled by the mutation onError
    }
  };

  const saving = createProspect.isPending || updateProspect.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {isEdit ? "Edit prospect" : "Add prospect"}
          </DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground">
            A prospect is someone you&apos;re keeping in touch with. No account
            is created and no email is sent.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="p_first" className="text-[11px]">
                First name *
              </Label>
              <Input
                id="p_first"
                value={form.first_name}
                onChange={(e) => set("first_name", e.target.value)}
                className="h-8 text-[11px]"
                placeholder="John"
              />
              {errors.first_name && (
                <p className="text-[10px] text-destructive">
                  {errors.first_name}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="p_last" className="text-[11px]">
                Last name
              </Label>
              <Input
                id="p_last"
                value={form.last_name}
                onChange={(e) => set("last_name", e.target.value)}
                className="h-8 text-[11px]"
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="p_email" className="text-[11px]">
                Email
              </Label>
              <Input
                id="p_email"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className="h-8 text-[11px]"
                placeholder="john@example.com"
              />
              {errors.email && (
                <p className="text-[10px] text-destructive">{errors.email}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="p_phone" className="text-[11px]">
                Phone
              </Label>
              <Input
                id="p_phone"
                type="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                className="h-8 text-[11px]"
                placeholder="(555) 555-5555"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="p_state" className="text-[11px]">
                State
              </Label>
              <Select value={form.state} onValueChange={(v) => set("state", v)}>
                <SelectTrigger id="p_state" className="h-8 text-[11px]">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="p_source" className="text-[11px]">
                Source
              </Label>
              <Input
                id="p_source"
                value={form.source}
                onChange={(e) => set("source", e.target.value)}
                className="h-8 text-[11px]"
                placeholder="Referral, event…"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="p_status" className="text-[11px]">
                Status
              </Label>
              <Select
                value={form.status}
                onValueChange={(v) => set("status", v as ProspectStatus)}
              >
                <SelectTrigger id="p_status" className="h-8 text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROSPECT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {PROSPECT_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="p_followup" className="text-[11px]">
                Next follow-up
              </Label>
              <Input
                id="p_followup"
                type="date"
                value={form.next_follow_up_at}
                onChange={(e) => set("next_follow_up_at", e.target.value)}
                className="h-8 text-[11px]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="p_notes" className="text-[11px]">
              Notes
            </Label>
            <Textarea
              id="p_notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              className="text-[11px] min-h-16"
              placeholder="What did you talk about? What's the follow-up?"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-7 text-[11px]"
              disabled={saving}
            >
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add prospect"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
