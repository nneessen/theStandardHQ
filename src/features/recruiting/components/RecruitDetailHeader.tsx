// src/features/recruiting/components/RecruitDetailHeader.tsx
import { useState, useRef } from "react";
import type { UserProfile } from "@/types/hierarchy.types";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Mail, Phone, IdCard, Check, Loader2 } from "lucide-react";
import { TERMINAL_STATUS_COLORS } from "@/types/recruiting.types";
import { cn } from "@/lib/utils";

interface RecruitDetailHeaderProps {
  recruit: UserProfile;
  displayName: string;
  initials: string;
  onUpdateNpn?: (npn: string) => Promise<void>;
  isUpdatingNpn?: boolean;
}

export function RecruitDetailHeader({
  recruit,
  displayName,
  initials,
  onUpdateNpn,
  isUpdatingNpn,
}: RecruitDetailHeaderProps) {
  const [editingNpn, setEditingNpn] = useState(false);
  const [npnValue, setNpnValue] = useState(recruit.npn || "");
  const savingRef = useRef(false);

  const handleNpnSave = async () => {
    if (savingRef.current) return;
    const trimmed = npnValue.trim();
    if (trimmed === (recruit.npn || "")) {
      setEditingNpn(false);
      return;
    }
    savingRef.current = true;
    try {
      if (onUpdateNpn) {
        await onUpdateNpn(trimmed);
      }
      setEditingNpn(false);
    } finally {
      savingRef.current = false;
    }
  };

  return (
    <div className="flex items-center gap-2.5">
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarImage src={recruit.profile_photo_url || undefined} />
        <AvatarFallback className="text-xs font-medium bg-v2-ring">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-v2-ink truncate">
            {displayName}
          </h2>
          <Badge
            variant="secondary"
            className={cn(
              "text-[10px] px-1.5 py-0 h-4",
              recruit.onboarding_status
                ? TERMINAL_STATUS_COLORS[recruit.onboarding_status] ||
                    "bg-blue-100 text-blue-800"
                : "",
            )}
          >
            {recruit.onboarding_status?.replace(/_/g, " ") || "New"}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-v2-ink-muted">
          {recruit.email && (
            <a
              href={`mailto:${recruit.email}`}
              className="flex items-center gap-0.5 hover:text-v2-ink dark:hover:text-v2-ink-subtle truncate"
            >
              <Mail className="h-3 w-3" />
              <span className="truncate max-w-[140px]">{recruit.email}</span>
            </a>
          )}
          {recruit.phone && (
            <a
              href={`tel:${recruit.phone}`}
              className="flex items-center gap-0.5 hover:text-v2-ink dark:hover:text-v2-ink-subtle"
            >
              <Phone className="h-3 w-3" />
              {recruit.phone}
            </a>
          )}
          {onUpdateNpn && (
            <>
              <span className="text-v2-ink-subtle">|</span>
              {editingNpn ? (
                <div className="flex items-center gap-1">
                  <IdCard className="h-3 w-3 text-v2-ink-subtle" />
                  <Input
                    value={npnValue}
                    onChange={(e) => setNpnValue(e.target.value)}
                    onBlur={handleNpnSave}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleNpnSave();
                      if (e.key === "Escape") {
                        setNpnValue(recruit.npn || "");
                        setEditingNpn(false);
                      }
                    }}
                    placeholder="NPN #"
                    autoFocus
                    className="h-4 w-24 text-[11px] px-1 py-0 border-v2-ring"
                  />
                  {isUpdatingNpn && (
                    <Loader2 className="h-3 w-3 animate-spin text-v2-ink-subtle" />
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setNpnValue(recruit.npn || "");
                    setEditingNpn(true);
                  }}
                  className={cn(
                    "flex items-center gap-0.5 hover:text-v2-ink dark:hover:text-v2-ink-subtle",
                    recruit.npn
                      ? "text-v2-ink-muted"
                      : "text-amber-500 dark:text-amber-400",
                  )}
                  title={recruit.npn ? "Edit NPN" : "Set NPN"}
                >
                  {recruit.npn ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-500" />
                      NPN: {recruit.npn}
                    </>
                  ) : (
                    <>
                      <IdCard className="h-3 w-3" />
                      Set NPN
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
