// src/features/call-reviews/components/LikeButton.tsx
// Presentational heart + count. Stateless: the parent supplies whether the
// current user liked it and the toggle handler (so the my-likes set is fetched
// once per page, not once per row). Used in the library list and on the detail
// page. MUST sit OUTSIDE the row's navigation <Link>, or a click navigates
// instead of toggling.

import { Heart } from "lucide-react";

interface LikeButtonProps {
  liked: boolean;
  count: number;
  onToggle: () => void;
  disabled?: boolean;
  /** "sm" for the dense table row, "md" for the detail header. */
  size?: "sm" | "md";
}

export function LikeButton({
  liked,
  count,
  onToggle,
  disabled,
  size = "sm",
}: LikeButtonProps) {
  const icon = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  const text = size === "md" ? "text-xs" : "text-[11px]";
  return (
    <button
      type="button"
      title={liked ? "Remove your like" : "Like this call"}
      aria-pressed={liked}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) onToggle();
      }}
      disabled={disabled}
      className={`inline-flex items-center gap-1 rounded px-1 py-0.5 ${text} tabular-nums transition-colors hover:bg-rose-50 disabled:opacity-50 ${
        liked ? "text-rose-600" : "text-v2-ink-subtle hover:text-rose-600"
      }`}
    >
      <Heart className={`${icon} ${liked ? "fill-current" : ""}`} />
      <span>{count}</span>
    </button>
  );
}
