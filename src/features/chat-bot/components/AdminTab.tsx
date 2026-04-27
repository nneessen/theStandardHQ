// src/features/chat-bot/components/AdminTab.tsx
// Super-admin panel for managing all users' SMS bots and voice agents.

import { useState, useMemo } from "react";
import {
  ArrowLeft,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  Bot,
  Loader2,
  Phone,
  Link2,
  BarChart3,
  Settings,
  Mic,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useAdminListAgents,
  useAdminGetAgent,
  useAdminGetCloseStatus,
  useAdminGetCalendlyStatus,
  useAdminGetGoogleStatus,
  useAdminGetUsage,
  useAdminGetMonitoring,
  useAdminGetVoiceSetupState,
  useAdminGetVoiceEntitlement,
  useAdminGetVoiceUsage,
  useAdminUpdateConfig,
  useAdminGrantTeamAccess,
  useAdminRevokeTeamAccess,
  type AdminAgentListItem,
  type AdminTeamOverride,
} from "../hooks/useChatBotAdmin";
import { useQueryClient } from "@tanstack/react-query";
import { adminKeys } from "../hooks/useChatBotAdmin";

// ─── Status Badge Helper ────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { className: string; icon: React.ElementType; label?: string }
  > = {
    active: {
      className:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
      icon: CheckCircle2,
    },
    failed: {
      className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
      icon: XCircle,
    },
    pending: {
      className:
        "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
      icon: Clock,
    },
    not_provisioned: {
      className:
        "bg-v2-card-tinted text-v2-ink-muted dark:bg-v2-card-tinted dark:text-v2-ink-subtle",
      icon: Clock,
      label: "Has Addon",
    },
    override_only: {
      className:
        "bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400",
      icon: ShieldCheck,
      label: "Override Only",
    },
  };
  const c = config[status] || config.pending;
  const Icon = c.icon;
  return (
    <Badge className={cn("text-[9px] h-4 px-1.5 gap-0.5", c.className)}>
      <Icon className="h-2.5 w-2.5" />
      {c.label || status}
    </Badge>
  );
}

// ─── List View ──────────────────────────────────────────────────

