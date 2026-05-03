// src/features/chat-bot/components/BlockedLeadStatusSelector.tsx
// Multi-select dropdown with removable chips for blocked lead statuses

import { useState, useRef, useEffect, useCallback } from "react";
import { AlertTriangle, ChevronsUpDown, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatBotCloseLeadStatus } from "../hooks/useChatBot";

interface BlockedLeadStatusSelectorProps {
  selected: string[];
  onChange: (statuses: string[]) => void;
  disabled?: boolean;
  options?: ChatBotCloseLeadStatus[] | null;
  closeConnected: boolean;
  isLoadingStatuses?: boolean;
}

export function BlockedLeadStatusSelector({
  selected,
  onChange,
  disabled,
  options,
  closeConnected,
  isLoadingStatuses,
}: BlockedLeadStatusSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, close]);

  if (!closeConnected) {
    return (
      <div className="rounded-lg border border-v2-ring bg-v2-canvas px-3 py-2.5 dark:border-v2-ring dark:bg-v2-canvas/40">
        <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
          Connect Close CRM to configure status filtering.
        </p>
      </div>
    );
  }

  if (isLoadingStatuses) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-v2-ring bg-v2-canvas px-3 py-2.5 dark:border-v2-ring dark:bg-v2-canvas/40">
        <Loader2 className="h-3 w-3 animate-spin text-v2-ink-subtle" />
        <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
          Loading lead statuses from Close CRM...
        </p>
      </div>
    );
  }

  // Use real CRM labels only — no defaults for a kill-switch feature
  const statusLabels = Array.isArray(options)
    ? options
        .map((s) => s.label?.trim())
        .filter((label): label is string => Boolean(label))
    : [];

  // Statuses the user previously selected that no longer exist in CRM
  const orphaned = selected.filter((s) => !statusLabels.includes(s));
  const valid = selected.filter((s) => statusLabels.includes(s));

  const available = statusLabels.filter((s) => !selected.includes(s));
  const filtered = search
    ? available.filter((s) => s.toLowerCase().includes(search.toLowerCase()))
    : available;

  const add = (status: string) => {
    if (selected.includes(status)) return;
    onChange([...selected, status]);
    setSearch("");
  };

  const remove = (status: string) => {
    onChange(selected.filter((s) => s !== status));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      close();
      e.stopPropagation();
    }
  };

  return (
    <div className="space-y-2">
      {/* Orphaned status warning */}
      {orphaned.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 dark:border-warning dark:bg-warning/15">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warning" />
          <div>
            <p className="text-[10px] font-medium text-warning">
              {orphaned.length === 1
                ? "1 blocked status no longer exists in your CRM"
                : `${orphaned.length} blocked statuses no longer exist in your CRM`}
            </p>
            <p className="mt-0.5 text-[10px] text-warning">
              These are not being enforced. Remove them to clear this warning.
            </p>
          </div>
        </div>
      )}

      {/* Selected chips */}
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {valid.map((status) => (
            <Badge
              key={status}
              variant="secondary"
              className="gap-1 py-0.5 pl-2 pr-1 text-[10px]"
            >
              {status}
              <button
                type="button"
                onClick={() => remove(status)}
                disabled={disabled}
                className="ml-0.5 rounded-sm hover:bg-v2-ring-strong"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {orphaned.map((status) => (
            <Badge
              key={status}
              variant="outline"
              className="gap-1 border-warning/40 py-0.5 pl-2 pr-1 text-[10px] text-warning dark:border-warning dark:text-warning"
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              {status}
              <button
                type="button"
                onClick={() => remove(status)}
                disabled={disabled}
                className="ml-0.5 rounded-sm hover:bg-warning/30 dark:hover:bg-warning"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-v2-ink-subtle dark:text-v2-ink-muted">
          No statuses blocked — bot will respond to all leads.
        </p>
      )}

      {/* Dropdown trigger */}
      <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full justify-between text-[10px] font-normal"
          disabled={disabled || statusLabels.length === 0}
          onClick={() => setOpen(!open)}
        >
          <span className="truncate text-v2-ink-muted dark:text-v2-ink-subtle">
            {statusLabels.length === 0
              ? "No statuses available"
              : available.length > 0
                ? "Add statuses to block..."
                : "All statuses blocked"}
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-v2-ring bg-white shadow-lg dark:border-v2-ring-strong dark:bg-v2-card">
            <div className="border-b border-v2-ring p-1.5 dark:border-v2-ring">
              <input
                ref={inputRef}
                type="text"
                className="w-full rounded-md border-0 bg-v2-canvas px-2 py-1.5 text-[11px] text-v2-ink outline-none placeholder:text-v2-ink-subtle dark:bg-v2-card-tinted dark:text-v2-ink dark:placeholder:text-v2-ink-muted"
                placeholder="Search statuses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div
              className="max-h-[200px] overflow-y-auto overscroll-contain p-1"
              onWheel={(e) => e.stopPropagation()}
            >
              {filtered.length === 0 ? (
                <p className="px-2 py-1.5 text-[10px] text-v2-ink-subtle">
                  {search
                    ? "No matching statuses."
                    : "No more statuses available."}
                </p>
              ) : (
                filtered.map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors",
                      "text-v2-ink hover:bg-v2-card-tinted dark:text-v2-ink-muted dark:hover:bg-v2-card-tinted",
                    )}
                    onClick={() => add(status)}
                  >
                    <span className="w-3 shrink-0" />
                    {status}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
        The bot will not respond to leads with any of these statuses. This
        applies to both inbound and outbound messages.
      </p>
    </div>
  );
}
