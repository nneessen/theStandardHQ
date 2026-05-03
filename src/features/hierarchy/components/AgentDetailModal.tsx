// src/features/hierarchy/components/AgentDetailModal.tsx
// Comprehensive agent detail modal - REDESIGNED for data density and proper visual hierarchy

import React, { useState } from "react";
import {
  User,
  Mail,
  Calendar,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Target,
  Activity,
  FileText,
  Users,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import {
  useAgentDetails,
  useAgentPolicies,
  useAgentCommissions,
  useAgentOverrides,
  useTeamComparison,
} from "@/hooks";
import { cn } from "@/lib/utils";
import type { HierarchyNode } from "@/types/hierarchy.types";
import {
  AgentPolicy,
  AgentCommission,
  AgentActivity,
  ProductMixItem,
  PeerPerformance,
} from "@/types/agent-detail.types";

interface AgentDetailModalProps {
  agent: HierarchyNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Safe formatters with proper null handling
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic date type
const safeFormatDate = (date: any): string => {
  if (!date || date === undefined || date === null || date === "") return "N/A";
  try {
    const formatted = formatDate(date);
    if (formatted === "Invalid Date" || formatted.includes("NaN")) return "N/A";
    return formatted;
  } catch {
    return "N/A";
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic amount type
const safeFormatCurrency = (amount: any): string => {
  if (amount === null || amount === undefined || isNaN(amount)) return "$0";
  return formatCurrency(Number(amount));
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic value type
const safeFormatPercent = (value: any, decimals?: number): string => {
  if (value === null || value === undefined || isNaN(value)) return "0%";
  return formatPercent(Number(value), decimals);
};

// Pagination hook
const usePagination = <T,>(
  items: T[] | undefined,
  itemsPerPage: number = 10,
) => {
  const [currentPage, setCurrentPage] = useState(1);
  const totalItems = items?.length || 0;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = items?.slice(startIndex, endIndex) || [];

  return {
    currentItems,
    currentPage,
    totalPages,
    totalItems,
    setCurrentPage,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1,
  };
};

/**
 * Comprehensive agent detail modal with proper data density and visual hierarchy
 */
export function AgentDetailModal({
  agent,
  open,
  onOpenChange,
}: AgentDetailModalProps) {
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch all agent data with error handling
  const {
    data: details,
    isLoading: detailsLoading,
    error: detailsError,
  } = useAgentDetails(agent?.id, { enabled: !!agent });
  const {
    data: policies,
    isLoading: policiesLoading,
    error: policiesError,
  } = useAgentPolicies(agent?.id, { enabled: !!agent });
  const {
    data: commissions,
    isLoading: commissionsLoading,
    error: commissionsError,
  } = useAgentCommissions(agent?.id, { enabled: !!agent });
  const { data: overrides, isLoading: _overridesLoading } = useAgentOverrides(
    agent?.id,
    { enabled: !!agent },
  );
  const { data: comparison, isLoading: comparisonLoading } = useTeamComparison(
    agent?.id,
    { enabled: !!agent },
  );

  // Pagination for tables
  const policiesPagination = usePagination(policies?.policies, 10);
  const commissionsPagination = usePagination(commissions?.recent, 10);
  const activityPagination = usePagination(details?.activityHistory, 15);
  const peersPagination = usePagination(comparison?.topPeers, 10);

  if (!agent) return null;

  const performanceScore = details?.performanceScore || 0;
  const performanceColor =
    performanceScore >= 90
      ? "text-success"
      : performanceScore >= 70
        ? "text-warning"
        : "text-destructive";

  const isLoading = detailsLoading || policiesLoading || commissionsLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0 bg-background">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-card/50">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white font-bold text-lg">
              {agent.email?.charAt(0).toUpperCase()}
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                {agent.email}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1 flex items-center gap-3">
                <Badge variant="outline" className="text-xs font-medium">
                  Level {agent.hierarchy_depth}
                </Badge>
                {details?.joinDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Joined {safeFormatDate(details.joinDate)}
                  </span>
                )}
                <span
                  className={cn(
                    "flex items-center gap-1 font-semibold",
                    performanceColor,
                  )}
                >
                  <TrendingUp className="h-3 w-3" />
                  {performanceScore}% Score
                </span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Loading/Error States */}
        {isLoading && (
          <div className="p-8 text-center text-muted-foreground">
            Loading agent data...
          </div>
        )}

        {!isLoading && (detailsError || policiesError || commissionsError) && (
          <div className="p-8">
            <div className="bg-destructive/10 text-destructive rounded-lg p-4">
              <p className="font-medium">Error loading agent data</p>
              <p className="text-sm mt-1">
                {detailsError?.toString() ||
                  policiesError?.toString() ||
                  commissionsError?.toString()}
              </p>
            </div>
          </div>
        )}

        {/* Content */}
        {!isLoading && (
          <div className="flex-1 overflow-y-auto">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="w-full justify-start px-6 bg-card/30 border-b">
                <TabsTrigger
                  value="overview"
                  className="data-[state=active]:bg-card"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="performance"
                  className="data-[state=active]:bg-card"
                >
                  Performance
                </TabsTrigger>
                <TabsTrigger
                  value="commissions"
                  className="data-[state=active]:bg-card"
                >
                  Commissions
                </TabsTrigger>
                <TabsTrigger
                  value="policies"
                  className="data-[state=active]:bg-card"
                >
                  Policies {policies?.total ? `(${policies.total})` : ""}
                </TabsTrigger>
                <TabsTrigger
                  value="activity"
                  className="data-[state=active]:bg-card"
                >
                  Activity
                </TabsTrigger>
                <TabsTrigger
                  value="comparison"
                  className="data-[state=active]:bg-card"
                >
                  Team Comparison
                </TabsTrigger>
              </TabsList>

              <div className="p-6">
                {/* OVERVIEW TAB - DATA DENSE */}
                <TabsContent value="overview" className="mt-0">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Left Column: Performance Metrics */}
                    <Card>
                      <CardHeader className="p-4 pb-3">
                        <CardTitle className="text-sm uppercase tracking-wide flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          Performance Metrics
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Total Policies
                          </span>
                          <span className="font-mono font-semibold text-lg">
                            {details?.totalPolicies || 0}
                          </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Active Policies
                          </span>
                          <span className="font-mono font-semibold text-success">
                            {details?.activePolicies || 0}
                          </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Total Premium
                          </span>
                          <span className="font-mono font-semibold">
                            {safeFormatCurrency(details?.totalPremium)}
                          </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Avg Premium
                          </span>
                          <span className="font-mono font-semibold">
                            {safeFormatCurrency(details?.avgPremium)}
                          </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Persistency Rate
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold">
                              {safeFormatPercent(details?.persistencyRate)}
                            </span>
                            <Badge
                              variant={
                                (details?.persistencyRate || 0) >= 85
                                  ? "default"
                                  : (details?.persistencyRate || 0) >= 70
                                    ? "secondary"
                                    : "destructive"
                              }
                              className="text-xs"
                            >
                              {(details?.persistencyRate || 0) >= 85
                                ? "Excellent"
                                : (details?.persistencyRate || 0) >= 70
                                  ? "Good"
                                  : "Needs Fix"}
                            </Badge>
                          </div>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Overrides Generated
                          </span>
                          <span className="font-mono font-semibold text-info">
                            {safeFormatCurrency(details?.overridesGenerated)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Right Column: Contact & Hierarchy */}
                    <div className="space-y-6">
                      <Card className="shadow-md bg-gradient-to-br from-card to-card/95">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm uppercase tracking-wide flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Contact & Status
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground flex items-center gap-2">
                              <Mail className="h-3 w-3" />
                              Email
                            </span>
                            <span className="text-sm font-medium">
                              {agent.email}
                            </span>
                          </div>
                          <Separator />
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">
                              Status
                            </span>
                            <Badge
                              variant={
                                details?.isActive ? "default" : "secondary"
                              }
                            >
                              {details?.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <Separator />
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">
                              Reports To
                            </span>
                            <span className="text-sm font-medium">
                              {details?.uplineEmail || "None (Root)"}
                            </span>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="shadow-md bg-gradient-to-br from-card to-card/95">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm uppercase tracking-wide flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Hierarchy Position
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">
                              Level
                            </span>
                            <Badge variant="outline">
                              Level {agent.hierarchy_depth}
                            </Badge>
                          </div>
                          <Separator />
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">
                              Direct Reports
                            </span>
                            <span className="text-sm font-bold font-mono">
                              {agent.direct_downline_count || 0}
                            </span>
                          </div>
                          <Separator />
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">
                              Total Downline
                            </span>
                            <span className="text-sm font-bold font-mono">
                              {agent.downline_count || 0}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  {/* Recent Activity - Full Width */}
                  <Card className="mt-6 shadow-md bg-gradient-to-br from-card to-card/95">
                    <CardHeader>
                      <CardTitle className="text-sm uppercase tracking-wide flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Recent Activity
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {details?.recentActivity &&
                      details.recentActivity.length > 0 ? (
                        <div className="space-y-2">
                          {details.recentActivity
                            .slice(0, 5)
                            .map((activity: AgentActivity, idx: number) => (
                              <div
                                key={idx}
                                className="flex items-start gap-3 p-3 bg-muted/20 rounded-lg hover:bg-muted/30 transition-colors"
                              >
                                <div
                                  className={cn(
                                    "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                                    activity.type === "policy"
                                      ? "bg-info/20 text-info"
                                      : activity.type === "commission"
                                        ? "bg-success/20 text-success"
                                        : "bg-warning/20 text-warning",
                                  )}
                                >
                                  {activity.type === "policy" ? (
                                    <FileText className="h-3 w-3" />
                                  ) : activity.type === "commission" ? (
                                    <DollarSign className="h-3 w-3" />
                                  ) : (
                                    <AlertCircle className="h-3 w-3" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {activity.title}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {activity.description}
                                  </p>
                                </div>
                                <span className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
                                  <Clock className="h-3 w-3" />
                                  {safeFormatDate(activity.timestamp)}
                                </span>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No recent activity
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* PERFORMANCE TAB - Meaningful metrics */}
                <TabsContent value="performance" className="mt-0">
                  <Card className="shadow-md bg-gradient-to-br from-card to-card/95">
                    <CardHeader>
                      <CardTitle className="text-sm uppercase tracking-wide">
                        Performance Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="bg-muted/30 rounded-lg p-4">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                          Production Metrics
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm">
                              Annual Premium Production
                            </span>
                            <span className="font-bold font-mono">
                              {safeFormatCurrency(details?.totalPremium)}
                            </span>
                          </div>
                          <Separator />
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Average Policy Size</span>
                            <span className="font-bold font-mono">
                              {safeFormatCurrency(details?.avgPremium)}
                            </span>
                          </div>
                          <Separator />
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Policies Written</span>
                            <span className="font-bold font-mono">
                              {details?.totalPolicies || 0}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-muted/30 rounded-lg p-4">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                          Quality Metrics
                        </h4>
                        <div className="space-y-3">
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm">Persistency Rate</span>
                              <span className="font-bold font-mono">
                                {safeFormatPercent(details?.persistencyRate)}
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className={cn(
                                  "h-2 rounded-full transition-all",
                                  (details?.persistencyRate || 0) >= 85
                                    ? "bg-success"
                                    : (details?.persistencyRate || 0) >= 70
                                      ? "bg-warning"
                                      : "bg-destructive",
                                )}
                                style={{
                                  width: `${Math.min(details?.persistencyRate || 0, 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                          <Separator />
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Active Policies</span>
                            <Badge variant="default">
                              {details?.activePolicies || 0} /{" "}
                              {details?.totalPolicies || 0}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {details?.productMix && details.productMix.length > 0 && (
                        <div className="bg-muted/30 rounded-lg p-4">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                            Product Mix
                          </h4>
                          <div className="space-y-2">
                            {details.productMix.map(
                              (product: ProductMixItem, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex justify-between items-center text-sm"
                                >
                                  <span>{product.name}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">
                                      {product.count} policies
                                    </span>
                                    <Badge variant="outline">
                                      {product.percentage}%
                                    </Badge>
                                  </div>
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* COMMISSIONS TAB - Data-dense with proper calculations */}
                <TabsContent value="commissions" className="mt-0 space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <Card className="shadow-md bg-gradient-to-br from-card to-card/95">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm uppercase tracking-wide">
                          Commission Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Total Earned
                          </span>
                          <span className="font-mono font-semibold text-success text-lg">
                            {safeFormatCurrency(commissions?.totalEarned)}
                          </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Pending
                          </span>
                          <span className="font-mono font-semibold">
                            {safeFormatCurrency(commissions?.pending)}
                          </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Advances
                          </span>
                          <span className="font-mono font-semibold text-warning">
                            {safeFormatCurrency(commissions?.advances)}
                          </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Chargebacks
                          </span>
                          <span className="font-mono font-semibold text-destructive">
                            {safeFormatCurrency(commissions?.chargebacks)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-md bg-gradient-to-br from-card to-card/95">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm uppercase tracking-wide">
                          Override Income Generated
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            This Month (MTD)
                          </span>
                          <span className="font-mono font-semibold text-info text-lg">
                            {safeFormatCurrency(overrides?.mtd)}
                          </span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            Year to Date (YTD)
                          </span>
                          <span className="font-mono font-semibold text-info">
                            {safeFormatCurrency(overrides?.ytd)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Commissions Table with Pagination */}
                  <Card className="shadow-md bg-gradient-to-br from-card to-card/95">
                    <CardHeader>
                      <CardTitle className="text-sm uppercase tracking-wide">
                        Recent Commissions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {commissionsLoading ? (
                        <p className="text-center text-muted-foreground py-4">
                          Loading...
                        </p>
                      ) : commissionsPagination.currentItems.length > 0 ? (
                        <>
                          <div className="rounded-lg border bg-muted/10">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/30">
                                  <TableHead>Date</TableHead>
                                  <TableHead>Policy #</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead className="text-right">
                                    Amount
                                  </TableHead>
                                  <TableHead>Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(
                                  commissionsPagination.currentItems as AgentCommission[]
                                ).map((comm: AgentCommission) => (
                                  <TableRow
                                    key={comm.id}
                                    className="hover:bg-muted/20"
                                  >
                                    <TableCell className="text-sm">
                                      {safeFormatDate(comm.date)}
                                    </TableCell>
                                    <TableCell className="text-sm font-mono">
                                      {comm.policyNumber}
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {comm.type}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-semibold">
                                      {safeFormatCurrency(comm.amount)}
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant={
                                          comm.status === "paid"
                                            ? "default"
                                            : comm.status === "pending"
                                              ? "secondary"
                                              : "outline"
                                        }
                                      >
                                        {comm.status}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                          {commissionsPagination.totalPages > 1 && (
                            <div className="flex items-center justify-between mt-4">
                              <p className="text-sm text-muted-foreground">
                                Showing{" "}
                                {(commissionsPagination.currentPage - 1) * 10 +
                                  1}
                                -
                                {Math.min(
                                  commissionsPagination.currentPage * 10,
                                  commissionsPagination.totalItems,
                                )}{" "}
                                of {commissionsPagination.totalItems}
                              </p>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    commissionsPagination.setCurrentPage(
                                      commissionsPagination.currentPage - 1,
                                    )
                                  }
                                  disabled={!commissionsPagination.hasPrev}
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-sm">
                                  Page {commissionsPagination.currentPage} of{" "}
                                  {commissionsPagination.totalPages}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    commissionsPagination.setCurrentPage(
                                      commissionsPagination.currentPage + 1,
                                    )
                                  }
                                  disabled={!commissionsPagination.hasNext}
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-center text-muted-foreground py-8">
                          No commission data available
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* POLICIES TAB - Paginated table */}
                <TabsContent value="policies" className="mt-0">
                  <Card className="shadow-md bg-gradient-to-br from-card to-card/95">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm uppercase tracking-wide">
                          Policy Portfolio
                        </CardTitle>
                        <div className="flex gap-2">
                          <Badge variant="outline">
                            {policies?.total || 0} Total
                          </Badge>
                          <Badge variant="default">
                            {policies?.active || 0} Active
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {policiesLoading ? (
                        <p className="text-center text-muted-foreground py-4">
                          Loading policies...
                        </p>
                      ) : policiesError ? (
                        <div className="bg-destructive/10 text-destructive rounded-lg p-4">
                          <p>
                            Error loading policies: {policiesError.toString()}
                          </p>
                        </div>
                      ) : policiesPagination.currentItems.length > 0 ? (
                        <>
                          <div className="rounded-lg border bg-muted/10">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/30">
                                  <TableHead>Policy #</TableHead>
                                  <TableHead>Client</TableHead>
                                  <TableHead>Product</TableHead>
                                  <TableHead>Carrier</TableHead>
                                  <TableHead className="text-right">
                                    Premium
                                  </TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Issue Date</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(
                                  policiesPagination.currentItems as AgentPolicy[]
                                ).map((policy: AgentPolicy) => (
                                  <TableRow
                                    key={policy.id}
                                    className="hover:bg-muted/20"
                                  >
                                    <TableCell className="font-mono text-sm font-medium">
                                      {policy.policyNumber}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {policy.clientName}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {policy.product}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {policy.carrier}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-semibold">
                                      {safeFormatCurrency(policy.annualPremium)}
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant={
                                          policy.lifecycleStatus === "active"
                                            ? "default"
                                            : policy.lifecycleStatus ===
                                                "lapsed"
                                              ? "destructive"
                                              : policy.lifecycleStatus ===
                                                  "cancelled"
                                                ? "destructive"
                                                : "secondary"
                                        }
                                      >
                                        {policy.lifecycleStatus ||
                                          policy.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {safeFormatDate(policy.issueDate)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                          {policiesPagination.totalPages > 1 && (
                            <div className="flex items-center justify-between mt-4">
                              <p className="text-sm text-muted-foreground">
                                Showing{" "}
                                {(policiesPagination.currentPage - 1) * 10 + 1}-
                                {Math.min(
                                  policiesPagination.currentPage * 10,
                                  policiesPagination.totalItems,
                                )}{" "}
                                of {policiesPagination.totalItems}
                              </p>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    policiesPagination.setCurrentPage(
                                      policiesPagination.currentPage - 1,
                                    )
                                  }
                                  disabled={!policiesPagination.hasPrev}
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-sm">
                                  Page {policiesPagination.currentPage} of{" "}
                                  {policiesPagination.totalPages}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    policiesPagination.setCurrentPage(
                                      policiesPagination.currentPage + 1,
                                    )
                                  }
                                  disabled={!policiesPagination.hasNext}
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-8">
                          <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                          <p className="text-muted-foreground">
                            No policies found for this agent
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ACTIVITY TAB - Paginated timeline */}
                <TabsContent value="activity" className="mt-0">
                  <Card className="shadow-md bg-gradient-to-br from-card to-card/95">
                    <CardHeader>
                      <CardTitle className="text-sm uppercase tracking-wide">
                        Activity History
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {activityPagination.currentItems.length > 0 ? (
                        <>
                          <div className="space-y-3">
                            {(
                              activityPagination.currentItems as AgentActivity[]
                            ).map((activity: AgentActivity, idx: number) => (
                              <div
                                key={idx}
                                className="flex items-start gap-3 p-3 bg-muted/20 rounded-lg hover:bg-muted/30 transition-colors"
                              >
                                <div
                                  className={cn(
                                    "h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0",
                                    activity.category === "policy"
                                      ? "bg-info/20 text-info"
                                      : activity.category === "commission"
                                        ? "bg-success/20 text-success"
                                        : activity.category === "override"
                                          ? "bg-info/20 text-info"
                                          : "bg-warning/20 text-warning",
                                  )}
                                >
                                  {activity.category === "policy" ? (
                                    <FileText className="h-4 w-4" />
                                  ) : activity.category === "commission" ? (
                                    <DollarSign className="h-4 w-4" />
                                  ) : activity.category === "override" ? (
                                    <Users className="h-4 w-4" />
                                  ) : (
                                    <Activity className="h-4 w-4" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start">
                                    <p className="font-medium text-sm">
                                      {activity.title}
                                    </p>
                                    <span className="text-xs text-muted-foreground">
                                      {safeFormatDate(
                                        activity.date || activity.timestamp,
                                      )}
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {activity.description}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                          {activityPagination.totalPages > 1 && (
                            <div className="flex items-center justify-between mt-4">
                              <p className="text-sm text-muted-foreground">
                                Showing{" "}
                                {(activityPagination.currentPage - 1) * 15 + 1}-
                                {Math.min(
                                  activityPagination.currentPage * 15,
                                  activityPagination.totalItems,
                                )}{" "}
                                of {activityPagination.totalItems}
                              </p>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    activityPagination.setCurrentPage(
                                      activityPagination.currentPage - 1,
                                    )
                                  }
                                  disabled={!activityPagination.hasPrev}
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-sm">
                                  Page {activityPagination.currentPage} of{" "}
                                  {activityPagination.totalPages}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    activityPagination.setCurrentPage(
                                      activityPagination.currentPage + 1,
                                    )
                                  }
                                  disabled={!activityPagination.hasNext}
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-8">
                          <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                          <p className="text-muted-foreground">
                            No activity history available
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* TEAM COMPARISON TAB - Data-dense */}
                <TabsContent value="comparison" className="mt-0 space-y-4">
                  {comparisonLoading ? (
                    <p className="text-center text-muted-foreground py-4">
                      Loading comparison data...
                    </p>
                  ) : comparison ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        {/* Rankings Card */}
                        <Card>
                          <CardHeader className="p-4 pb-3">
                            <CardTitle className="text-sm uppercase tracking-wide">
                              Performance Rankings
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-4 pt-0 space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">
                                Premium Rank
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold text-lg">
                                  #{comparison.premiumRank}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  of {comparison.totalAgents}
                                </span>
                                <Badge
                                  variant={
                                    comparison.premiumPercentile >= 90
                                      ? "default"
                                      : comparison.premiumPercentile >= 70
                                        ? "secondary"
                                        : "outline"
                                  }
                                  className="text-xs"
                                >
                                  Top{" "}
                                  {100 - (comparison.premiumPercentile || 0)}%
                                </Badge>
                              </div>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">
                                Policy Count Rank
                              </span>
                              <span className="font-mono font-semibold">
                                #{comparison.policyRank}
                              </span>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">
                                Persistency Rank
                              </span>
                              <span className="font-mono font-semibold">
                                #{comparison.persistencyRank}
                              </span>
                            </div>
                          </CardContent>
                        </Card>

                        {/* vs Team Average Card */}
                        <Card>
                          <CardHeader className="p-4 pb-3">
                            <CardTitle className="text-sm uppercase tracking-wide">
                              vs Team Average
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-4 pt-0 space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">
                                Premium
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm">
                                  {safeFormatCurrency(details?.totalPremium)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  /
                                </span>
                                <span className="font-mono text-sm text-muted-foreground">
                                  {safeFormatCurrency(comparison.avgPremium)}
                                </span>
                                <Badge
                                  variant={
                                    (details?.totalPremium || 0) >
                                    (comparison.avgPremium || 0)
                                      ? "default"
                                      : "secondary"
                                  }
                                  className="text-xs"
                                >
                                  {(
                                    ((details?.totalPremium || 0) /
                                      (comparison.avgPremium || 1)) *
                                    100
                                  ).toFixed(0)}
                                  %
                                </Badge>
                              </div>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">
                                Policies
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm">
                                  {details?.totalPolicies || 0}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  /
                                </span>
                                <span className="font-mono text-sm text-muted-foreground">
                                  {comparison.avgPolicies || 0}
                                </span>
                                <Badge
                                  variant={
                                    (details?.totalPolicies || 0) >
                                    (comparison.avgPolicies || 0)
                                      ? "default"
                                      : "secondary"
                                  }
                                  className="text-xs"
                                >
                                  {(
                                    ((details?.totalPolicies || 0) /
                                      (comparison.avgPolicies || 1)) *
                                    100
                                  ).toFixed(0)}
                                  %
                                </Badge>
                              </div>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">
                                Persistency
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm">
                                  {safeFormatPercent(details?.persistencyRate)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  /
                                </span>
                                <span className="font-mono text-sm text-muted-foreground">
                                  {safeFormatPercent(comparison.avgPersistency)}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Top Performers Table with Pagination */}
                      {peersPagination.currentItems.length > 0 && (
                        <Card>
                          <CardHeader className="p-4 pb-3">
                            <CardTitle className="text-sm uppercase tracking-wide">
                              Top Performers at Level {agent.hierarchy_depth}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-4 pt-0">
                            <div className="rounded-lg border bg-muted/10">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/30">
                                    <TableHead className="w-12">Rank</TableHead>
                                    <TableHead>Agent</TableHead>
                                    <TableHead className="text-right">
                                      Premium
                                    </TableHead>
                                    <TableHead className="text-right">
                                      Policies
                                    </TableHead>
                                    <TableHead className="text-right">
                                      Persistency
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {(
                                    peersPagination.currentItems as PeerPerformance[]
                                  ).map(
                                    (peer: PeerPerformance, idx: number) => {
                                      const actualRank =
                                        (peersPagination.currentPage - 1) * 10 +
                                        idx +
                                        1;
                                      return (
                                        <TableRow
                                          key={peer.id}
                                          className={cn(
                                            "hover:bg-muted/20",
                                            peer.id === agent.id &&
                                              "bg-primary/10 font-semibold",
                                          )}
                                        >
                                          <TableCell className="font-medium text-sm">
                                            {actualRank}
                                          </TableCell>
                                          <TableCell className="text-sm">
                                            {peer.email}
                                            {peer.id === agent.id && (
                                              <Badge
                                                className="ml-2"
                                                variant="outline"
                                              >
                                                You
                                              </Badge>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-right font-mono text-sm">
                                            {safeFormatCurrency(peer.premium)}
                                          </TableCell>
                                          <TableCell className="text-right font-mono text-sm">
                                            {peer.policies}
                                          </TableCell>
                                          <TableCell className="text-right font-mono text-sm">
                                            {safeFormatPercent(
                                              peer.persistency,
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      );
                                    },
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                            {peersPagination.totalPages > 1 && (
                              <div className="flex items-center justify-between mt-4">
                                <p className="text-sm text-muted-foreground">
                                  Showing{" "}
                                  {(peersPagination.currentPage - 1) * 10 + 1}-
                                  {Math.min(
                                    peersPagination.currentPage * 10,
                                    peersPagination.totalItems,
                                  )}{" "}
                                  of {peersPagination.totalItems}
                                </p>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      peersPagination.setCurrentPage(
                                        peersPagination.currentPage - 1,
                                      )
                                    }
                                    disabled={!peersPagination.hasPrev}
                                  >
                                    <ChevronLeft className="h-4 w-4" />
                                  </Button>
                                  <span className="text-sm">
                                    Page {peersPagination.currentPage} of{" "}
                                    {peersPagination.totalPages}
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      peersPagination.setCurrentPage(
                                        peersPagination.currentPage + 1,
                                      )
                                    }
                                    disabled={!peersPagination.hasNext}
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}
                    </>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      No comparison data available
                    </p>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
