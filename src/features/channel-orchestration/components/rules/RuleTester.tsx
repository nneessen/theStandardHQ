// src/features/channel-orchestration/components/rules/RuleTester.tsx
import { useState } from "react";
import {
  Play,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  CircleDot,
  Loader2,
  AlertCircle,
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
  OrchestrationRule,
  OrchestrationDecision,
  ChannelType,
  ConversationStatus,
  FallbackAction,
} from "../../types/orchestration.types";
import { CONVERSATION_STATUSES } from "../../types/orchestration.types";

interface ConditionCheck {
  label: string;
  passed: boolean | "skipped";
  detail: string;
}

interface RuleBreakdown {
  rule: OrchestrationRule;
  checks: ConditionCheck[];
  allPassed: boolean;
  isMatched: boolean;
}

/** Client-side condition checking — shows WHY each rule did or didn't match */
function evaluateRuleLocally(
  rule: OrchestrationRule,
  input: {
    leadStatus?: string;
    leadSource?: string;
    conversationStatus?: string;
  },
): ConditionCheck[] {
  const checks: ConditionCheck[] = [];
  const c = rule.conditions;

  // Lead Statuses
  if (c.leadStatuses?.length) {
    if (!input.leadStatus) {
      checks.push({
        label: "Lead Status",
        passed: "skipped",
        detail: `Requires: ${c.leadStatuses.join(", ")} — not specified in test`,
      });
    } else {
      const match = c.leadStatuses.some(
        (s) => s.toLowerCase() === input.leadStatus!.toLowerCase(),
      );
      checks.push({
        label: "Lead Status",
        passed: match,
        detail: match
          ? `"${input.leadStatus}" matches`
          : `Requires: ${c.leadStatuses.join(", ")} — got "${input.leadStatus}"`,
      });
    }
  }

  // Lead Sources
  if (c.leadSources?.length) {
    if (!input.leadSource) {
      checks.push({
        label: "Lead Source",
        passed: "skipped",
        detail: `Requires: ${c.leadSources.join(", ")} — not specified in test`,
      });
    } else {
      const match = c.leadSources.some(
        (s) => s.toLowerCase() === input.leadSource!.toLowerCase(),
      );
      checks.push({
        label: "Lead Source",
        passed: match,
        detail: match
          ? `"${input.leadSource}" matches`
          : `Requires: ${c.leadSources.join(", ")} — got "${input.leadSource}"`,
      });
    }
  }

  // Conversation Statuses
  if (c.conversationStatuses?.length) {
    const testConv = input.conversationStatus || "open";
    const match = c.conversationStatuses.includes(
      testConv as ConversationStatus,
    );
    checks.push({
      label: "Conv Status",
      passed: match,
      detail: match
        ? `"${testConv}" matches`
        : `Requires: ${c.conversationStatuses.join(", ")} — got "${testConv}"${!input.conversationStatus ? " (default)" : ""}`,
    });
  }

  // Time Window
  if (c.timeWindow) {
    const tw = c.timeWindow;
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const now = new Date();
    const dayOfWeek = now.getDay();
    const dayMatch = tw.days.includes(dayOfWeek);

    checks.push({
      label: "Time Window",
      passed: dayMatch ? true : false,
      detail: dayMatch
        ? `${tw.startTime}–${tw.endTime} ${tw.days.map((d) => dayNames[d]).join(", ")} — today (${dayNames[dayOfWeek]}) is included`
        : `${tw.startTime}–${tw.endTime} ${tw.days.map((d) => dayNames[d]).join(", ")} — today (${dayNames[dayOfWeek]}) is excluded`,
    });
  }

  // Channel History
  if (c.channelHistory) {
    const h = c.channelHistory;
    const parts: string[] = [];
    if (h.smsAttempts)
      parts.push(
        `SMS attempts ${h.smsAttempts.operator} ${h.smsAttempts.value}`,
      );
    if (h.voiceAttempts)
      parts.push(
        `Voice attempts ${h.voiceAttempts.operator} ${h.voiceAttempts.value}`,
      );
    if (h.lastSmsAgeMinutes)
      parts.push(
        `Last SMS age ${h.lastSmsAgeMinutes.operator} ${h.lastSmsAgeMinutes.value}min`,
      );
    if (h.lastVoiceAgeMinutes)
      parts.push(
        `Last voice age ${h.lastVoiceAgeMinutes.operator} ${h.lastVoiceAgeMinutes.value}min`,
      );
    if (h.lastVoiceOutcome?.length)
      parts.push(`Last voice outcome: ${h.lastVoiceOutcome.join(", ")}`);
    checks.push({
      label: "Channel History",
      passed: "skipped",
      detail: `${parts.join("; ")} — can't verify in test (requires real lead data)`,
    });
  }

  // Custom Fields
  if (c.customFieldConditions?.length) {
    checks.push({
      label: "Custom Fields",
      passed: "skipped",
      detail: `${c.customFieldConditions.length} condition(s) — can't verify in test`,
    });
  }

  // No conditions = catch-all
  if (checks.length === 0) {
    checks.push({
      label: "No conditions",
      passed: true,
      detail: "This rule matches everything (catch-all)",
    });
  }

  return checks;
}

