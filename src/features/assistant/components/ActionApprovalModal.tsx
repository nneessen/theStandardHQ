import { useEffect, useState } from "react";
import { Loader2, Mail, MessageSquare, ShieldCheck } from "lucide-react";
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
  const busy = approve.isPending || cancel.isPending;

  const handleApprove = async () => {
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
            {isEmail ? (
              <Mail className="h-4 w-4" />
            ) : (
              <MessageSquare className="h-4 w-4" />
            )}
            Review {isEmail ? "email" : "SMS"} before sending
          </DialogTitle>
          <DialogDescription>
            Nothing is sent until you approve. Edit anything below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
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
          <div className="space-y-1.5">
            <Label htmlFor="ar-body">Message</Label>
            <Textarea
              id="ar-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={isEmail ? 8 : 4}
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
            Approve &amp; send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
