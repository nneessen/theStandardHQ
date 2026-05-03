// src/features/hierarchy/components/IssuedPremiumTable.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import type { UserProfile } from "@/types/hierarchy.types";
// eslint-disable-next-line no-restricted-imports
import { policyRepository } from "@/services/policies";
// eslint-disable-next-line no-restricted-imports
import type { PolicyMetricRow } from "@/services/policies";
import { useCurrentUserProfile } from "@/hooks/admin";

interface IPMetrics {
  ip_total: number; // Sum of active policies in period
  ip_policies: number; // Count of active policies in period
  avg_premium: number; // Average premium per active policy
}

interface DateRangeFilter {
  start: string;
  end: string;
}

interface IssuedPremiumTableProps {
  agents: UserProfile[];
  owner?: UserProfile | null;
  isLoading?: boolean;
  dateRange?: DateRangeFilter;
}

// Lifecycle statuses for IP (Issued Premium)
const ISSUED_LIFECYCLE_STATUSES = ["active"];

async function fetchIPMetrics(
  agentIds: string[],
  dateRange?: DateRangeFilter,
): Promise<Map<string, IPMetrics>> {
  if (agentIds.length === 0) return new Map();

  const now = new Date();
  // Normalize dates to YYYY-MM-DD for comparison with DB date columns
  const pad = (n: number) => String(n).padStart(2, "0");
  const toDateStr = (isoOrDate: string): string => {
    if (isoOrDate.length === 10) return isoOrDate;
    const d = new Date(isoOrDate);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const startStr = toDateStr(
    dateRange
      ? dateRange.start
      : `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`,
  );
  const endStr = toDateStr(
    dateRange
      ? dateRange.end
      : `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
  );

  const allPolicies = await policyRepository.findMetricsByUserIds(agentIds);

  // Pre-group policies by user_id
  const policiesByUser = new Map<string, PolicyMetricRow[]>();
  for (const p of allPolicies) {
    if (!p.user_id) continue;
    const existing = policiesByUser.get(p.user_id);
    if (existing) {
      existing.push(p);
    } else {
      policiesByUser.set(p.user_id, [p]);
    }
  }

  const metricsMap = new Map<string, IPMetrics>();

  for (const agentId of agentIds) {
    const agentPolicies = policiesByUser.get(agentId) || [];

    // IP: lifecycle_status = 'active' + effective_date in range
    const activePolicies = agentPolicies.filter((p) => {
      if (!ISSUED_LIFECYCLE_STATUSES.includes(p.lifecycle_status || ""))
        return false;
      if (!p.effective_date) return false;
      return p.effective_date >= startStr && p.effective_date <= endStr;
    });

    const ip_total = activePolicies.reduce((sum, p) => {
      const val = parseFloat(String(p.annual_premium ?? 0));
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

    const ip_policies = activePolicies.length;
    const avg_premium = ip_policies > 0 ? ip_total / ip_policies : 0;

    metricsMap.set(agentId, { ip_total, ip_policies, avg_premium });
  }

  return metricsMap;
}

function IPRow({
  agent,
  depth,
  isExpanded,
  onToggle,
  hasChildren,
  metrics,
  isOwner,
}: {
  agent: UserProfile;
  depth: number;
  isExpanded: boolean;
  onToggle: () => void;
  hasChildren: boolean;
  metrics?: IPMetrics;
  isOwner?: boolean;
}) {
  const { ip_total, ip_policies, avg_premium } = metrics || {
    ip_total: 0,
    ip_policies: 0,
    avg_premium: 0,
  };

  return (
    <tr className="h-9 transition-colors hover:bg-background border-b border-border/60">
      {/* Agent Name with Hierarchy */}
      <td className="px-2 py-1.5 text-[11px] text-foreground">
        <div
          className="flex items-center gap-1"
          style={{ paddingLeft: `${depth * 16}px` }}
        >
          {hasChildren && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="h-4 w-4 p-0 text-muted-foreground"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          )}
          {!hasChildren && depth > 0 && (
            <span className="text-muted-foreground text-[10px] mr-1">└─</span>
          )}
          <span className="font-medium">
            {agent.first_name && agent.last_name
              ? `${agent.first_name} ${agent.last_name}`
              : agent.email}
          </span>
          {isOwner && (
            <span className="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-semibold bg-info/20 text-info ml-1">
              You
            </span>
          )}
          {agent.approval_status === "approved" && (
            <UserCheck className="h-3 w-3 text-success" />
          )}
        </div>
      </td>

      {/* IP (Issued Premium) */}
      <td className="px-2 py-1.5 text-right text-[11px] font-mono">
        {ip_total > 0 ? (
          <span className="font-bold text-info">
            {formatCurrency(ip_total)}
          </span>
        ) : (
          <span className="text-muted-foreground">$0</span>
        )}
      </td>

      {/* IP Policies Count */}
      <td className="px-2 py-1.5 text-center text-[11px] font-mono">
        {ip_policies > 0 ? (
          <span className="font-semibold text-foreground">{ip_policies}</span>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </td>

      {/* Average Premium */}
      <td className="px-2 py-1.5 text-right text-[11px] font-mono">
        {avg_premium > 0 ? (
          <span className="font-medium text-muted-foreground">
            {formatCurrency(avg_premium)}
          </span>
        ) : (
          <span className="text-muted-foreground">$0</span>
        )}
      </td>
    </tr>
  );
}

export function IssuedPremiumTable({
  agents,
  owner,
  isLoading,
  dateRange,
}: IssuedPremiumTableProps) {
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [metricsMap, setMetricsMap] = useState<Map<string, IPMetrics>>(
    new Map(),
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const { data: currentUserProfile } = useCurrentUserProfile();
  const viewerId = currentUserProfile?.id;

  const ownerId = owner?.id;

  const agentIdsKey = useMemo(() => {
    const ids = ownerId
      ? [ownerId, ...agents.map((a) => a.id)]
      : agents.map((a) => a.id);
    return ids.sort().join(",");
  }, [agents, ownerId]);

  useEffect(() => {
    if (!agentIdsKey) {
      setMetricsMap(new Map());
      return;
    }

    const agentIds = agentIdsKey.split(",");
    fetchIPMetrics(agentIds, dateRange)
      .then(setMetricsMap)
      .catch((err) => {
        console.error("Error fetching IP metrics:", err);
        toast.error("Failed to load IP metrics.");
        setMetricsMap(new Map());
      });
  }, [agentIdsKey, dateRange]);

  const agentsToDisplay = agents;

  // Build hierarchy structure (same logic as AgentTable)
  const getParentIdFromPath = (
    path: string | null | undefined,
    selfId: string,
  ): string | null => {
    if (!path) return null;
    const segments = path.split(".");
    const selfIndex = segments.indexOf(selfId);
    if (selfIndex <= 0) return null;
    return segments[selfIndex - 1];
  };

  const agentMap = new Map(agentsToDisplay.map((a) => [a.id, a]));
  const childrenMap = new Map<string, UserProfile[]>();

  agentsToDisplay.forEach((agent) => {
    const parentId =
      getParentIdFromPath(agent.hierarchy_path, agent.id) || agent.upline_id;
    if (parentId && agentMap.has(parentId)) {
      const children = childrenMap.get(parentId) || [];
      children.push(agent);
      childrenMap.set(parentId, children);
    }
  });

  const rootAgentsUnsorted = agentsToDisplay.filter((a) => {
    const parentId = getParentIdFromPath(a.hierarchy_path, a.id) || a.upline_id;
    return !parentId || !agentMap.has(parentId);
  });

  // Sort by IP total (highest first)
  const rootAgents = [...rootAgentsUnsorted].sort((a, b) => {
    const aMetrics = metricsMap.get(a.id);
    const bMetrics = metricsMap.get(b.id);
    return (bMetrics?.ip_total || 0) - (aMetrics?.ip_total || 0);
  });

  const toggleExpanded = (agentId: string) => {
    const newExpanded = new Set(expandedAgents);
    if (newExpanded.has(agentId)) {
      newExpanded.delete(agentId);
    } else {
      newExpanded.add(agentId);
    }
    setExpandedAgents(newExpanded);
  };

  // Pagination
  const totalRootAgents = rootAgents.length;
  const totalPages = Math.ceil(totalRootAgents / rowsPerPage);
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(1);
  }
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedRootAgents = rootAgents.slice(startIndex, endIndex);

  const handleRowsPerPageChange = (value: string) => {
    setRowsPerPage(Number(value));
    setCurrentPage(1);
  };

  const renderRows = (
    agentList: UserProfile[],
    depth = 0,
  ): React.ReactElement[] => {
    const rows: React.ReactElement[] = [];
    agentList.forEach((agent) => {
      const children = childrenMap.get(agent.id) || [];
      const isExpanded = expandedAgents.has(agent.id);

      rows.push(
        <IPRow
          key={agent.id}
          agent={agent}
          depth={depth}
          isExpanded={isExpanded}
          onToggle={() => toggleExpanded(agent.id)}
          hasChildren={children.length > 0}
          metrics={metricsMap.get(agent.id)}
          isOwner={agent.id === viewerId}
        />,
      );

      if (isExpanded && children.length > 0) {
        rows.push(...renderRows(children, depth + 1));
      }
    });
    return rows;
  };

  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="px-3 py-2 border-b border-border bg-background/30">
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          Issued Premium (IP) — Active Policies Only
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-background border-b border-border">
            <tr className="h-8">
              <th className="px-2 py-1.5 text-left text-[10px] font-semibold text-muted-foreground">
                Agent
              </th>
              <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-muted-foreground">
                <span className="text-info">IP</span>
              </th>
              <th className="px-2 py-1.5 text-center text-[10px] font-semibold text-muted-foreground">
                Policies
              </th>
              <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-muted-foreground">
                Avg Premium
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="text-center py-8">
                  <div className="text-[11px] text-muted-foreground">
                    Loading issued premium data...
                  </div>
                </td>
              </tr>
            ) : agentsToDisplay.length === 0 && !owner ? (
              <tr>
                <td colSpan={4} className="text-center py-6">
                  <span className="text-[11px] text-muted-foreground">
                    No team members found
                  </span>
                </td>
              </tr>
            ) : (
              <>
                {owner && (
                  <IPRow
                    key={owner.id}
                    agent={owner}
                    depth={0}
                    isExpanded={false}
                    onToggle={() => {}}
                    hasChildren={false}
                    metrics={metricsMap.get(owner.id)}
                    isOwner={true}
                  />
                )}
                {renderRows(paginatedRootAgents)}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalRootAgents > 0 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-background/30">
          <div className="flex items-center gap-4">
            <span className="text-[10px] text-muted-foreground">
              Total: {agents.length + (owner ? 1 : 0)} agent
              {agents.length + (owner ? 1 : 0) !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">
                Rows per page:
              </span>
              <Select
                value={rowsPerPage.toString()}
                onValueChange={handleRowsPerPageChange}
              >
                <SelectTrigger className="h-6 w-14 text-[10px] bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">
              Page {currentPage} of {totalPages || 1}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setCurrentPage(Math.min(totalPages || 1, currentPage + 1))
              }
              disabled={currentPage >= totalPages}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