interface Props {
  rules: OrchestrationRule[];
  fallbackAction: FallbackAction;
}

export function RuleTester({ rules, fallbackAction }: Props) {
  const [open, setOpen] = useState(false);
  const [leadStatus, setLeadStatus] = useState("");
  const [leadSource, setLeadSource] = useState("");
  const [convStatus, setConvStatus] = useState("");
  const [channel, setChannel] = useState<ChannelType>("sms");

  const { data: leadStatuses = [] } = useChatBotCloseLeadStatuses(open);
  const { data: leadSources = [] } = useCloseLeadSources(open);
  const evaluate = useEvaluateOrchestration();

  const clean = (v: string) => (v && v !== "__any__" ? v : undefined);

  const handleEvaluate = () => {
    evaluate.mutate({
      leadStatus: clean(leadStatus),
      leadSource: clean(leadSource),
      conversationStatus: clean(convStatus) as ConversationStatus | undefined,
      channel,
    });
  };

  const result = evaluate.data as OrchestrationDecision | undefined;

  // Build per-rule breakdown after evaluation
  const breakdowns: RuleBreakdown[] | null = result
    ? rules.map((rule) => {
        const checks = evaluateRuleLocally(rule, {
          leadStatus: clean(leadStatus),
          leadSource: clean(leadSource),
          conversationStatus: clean(convStatus),
        });
        const allPassed = checks.every(
          (c) => c.passed === true || c.passed === "skipped",
        );
        return {
          rule,
          checks,
          allPassed,
          isMatched: result.matchedRuleId === rule.id,
        };
      })
    : null;

  return (
    <div className="border border-border dark:border-border rounded-md">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full px-2 py-1.5 text-[10px] font-medium text-muted-foreground dark:text-muted-foreground hover:bg-background dark:hover:bg-card-tinted/50 rounded-t-md"
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
          <p className="text-[9px] text-muted-foreground">
            Simulate a lead to see which rule would fire. All conditions on a
            rule must pass for it to match. Rules are checked top-to-bottom —
            first match wins.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <div>
              <span className="text-[9px] text-muted-foreground">
                Lead Status
              </span>
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
              <span className="text-[9px] text-muted-foreground">
                Lead Source
              </span>
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
              <span className="text-[9px] text-muted-foreground">
                Conv Status
              </span>
              <Select value={convStatus} onValueChange={setConvStatus}>
                <SelectTrigger className="h-7 text-[10px]">
                  <SelectValue placeholder="open (default)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__" className="text-[10px]">
                    open (default)
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
              <span className="text-[9px] text-muted-foreground">Channel</span>
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
            {evaluate.isPending ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Play className="h-3 w-3 mr-1" />
            )}
            Evaluate
          </Button>

          {/* Result + Per-Rule Breakdown */}
          {result && (
            <div className="space-y-1.5">
              {/* Verdict */}
              <div
                className={cn(
                  "rounded p-2 text-[10px]",
                  result.matchedRuleId
                    ? "bg-info/10 border border-info/30"
                    : "bg-background dark:bg-card/50 border border-border dark:border-border",
                )}
              >
                <div className="flex items-center gap-1.5">
                  {result.matchedRuleId ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-info" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className="font-medium text-foreground dark:text-foreground">
                    {result.matchedRuleName
                      ? `Matched: ${result.matchedRuleName}`
                      : "No rules matched — using fallback"}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-muted-foreground">Result:</span>
                  {result.allowedChannels.map((ch) => (
                    <Badge
                      key={ch}
                      variant="outline"
                      className="h-4 px-1 text-[8px]"
                    >
                      {ch === "sms" ? "SMS" : "Voice"}
                    </Badge>
                  ))}
                  <span className="text-muted-foreground">
                    (prefer{" "}
                    {result.preferredChannel === "sms" ? "SMS" : "Voice"})
                  </span>
                </div>
              </div>

              {/* Per-Rule Breakdown */}
              <div className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider pt-1">
                Condition Breakdown
              </div>
              <div className="space-y-1">
                {breakdowns?.map(({ rule, checks, isMatched }, idx) => (
                  <div
                    key={rule.id}
                    className={cn(
                      "rounded border p-1.5 text-[10px]",
                      isMatched
                        ? "border-info/40 bg-info/10/50 dark:bg-info/10/10"
                        : "border-border dark:border-border",
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[9px] text-muted-foreground w-3 text-right shrink-0">
                        {idx + 1}.
                      </span>
                      {isMatched ? (
                        <CheckCircle2 className="h-3 w-3 text-info shrink-0" />
                      ) : (
                        <XCircle className="h-3 w-3 text-muted-foreground dark:text-muted-foreground shrink-0" />
                      )}
                      <span
                        className={cn(
                          "font-medium truncate",
                          isMatched ? "text-info" : "text-muted-foreground",
                          !rule.enabled && "line-through",
                        )}
                      >
                        {rule.name}
                        {!rule.enabled && " (disabled)"}
                      </span>
                      {isMatched && (
                        <Badge className="h-3.5 px-1 text-[7px] bg-info/15 text-info ml-auto shrink-0">
                          MATCHED
                        </Badge>
                      )}
                    </div>
                    <div className="ml-[18px] space-y-0.5">
                      {checks.map((check, ci) => (
                        <div
                          key={ci}
                          className="flex items-start gap-1 text-[9px]"
                        >
                          {check.passed === true ? (
                            <CheckCircle2 className="h-2.5 w-2.5 text-success shrink-0 mt-px" />
                          ) : check.passed === "skipped" ? (
                            <CircleDot className="h-2.5 w-2.5 text-muted-foreground dark:text-muted-foreground shrink-0 mt-px" />
                          ) : (
                            <XCircle className="h-2.5 w-2.5 text-destructive shrink-0 mt-px" />
                          )}
                          <span className="text-muted-foreground w-16 shrink-0">
                            {check.label}
                          </span>
                          <span
                            className={cn(
                              check.passed === true
                                ? "text-success"
                                : check.passed === "skipped"
                                  ? "text-muted-foreground"
                                  : "text-destructive",
                            )}
                          >
                            {check.detail}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Fallback row */}
                <div
                  className={cn(
                    "rounded border p-1.5 text-[10px]",
                    !result.matchedRuleId
                      ? "border-border dark:border-border bg-background dark:bg-card/50"
                      : "border-border dark:border-border",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {!result.matchedRuleId ? (
                      <AlertCircle className="h-3 w-3 text-muted-foreground shrink-0" />
                    ) : (
                      <CircleDot className="h-3 w-3 text-muted-foreground dark:text-muted-foreground shrink-0" />
                    )}
                    <span
                      className={cn(
                        "font-medium",
                        !result.matchedRuleId
                          ? "text-muted-foreground dark:text-muted-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      Fallback →{" "}
                      {fallbackAction.allowedChannels
                        .map((c) => (c === "sms" ? "SMS" : "Voice"))
                        .join(" + ")}{" "}
                      (prefer{" "}
                      {fallbackAction.preferredChannel === "sms"
                        ? "SMS"
                        : "Voice"}
                      )
                    </span>
                    {!result.matchedRuleId && (
                      <Badge className="h-3.5 px-1 text-[7px] bg-muted dark:bg-muted text-muted-foreground dark:text-muted-foreground ml-auto shrink-0">
                        ACTIVE
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
