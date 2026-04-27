// src/features/recruiting/components/LeadsQueueDashboard.tsx
// Dashboard for managing incoming leads from the public recruiting funnel

import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Search,
  Loader2,
  Inbox,
  UserPlus,
  XCircle,
  CheckCircle2,
  Clock,
  Users,
  Copy,
  Check,
  Link2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useLeads,
  useLeadsStats,
  useAcceptLead,
  useRejectLead,
} from "../hooks/useLeads";
import { LeadDetailPanel } from "./LeadDetailPanel";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  EXPERIENCE_LABELS,
  type LeadStatus,
  type EnrichedLead,
} from "@/types/leads.types";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
// eslint-disable-next-line no-restricted-imports
import { supabase } from "@/services/base/supabase";

export function LeadsQueueDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<LeadStatus | "all">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedLead, setSelectedLead] = useState<EnrichedLead | null>(null);
  const [copiedSlug, setCopiedSlug] = useState(false);

  // Build filters based on active tab and search
  const filters =
    activeTab === "all"
      ? { search: searchQuery || undefined }
      : { status: [activeTab], search: searchQuery || undefined };

  const { data: leadsData, isLoading: leadsLoading } = useLeads(
    filters,
    page,
    25,
  );
  const { data: stats, isLoading: statsLoading } = useLeadsStats();

  const acceptMutation = useAcceptLead();
  const rejectMutation = useRejectLead();

  // Fetch current user's recruiter_slug
  const { data: recruiterSlug } = useQuery({
    queryKey: ["recruiter-slug", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("user_profiles")
        .select("recruiter_slug")
        .eq("id", user.id)
        .single();
      return data?.recruiter_slug || null;
    },
    enabled: !!user?.id,
  });

  const shareableUrl = recruiterSlug
    ? `https://www.thestandardhq.com/join-${recruiterSlug}`
    : null;

  const handleCopyLink = () => {
    if (shareableUrl) {
      navigator.clipboard.writeText(shareableUrl);
      setCopiedSlug(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopiedSlug(false), 2000);
    }
  };

  const handleAccept = async (lead: EnrichedLead) => {
    await acceptMutation.mutateAsync({ leadId: lead.id });
    setSelectedLead(null);
  };

  const handleReject = async (lead: EnrichedLead, reason?: string) => {
    await rejectMutation.mutateAsync({ leadId: lead.id, reason });
    setSelectedLead(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-v2-ring bg-v2-card p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: "/recruiting" })}
              className="h-7 px-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              <span className="text-[11px]">Recruiting</span>
            </Button>
            <div className="h-4 w-px bg-v2-ring" />
            <div>
              <h1 className="text-sm font-semibold text-v2-ink">Leads Queue</h1>
              <p className="text-[10px] text-v2-ink-muted">
                Manage incoming interest from your public funnel
              </p>
            </div>
          </div>

          {/* Stats */}
          {!statsLoading && stats && (
            <div className="flex items-center gap-4 text-[11px]">
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-v2-ink-subtle" />
                <span className="text-v2-ink-muted">Total:</span>
                <span className="font-medium">{stats.total}</span>
              </div>
              <div className="h-3 w-px bg-v2-ring" />
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-v2-ink-muted">Pending:</span>
                <span className="font-medium text-amber-600">
                  {stats.pending}
                </span>
              </div>
              <div className="h-3 w-px bg-v2-ring" />
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-v2-ink-muted">Accepted:</span>
                <span className="font-medium text-emerald-600">
                  {stats.accepted}
                </span>
              </div>
            </div>
          )}

          {/* Share Link */}
          {shareableUrl ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 dark:bg-emerald-950/30 rounded-md border border-emerald-200 dark:border-emerald-800">
                <Link2 className="h-3 w-3 text-emerald-500" />
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 max-w-[200px] truncate">
                  www.thestandardhq.com/join-{recruiterSlug}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="h-7 px-2 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
              >
                {copiedSlug ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-7 px-2 text-[10px] border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/50"
            >
              <Link to="/settings">
                <Link2 className="h-3 w-3 mr-1" />
                Set Up Your Link
                <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 border-b border-v2-ring bg-v2-canvas /50 p-3">
        <div className="flex items-center justify-between gap-3">
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v as LeadStatus | "all");
              setPage(1);
            }}
          >
            <TabsList className="h-7">
              <TabsTrigger value="pending" className="h-6 text-[11px] px-3">
                <Clock className="h-3 w-3 mr-1.5" />
                Pending
                {stats?.pending ? (
                  <Badge
                    variant="secondary"
                    className="ml-1.5 h-4 px-1 text-[9px]"
                  >
                    {stats.pending}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="accepted" className="h-6 text-[11px] px-3">
                <CheckCircle2 className="h-3 w-3 mr-1.5" />
                Accepted
              </TabsTrigger>
              <TabsTrigger value="rejected" className="h-6 text-[11px] px-3">
                <XCircle className="h-3 w-3 mr-1.5" />
                Rejected
              </TabsTrigger>
              <TabsTrigger value="all" className="h-6 text-[11px] px-3">
                All
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-v2-ink-subtle" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="h-7 pl-8 w-[250px] text-[11px]"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {leadsLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-v2-ink-subtle" />
          </div>
        ) : !leadsData?.leads.length ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Inbox className="h-10 w-10 text-v2-ink-subtle mb-3" />
            <h3 className="text-sm font-medium text-v2-ink">No leads found</h3>
            <p className="text-[11px] text-v2-ink-muted mt-1 max-w-xs">
              {activeTab === "pending"
                ? "No pending leads to review. Share your link to start receiving interest."
                : "No leads match your current filters."}
            </p>
            {!shareableUrl && (
              <p className="text-[11px] text-amber-600 mt-3">
                Set up your recruiter slug in settings to get your shareable
                link.
              </p>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[10px] font-semibold h-8 w-[180px]">
                  Name
                </TableHead>
                <TableHead className="text-[10px] font-semibold h-8 w-[200px]">
                  Contact
                </TableHead>
                <TableHead className="text-[10px] font-semibold h-8 w-[120px]">
                  Location
                </TableHead>
                <TableHead className="text-[10px] font-semibold h-8 w-[120px]">
                  Experience
                </TableHead>
                <TableHead className="text-[10px] font-semibold h-8 w-[100px]">
                  Availability
                </TableHead>
                <TableHead className="text-[10px] font-semibold h-8 w-[100px]">
                  Submitted
                </TableHead>
                <TableHead className="text-[10px] font-semibold h-8 w-[80px]">
                  Status
                </TableHead>
                <TableHead className="text-[10px] font-semibold h-8 w-[100px] text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leadsData.leads.map((lead) => (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedLead(lead)}
                >
                  <TableCell className="py-2">
                    <div>
                      <p className="text-[11px] font-medium text-v2-ink">
                        {lead.first_name} {lead.last_name}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
                        {lead.email}
                      </p>
                      <p className="text-[10px] text-v2-ink-subtle">
                        {lead.phone}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
                      {lead.city}, {lead.state}
                    </p>
                  </TableCell>
                  <TableCell className="py-2">
                    <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
                      {
                        EXPERIENCE_LABELS[
                          lead.insurance_experience as keyof typeof EXPERIENCE_LABELS
                        ]
                      }
                    </p>
                  </TableCell>
                  <TableCell className="py-2">
                    <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle capitalize">
                      {lead.availability.replace("_", "-")}
                    </p>
                  </TableCell>
                  <TableCell className="py-2">
                    <p className="text-[10px] text-v2-ink-muted">
                      {formatDistanceToNow(new Date(lead.submitted_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge
                      variant="outline"
                      className={`text-[9px] ${
                        STATUS_COLORS[lead.status as LeadStatus]?.bg
                      } ${STATUS_COLORS[lead.status as LeadStatus]?.text} ${
                        STATUS_COLORS[lead.status as LeadStatus]?.border
                      }`}
                    >
                      {STATUS_LABELS[lead.status as LeadStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 text-right">
                    {lead.status === "pending" && (
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          onClick={() => handleAccept(lead)}
                          disabled={acceptMutation.isPending}
                        >
                          <UserPlus className="h-3 w-3 mr-1" />
                          Accept
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleReject(lead)}
                          disabled={rejectMutation.isPending}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {leadsData && leadsData.totalPages > 1 && (
        <div className="flex-shrink-0 border-t border-v2-ring bg-v2-card p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-v2-ink-muted">
              Showing {(page - 1) * 25 + 1} -{" "}
              {Math.min(page * 25, leadsData.total)} of {leadsData.total} leads
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-6 px-2 text-[10px]"
              >
                Previous
              </Button>
              <span className="text-[10px] text-v2-ink-muted px-2">
                Page {page} of {leadsData.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((p) => Math.min(leadsData.totalPages, p + 1))
                }
                disabled={page === leadsData.totalPages}
                className="h-6 px-2 text-[10px]"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Panel */}
      {selectedLead && (
        <LeadDetailPanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onAccept={() => handleAccept(selectedLead)}
          onReject={(reason) => handleReject(selectedLead, reason)}
          isAccepting={acceptMutation.isPending}
          isRejecting={rejectMutation.isPending}
        />
      )}
    </div>
  );
}

export default LeadsQueueDashboard;
