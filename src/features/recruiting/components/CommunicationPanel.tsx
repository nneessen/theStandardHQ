// src/features/recruiting/components/CommunicationPanel.tsx
// Communication panel with compact styling

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Mail,
  Send,
  Inbox,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
// eslint-disable-next-line no-restricted-imports
import { emailService, type SendEmailRequest } from "@/services/email";
import type { UserProfile } from "@/types/hierarchy.types";

interface CommunicationPanelProps {
  userId: string;
  upline?: UserProfile | null;
  currentUserProfile?: UserProfile;
}

export function CommunicationPanel({
  userId,
  upline,
  currentUserProfile,
}: CommunicationPanelProps) {
  const [subject, setSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [showInbox, setShowInbox] = useState(false);
  const queryClient = useQueryClient();

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["user-messages", userId],
    queryFn: () => emailService.getEmailsForUser(userId),
    enabled: !!userId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: { subject: string; body: string }) => {
      if (!upline?.email) {
        throw new Error("No recruiter email available");
      }

      // Sanitize name to prevent email header injection (remove angle brackets)
      const senderName =
        `${currentUserProfile?.first_name || "Recruit"} ${currentUserProfile?.last_name || ""}`
          .trim()
          .replace(/[<>]/g, "");
      const request: SendEmailRequest = {
        to: [upline.email],
        from: `${senderName} <recruiting@thestandardhq.com>`,
        subject: messageData.subject || "Message from Recruiting Pipeline",
        html: messageData.body.replace(/\n/g, "<br>"),
        text: messageData.body,
        replyTo: currentUserProfile?.email,
        recruitId: userId,
        senderId: userId,
        metadata: {
          sent_via: "communication_panel",
          from_recruit: true,
        },
      };

      return emailService.sendEmail(request);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-messages", userId] });
      setSubject("");
      setMessageBody("");
      toast.success("Email sent successfully!");
    },
    onError: (error) => {
      console.error("Failed to send message:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to send email",
      );
    },
  });

  const handleSendMessage = () => {
    if (!messageBody.trim()) {
      toast.error("Please enter a message");
      return;
    }

    if (!upline?.email) {
      toast.error("No recruiter assigned. Please contact support.");
      return;
    }

    sendMessageMutation.mutate({
      subject: subject.trim(),
      body: messageBody.trim(),
    });
  };

  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return format(date, "MMM d");
  };

  const recruiterName = upline
    ? `${upline.first_name || ""} ${upline.last_name || ""}`.trim() ||
      upline.email
    : null;

  const inboxCount = messages?.length || 0;

  if (showInbox) {
    return (
      <div className="h-full flex flex-col p-2">
        {/* Inbox Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Inbox className="h-3.5 w-3.5 text-v2-ink-muted" />
            <span className="text-[11px] font-medium text-v2-ink">
              Messages ({messages?.length || 0})
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => setShowInbox(false)}
          >
            <Send className="h-3 w-3 mr-1" />
            Compose
          </Button>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-auto">
          {messagesLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
            </div>
          ) : messages && messages.length > 0 ? (
            <div className="space-y-1.5">
              {messages.map((message) => {
                const isSent = message.sender_id === userId;
                const statusIcon =
                  message.status === "sent" ||
                  message.status === "delivered" ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-500" />
                  ) : message.status === "failed" ? (
                    <AlertCircle className="h-3 w-3 text-red-600 dark:text-red-500" />
                  ) : (
                    <Clock className="h-3 w-3 text-v2-ink-subtle" />
                  );

                return (
                  <div
                    key={message.id}
                    className="p-2 rounded-md border border-v2-ring bg-v2-card hover:bg-v2-canvas transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarFallback className="text-[9px] bg-v2-ring text-v2-ink  dark:text-v2-ink-subtle">
                          {isSent ? (
                            <Send className="h-3 w-3" />
                          ) : (
                            <User className="h-3 w-3" />
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle">
                            {isSent ? "Sent" : "Received"}
                          </p>
                          {statusIcon}
                          <span className="text-[9px] text-v2-ink-subtle ml-auto">
                            {message.sent_at
                              ? formatRelativeTime(message.sent_at)
                              : formatRelativeTime(message.created_at)}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-v2-ink truncate mt-0.5">
                          {message.subject || "(No subject)"}
                        </p>
                        <p className="text-[10px] text-v2-ink-muted line-clamp-1 mt-0.5">
                          {message.body_text}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Inbox className="h-8 w-8 text-v2-ink-subtle mx-auto mb-2" />
              <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
                No messages yet
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-2">
      {/* Compose Header with Inbox Toggle */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Send className="h-3.5 w-3.5 text-v2-ink-muted" />
          <span className="text-[11px] font-medium text-v2-ink">
            New Message
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={() => setShowInbox(true)}
        >
          <Inbox className="h-3 w-3 mr-1" />
          Inbox
          {inboxCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-1 h-4 px-1 text-[9px] bg-v2-ring text-v2-ink-muted  dark:text-v2-ink-subtle"
            >
              {inboxCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Recipient */}
      <div className="shrink-0 mb-2">
        {upline ? (
          <div className="flex items-center gap-2 p-1.5 bg-v2-canvas rounded-md">
            <Avatar className="h-6 w-6">
              <AvatarImage src={upline.profile_photo_url || undefined} />
              <AvatarFallback className="text-[9px] bg-v2-ring text-v2-ink  dark:text-v2-ink-subtle">
                {upline.first_name?.[0]}
                {upline.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-v2-ink truncate">
                To: {recruiterName}
              </p>
              <p className="text-[9px] text-v2-ink-muted truncate">
                {upline.email}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 p-1.5 bg-red-50 dark:bg-red-950/30 rounded-md">
            <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
            <p className="text-[10px] text-red-700 dark:text-red-400">
              No recruiter assigned
            </p>
          </div>
        )}
      </div>

      {/* Subject Field */}
      <div className="shrink-0 mb-2">
        <Input
          placeholder="Subject (optional)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="h-7 text-[11px]"
          disabled={sendMessageMutation.isPending}
        />
      </div>

      {/* Message Body */}
      <div className="flex-1 min-h-0 mb-2">
        <Textarea
          placeholder="Type your message..."
          value={messageBody}
          onChange={(e) => setMessageBody(e.target.value)}
          className="h-full min-h-[80px] resize-none text-[11px]"
          disabled={sendMessageMutation.isPending}
        />
      </div>

      {/* Send Button */}
      <Button
        onClick={handleSendMessage}
        disabled={
          !upline?.email || !messageBody.trim() || sendMessageMutation.isPending
        }
        className="h-7 text-[11px] shrink-0"
        size="sm"
      >
        {sendMessageMutation.isPending ? (
          <>
            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Mail className="h-3 w-3 mr-1.5" />
            Send Email
          </>
        )}
      </Button>
    </div>
  );
}
