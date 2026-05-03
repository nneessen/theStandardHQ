import { useState } from "react";
import { Mail, MousePointer, Eye, AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { cn } from "@/lib/utils";
import {
  useOverallMetrics,
  useRecentCampaigns,
} from "../../hooks/useCampaignAnalytics";
import { format } from "date-fns";
import type { CampaignStatus } from "../../types/marketing.types";
import { CampaignDetailSheet } from "../campaigns/CampaignDetailSheet";

const STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: "bg-muted text-v2-ink-muted border-input/20",
  sending: "bg-info/10 text-info border-info/20",
  sent: "bg-success/10 text-success border-success/20",
  scheduled: "bg-warning/10 text-warning border-warning/20",
  paused: "bg-warning/10 text-warning border-warning/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
};

interface KpiBlockProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  iconClass?: string;
}

function KpiBlock({ icon: Icon, label, value, sub, iconClass }: KpiBlockProps) {
  return (
    <div className="p-3 border border-border rounded-sm">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={cn("h-3.5 w-3.5", iconClass)} />
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="text-lg font-semibold leading-tight tabular-nums">
        {value}
      </div>
      {sub && (
        <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
      )}
    </div>
  );
}

export function AnalyticsTab() {
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });
  const [detailId, setDetailId] = useState<string | null>(null);

  const fromStr = dateRange.from?.toISOString();
  const toStr = dateRange.to?.toISOString();

  const { data: metrics, isLoading: metricsLoading } = useOverallMetrics(
    fromStr,
    toStr,
  );
  const { data: recentCampaigns, isLoading: campaignsLoading } =
    useRecentCampaigns(10, fromStr, toStr);

  const isLoading = metricsLoading || campaignsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const openRate = metrics ? `${metrics.openRate.toFixed(1)}%` : "0%";
  const clickRate = metrics ? `${metrics.clickRate.toFixed(1)}%` : "0%";
  const bounceRate = metrics ? `${metrics.bounceRate.toFixed(1)}%` : "0%";

  return (
    <div className="space-y-4">
      {/* Date Range Picker */}
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium text-muted-foreground">
          Campaign Analytics
        </div>
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          placeholder="All time"
        />
      </div>

      {/* KPI Blocks */}
      <div className="grid grid-cols-4 gap-3">
        <KpiBlock
          icon={Mail}
          label="Total Sent"
          value={(metrics?.totalSent ?? 0).toLocaleString()}
          sub="across all campaigns"
          iconClass="text-info"
        />
        <KpiBlock
          icon={Eye}
          label="Open Rate"
          value={openRate}
          sub={`${(metrics?.totalOpened ?? 0).toLocaleString()} opens`}
          iconClass="text-success"
        />
        <KpiBlock
          icon={MousePointer}
          label="Click Rate"
          value={clickRate}
          sub={`${(metrics?.totalClicked ?? 0).toLocaleString()} clicks`}
          iconClass="text-warning"
        />
        <KpiBlock
          icon={AlertTriangle}
          label="Bounce Rate"
          value={bounceRate}
          sub={`${(metrics?.totalBounced ?? 0).toLocaleString()} bounces`}
          iconClass="text-destructive"
        />
      </div>

      {/* Recent Campaigns */}
      <div>
        <div className="text-[11px] font-medium text-muted-foreground mb-2">
          Recent Campaigns
        </div>
        <div className="border border-border rounded-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-[10px] font-medium text-muted-foreground h-7 py-0 px-3">
                  Name
                </TableHead>
                <TableHead className="text-[10px] font-medium text-muted-foreground h-7 py-0 px-3">
                  Status
                </TableHead>
                <TableHead className="text-[10px] font-medium text-muted-foreground h-7 py-0 px-3 text-right">
                  Sent
                </TableHead>
                <TableHead className="text-[10px] font-medium text-muted-foreground h-7 py-0 px-3 text-right">
                  Opens
                </TableHead>
                <TableHead className="text-[10px] font-medium text-muted-foreground h-7 py-0 px-3 text-right">
                  Clicks
                </TableHead>
                <TableHead className="text-[10px] font-medium text-muted-foreground h-7 py-0 px-3 text-right">
                  Bounces
                </TableHead>
                <TableHead className="text-[10px] font-medium text-muted-foreground h-7 py-0 px-3">
                  Date
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!recentCampaigns?.length ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-[11px] text-muted-foreground"
                  >
                    <Mail className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
                    No campaigns have been sent yet.
                  </TableCell>
                </TableRow>
              ) : (
                recentCampaigns.map((campaign) => {
                  const sent = campaign.sent_count ?? 0;
                  const opens = campaign.opened_count ?? 0;
                  const clicks = campaign.clicked_count ?? 0;
                  const bounces = campaign.bounced_count ?? 0;

                  return (
                    <TableRow
                      key={campaign.id}
                      className="hover:bg-muted/30 py-1.5 cursor-pointer"
                      onClick={() => setDetailId(campaign.id)}
                    >
                      <TableCell className="py-1.5 px-3 text-[11px] font-medium max-w-[180px]">
                        <span className="truncate block">{campaign.name}</span>
                      </TableCell>
                      <TableCell className="py-1.5 px-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] h-4 px-1.5 font-normal capitalize border",
                            STATUS_COLORS[campaign.status as CampaignStatus] ??
                              STATUS_COLORS.draft,
                          )}
                        >
                          {campaign.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1.5 px-3 text-[11px] text-right tabular-nums">
                        {sent.toLocaleString()}
                      </TableCell>
                      <TableCell className="py-1.5 px-3 text-[11px] text-right tabular-nums">
                        <span className={opens > 0 ? "text-success" : ""}>
                          {opens.toLocaleString()}
                        </span>
                        {sent > 0 && (
                          <span className="text-[10px] text-muted-foreground ml-1">
                            ({((opens / sent) * 100).toFixed(0)}%)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-1.5 px-3 text-[11px] text-right tabular-nums">
                        <span className={clicks > 0 ? "text-warning" : ""}>
                          {clicks.toLocaleString()}
                        </span>
                        {sent > 0 && (
                          <span className="text-[10px] text-muted-foreground ml-1">
                            ({((clicks / sent) * 100).toFixed(0)}%)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-1.5 px-3 text-[11px] text-right tabular-nums">
                        <span className={bounces > 0 ? "text-destructive" : ""}>
                          {bounces.toLocaleString()}
                        </span>
                        {sent > 0 && (
                          <span className="text-[10px] text-muted-foreground ml-1">
                            ({((bounces / sent) * 100).toFixed(0)}%)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-1.5 px-3 text-[11px] text-muted-foreground whitespace-nowrap">
                        {campaign.created_at
                          ? format(new Date(campaign.created_at), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Campaign Detail Sheet */}
      <CampaignDetailSheet
        campaignId={detailId}
        open={!!detailId}
        onOpenChange={(v) => {
          if (!v) setDetailId(null);
        }}
      />
    </div>
  );
}
