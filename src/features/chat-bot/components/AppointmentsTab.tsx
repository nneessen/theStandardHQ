// src/features/chat-bot/components/AppointmentsTab.tsx
// Appointments list with pagination and reminder status indicators

import { useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ExternalLink,
  Check,
  Clock,
  Minus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useChatBotAppointments,
  type ChatBotAppointment,
} from "../hooks/useChatBot";

// --- Reminder tier logic (pure function) ---

type ReminderStatus = "sent" | "upcoming" | "pending" | "skipped";

interface ReminderTier {
  label: string;
  status: ReminderStatus;
  sentAt: string | null;
}

function computeReminderTiers(
  appt: ChatBotAppointment,
  now: number,
): ReminderTier[] {
  const scheduledMs = appt.scheduledAt
    ? new Date(appt.scheduledAt).getTime()
    : null;
  const isPast =
    scheduledMs != null && !isNaN(scheduledMs) && now >= scheduledMs;

  const tiers: {
    label: string;
    sentAt: string | null;
    windowMs: number;
  }[] = [
    {
      label: "24h",
      sentAt: appt.reminder24hSentAt,
      windowMs: 24 * 60 * 60 * 1000,
    },
    { label: "1h", sentAt: appt.reminder1hSentAt, windowMs: 60 * 60 * 1000 },
    { label: "15m", sentAt: appt.reminder15mSentAt, windowMs: 15 * 60 * 1000 },
  ];

  return tiers.map(({ label, sentAt, windowMs }) => {
    let status: ReminderStatus;
    if (sentAt != null) {
      status = "sent";
    } else if (scheduledMs == null || isNaN(scheduledMs)) {
      status = "pending";
    } else if (isPast) {
      status = "skipped";
    } else if (now >= scheduledMs - windowMs) {
      status = "upcoming";
    } else {
      status = "pending";
    }
    return { label, status, sentAt };
  });
}

// --- Sub-component ---

const dotColors: Record<ReminderStatus, string> = {
  sent: "bg-success dark:bg-success/70",
  upcoming: "bg-warning dark:bg-warning/70",
  pending: "bg-muted dark:bg-muted",
  skipped: "bg-destructive dark:bg-destructive/70",
};

const dotIcons: Record<ReminderStatus, typeof Check> = {
  sent: Check,
  upcoming: Clock,
  pending: Minus,
  skipped: X,
};

const statusLabels: Record<ReminderStatus, string> = {
  sent: "Sent",
  upcoming: "Upcoming",
  pending: "Pending",
  skipped: "Skipped",
};

function formatTimestamp(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function ReminderDots({ appt }: { appt: ChatBotAppointment }) {
  const tiers = computeReminderTiers(appt, Date.now());

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 cursor-default">
            {tiers.map((tier) => (
              <span
                key={tier.label}
                className={`inline-block h-2 w-2 rounded-full ${dotColors[tier.status]}`}
              />
            ))}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="text-[10px] leading-relaxed p-2 max-w-[200px]"
        >
          <p className="font-semibold mb-1 text-[10px]">Reminders</p>
          {tiers.map((tier) => {
            const Icon = dotIcons[tier.status];
            return (
              <div key={tier.label} className="flex items-center gap-1.5">
                <Icon className="h-2.5 w-2.5 shrink-0" />
                <span>
                  {tier.label}: {statusLabels[tier.status]}
                  {tier.status === "sent" && tier.sentAt && (
                    <span className="text-muted-foreground ml-1">
                      ({formatTimestamp(tier.sentAt)})
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// --- Main component ---

export function AppointmentsTab() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useChatBotAppointments(page, limit);

  const appointments = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatCreated = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const sourceLabel = (source: string | null | undefined) => {
    if (!source) return null;
    switch (source) {
      case "bot":
        return "Bot booked";
      case "calendar_sync":
        return "Calendar sync";
      default:
        return null;
    }
  };

  const statusBadge = (s: string, source: string | null | undefined) => {
    const normalized = s?.toLowerCase() || "";
    let badge: React.ReactNode;
    switch (normalized) {
      case "scheduled":
      case "confirmed":
      case "active":
      case "pending":
        badge = (
          <Badge className="text-[9px] h-3.5 px-1 bg-info/20 text-info dark:bg-info dark:text-info">
            Scheduled
          </Badge>
        );
        break;
      case "completed":
      case "done":
        badge = (
          <Badge className="text-[9px] h-3.5 px-1 bg-success/20 text-success dark:bg-success dark:text-success">
            Completed
          </Badge>
        );
        break;
      case "cancelled":
      case "canceled":
        badge = (
          <Badge className="text-[9px] h-3.5 px-1 bg-destructive/20 text-destructive dark:bg-destructive dark:text-destructive">
            Cancelled
          </Badge>
        );
        break;
      case "no_show":
      case "no-show":
      case "noshow":
        badge = (
          <Badge className="text-[9px] h-3.5 px-1 bg-warning/20 text-warning dark:bg-warning dark:text-warning">
            No Show
          </Badge>
        );
        break;
      default:
        badge = (
          <Badge
            variant="secondary"
            className="text-[9px] h-3.5 px-1 bg-card-tinted text-muted-foreground dark:bg-card-tinted dark:text-muted-foreground"
          >
            {s || "Unknown"}
          </Badge>
        );
    }

    const label = sourceLabel(source);
    return (
      <div className="flex flex-col">
        {badge}
        {label && (
          <span className="text-[9px] text-muted-foreground dark:text-muted-foreground mt-0.5">
            {label}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {total} appointment{total !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="overflow-hidden bg-card rounded-lg border border-border dark:border-border">
        <div className="overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background dark:bg-card-tinted/50 z-10">
              <TableRow className="border-b border-border dark:border-border hover:bg-transparent">
                <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground dark:text-muted-foreground">
                  Lead
                </TableHead>
                <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground dark:text-muted-foreground">
                  Date/Time
                </TableHead>
                <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground dark:text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground dark:text-muted-foreground">
                  Reminders
                </TableHead>
                <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground dark:text-muted-foreground text-right">
                  Created
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                  </TableCell>
                </TableRow>
              ) : appointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center">
                    <Calendar className="h-8 w-8 text-muted-foreground dark:text-muted-foreground mx-auto mb-2" />
                    <p className="text-[11px] text-muted-foreground dark:text-muted-foreground">
                      No appointments yet
                    </p>
                    <p className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                      Appointments will appear when leads book via the bot
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                appointments.map((appt) => (
                  <TableRow
                    key={appt.id}
                    className="hover:bg-background dark:hover:bg-card-tinted/50 border-b border-border dark:border-border/50"
                  >
                    <TableCell className="py-1.5">
                      <span className="text-[11px] font-medium text-foreground dark:text-foreground">
                        {appt.leadName}
                      </span>
                    </TableCell>
                    <TableCell className="py-1.5">
                      <span className="text-[11px] text-foreground dark:text-foreground">
                        {formatDate(appt.scheduledAt)}
                      </span>
                    </TableCell>
                    <TableCell className="py-1.5">
                      <div className="flex items-center gap-1.5">
                        {statusBadge(appt.status, appt.source)}
                        {appt.eventUrl && (
                          <a
                            href={appt.eventUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-info hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-1.5">
                      <ReminderDots appt={appt} />
                    </TableCell>
                    <TableCell className="py-1.5 text-right">
                      <span className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                        {formatCreated(appt.createdAt)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px]"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-3 w-3 mr-0.5" />
            Previous
          </Button>
          <span className="text-[10px] text-muted-foreground dark:text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px]"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
            <ChevronRight className="h-3 w-3 ml-0.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
