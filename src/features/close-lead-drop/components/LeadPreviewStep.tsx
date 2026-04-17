// Step 2: Preview leads from the selected Smart View and deselect any to exclude.

import { useEffect, useState } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Phone,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useLeadDropPreview } from "../hooks/useLeadDrop";
import type { LeadPreviewItem, SmartView } from "../types/lead-drop.types";

interface LeadPreviewStepProps {
  smartView: SmartView;
  allLeads: LeadPreviewItem[];
  selectedIds: Set<string>;
  onLeadsLoaded: (leads: LeadPreviewItem[]) => void;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onNext: () => void;
  onBack: () => void;
}

export function LeadPreviewStep({
  smartView,
  allLeads,
  selectedIds,
  onLeadsLoaded,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onNext,
  onBack,
}: LeadPreviewStepProps) {
  // Close /data/search/ is cursor-based. We track the cursor requested for
  // the CURRENT page and the next cursor the API returned (for "Load more").
  const [activeCursor, setActiveCursor] = useState<string | null>(null);

  const { data, isLoading, error } = useLeadDropPreview(
    smartView.id,
    activeCursor,
    true,
  );

  // Merge newly loaded leads into parent state whenever a page arrives.
  // Using `data` itself as the sole dep is intentional — `onLeadsLoaded`
  // should not trigger re-merges when its identity changes.
  useEffect(() => {
    if (data) {
      onLeadsLoaded(data.leads);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const allSelected =
    allLeads.length > 0 && allLeads.every((l) => selectedIds.has(l.id));
  const someSelected = allLeads.some((l) => selectedIds.has(l.id));
  const selectedCount = selectedIds.size;
  const hasMore = data?.has_more ?? false;
  const nextCursor = data?.cursor ?? null;
  const loadedOnce = !!data;
  // Close returns total_results for most /data/search/ responses. When it's
  // null we fall back to just "Showing N" — the Load more pill still guards
  // against over-fetching via the has_more flag from the backend.
  const totalFromApi = data?.total ?? null;
  const overLoaded = totalFromApi != null && allLeads.length > totalFromApi;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Review Leads</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            From Smart View:{" "}
            <span className="font-medium text-foreground">
              {smartView.name}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {allLeads.length > 0 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2"
                onClick={onSelectAll}
                disabled={allSelected}
              >
                All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2"
                onClick={onDeselectAll}
                disabled={!someSelected}
              >
                None
              </Button>
            </>
          )}
          {selectedCount > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {selectedCount} selected
            </span>
          )}
        </div>
      </div>

      {isLoading && allLeads.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-6 justify-center">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading leads…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-md p-3">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error.message}
        </div>
      )}

      {!isLoading && !error && allLeads.length === 0 && loadedOnce && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-4 text-center">
          No leads found in this Smart View.
        </div>
      )}

      {allLeads.length > 0 && (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="w-8 px-2 py-1.5 text-left">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(v) =>
                      v ? onSelectAll() : onDeselectAll()
                    }
                    className="h-3.5 w-3.5"
                  />
                </th>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                  Name
                </th>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground hidden sm:table-cell">
                  Status
                </th>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground hidden md:table-cell">
                  Contact
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allLeads.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => onToggle(lead.id)}
                  className={[
                    "cursor-pointer transition-colors hover:bg-muted/40",
                    selectedIds.has(lead.id) ? "bg-muted/20" : "",
                  ].join(" ")}
                >
                  <td className="px-2 py-1.5">
                    <Checkbox
                      checked={selectedIds.has(lead.id)}
                      onCheckedChange={() => onToggle(lead.id)}
                      className="h-3.5 w-3.5"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-2 py-1.5 font-medium truncate max-w-[160px]">
                    {lead.display_name || "—"}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground hidden sm:table-cell">
                    <span className="truncate max-w-[120px] inline-block">
                      {lead.status_label || "—"}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 hidden md:table-cell">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {lead.primary_phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {lead.primary_phone}
                        </span>
                      )}
                      {lead.primary_email && !lead.primary_phone && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {lead.primary_email}
                        </span>
                      )}
                      {!lead.primary_phone && !lead.primary_email && "—"}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t px-3 py-2 flex items-center justify-between bg-muted/30">
            <span
              className={[
                "text-xs",
                overLoaded ? "text-amber-600" : "text-muted-foreground",
              ].join(" ")}
            >
              {totalFromApi != null
                ? `Showing ${allLeads.length} of ${totalFromApi}`
                : `Showing ${allLeads.length} leads`}
              {hasMore && " — more available"}
              {overLoaded &&
                " — Close returned more leads than the smart view advertises"}
            </span>
            {hasMore && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => nextCursor && setActiveCursor(nextCursor)}
                disabled={isLoading || !nextCursor}
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Load more"
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1.5 text-xs"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </Button>
        <Button
          size="sm"
          onClick={onNext}
          disabled={selectedCount === 0}
          className="gap-1.5 text-xs"
        >
          Configure ({selectedCount})
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
