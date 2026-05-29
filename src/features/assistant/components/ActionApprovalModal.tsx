import { useEffect, useState } from "react";
import {
  Loader2,
  Mail,
  MessageSquare,
  ShieldCheck,
  StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useApproveActionRequest,
  useCancelActionRequest,
} from "../hooks/useAssistantActions";
import type { ActionRequest } from "../types/assistant.types";

interface Props {
  action: ActionRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApproved?: () => void;
}

export function ActionApprovalModal({
  action,
  open,
  onOpenChange,
  onApproved,
}: Props) {
  const approve = useApproveActionRequest();
  const cancel = useCancelActionRequest();
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (action) {
      setRecipient(action.recipient ?? "");
      setSubject(action.draft_payload?.subject ?? "");
      setBody(action.draft_payload?.body ?? "");
    }
  }, [action]);

  if (!action) return null;
  const isEmail = action.channel === "email";
  const isClose =
    action.channel === "close_note" || action.channel === "close_task";
  const isNote = action.channel === "close_note";
  const leadName = action.draft_payload?.leadName?.trim() || "this lead";
  const busy = approve.isPending || cancel.isPending;

  // Close write actions (note/task): no recipient — they act on the lead in the
  // user's own Close account. Preserve the frozen leadId; only the text is editable.
  const handleApproveClose = async () => {
    if (!body.trim()) {
      toast.error(`The ${isNote ? "note" : "task"} is empty.`);
      return;
    }
    try {
      const res = await approve.mutateAsync({
        id: action.id,
        payload: {
          leadId: action.draft_payload?.leadId,
          leadName: action.draft_payload?.leadName,
          body,
          ...(action.draft_payload?.dueDate
            ? { dueDate: action.draft_payload.dueDate }
            : {}),
        },
      });
      if (res.ok || res.status === "executed") {
        toast.success(
          isNote ? "Note added to Close." : "Task created in Close.",
        );
        onApproved?.();
        onOpenChange(false);
      } else {
        toast.error(res.error ?? "Close rejected the write.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The write failed.");
    }
  };

  const handleApprove = async () => {
    if (isClose) return handleApproveClose();
    if (!recipient.trim()) {
      toast.error("Add a recipient before sending.");
      return;
    }
    if (isEmail && !subject.trim()) {
      toast.error("Add a subject.");
      return;
    }
    if (!body.trim()) {
      toast.error("The message body is empty.");
      return;
    }
    try {
      const res = await approve.mutateAsync({
        id: action.id,
        recipient: recipient.trim(),
        payload: isEmail ? { subject: subject.trim(), body } : { body },
      });
      if (res.ok || res.status === "executed") {
        toast.success(`${isEmail ? "Email" : "SMS"} sent.`);
        onApproved?.();
        onOpenChange(false);
      } else {
        toast.error(res.error ?? "The send failed.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The send failed.");
    }
  };

  const handleCancel = async () => {
    try {
      await cancel.mutateAsync(action.id);
      toast.message("Draft discarded.");
      onOpenChange(false);
    } catch {
      toast.error("Couldn't discard the draft.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isClose ? (
              <StickyNote className="h-4 w-4" />
            ) : isEmail ? (
              <Mail className="h-4 w-4" />
            ) : (
              <MessageSquare className="h-4 w-4" />
            )}
            {isClose
              ? `Review ${isNote ? "note" : "task"} before adding to Close`
              : `Review ${isEmail ? "email" : "SMS"} before sending`}
          </DialogTitle>
          <DialogDescription>
            {isClose
              ? "Nothing is written to Close until you approve. Edit the text below."
              : "Nothing is sent until you approve. Edit anything below."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {isClose ? (
            <div className="space-y-1.5">
              <Label>Lead</Label>
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                {leadName}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="ar-recipient">
                {isEmail ? "To (email)" : "To (phone)"}
              </Label>
              <Input
                id="ar-recipient"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={isEmail ? "name@example.com" : "+13035551234"}
              />
            </div>
          )}
          {isEmail && (
            <div className="space-y-1.5">
              <Label htmlFor="ar-subject">Subject</Label>
              <Input
                id="ar-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          )}
          {isClose && !isNote && action.draft_payload?.dueDate && (
            <div className="space-y-1.5">
              <Label>Due</Label>
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                {action.draft_payload.dueDate}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ar-body">
              {isClose ? (isNote ? "Note" : "Task") : "Message"}
            </Label>
            <Textarea
              id="ar-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={isEmail ? 8 : isClose ? 6 : 4}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={handleCancel} disabled={busy}>
            Discard
          </Button>
          <Button onClick={handleApprove} disabled={busy}>
            {approve.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            {isClose ? "Approve & add to Close" : "Approve & send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
