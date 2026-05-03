// src/features/chat-bot/components/ConversationsTab.tsx
// Conversation list with search, filters, pagination, and message thread viewer

import { useState, useEffect, useCallback, useRef } from "react";
import {
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  X,
  Phone,
  PhoneCall,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ConversationThread } from "./ConversationThread";
import {
  useChatBotConversations,
  type ChatBotConversation,
} from "../hooks/useChatBot";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "awaiting_reply", label: "Awaiting Reply" },
  { value: "scheduling", label: "Scheduling" },
  { value: "scheduled", label: "Scheduled" },
  { value: "closed", label: "Closed" },
  { value: "stale", label: "Stale" },
];

export function ConversationsTab() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedConv, setSelectedConv] = useState<ChatBotConversation | null>(
    null,
  );
  const limit = 20;

  // Debounce search input (400ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, refetch } = useChatBotConversations(
    page,
    limit,
    status === "all" ? undefined : status,
    true,
    debouncedSearch || undefined,
  );

  // Lightweight query to get open conversation count (only when viewing "all" with no search)
  const { data: openCountData } = useChatBotConversations(
    1,
    1,
    "open",
    status === "all" && !debouncedSearch,
  );

  // Auto-refresh every 30 seconds — use ref to avoid re-creating interval on every render
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  useEffect(() => {
    const interval = setInterval(() => {
      refetchRef.current();
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const conversations = data?.data || [];
  const total = data?.total || 0;
  const openCount =
    status === "all" && !debouncedSearch ? (openCountData?.total ?? 0) : 0;
  const engagedTotal = Math.max(0, total - openCount);
  const totalPages = Math.ceil(total / limit);

  const clearSearch = useCallback(() => {
    setSearchInput("");
    setDebouncedSearch("");
    setPage(1);
  }, []);

  const formatTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return "\u2014";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "\u2014";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const leadLabel = (conv: ChatBotConversation) => {
    if (conv.leadName) return conv.leadName;
    if (conv.leadPhone) return conv.leadPhone;
    return "Unknown Lead";
  };

  const channelIcon = (channel: string | null | undefined) => {
    if (!channel || channel === "email") return null;
    const map: Record<string, { icon: typeof Phone; label: string }> = {
      sms: { icon: Phone, label: "SMS" },
      voice: { icon: PhoneCall, label: "Voice" },
    };
    const entry = map[channel];
    if (!entry) return null;
    const Icon = entry.icon;
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Icon className="h-3 w-3 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[10px]">
            {entry.label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case "open":
        return (
          <Badge className="text-[9px] h-3.5 px-1 bg-success/20 text-success dark:bg-success dark:text-success">
            Open
          </Badge>
        );
      case "awaiting_reply":
        return (
          <Badge className="text-[9px] h-3.5 px-1 bg-info/20 text-info dark:bg-info dark:text-info">
            Awaiting Reply
          </Badge>
        );
      case "scheduling":
        return (
          <Badge className="text-[9px] h-3.5 px-1 bg-info/20 text-info dark:bg-info dark:text-info">
            Scheduling
          </Badge>
        );
      case "scheduled":
        return (
          <Badge className="text-[9px] h-3.5 px-1 bg-success/20 text-success dark:bg-success dark:text-success">
            Scheduled
          </Badge>
        );
      case "closed":
        return (
          <Badge className="text-[9px] h-3.5 px-1 bg-card-tinted text-muted-foreground dark:bg-card-tinted dark:text-muted-foreground">
            Closed
          </Badge>
        );
      case "stale":
        return (
          <Badge className="text-[9px] h-3.5 px-1 bg-warning/20 text-warning dark:bg-warning dark:text-warning">
            Stale
          </Badge>
        );
      default:
        return (
          <Badge
            variant="secondary"
            className="text-[9px] h-3.5 px-1 bg-card-tinted text-muted-foreground dark:bg-card-tinted dark:text-muted-foreground"
          >
            {s}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-2">
      {/* Search + Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Search name or phone..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-7 text-[11px] pl-7 pr-7"
          />
          {searchInput && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-7 text-[11px] w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem
                key={opt.value}
                value={opt.value}
                className="text-[11px]"
              >
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {debouncedSearch
            ? `${total} result${total !== 1 ? "s" : ""}`
            : `${engagedTotal} conversation${engagedTotal !== 1 ? "s" : ""}`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px] ml-auto"
          onClick={() => refetch()}
        >
          <RefreshCw className="h-2.5 w-2.5 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-hidden bg-card rounded-lg border border-border dark:border-border">
        <div className="overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background dark:bg-card-tinted/50 z-10">
              <TableRow className="border-b border-border dark:border-border hover:bg-transparent">
                <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground dark:text-muted-foreground">
                  Lead
                </TableHead>
                <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground dark:text-muted-foreground w-10 text-center">
                  Ch
                </TableHead>
                <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground dark:text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground dark:text-muted-foreground text-right">
                  Last Activity
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                  </TableCell>
                </TableRow>
              ) : conversations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center">
                    <MessageSquare className="h-8 w-8 text-muted-foreground dark:text-muted-foreground mx-auto mb-2" />
                    <p className="text-[11px] text-muted-foreground dark:text-muted-foreground">
                      {debouncedSearch
                        ? "No conversations match your search"
                        : "No conversations yet"}
                    </p>
                    {!debouncedSearch && (
                      <p className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                        Conversations will appear when leads text in
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                conversations.map((conv) => (
                  <TableRow
                    key={conv.id}
                    className="hover:bg-background dark:hover:bg-card-tinted/50 border-b border-border dark:border-border/50 cursor-pointer"
                    onClick={() => setSelectedConv(conv)}
                  >
                    <TableCell className="py-1.5">
                      <div>
                        <span className="text-[11px] font-medium text-foreground dark:text-foreground">
                          {leadLabel(conv)}
                        </span>
                        {conv.leadName && conv.leadPhone && (
                          <p className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                            {conv.leadPhone}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-1.5 text-center">
                      {channelIcon(conv.channel)}
                    </TableCell>
                    <TableCell className="py-1.5">
                      {statusBadge(conv.status)}
                    </TableCell>
                    <TableCell className="py-1.5 text-right">
                      <span className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                        {formatTime(conv.lastEventAt || conv.updatedAt)}
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

      {/* Thread Dialog */}
      <ConversationThread
        conversation={selectedConv}
        open={!!selectedConv}
        onClose={() => setSelectedConv(null)}
      />
    </div>
  );
}
