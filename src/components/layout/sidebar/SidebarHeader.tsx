// src/components/layout/sidebar/SidebarHeader.tsx
// Presentational header for the main app sidebar.

import { ChevronLeft, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationDropdown } from "@/components/notifications";
import { cn } from "@/lib/utils";
import { ALL_IMOS_SENTINEL } from "@/contexts/ImoContext";
import type { Agency, Imo } from "@/types/imo.types";

interface SidebarHeaderProps {
  actingImoId: string | null;
  agency: Agency | null;
  allImos?: Imo[];
  imo: Imo | null;
  imoError: Error | null;
  imoLoading: boolean;
  isCollapsed: boolean;
  isMobile: boolean;
  isRecruit: boolean;
  isSuperAdmin: boolean;
  onCloseMobile: () => void;
  onToggleCollapse: () => void;
  setActingImoId: (imoId: string | null) => Promise<void> | void;
  userEmail: string;
  userName: string;
}

export function SidebarHeader({
  actingImoId,
  agency,
  allImos,
  imo,
  imoError,
  imoLoading,
  isCollapsed,
  isMobile,
  isRecruit,
  isSuperAdmin,
  onCloseMobile,
  onToggleCollapse,
  setActingImoId,
  userEmail,
  userName,
}: SidebarHeaderProps) {
  if (isCollapsed) {
    return (
      <div className="p-3 border-b border-v2-ring bg-v2-card/60">
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggleCollapse}
          >
            <Menu size={16} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 border-b border-v2-ring bg-v2-card/60">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-9 h-9 bg-v2-accent text-v2-ink rounded-v2-pill flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-v2-soft">
            {userName
              .split(" ")
              .filter(Boolean)
              .map((n) => n[0])
              .join("")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-v2-ink truncate tracking-tight">
              {userName}
            </div>
            <div className="text-[11px] text-v2-ink-muted truncate">
              {userEmail}
            </div>
            {imoLoading ? (
              <div className="text-[10px] text-muted-foreground/50 truncate mt-0.5">
                Loading...
              </div>
            ) : imoError ? (
              <div className="text-[10px] text-destructive/70 truncate mt-0.5">
                Organization unavailable
              </div>
            ) : imo || agency ? (
              <div className="text-[10px] text-v2-ink-subtle truncate mt-0.5 flex items-center gap-1">
                {imo && (
                  <span
                    className="font-medium"
                    style={{ color: imo.primary_color || undefined }}
                  >
                    {imo.code}
                  </span>
                )}
                {imo && agency && <span className="opacity-50">&bull;</span>}
                {agency && <span>{agency.code}</span>}
              </div>
            ) : null}
            {isSuperAdmin && allImos && allImos.length > 0 ? (
              <div className="mt-1.5">
                <select
                  value={actingImoId ?? ""}
                  onChange={(e) => setActingImoId(e.target.value || null)}
                  className={cn(
                    "w-full text-[10px] px-1.5 py-0.5 rounded border bg-v2-card text-v2-ink-muted cursor-pointer",
                    actingImoId === ALL_IMOS_SENTINEL
                      ? "border-red-500/60 bg-red-500/10 text-red-900 dark:text-red-200 font-semibold"
                      : actingImoId
                        ? "border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200 font-medium"
                        : "border-v2-ring",
                  )}
                  title={
                    actingImoId === ALL_IMOS_SENTINEL
                      ? "Viewing ALL IMOs — data spans every tenant (cross-tenant view)"
                      : actingImoId
                        ? "Acting as another IMO — recruits and reads are scoped to it"
                        : "Scoped to your own IMO"
                  }
                >
                  <option value="">— Own IMO —</option>
                  {allImos.map((i) => (
                    <option key={i.id} value={i.id}>
                      {actingImoId === i.id ? "● " : ""}
                      Act as {i.code || i.name}
                    </option>
                  ))}
                  <option value={ALL_IMOS_SENTINEL}>
                    {actingImoId === ALL_IMOS_SENTINEL ? "● " : ""}— All IMOs
                    (cross-tenant) —
                  </option>
                </select>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {!isRecruit && <NotificationDropdown isCollapsed={false} />}
          {isMobile ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onCloseMobile}
            >
              <X size={16} />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onToggleCollapse}
            >
              <ChevronLeft size={16} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
