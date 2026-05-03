// src/components/layout/SupportDialog.tsx
// Support ticket dialog — routes through user's Gmail if connected, else Mailgun fallback

import { useState } from "react";
import {
  Bug,
  Lightbulb,
  MessageSquare,
  CreditCard,
  X,
  Send,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { sendEmail } from "@/services/email";

const SUPPORT_ADDRESS = "support@thestandardhq.com";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CATEGORIES = [
  {
    label: "Bug Report",
    icon: Bug,
    subject: "Bug Report",
    placeholder:
      "Describe what happened, what you expected, and steps to reproduce...",
  },
  {
    label: "Feature Request",
    icon: Lightbulb,
    subject: "Feature Request",
    placeholder: "Describe the feature and why it would be valuable...",
  },
  {
    label: "Question",
    icon: MessageSquare,
    subject: "Question",
    placeholder: "What do you need help with?",
  },
  {
    label: "Billing Help",
    icon: CreditCard,
    subject: "Billing Help",
    placeholder: "Describe your billing issue or question...",
  },
] as const;

interface SupportDialogProps {
  open: boolean;
  onClose: () => void;
  userName: string;
}

export function SupportDialog({ open, onClose, userName }: SupportDialogProps) {
  const { user, supabaseUser } = useAuth();
  const userEmail = supabaseUser?.email || user?.email || "";
  const [selectedIdx, setSelectedIdx] = useState(2); // default: Question
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const category = CATEGORIES[selectedIdx];

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error("Please describe your issue before submitting.");
      return;
    }
    if (!user?.id) {
      toast.error("Unable to send — please reload the page.");
      return;
    }

    setSubmitting(true);
    try {
      const subject = `[Support] ${category.subject}${userName ? ` — ${userName}` : ""}`;
      const bodyText = message.trim();
      const bodyHtml = `
        <div style="font-family:sans-serif;font-size:14px;color:#111;">
          <p><strong>From:</strong> ${escapeHtml(userName)} &lt;${escapeHtml(userEmail)}&gt;</p>
          <p><strong>Category:</strong> ${escapeHtml(category.subject)}</p>
          <hr style="border:none;border-top:1px solid #e4e4e7;margin:12px 0;" />
          <p style="white-space:pre-wrap;">${escapeHtml(bodyText)}</p>
        </div>
      `;

      const result = await sendEmail({
        userId: user.id,
        to: [SUPPORT_ADDRESS],
        subject,
        bodyHtml,
        bodyText,
        source: "personal",
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to send");
      }

      toast.success("Support request sent. We'll get back to you soon.");
      setMessage("");
      setSelectedIdx(2);
      onClose();
    } catch (err) {
      console.error("Support email failed:", err);
      toast.error(
        "Failed to send support request. Please email us directly at support@thestandardhq.com",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[200] bg-foreground/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed z-[201] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-card text-card-foreground rounded-md border border-border shadow-2xl focus:outline-none">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <Dialog.Title className="text-sm font-semibold text-foreground">
                Contact Support
              </Dialog.Title>
              <Dialog.Description className="text-[11px] text-muted-foreground mt-0.5">
                We'll reply to {userEmail || "your email"}.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="h-7 w-7 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="px-4 py-3 space-y-3">
            {/* Category selector */}
            <div>
              <p className="text-eyebrow mb-1.5">Type</p>
              <div className="grid grid-cols-2 gap-1.5">
                {CATEGORIES.map((cat, i) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.label}
                      onClick={() => setSelectedIdx(i)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-2 rounded-sm border text-[11px] font-medium transition-colors text-left",
                        selectedIdx === i
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-input hover:border-foreground/40 hover:text-foreground",
                      )}
                    >
                      <Icon className="h-3 w-3 flex-shrink-0" />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message */}
            <div>
              <p className="text-eyebrow mb-1.5">Message</p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={category.placeholder}
                rows={5}
                className="w-full text-[12px] px-2.5 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring leading-relaxed transition-colors"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-[10px] text-muted-foreground">
              Sent to support@thestandardhq.com
            </p>
            <button
              onClick={handleSubmit}
              disabled={submitting || !message.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              {submitting ? "Sending..." : "Send Request"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
