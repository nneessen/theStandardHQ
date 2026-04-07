// Library tab: lists all email templates, SMS templates, and sequences from Close.
// Search + filter + delete. Source of truth is Close's API, not our local DB.
//
// Pagination: the edge function auto-paginates through all Close pages and
// returns one combined array (up to MAX_AUTO_PAGINATE_ITEMS = 2000). We
// surface the total count prominently so users can confirm it matches what
// they see in Close's own UI. If the safety cap is hit, a warning banner
// tells them the list is truncated.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Mail,
  MessageSquare,
  GitBranch,
  Trash2,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Archive,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useEmailTemplates,
  useSmsTemplates,
  useSequences,
  useDeleteEmailTemplate,
  useDeleteSmsTemplate,
  useDeleteSequence,
} from "../hooks/useCloseAiBuilder";
import type {
  CloseEmailTemplate,
  CloseSequence,
  CloseSmsTemplate,
} from "../types/close-ai-builder.types";

export function LibraryTab() {
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(true);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates and workflows…"
            className="h-9 pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
          <Switch
            id="show-archived"
            checked={showArchived}
            onCheckedChange={setShowArchived}
          />
          <Label htmlFor="show-archived" className="cursor-pointer text-xs">
            Show archived
          </Label>
        </div>
      </div>

      <Tabs defaultValue="email" className="space-y-3">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-xl bg-zinc-200/70 p-1 dark:bg-zinc-800/70">
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-3.5 w-3.5" />
            <span className="text-xs">Email Templates</span>
          </TabsTrigger>
          <TabsTrigger value="sms" className="gap-2">
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="text-xs">SMS Templates</span>
          </TabsTrigger>
          <TabsTrigger value="sequences" className="gap-2">
            <GitBranch className="h-3.5 w-3.5" />
            <span className="text-xs">Workflows</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email">
          <EmailLibrary search={search} showArchived={showArchived} />
        </TabsContent>
        <TabsContent value="sms">
          <SmsLibrary search={search} />
        </TabsContent>
        <TabsContent value="sequences">
          <SequenceLibrary search={search} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Email library ────────────────────────────────────────────────

function EmailLibrary({
  search,
  showArchived,
}: {
  search: string;
  showArchived: boolean;
}) {
  const { data, isLoading, isError, error } = useEmailTemplates();
  const del = useDeleteEmailTemplate();

  const { rows, archivedCount, totalCount } = useMemo(() => {
    if (!data?.data) {
      return { rows: [], archivedCount: 0, totalCount: 0 };
    }
    const allRows = data.data;
    const totalCount = allRows.length;
    const archivedCount = allRows.filter(
      (t: CloseEmailTemplate) => t.is_archived,
    ).length;

    // Apply archived filter first
    const afterArchiveFilter = showArchived
      ? allRows
      : allRows.filter((t: CloseEmailTemplate) => !t.is_archived);

    // Then search
    const q = search.trim().toLowerCase();
    const rows = !q
      ? afterArchiveFilter
      : afterArchiveFilter.filter(
          (t: CloseEmailTemplate) =>
            t.name.toLowerCase().includes(q) ||
            t.subject.toLowerCase().includes(q),
        );
    return { rows, archivedCount, totalCount };
  }, [data, search, showArchived]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete email template "${name}"?`)) return;
    try {
      await del.mutateAsync(id);
      toast.success("Deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  if (isLoading) return <LoadingRow count={4} />;
  if (isError)
    return (
      <ErrorCard
        message={error instanceof Error ? error.message : "Failed to load"}
      />
    );

  return (
    <div className="space-y-2">
      <ListHeader
        label="email templates"
        totalCount={totalCount}
        visibleCount={rows.length}
        archivedCount={archivedCount}
        truncated={data?.truncated ?? false}
      />
      {rows.length === 0 ? (
        <EmptyRow text="No email templates found" />
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {rows.map((t: CloseEmailTemplate) => (
              <div
                key={t.id}
                className="flex items-start justify-between gap-3 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    <span className="truncate text-sm font-medium">
                      {t.name}
                    </span>
                    {t.is_shared && (
                      <Badge variant="outline" className="text-[10px]">
                        shared
                      </Badge>
                    )}
                    {t.is_archived && (
                      <Badge
                        variant="outline"
                        className="border-amber-400/50 text-[10px] text-amber-600 dark:text-amber-400"
                      >
                        <Archive className="mr-1 h-2.5 w-2.5" />
                        archived
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {t.subject}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {new Date(t.date_created).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="h-7 w-7 p-0"
                  >
                    <a
                      href="https://app.close.com/settings/email_templates/"
                      target="_blank"
                      rel="noreferrer"
                      title="Open in Close"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                    onClick={() => handleDelete(t.id, t.name)}
                    disabled={del.isPending}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── SMS library ──────────────────────────────────────────────────

function SmsLibrary({ search }: { search: string }) {
  const { data, isLoading, isError, error } = useSmsTemplates();
  const del = useDeleteSmsTemplate();

  const { rows, totalCount } = useMemo(() => {
    if (!data?.data) return { rows: [], totalCount: 0 };
    const allRows = data.data;
    const totalCount = allRows.length;
    const q = search.trim().toLowerCase();
    const rows = !q
      ? allRows
      : allRows.filter(
          (t: CloseSmsTemplate) =>
            t.name.toLowerCase().includes(q) ||
            t.text.toLowerCase().includes(q),
        );
    return { rows, totalCount };
  }, [data, search]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete SMS template "${name}"?`)) return;
    try {
      await del.mutateAsync(id);
      toast.success("Deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  if (isLoading) return <LoadingRow count={4} />;
  if (isError)
    return (
      <ErrorCard
        message={error instanceof Error ? error.message : "Failed to load"}
      />
    );

  return (
    <div className="space-y-2">
      <ListHeader
        label="SMS templates"
        totalCount={totalCount}
        visibleCount={rows.length}
        archivedCount={0}
        truncated={data?.truncated ?? false}
      />
      {rows.length === 0 ? (
        <EmptyRow text="No SMS templates found" />
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {rows.map((t: CloseSmsTemplate) => (
              <div
                key={t.id}
                className="flex items-start justify-between gap-3 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-cyan-500" />
                    <span className="truncate text-sm font-medium">
                      {t.name}
                    </span>
                    {t.is_shared && (
                      <Badge variant="outline" className="text-[10px]">
                        shared
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                    {t.text}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {new Date(t.date_created).toLocaleDateString()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                  onClick={() => handleDelete(t.id, t.name)}
                  disabled={del.isPending}
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Sequence library ─────────────────────────────────────────────

function SequenceLibrary({ search }: { search: string }) {
  const { data, isLoading, isError, error } = useSequences();
  const del = useDeleteSequence();

  const { rows, totalCount } = useMemo(() => {
    if (!data?.data) return { rows: [], totalCount: 0 };
    const allRows = data.data;
    const totalCount = allRows.length;
    const q = search.trim().toLowerCase();
    const rows = !q
      ? allRows
      : allRows.filter((s: CloseSequence) => s.name.toLowerCase().includes(q));
    return { rows, totalCount };
  }, [data, search]);

  const handleDelete = async (id: string, name: string) => {
    if (
      !confirm(
        `Delete workflow "${name}"? This does NOT delete the templates it references.`,
      )
    )
      return;
    try {
      await del.mutateAsync(id);
      toast.success("Deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  if (isLoading) return <LoadingRow count={4} />;
  if (isError)
    return (
      <ErrorCard
        message={error instanceof Error ? error.message : "Failed to load"}
      />
    );

  return (
    <div className="space-y-2">
      <ListHeader
        label="workflows"
        totalCount={totalCount}
        visibleCount={rows.length}
        archivedCount={0}
        truncated={data?.truncated ?? false}
      />
      {rows.length === 0 ? (
        <EmptyRow text="No workflows found" />
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {rows.map((s: CloseSequence) => (
              <div
                key={s.id}
                className="flex items-start justify-between gap-3 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                    <span className="truncate text-sm font-medium">
                      {s.name}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {s.status}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {s.steps.length} step{s.steps.length !== 1 ? "s" : ""} •{" "}
                    {s.timezone}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {new Date(s.date_created).toLocaleDateString()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                  onClick={() => handleDelete(s.id, s.name)}
                  disabled={del.isPending}
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────

function ListHeader({
  label,
  totalCount,
  visibleCount,
  archivedCount,
  truncated,
}: {
  label: string;
  totalCount: number;
  visibleCount: number;
  archivedCount: number;
  truncated: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>
          Showing{" "}
          <span className="font-medium text-foreground">{visibleCount}</span> of{" "}
          <span className="font-medium text-foreground">{totalCount}</span>{" "}
          {label}
        </span>
        {archivedCount > 0 && (
          <Badge variant="outline" className="text-[10px]">
            {archivedCount} archived
          </Badge>
        )}
      </div>
      {truncated && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300/50 bg-amber-50/50 p-2 text-[11px] text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            Your library has more than 2000 items. Showing the first 2000 — use
            search to find older ones, or delete unused items in Close to
            tighten the list.
          </span>
        </div>
      )}
    </div>
  );
}

function LoadingRow({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-md border p-3">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          <div className="h-3 w-48 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50/50 p-4 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
      {message}
    </div>
  );
}
