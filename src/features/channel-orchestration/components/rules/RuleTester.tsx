// src/features/channel-orchestration/components/rules/RuleTester.tsx
import { useState } from "react";
import {
  Play,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useChatBotCloseLeadStatuses } from "@/features/chat-bot";
import {
  useCloseLeadSources,
  useEvaluateOrchestration,
} from "../../hooks/useOrchestration";
import type {
  OrchestrationDecision,
  ChannelType,
  ConversationStatus,
} from "../../types/orchestration.types";
import { CONVERSATION_STATUSES } from "../../types/orchestration.types";

export function RuleTester() {
  const [open, setOpen] = useState(false);
  const [leadStatus, setLeadStatus] = useState("");
  const [leadSource, setLeadSource] = useState("");
  const [convStatus, setConvStatus] = useState("");
  const [channel, setChannel] = useState<ChannelType>("sms");

  const { data: leadStatuses = [] } = useChatBotCloseLeadStatuses(open);
  const { data: leadSources = [] } = useCloseLeadSources(open);
  const evaluate = useEvaluateOrchestration();

  const handleEvaluate = () => {
    evaluate.mutate({
      leadStatus: leadStatus || undefined,
      leadSource: leadSource || undefined,
      conversationStatus: (convStatus || undefined) as
        | ConversationStatus
        | undefined,
      channel,
    });
  };

  const result = evaluate.data as OrchestrationDecision | undefined;

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-md">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full px-2 py-1.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-t-md"
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <Play className="h-3 w-3" />
        Test Rules
      </button>

      {open && (
        <div className="px-2 pb-2 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <div>
              <span className="text-[9px] text-zinc-500">Lead Status</span>
              <Select value={leadStatus} onValueChange={setLeadStatus}>
                <SelectTrigger className="h-7 text-[10px]">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__" className="text-[10px]">
                    Any
                  </SelectItem>
                  {leadStatuses.map((s) => (
                    <SelectItem
                      key={s.id}
                      value={s.label ?? s.id}
                      className="text-[10px]"
                    >
                      {s.label ?? s.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <span className="text-[9px] text-zinc-500">Lead Source</span>
              <Select value={leadSource} onValueChange={setLeadSource}>
                <SelectTrigger className="h-7 text-[10px]">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__" className="text-[10px]">
                    Any
                  </SelectItem>
                  {leadSources.map((s) => (
                    <SelectItem
                      key={s.id}
                      value={s.label}
                      className="text-[10px]"
                    >
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <span className="text-[9px] text-zinc-500">Conv Status</span>
              <Select value={convStatus} onValueChange={setConvStatus}>
                <SelectTrigger className="h-7 text-[10px]">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__" className="text-[10px]">
                    Any
                  </SelectItem>
                  {CONVERSATION_STATUSES.map((s) => (
                    <SelectItem
                      key={s.value}
                      value={s.value}
                      className="text-[10px]"
                    >
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <span className="text-[9px] text-zinc-500">Channel</span>
              <Select
                value={channel}
                onValueChange={(v) => setChannel(v as ChannelType)}
              >
                <SelectTrigger className="h-7 text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms" className="text-[10px]">
                    SMS
                  </SelectItem>
                  <SelectItem value="voice" className="text-[10px]">
                    Voice
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            size="sm"
            className="h-7 text-[10px]"
            onClick={handleEvaluate}
            disabled={evaluate.isPending}
          >
            <Play className="h-3 w-3 mr-1" />
            Evaluate
          </Button>

          {/* Result */}
          {result && (
            <div
              className={cn(
                "rounded p-2 text-[10px] space-y-1",
                result.allowed
                  ? "bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800"
                  : "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800",
              )}
            >
              <div className="flex items-center gap-1.5">
                {result.allowed ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-red-600" />
                )}
                <span className="font-medium">
                  {result.allowed ? "Allowed" : "Blocked"}
                </span>
              </div>
              <div className="text-zinc-600 dark:text-zinc-400">
                {result.reason}
              </div>
              {result.matchedRuleName && (
                <div className="flex items-center gap-1">
                  <span className="text-zinc-500">Matched:</span>
                  <Badge variant="secondary" className="h-4 px-1 text-[8px]">
                    {result.matchedRuleName}
                  </Badge>
                </div>
              )}
              <div className="flex items-center gap-1">
                <span className="text-zinc-500">Channels:</span>
                {result.allowedChannels.map((ch) => (
                  <Badge
                    key={ch}
                    variant="outline"
                    className="h-4 px-1 text-[8px]"
                  >
                    {ch === "sms" ? "SMS" : "Voice"}
                  </Badge>
                ))}
                <span className="text-zinc-500 ml-1">
                  prefer {result.preferredChannel === "sms" ? "SMS" : "Voice"}
                </span>
              </div>
              {result.cooldownUntil && (
                <div className="text-zinc-500">
                  Cooldown until:{" "}
                  {new Date(result.cooldownUntil).toLocaleString()}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