function AgentListView({
  onSelectUser,
}: {
  onSelectUser: (userId: string) => void;
}) {
  const { data, isLoading, error } = useAdminListAgents();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const grantAccess = useAdminGrantTeamAccess();
  const revokeAccess = useAdminRevokeTeamAccess();
  const [grantUserId, setGrantUserId] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [showGrantForm, setShowGrantForm] = useState(false);

  const agents = data?.agents ?? [];
  const overrides = data?.teamOverrides ?? [];
  const overrideMap = useMemo(() => {
    const map: Record<string, AdminTeamOverride> = {};
    for (const o of overrides) map[o.user_id] = o;
    return map;
  }, [overrides]);

  const filtered = useMemo(() => {
    let result = agents;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.userName?.toLowerCase().includes(q) ||
          a.userEmail?.toLowerCase().includes(q) ||
          a.user_id.toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((a) => a.provisioning_status === statusFilter);
    }
    return result;
  }, [agents, search, statusFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-[11px] text-red-500">
        Failed to load agents: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-v2-ink-subtle" />
          <input
            type="text"
            placeholder="Search by name, email, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-7 pr-2 py-1.5 text-[11px] bg-v2-card border border-v2-ring dark:border-v2-ring-strong rounded"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-[11px] px-2 py-1.5 bg-v2-card border border-v2-ring dark:border-v2-ring-strong rounded"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
          <option value="not_provisioned">Has Addon (Not Provisioned)</option>
          <option value="override_only">Override Only</option>
        </select>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[10px]"
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: adminKeys.agents() })
          }
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Refresh
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[10px]"
          onClick={() => setShowGrantForm(!showGrantForm)}
        >
          <Users className="h-3 w-3 mr-1" />
          Grant Access
        </Button>
      </div>

      {/* Grant Team Access Form */}
      {showGrantForm && (
        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded text-[11px] space-y-1.5">
          <div className="font-medium text-indigo-700 dark:text-indigo-300">
            Grant Team Access Override
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="User ID (UUID)"
              value={grantUserId}
              onChange={(e) => setGrantUserId(e.target.value)}
              className="flex-1 px-2 py-1 bg-v2-card border border-v2-ring dark:border-v2-ring-strong rounded text-[11px]"
            />
            <input
              type="text"
              placeholder="Reason (optional)"
              value={grantReason}
              onChange={(e) => setGrantReason(e.target.value)}
              className="flex-1 px-2 py-1 bg-v2-card border border-v2-ring dark:border-v2-ring-strong rounded text-[11px]"
            />
            <Button
              size="sm"
              className="h-6 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={!grantUserId.trim() || grantAccess.isPending}
              onClick={() => {
                grantAccess.mutate(
                  {
                    userId: grantUserId.trim(),
                    reason: grantReason.trim() || undefined,
                  },
                  {
                    onSuccess: () => {
                      setGrantUserId("");
                      setGrantReason("");
                      setShowGrantForm(false);
                    },
                  },
                );
              }}
            >
              {grantAccess.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Grant"
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
        {filtered.length} agent{filtered.length !== 1 ? "s" : ""} ·{" "}
        {overrides.length} team override{overrides.length !== 1 ? "s" : ""}
      </div>

      {/* Table */}
      <div className="border border-v2-ring dark:border-v2-ring-strong rounded overflow-hidden">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-v2-canvas dark:bg-v2-card-tinted/50 border-b border-v2-ring dark:border-v2-ring-strong">
              <th className="text-left px-2 py-1.5 font-medium text-v2-ink-muted dark:text-v2-ink-subtle">
                User
              </th>
              <th className="text-left px-2 py-1.5 font-medium text-v2-ink-muted dark:text-v2-ink-subtle">
                Status
              </th>
              <th className="text-left px-2 py-1.5 font-medium text-v2-ink-muted dark:text-v2-ink-subtle">
                Tier
              </th>
              <th className="text-center px-2 py-1.5 font-medium text-v2-ink-muted dark:text-v2-ink-subtle">
                Exempt
              </th>
              <th className="text-center px-2 py-1.5 font-medium text-v2-ink-muted dark:text-v2-ink-subtle">
                Team Override
              </th>
              <th className="text-right px-2 py-1.5 font-medium text-v2-ink-muted dark:text-v2-ink-subtle">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((agent) => (
              <AgentRow
                key={agent.id}
                agent={agent}
                override={overrideMap[agent.user_id]}
                onSelect={() => onSelectUser(agent.user_id)}
                onRevokeAccess={() =>
                  revokeAccess.mutate({ userId: agent.user_id })
                }
                onGrantAccess={() =>
                  grantAccess.mutate({
                    userId: agent.user_id,
                    reason: "Admin panel quick grant",
                  })
                }
                isRevoking={revokeAccess.isPending}
                isGranting={grantAccess.isPending}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="text-center py-6 text-v2-ink-subtle dark:text-v2-ink-muted"
                >
                  No agents found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AgentRow({
  agent,
  override,
  onSelect,
  onRevokeAccess,
  onGrantAccess,
  isRevoking,
  isGranting,
}: {
  agent: AdminAgentListItem;
  override?: AdminTeamOverride;
  onSelect: () => void;
  onRevokeAccess: () => void;
  onGrantAccess: () => void;
  isRevoking: boolean;
  isGranting: boolean;
}) {
  return (
    <tr className="border-b border-v2-ring dark:border-v2-ring hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/30 transition-colors">
      <td className="px-2 py-1.5">
        <div className="font-medium text-v2-ink dark:text-v2-ink">
          {agent.userName || "\u2014"}
        </div>
        <div className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle truncate max-w-[200px]">
          {agent.userEmail || agent.user_id}
        </div>
      </td>
      <td className="px-2 py-1.5">
        <StatusBadge status={agent.provisioning_status} />
      </td>
      <td className="px-2 py-1.5 text-v2-ink-muted dark:text-v2-ink-subtle">
        {agent.tier_id || "\u2014"}
      </td>
      <td className="px-2 py-1.5 text-center">
        {agent.billing_exempt ? (
          <Badge className="text-[9px] h-4 px-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            Yes
          </Badge>
        ) : (
          <span className="text-v2-ink-subtle">{"\u2014"}</span>
        )}
      </td>
      <td className="px-2 py-1.5 text-center">
        {override ? (
          <div className="flex items-center justify-center gap-1">
            <Badge className="text-[9px] h-4 px-1.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
              <ShieldCheck className="h-2.5 w-2.5 mr-0.5" />
              Granted
            </Badge>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRevokeAccess();
              }}
              disabled={isRevoking}
              className="text-[9px] text-red-500 hover:text-red-700 disabled:opacity-50"
              title="Revoke"
            >
              <ShieldOff className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onGrantAccess();
            }}
            disabled={isGranting}
            className="text-[9px] text-indigo-500 hover:text-indigo-700 disabled:opacity-50"
            title="Grant team access"
          >
            <ShieldCheck className="h-3 w-3" />
          </button>
        )}
      </td>
      <td className="px-2 py-1.5 text-right">
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[10px] px-2"
          onClick={onSelect}
        >
          Manage
        </Button>
      </td>
    </tr>
  );
}

// ─── Detail Panel ───────────────────────────────────────────────

type DetailTab =
  | "sms-config"
  | "voice"
  | "connections"
  | "usage"
  | "team-access";

function AdminUserPanel({
  userId,
  agentListItem,
  override,
  onBack,
}: {
  userId: string;
  agentListItem: AdminAgentListItem;
  override?: AdminTeamOverride;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>("sms-config");

  const { data: agent, isLoading: agentLoading } = useAdminGetAgent(userId);
  const updateConfig = useAdminUpdateConfig(userId);

  const detailTabs: {
    id: DetailTab;
    label: string;
    icon: React.ElementType;
  }[] = [
    { id: "sms-config", label: "SMS Bot Config", icon: Settings },
    { id: "voice", label: "Voice Agent", icon: Mic },
    { id: "connections", label: "Connections", icon: Link2 },
    { id: "usage", label: "Usage & Monitoring", icon: BarChart3 },
    { id: "team-access", label: "Team Access", icon: Users },
  ];

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[10px]"
          onClick={onBack}
        >
          <ArrowLeft className="h-3 w-3 mr-1" />
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Bot className="h-3.5 w-3.5 text-v2-ink-muted" />
            <span className="text-[12px] font-semibold text-v2-ink dark:text-v2-ink">
              {agentListItem.userName || "Unknown User"}
            </span>
            <StatusBadge status={agentListItem.provisioning_status} />
          </div>
          <div className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle ml-5">
            {agentListItem.userEmail} · {userId}
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-0.5 bg-v2-card-tinted dark:bg-v2-card-tinted/50 rounded-md p-0.5">
        {detailTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded transition-all",
              activeTab === tab.id
                ? "bg-v2-card shadow-sm text-v2-ink dark:text-v2-ink"
                : "text-v2-ink-muted dark:text-v2-ink-subtle hover:text-v2-ink dark:hover:text-v2-ink-subtle",
            )}
          >
            <tab.icon className="h-3 w-3" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-v2-card border border-v2-ring dark:border-v2-ring rounded-lg p-3">
        {agentLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
          </div>
        ) : activeTab === "sms-config" ? (
          <SmsConfigPanel agent={agent} updateConfig={updateConfig} />
        ) : activeTab === "voice" ? (
          <VoicePanel userId={userId} />
        ) : activeTab === "connections" ? (
          <ConnectionsPanel userId={userId} agent={agent} />
        ) : activeTab === "usage" ? (
          <UsagePanel userId={userId} />
        ) : activeTab === "team-access" ? (
          <TeamAccessPanel
            userId={userId}
            agentListItem={agentListItem}
            override={override}
          />
        ) : null}
      </div>
    </div>
  );
}

