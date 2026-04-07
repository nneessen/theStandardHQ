// Library tab: lists all email templates, SMS templates, and sequences from Close.
// Search + filter + delete. Source of truth is Close's API, not our local DB.

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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useEmailTemplates,
  useSmsTemplates,
  useSequences,
  useDeleteEmailTemplate,
  useDeleteSmsTemplate,
  useDeleteSequence,
} from "../hooks/useCloseAiBuilder";

export function LibraryTab() {
  const [search, setSearch] = useState("");

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates and workflows…"
          className="h-9 pl-9 text-sm"
        />
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
          <EmailLibrary search={search} />
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

function EmailLibrary({ search }: { search: string }) {
  const { data, isLoading, isError, error } = useEmailTemplates({ limit: 100 });
  const del = useDeleteEmailTemplate();

  const filtered = useMemo(() => {
    if (!data?.data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.data;
    return data.data.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q),
    );
  }, [data, search]);

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

  if (filtered.length === 0) {
    return <EmptyRow text="No email templates found" />;
  }

  return (
    <Card>
      <CardContent className="divide-y p-0">
        {filtered.map((t) => (
          <div
            key={t.id}
            className="flex items-start justify-between gap-3 p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                <span className="truncate text-sm font-medium">{t.name}</span>
                {t.is_shared && (
                  <Badge variant="outline" className="text-[10px]">
                    shared
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
              <Button variant="ghost" size="sm" asChild className="h-7 w-7 p-0">
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
  );
}

// ─── SMS library ──────────────────────────────────────────────────

function SmsLibrary({ search }: { search: string }) {
  const { data, isLoading, isError, error } = useSmsTemplates({ limit: 100 });
  const del = useDeleteSmsTemplate();

  const filtered = useMemo(() => {
    if (!data?.data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.data;
    return data.data.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || t.text.toLowerCase().includes(q),
    );
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

  if (filtered.length === 0) {
    return <EmptyRow text="No SMS templates found" />;
  }

  return (
    <Card>
      <CardContent className="divide-y p-0">
        {filtered.map((t) => (
          <div
            key={t.id}
            className="flex items-start justify-between gap-3 p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-cyan-500" />
                <span className="truncate text-sm font-medium">{t.name}</span>
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
  );
}

// ─── Sequence library ─────────────────────────────────────────────

function SequenceLibrary({ search }: { search: string }) {
  const { data, isLoading, isError, error } = useSequences({ limit: 100 });
  const del = useDeleteSequence();

  const filtered = useMemo(() => {
    if (!data?.data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.data;
    return data.data.filter((s) => s.name.toLowerCase().includes(q));
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

  if (filtered.length === 0) {
    return <EmptyRow text="No workflows found" />;
  }

  return (
    <Card>
      <CardContent className="divide-y p-0">
        {filtered.map((s) => (
          <div
            key={s.id}
            className="flex items-start justify-between gap-3 p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <GitBranch className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                <span className="truncate text-sm font-medium">{s.name}</span>
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
  );
}

// ─── Shared helpers ───────────────────────────────────────────────

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
