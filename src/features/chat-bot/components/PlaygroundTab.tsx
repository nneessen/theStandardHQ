// src/features/chat-bot/components/PlaygroundTab.tsx
// Bot Playground — test what the bot WOULD reply for any lead without
// sending an SMS or touching the database. Powered by the
// POST /api/external/agents/:id/dry-run-reply endpoint.

import { useState, useCallback, useMemo } from "react";
import {
  FlaskConical,
  Play,
  Clock,
  Copy,
  Check,
  AlertTriangle,
  History,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Sparkles,
  MessageSquare,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useChatBotDryRun,
  useChatBotPlaygroundRuns,
  useDeletePlaygroundRun,
  type DryRunReplyResult,
  type PlaygroundMode,
  type PlaygroundRunListItem,
  ChatBotApiError,
} from "../hooks/useChatBot";

function RelativeTime({ iso }: { iso: string }) {
  const label = useMemo(() => {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - then) / 1000));
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return new Date(iso).toLocaleDateString();
  }, [iso]);
  return (
    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
      {label}
    </span>
  );
}

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onCopy}
      className={`h-6 px-2 text-[10px] font-medium ${className ?? ""}`}
    >
      {copied ? (
        <Check className="h-3 w-3 mr-1" />
      ) : (
        <Copy className="h-3 w-3 mr-1" />
      )}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

interface ResultPanelProps {
  result: DryRunReplyResult;
  onReuseInbound?: (text: string) => void;
}