// ─── SMS Config Panel (Editable) ────────────────────────────────

function SmsConfigPanel({
  agent,
  updateConfig,
}: {
  agent: ReturnType<typeof useAdminGetAgent>["data"];
  updateConfig: ReturnType<typeof useAdminUpdateConfig>;
}) {
  if (!agent) {
    return (
      <div className="text-center py-6 text-[11px] text-v2-ink-subtle">
        <AlertTriangle className="h-4 w-4 mx-auto mb-1" />
        No active agent found for this user
      </div>
    );
  }

  return (
    <div className="space-y-3 text-[11px]">
      {/* Bot Enabled Toggle */}
      <div className="flex items-center justify-between py-1 border-b border-v2-ring dark:border-v2-ring">
        <span className="font-medium text-v2-ink dark:text-v2-ink-muted">
          Bot Enabled
        </span>
        <button
          onClick={() => updateConfig.mutate({ botEnabled: !agent.botEnabled })}
          disabled={updateConfig.isPending}
          className={cn(
            "px-3 py-1 rounded text-[10px] font-medium transition-colors",
            agent.botEnabled
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
              : "bg-v2-card-tinted text-v2-ink-muted dark:bg-v2-card-tinted dark:text-v2-ink-subtle",
          )}
        >
          {updateConfig.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : agent.botEnabled ? (
            "ON"
          ) : (
            "OFF"
          )}
        </button>
      </div>

      {/* Editable Agent Profile Fields */}
      <div className="grid grid-cols-2 gap-2">
        <EditableField
          label="Name"
          value={agent.name}
          fieldKey="name"
          updateConfig={updateConfig}
        />
        <EditableField
          label="Timezone"
          value={agent.timezone}
          fieldKey="timezone"
          updateConfig={updateConfig}
        />
        <EditableField
          label="Company"
          value={agent.companyName ?? ""}
          fieldKey="companyName"
          updateConfig={updateConfig}
        />
        <EditableField
          label="Job Title"
          value={agent.jobTitle ?? ""}
          fieldKey="jobTitle"
          updateConfig={updateConfig}
        />
        <EditableField
          label="Resident State"
          value={agent.residentState ?? ""}
          fieldKey="residentState"
          updateConfig={updateConfig}
        />
        <EditableField
          label="Website"
          value={agent.website ?? ""}
          fieldKey="website"
          updateConfig={updateConfig}
        />
        <EditableField
          label="Location"
          value={agent.location ?? ""}
          fieldKey="location"
          updateConfig={updateConfig}
        />
        <ToggleField
          label="Billing Exempt"
          value={agent.billingExempt ?? false}
          fieldKey="billingExempt"
          updateConfig={updateConfig}
        />
      </div>

      {/* Bio (editable) */}
      <EditableTextArea
        label="Bio"
        value={agent.bio ?? ""}
        fieldKey="bio"
        updateConfig={updateConfig}
      />

      {/* Lead Sources (editable as comma-separated) */}
      <div className="grid grid-cols-2 gap-2">
        <EditableList
          label="Lead Sources"
          values={agent.autoOutreachLeadSources || []}
          fieldKey="autoOutreachLeadSources"
          updateConfig={updateConfig}
        />
        <EditableList
          label="Outbound Lead Statuses"
          values={agent.allowedLeadStatuses || []}
          fieldKey="allowedLeadStatuses"
          updateConfig={updateConfig}
        />
      </div>
      <EditableList
        label="Blocked Lead Statuses"
        values={agent.blockedLeadStatuses || []}
        fieldKey="blockedLeadStatuses"
        updateConfig={updateConfig}
      />

      {/* Response Schedule (read-only — complex structure) */}
      {agent.responseSchedule && (
        <div>
          <div className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle mb-0.5">
            Response Schedule
          </div>
          <div className="text-[10px] text-v2-ink dark:text-v2-ink-muted bg-v2-canvas dark:bg-v2-card-tinted p-1.5 rounded">
            {agent.responseSchedule.days?.length ?? 0} days configured ·
            Reminders: {agent.remindersEnabled ? "Enabled" : "Disabled"}
          </div>
        </div>
      )}

      {/* Business Hours (read-only — complex structure) */}
      {agent.businessHours && (
        <div>
          <div className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle mb-0.5">
            Business Hours
          </div>
          <div className="text-[10px] text-v2-ink dark:text-v2-ink-muted bg-v2-canvas dark:bg-v2-card-tinted p-1.5 rounded">
            Days: {agent.businessHours.days?.join(", ")} ·{" "}
            {agent.businessHours.startTime} – {agent.businessHours.endTime}
          </div>
        </div>
      )}

      {/* Limits */}
      <div className="grid grid-cols-2 gap-2">
        <FieldDisplay
          label="Daily Message Limit"
          value={agent.dailyMessageLimit ?? "Unlimited"}
        />
        <FieldDisplay
          label="Max Messages/Conversation"
          value={agent.maxMessagesPerConversation ?? "Unlimited"}
        />
      </div>

      {/* Voice Config Toggles */}
      <div className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wider mt-2">
        Voice Settings
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ToggleField
          label="Voice Enabled"
          value={agent.voiceEnabled ?? false}
          fieldKey="voiceEnabled"
          updateConfig={updateConfig}
        />
        <ToggleField
          label="Voice Follow-Up"
          value={agent.voiceFollowUpEnabled ?? false}
          fieldKey="voiceFollowUpEnabled"
          updateConfig={updateConfig}
        />
        <ToggleField
          label="After-Hours Inbound"
          value={agent.afterHoursInboundEnabled ?? false}
          fieldKey="afterHoursInboundEnabled"
          updateConfig={updateConfig}
        />
        <ToggleField
          label="Reminders"
          value={agent.remindersEnabled ?? false}
          fieldKey="remindersEnabled"
          updateConfig={updateConfig}
        />
      </div>
    </div>
  );
}

