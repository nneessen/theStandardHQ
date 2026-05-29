import { useEffect, useState } from "react";
import { Inbox, Mail, MessageSquare, StickyNote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePendingActionRequests } from "../hooks/useAssistantActions";
import type { ActionRequest } from "../types/assistant.types";
import { ActionApprovalModal } from "./ActionApprovalModal";

interface Props {
  /** When set, auto-open the matching action once it appears in the list. */
  focusActionId?: string | null;
  /** Fires after a draft is successfully approved and sent (for a sound cue). */
  onApproved?: () => void;
}

export function PendingActionsPanel({ focusActionId, onApproved }: Props) {
  const { data: actions = [] } = usePendingActionRequests();
  const [selected, setSelected] = useState<ActionRequest | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!focusActionId) return;
    const match = actions.find((a) => a.id === focusActionId);
    if (match) {
      setSelected(match);
      setOpen(true);
    }
  }, [focusActionId, actions]);

  if (actions.length === 0) return null;

  const previewOf = (a: ActionRequest) =>
    a.draft_payload?.subject || a.draft_payload?.body || "(draft)";

  const isCloseChannel = (a: ActionRequest) =>
    a.channel === "close_note" || a.channel === "close_task";

  // Human-readable channel label + the "to <who>" target line.
  const labelOf = (a: ActionRequest) => {
    if (a.channel === "close_note") return "Close note";
    if (a.channel === "close_task") return "Close task";
    if (a.channel === "email") return "Email";
    if (a.channel === "sms") return "SMS";
    return a.channel;
  };
  const targetOf = (a: ActionRequest) =>
    isCloseChannel(a)
      ? a.draft_payload?.leadName
        ? ` to ${a.draft_payload.leadName}`
        : ""
      : a.recipient
        ? ` to ${a.recipient}`
        : "";

  return (
    <Card className="border-amber-500/30 bg-amber-500/[0.03]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Inbox className="h-4 w-4" />
          Pending approvals
          <Badge variant="secondary">{actions.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => {
              setSelected(a);
              setOpen(true);
            }}
            className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-left text-sm transition hover:bg-muted/60"
          >
            {isCloseChannel(a) ? (
              <StickyNote className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : a.channel === "email" ? (
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium">{labelOf(a)}</span>
              {targetOf(a)} — {previewOf(a)}
            </span>
            <span className="shrink-0 text-xs font-medium text-primary">
              Review
            </span>
          </button>
        ))}
      </CardContent>
      <ActionApprovalModal
        action={selected}
        open={open}
        onOpenChange={setOpen}
        onApproved={onApproved}
      />
    </Card>
  );
}