function ResultPanel({ result, onReuseInbound }: ResultPanelProps) {
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const violations = result.guardrailViolations;
  const { metadata } = result;

  return (
    <div className="space-y-2.5">
      {/* Final reply — the big obvious answer */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            <span className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
              What the bot WOULD send
            </span>
            {result.wouldSend ? (
              <Badge className="text-[9px] h-4 px-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                would send
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="text-[9px] h-4 px-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
              >
                would SKIP
              </Badge>
            )}
          </div>
          {result.finalReply && <CopyButton text={result.finalReply} />}
        </div>
        {result.finalReply ? (
          <p className="text-[12px] text-zinc-800 dark:text-zinc-100 whitespace-pre-wrap leading-relaxed">
            {result.finalReply}
          </p>
        ) : (
          <p className="text-[11px] italic text-zinc-500 dark:text-zinc-400">
            Guardrails stripped the reply entirely — bot would skip sending.
          </p>
        )}
      </div>

      {/* Raw output + stripped — collapsible */}
      {result.rawReply !== result.finalReply && (
        <details className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <summary className="cursor-pointer px-3 py-2 text-[10px] font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
            <ChevronRight className="h-3 w-3" />
            Raw AI output (before guardrails)
          </summary>
          <div className="px-3 pb-2.5">
            <p className="text-[11px] text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {result.rawReply}
            </p>
          </div>
        </details>
      )}

      {/* Guardrail violations */}
      {violations.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 p-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-200">
              Guardrails fired ({violations.length})
            </span>
          </div>
          <ul className="text-[10px] text-amber-700 dark:text-amber-300 space-y-0.5">
            {violations.map((v) => (
              <li key={v} className="font-mono">
                • {v}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Metadata row — quick glance */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-3 py-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-zinc-600 dark:text-zinc-400">
          <span>
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Lead:
            </span>{" "}
            {metadata.leadName ?? "(unknown)"}
          </span>
          {metadata.leadStatusLabel && (
            <span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                Status:
              </span>{" "}
              {metadata.leadStatusLabel}
            </span>
          )}
          <span>
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Convo:
            </span>{" "}
            {metadata.conversationStatus} · {metadata.messageCount} msgs (
            {metadata.inboundCount} inbound)
          </span>
          <span>
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Inbound:
            </span>{" "}
            {metadata.usedInboundSource}
          </span>
          <span>
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Time:
            </span>{" "}
            {metadata.generationMs}ms
          </span>
          <span>
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Tokens:
            </span>{" "}
            {metadata.promptTokens ?? "?"} in /{" "}
            {metadata.completionTokens ?? "?"} out
          </span>
        </div>
      </div>

      {/* Expandable: full metadata JSON */}
      <details
        className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
        open={showMetadata}
        onToggle={(e) => setShowMetadata((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer px-3 py-2 text-[10px] font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
          <ChevronRight className="h-3 w-3" />
          Full metadata (JSON)
        </summary>
        <pre className="px-3 pb-2.5 text-[10px] font-mono text-zinc-700 dark:text-zinc-300 overflow-x-auto">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      </details>

      {/* Expandable: full system prompt (power user) */}
      {result.systemPrompt && (
        <details
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
          open={showSystemPrompt}
          onToggle={(e) =>
            setShowSystemPrompt((e.target as HTMLDetailsElement).open)
          }
        >
          <summary className="cursor-pointer px-3 py-2 text-[10px] font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
            <ChevronRight className="h-3 w-3" />
            Full system prompt sent to AI (
            {result.systemPrompt.length.toLocaleString()} chars)
            <CopyButton text={result.systemPrompt} className="ml-auto" />
          </summary>
          <pre className="px-3 pb-2.5 text-[10px] font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
            {result.systemPrompt}
          </pre>
        </details>
      )}

      {/* Reuse inbound button */}
      {onReuseInbound && metadata.usedInbound && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[10px]"
          onClick={() => onReuseInbound(metadata.usedInbound)}
        >
          Reuse this inbound
        </Button>
      )}
    </div>
  );
}

interface HistoryItemProps {
  run: PlaygroundRunListItem;
  onSelect: (run: PlaygroundRunListItem) => void;
  onDelete: (runId: string) => void;
  isDeleting: boolean;
}

function HistoryItem({
  run,
  onSelect,
  onDelete,
  isDeleting,
}: HistoryItemProps) {
  const metadata = run.metadata as Record<string, unknown>;
  const leadName =
    typeof metadata.leadName === "string"
      ? metadata.leadName
      : run.close_lead_id.slice(0, 20);
  const preview = run.final_reply || "(bot would skip)";

  return (
    <div className="group rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
      <button
        type="button"
        onClick={() => onSelect(run)}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <Badge
              variant="secondary"
              className={`text-[9px] h-4 px-1.5 ${
                run.mode === "re-engage"
                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
              }`}
            >
              {run.mode}
            </Badge>
            <span className="text-[10px] font-medium text-zinc-900 dark:text-zinc-100 truncate">
              {leadName}
            </span>
          </div>
          <RelativeTime iso={run.created_at} />
        </div>
        <p className="text-[10px] text-zinc-600 dark:text-zinc-400 line-clamp-2">
          {preview}
        </p>
        {run.inbound_override && (
          <p className="mt-0.5 text-[9px] italic text-zinc-500 dark:text-zinc-500 truncate">
            inbound: {run.inbound_override}
          </p>
        )}
      </button>
      <div className="flex justify-end mt-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(run.id);
          }}
          disabled={isDeleting}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] text-zinc-400 hover:text-red-500 disabled:opacity-50"
          aria-label="Delete run"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export function PlaygroundTab() {
  const [closeLeadId, setCloseLeadId] = useState("");
  const [inboundOverride, setInboundOverride] = useState("");
  const [mode, setMode] = useState<PlaygroundMode>("ai-reply");
  const [systemPromptOverride, setSystemPromptOverride] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [currentResult, setCurrentResult] = useState<DryRunReplyResult | null>(
    null,
  );
  const [lastError, setLastError] = useState<string | null>(null);

  const dryRun = useChatBotDryRun();
  const { data: history = [], isLoading: historyLoading } =
    useChatBotPlaygroundRuns({
      limit: 20,
    });
  const deleteRun = useDeletePlaygroundRun();

  const canSubmit = closeLeadId.trim().length > 0 && !dryRun.isPending;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;
      setLastError(null);
      try {
        const result = await dryRun.mutateAsync({
          closeLeadId: closeLeadId.trim(),
          inboundOverride: inboundOverride.trim() || undefined,
          mode,
          systemPromptOverride: systemPromptOverride.trim() || undefined,
        });
        setCurrentResult(result);
      } catch (err) {
        if (err instanceof ChatBotApiError) {
          setLastError(err.message);
        } else if (err instanceof Error) {
          setLastError(err.message);
        } else {
          setLastError("Unknown error");
        }
        setCurrentResult(null);
      }
    },
    [
      canSubmit,
      dryRun,
      closeLeadId,
      inboundOverride,
      mode,
      systemPromptOverride,
    ],
  );

  const handleReuseInbound = useCallback((text: string) => {
    setInboundOverride(text);
  }, []);

  const handleSelectHistory = useCallback((run: PlaygroundRunListItem) => {
    // Rehydrate the form from a past run so the user can iterate on it
    setCloseLeadId(run.close_lead_id);
    setMode(run.mode);
    setInboundOverride(run.inbound_override ?? "");
    // Show just the preview from the list view — the full run detail
    // (system prompt, metadata) is not included in list items, so we
    // synthesize a minimal result from what we have. For a full view,
    // users can re-run the test.
    const metadata =
      (run.metadata as unknown as DryRunReplyResult["metadata"]) ?? null;
    if (metadata) {
      setCurrentResult({
        rawReply: run.raw_reply,
        strippedReply: run.raw_reply,
        finalReply: run.final_reply,
        guardrailViolations: run.guardrail_violations,
        wouldSend: run.would_send,
        systemPrompt: null,
        metadata,
      });
    }
  }, []);

  const handleDeleteRun = useCallback(
    (runId: string) => {
      deleteRun.mutate({ runId });
    },
    [deleteRun],
  );

  return (
    <TooltipProvider>
      <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
        {/* Left column — form + result */}
        <div className="space-y-3 overflow-y-auto pr-1">
          {/* Header */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
            <div className="flex items-center gap-2 mb-1">
              <FlaskConical className="h-4 w-4 text-indigo-500" />
              <h2 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                Bot Playground
              </h2>
              <Badge className="text-[9px] h-4 px-1.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                Safe · No SMS sent
              </Badge>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Test what the bot <strong>would reply</strong> for any lead
              without actually sending an SMS or touching the database. Perfect
              for prompt experimentation, debugging weird replies, and verifying
              bot changes before they hit real customers.
            </p>
          </div>

          {/* Input form */}
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 space-y-3"
          >
            {/* Lead ID */}
            <div className="space-y-1">
              <Label
                htmlFor="close-lead-id"
                className="text-[10px] font-medium text-zinc-700 dark:text-zinc-300"
              >
                Close Lead ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="close-lead-id"
                value={closeLeadId}
                onChange={(e) => setCloseLeadId(e.target.value)}
                placeholder="lead_XXXXXXXXXXXXXXXXXXXXXXXXXX"
                className="h-8 text-[11px] font-mono"
                spellCheck={false}
              />
              <p className="text-[9px] text-zinc-500 dark:text-zinc-500">
                Paste the Close lead ID from the URL. Must belong to your bot
                agent.
              </p>
            </div>

            {/* Mode toggle */}
            <div className="space-y-1">
              <Label
                htmlFor="mode"
                className="text-[10px] font-medium text-zinc-700 dark:text-zinc-300"
              >
                Mode
              </Label>
              <Select
                value={mode}
                onValueChange={(v) => setMode(v as PlaygroundMode)}
              >
                <SelectTrigger id="mode" className="h-8 text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ai-reply" className="text-[11px]">
                    ai-reply (normal inbound response)
                  </SelectItem>
                  <SelectItem value="re-engage" className="text-[11px]">
                    re-engage (RE-ENGAGE BOT status trigger)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[9px] text-zinc-500 dark:text-zinc-500">
                {mode === "ai-reply"
                  ? "Simulates what the bot would say in response to an inbound SMS."
                  : "Simulates what the bot would send when a user drops a lead into the RE-ENGAGE BOT status."}
              </p>
            </div>

            {/* Inbound override */}
            <div className="space-y-1">
              <Label
                htmlFor="inbound-override"
                className="text-[10px] font-medium text-zinc-700 dark:text-zinc-300"
              >
                Simulated inbound message{" "}
                <span className="text-zinc-400 font-normal">(optional)</span>
              </Label>
              <Textarea
                id="inbound-override"
                value={inboundOverride}
                onChange={(e) => setInboundOverride(e.target.value)}
                placeholder="Leave empty to use the lead's actual most recent inbound. Or type what you want the lead to have said."
                rows={2}
                className="text-[11px] resize-none"
                maxLength={2000}
              />
            </div>

            {/* Advanced toggle */}
            <button
              type="button"
              onClick={() => setShowAdvanced((s) => !s)}
              className="flex items-center gap-1 text-[10px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              {showAdvanced ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Advanced: custom system prompt
            </button>

            {showAdvanced && (
              <div className="space-y-1 pl-4 border-l-2 border-amber-200 dark:border-amber-900">
                <div className="flex items-center gap-1.5">
                  <Label
                    htmlFor="system-prompt-override"
                    className="text-[10px] font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    System prompt override
                  </Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-amber-500" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-[10px]">
                      Replaces the bot&apos;s entire built system prompt.
                      Disables every guardrail, lead source rule, and
                      conversation state instruction. Use only for prompt
                      experimentation.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Textarea
                  id="system-prompt-override"
                  value={systemPromptOverride}
                  onChange={(e) => setSystemPromptOverride(e.target.value)}
                  placeholder="You are a helpful assistant that..."
                  rows={4}
                  className="text-[10px] font-mono resize-y"
                  maxLength={20000}
                />
                <p className="text-[9px] text-amber-600 dark:text-amber-400">
                  ⚠ Disables all safety guardrails. Use with caution.
                </p>
              </div>
            )}

            {/* Submit */}
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                disabled={!canSubmit}
                className="h-8 px-4 text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {dryRun.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 mr-1.5" />
                    Simulate reply
                  </>
                )}
              </Button>
              <span className="text-[9px] text-zinc-500 dark:text-zinc-500">
                Rate limit: 10/min per agent
              </span>
            </div>

            {lastError && (
              <div className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 px-2.5 py-1.5">
                <p className="text-[10px] text-red-700 dark:text-red-300">
                  <AlertTriangle className="h-3 w-3 inline mr-1" />
                  {lastError}
                </p>
              </div>
            )}
          </form>

          {/* Result */}
          {currentResult && (
            <ResultPanel
              result={currentResult}
              onReuseInbound={handleReuseInbound}
            />
          )}

          {!currentResult && !dryRun.isPending && (
            <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-6 text-center">
              <MessageSquare className="h-6 w-6 text-zinc-400 mx-auto mb-2" />
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Enter a Close lead ID and click <strong>Simulate reply</strong>{" "}
                to see what the bot would say.
              </p>
            </div>
          )}
        </div>

        {/* Right column — history */}
        <div className="space-y-2 overflow-y-auto">
          <div className="sticky top-0 bg-zinc-50 dark:bg-zinc-950 pb-1 z-10">
            <div className="flex items-center gap-1.5">
              <History className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase">
                Recent runs
              </span>
            </div>
          </div>
          {historyLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
            </div>
          ) : history.length === 0 ? (
            <div className="rounded-md border border-dashed border-zinc-300 dark:border-zinc-700 p-3 text-center">
              <Clock className="h-4 w-4 text-zinc-400 mx-auto mb-1" />
              <p className="text-[9px] text-zinc-500 dark:text-zinc-400">
                No playground runs yet. Your test history will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {history.map((run) => (
                <HistoryItem
                  key={run.id}
                  run={run}
                  onSelect={handleSelectHistory}
                  onDelete={handleDeleteRun}
                  isDeleting={deleteRun.isPending}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