// ─── Editable Field Components ──────────────────────────────────

function EditableField({
  label,
  value,
  fieldKey,
  updateConfig,
}: {
  label: string;
  value: string;
  fieldKey: string;
  updateConfig: ReturnType<typeof useAdminUpdateConfig>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const save = () => {
    if (draft !== value) {
      updateConfig.mutate({ [fieldKey]: draft || null });
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div>
        <div className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle">
          {label}
        </div>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          autoFocus
          className="w-full px-1.5 py-0.5 text-[11px] bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>
    );
  }

  return (
    <div
      className="cursor-pointer group"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
    >
      <div className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle">
        {label}
      </div>
      <div className="text-v2-ink dark:text-v2-ink-muted truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
        {value || "\u2014"}
        <span className="invisible group-hover:visible text-[9px] text-blue-400 ml-1">
          edit
        </span>
      </div>
    </div>
  );
}

function EditableTextArea({
  label,
  value,
  fieldKey,
  updateConfig,
}: {
  label: string;
  value: string;
  fieldKey: string;
  updateConfig: ReturnType<typeof useAdminUpdateConfig>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const save = () => {
    if (draft !== value) {
      updateConfig.mutate({ [fieldKey]: draft || null });
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div>
        <div className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle mb-0.5">
          {label}
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          autoFocus
          rows={4}
          className="w-full px-1.5 py-1 text-[10px] bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded outline-none focus:ring-1 focus:ring-blue-400 resize-y"
        />
        <div className="flex justify-end mt-0.5">
          <Button size="sm" className="h-5 px-2 text-[9px]" onClick={save}>
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="cursor-pointer group"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
    >
      <div className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle mb-0.5">
        {label}
      </div>
      <div className="text-v2-ink dark:text-v2-ink-muted bg-v2-canvas dark:bg-v2-card-tinted p-1.5 rounded text-[10px] whitespace-pre-wrap group-hover:border group-hover:border-blue-300 dark:group-hover:border-blue-700 transition-colors">
        {value || <span className="text-v2-ink-subtle">Click to add...</span>}
        <span className="invisible group-hover:visible text-[9px] text-blue-400 ml-1">
          edit
        </span>
      </div>
    </div>
  );
}

function EditableList({
  label,
  values,
  fieldKey,
  updateConfig,
}: {
  label: string;
  values: string[];
  fieldKey: string;
  updateConfig: ReturnType<typeof useAdminUpdateConfig>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(values.join(", "));

  const save = () => {
    const newValues = draft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const changed = JSON.stringify(newValues) !== JSON.stringify(values);
    if (changed) {
      updateConfig.mutate({ [fieldKey]: newValues });
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div>
        <div className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle mb-0.5">
          {label} (comma-separated)
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDraft(values.join(", "));
              setEditing(false);
            }
          }}
          autoFocus
          rows={2}
          className="w-full px-1.5 py-1 text-[10px] bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded outline-none focus:ring-1 focus:ring-blue-400 resize-y"
        />
        <div className="flex justify-end mt-0.5">
          <Button size="sm" className="h-5 px-2 text-[9px]" onClick={save}>
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="cursor-pointer group"
      onClick={() => {
        setDraft(values.join(", "));
        setEditing(true);
      }}
    >
      <div className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle mb-0.5">
        {label} ({values.length})
      </div>
      <div className="flex flex-wrap gap-1 group-hover:opacity-75 transition-opacity">
        {values.map((s) => (
          <Badge key={s} variant="secondary" className="text-[9px] h-4 px-1.5">
            {s}
          </Badge>
        ))}
        {values.length === 0 && (
          <span className="text-v2-ink-subtle">Click to add...</span>
        )}
        <span className="invisible group-hover:visible text-[9px] text-blue-400">
          edit
        </span>
      </div>
    </div>
  );
}

function ToggleField({
  label,
  value,
  fieldKey,
  updateConfig,
}: {
  label: string;
  value: boolean;
  fieldKey: string;
  updateConfig: ReturnType<typeof useAdminUpdateConfig>;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-v2-ink-muted dark:text-v2-ink-subtle">{label}</span>
      <button
        onClick={() => updateConfig.mutate({ [fieldKey]: !value })}
        disabled={updateConfig.isPending}
        className={cn(
          "px-2 py-0.5 rounded text-[9px] font-medium transition-colors",
          value
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
            : "bg-v2-card-tinted text-v2-ink-muted dark:bg-v2-card-tinted dark:text-v2-ink-subtle",
        )}
      >
        {value ? "ON" : "OFF"}
      </button>
    </div>
  );
}

function FieldDisplay({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <div className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle">
        {label}
      </div>
      <div className="text-v2-ink dark:text-v2-ink-muted truncate">
        {value ?? "\u2014"}
      </div>
    </div>
  );
}

// ─── Voice Panel ────────────────────────────────────────────────

function VoicePanel({ userId }: { userId: string }) {
  const { data: setupState, isLoading: setupLoading } =
    useAdminGetVoiceSetupState(userId);
  const { data: entitlement, isLoading: entLoading } =
    useAdminGetVoiceEntitlement(userId);
  const { data: voiceUsage, isLoading: usageLoading } =
    useAdminGetVoiceUsage(userId);

  const isLoading = setupLoading || entLoading || usageLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  // deno-lint-ignore no-explicit-any
  const state = setupState as any;
  // deno-lint-ignore no-explicit-any
  const ent = (entitlement as any)?.entitlement;
  // deno-lint-ignore no-explicit-any
  const usage = voiceUsage as any;

  return (
    <div className="space-y-3 text-[11px]">
      <div className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wider">
        Voice Setup State
      </div>

      {state ? (
        <div className="grid grid-cols-2 gap-2">
          <FieldDisplay
            label="Next Action"
            value={state.nextAction?.label || state.nextAction?.key || "N/A"}
          />
          <FieldDisplay
            label="Agent Exists"
            value={state.agent?.exists ? "Yes" : "No"}
          />
          <FieldDisplay
            label="Published"
            value={state.agent?.published ? "Yes" : "No"}
          />
          <FieldDisplay
            label="Close Connected"
            value={state.connections?.close?.connected ? "Yes" : "No"}
          />
          <FieldDisplay
            label="Retell Connected"
            value={state.connections?.retell?.connected ? "Yes" : "No"}
          />
          <FieldDisplay
            label="Entitlement Active"
            value={state.readiness?.entitlementActive ? "Yes" : "No"}
          />
        </div>
      ) : (
        <div className="text-v2-ink-subtle">No voice setup state available</div>
      )}

      <div className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wider mt-3">
        Voice Entitlement
      </div>

      {ent ? (
        <div className="grid grid-cols-2 gap-2">
          <FieldDisplay label="Status" value={ent.status} />
          <FieldDisplay label="Plan Code" value={ent.planCode} />
          <FieldDisplay label="Included Minutes" value={ent.includedMinutes} />
          <FieldDisplay
            label="Hard Limit Minutes"
            value={ent.hardLimitMinutes}
          />
          <FieldDisplay
            label="Allow Overage"
            value={ent.allowOverage ? "Yes" : "No"}
          />
        </div>
      ) : (
        <div className="text-v2-ink-subtle">No voice entitlement</div>
      )}

      <div className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wider mt-3">
        Voice Usage
      </div>

      {usage ? (
        <div className="grid grid-cols-2 gap-2">
          <FieldDisplay
            label="Minutes Used"
            value={usage.minutesUsed ?? usage.totalMinutesUsed ?? "N/A"}
          />
          <FieldDisplay
            label="Calls"
            value={usage.totalCalls ?? usage.callCount ?? "N/A"}
          />
        </div>
      ) : (
        <div className="text-v2-ink-subtle">No voice usage data</div>
      )}
    </div>
  );
}

// ─── Connections Panel ──────────────────────────────────────────

function ConnectionsPanel({
  userId,
  agent,
}: {
  userId: string;
  agent: ReturnType<typeof useAdminGetAgent>["data"];
}) {
  const { data: closeStatus, isLoading: closeLoading } =
    useAdminGetCloseStatus(userId);
  const { data: calendlyStatus, isLoading: calendlyLoading } =
    useAdminGetCalendlyStatus(userId);
  const { data: googleStatus, isLoading: googleLoading } =
    useAdminGetGoogleStatus(userId);

  const isLoading = closeLoading || calendlyLoading || googleLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  return (
    <div className="space-y-3 text-[11px]">
      <div className="text-[10px] text-v2-ink-subtle italic">
        OAuth connections are read-only. Connect/disconnect flows require the
        user's own browser session.
      </div>

      <ConnectionRow
        name="Close CRM"
        icon={Phone}
        connected={
          closeStatus?.connected ??
          agent?.connections?.close?.connected ??
          false
        }
        details={
          closeStatus?.connected
            ? `Org: ${closeStatus?.orgName || "Unknown"}`
            : undefined
        }
      />

      <ConnectionRow
        name="Calendly"
        icon={Link2}
        connected={
          calendlyStatus?.connected ??
          agent?.connections?.calendly?.connected ??
          false
        }
        details={
          calendlyStatus?.connected
            ? `${calendlyStatus?.userName || ""} ${calendlyStatus?.userEmail ? `(${calendlyStatus.userEmail})` : ""}`.trim() ||
              undefined
            : undefined
        }
      />

      <ConnectionRow
        name="Google Calendar"
        icon={Link2}
        connected={
          googleStatus?.connected ??
          agent?.connections?.google?.connected ??
          false
        }
        details={
          googleStatus?.connected
            ? `${googleStatus?.userEmail || ""} ${googleStatus?.calendarId ? `Calendar: ${googleStatus.calendarId}` : ""}`.trim() ||
              undefined
            : undefined
        }
      />

      {/* Retell from agent data */}
      <ConnectionRow
        name="Retell (Voice)"
        icon={Mic}
        connected={agent?.connections?.retell?.connected ?? false}
        details={
          agent?.connections?.retell?.connected
            ? `Agent: ${agent.connections?.retell?.retellAgentId || "N/A"} · Number: ${agent.connections?.retell?.fromNumber || "N/A"}`
            : undefined
        }
      />
    </div>
  );
}

function ConnectionRow({
  name,
  icon: Icon,
  connected,
  details,
}: {
  name: string;
  icon: React.ElementType;
  connected: boolean;
  details?: string;
}) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-v2-ring dark:border-v2-ring last:border-0">
      <Icon className="h-3.5 w-3.5 text-v2-ink-subtle" />
      <div className="flex-1">
        <div className="font-medium text-v2-ink dark:text-v2-ink-muted">
          {name}
        </div>
        {details && (
          <div className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
            {details}
          </div>
        )}
      </div>
      <Badge
        className={cn(
          "text-[9px] h-4 px-1.5",
          connected
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
            : "bg-v2-card-tinted text-v2-ink-muted dark:bg-v2-card-tinted dark:text-v2-ink-subtle",
        )}
      >
        {connected ? "Connected" : "Not Connected"}
      </Badge>
    </div>
  );
}

// ─── Usage Panel ────────────────────────────────────────────────

function UsagePanel({ userId }: { userId: string }) {
  const { data: usage, isLoading: usageLoading } = useAdminGetUsage(userId);
  const { data: monitoring, isLoading: monitoringLoading } =
    useAdminGetMonitoring(userId);

  if (usageLoading || monitoringLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  return (
    <div className="space-y-3 text-[11px]">
      <div className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wider">
        Lead Usage
      </div>

      {usage ? (
        <div className="grid grid-cols-2 gap-2">
          <FieldDisplay label="Leads Used" value={usage.leadsUsed} />
          <FieldDisplay label="Lead Limit" value={usage.leadLimit} />
          <FieldDisplay label="Period Start" value={usage.periodStart} />
          <FieldDisplay label="Period End" value={usage.periodEnd} />
          <FieldDisplay label="Tier" value={usage.tierName} />
        </div>
      ) : (
        <div className="text-v2-ink-subtle">No usage data available</div>
      )}

      <div className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wider mt-3">
        Monitoring
      </div>

      {monitoring ? (
        <div className="bg-v2-canvas dark:bg-v2-card-tinted p-2 rounded text-[10px] font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
          {JSON.stringify(monitoring, null, 2)}
        </div>
      ) : (
        <div className="text-v2-ink-subtle">No monitoring data available</div>
      )}
    </div>
  );
}

// ─── Team Access Panel ──────────────────────────────────────────

function TeamAccessPanel({
  userId,
  agentListItem,
  override,
}: {
  userId: string;
  agentListItem: AdminAgentListItem;
  override?: AdminTeamOverride;
}) {
  const updateConfig = useAdminUpdateConfig(userId);
  const grantAccess = useAdminGrantTeamAccess();
  const revokeAccess = useAdminRevokeTeamAccess();
  const [reason, setReason] = useState("");

  return (
    <div className="space-y-3 text-[11px]">
      {/* Current Status */}
      <div className="grid grid-cols-2 gap-2">
        <ToggleField
          label="Billing Exempt"
          value={agentListItem.billing_exempt ?? false}
          fieldKey="billingExempt"
          updateConfig={updateConfig}
        />
        <FieldDisplay label="Tier ID" value={agentListItem.tier_id || "None"} />
      </div>

      {/* Team Override Status */}
      <div className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wider mt-3">
        Team Access Override
      </div>

      {override ? (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded p-2 space-y-1">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="font-medium text-indigo-700 dark:text-indigo-300">
              Override Active
            </span>
          </div>
          <div className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle space-y-0.5">
            <div>Granted by: {override.granted_by || "System"}</div>
            <div>Reason: {override.reason || "No reason provided"}</div>
            <div>
              Created: {new Date(override.created_at).toLocaleDateString()}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] mt-1 text-red-600 border-red-200 hover:bg-red-50"
            disabled={revokeAccess.isPending}
            onClick={() => revokeAccess.mutate({ userId })}
          >
            {revokeAccess.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <ShieldOff className="h-3 w-3 mr-1" />
            )}
            Revoke Override
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="text-v2-ink-muted dark:text-v2-ink-subtle">
            No team access override is active for this user.
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="flex-1 px-2 py-1 bg-v2-canvas dark:bg-v2-card-tinted border border-v2-ring dark:border-v2-ring-strong rounded text-[11px]"
            />
            <Button
              size="sm"
              className="h-6 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={grantAccess.isPending}
              onClick={() =>
                grantAccess.mutate(
                  { userId, reason: reason.trim() || undefined },
                  { onSuccess: () => setReason("") },
                )
              }
            >
              {grantAccess.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <ShieldCheck className="h-3 w-3 mr-1" />
              )}
              Grant Override
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────

export function AdminTab() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { data } = useAdminListAgents();

  const selectedAgent = useMemo(() => {
    if (!selectedUserId || !data?.agents) return null;
    return data.agents.find((a) => a.user_id === selectedUserId) || null;
  }, [selectedUserId, data?.agents]);

  const selectedOverride = useMemo(() => {
    if (!selectedUserId || !data?.teamOverrides) return undefined;
    return data.teamOverrides.find((o) => o.user_id === selectedUserId);
  }, [selectedUserId, data?.teamOverrides]);

  if (selectedUserId && selectedAgent) {
    return (
      <AdminUserPanel
        userId={selectedUserId}
        agentListItem={selectedAgent}
        override={selectedOverride}
        onBack={() => setSelectedUserId(null)}
      />
    );
  }

  return <AgentListView onSelectUser={setSelectedUserId} />;
}
