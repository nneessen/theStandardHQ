import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Layers,
} from "lucide-react";
import { T } from "@/components/board";
import { CategoryBadge } from "./CategoryBadge";
import {
  ACCENT,
  CATEGORY_ACCENT,
  fmtDate,
  fmtSize,
  tint,
  type EnrichedGuide,
} from "./guideAttributes";
import type { Scope } from "./CarrierRail";

export const PAGE_SIZES = [9, 18, 30] as const;

interface DocumentListProps {
  scope: Scope;
  rows: EnrichedGuide[];
  totalFiltered: number;
  page: number;
  pageSize: number;
  sortDir: "asc" | "desc";
  selectedId: string | null;
  showCarrierCol: boolean;
  onSelect: (id: string) => void;
  onOpen: (guide: EnrichedGuide) => void;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  onToggleSort: () => void;
}

/** Up-to-5 windowed page numbers centered on the current page. */
function pageWindow(page: number, totalPages: number): number[] {
  const span = Math.min(5, totalPages);
  let start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + span - 1);
  start = Math.max(1, end - span + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function DocumentList({
  scope,
  rows,
  totalFiltered,
  page,
  pageSize,
  sortDir,
  selectedId,
  showCarrierCol,
  onSelect,
  onOpen,
  onPage,
  onPageSize,
  onToggleSort,
}: DocumentListProps) {
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const start = totalFiltered === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalFiltered);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        background: T.bg,
      }}
    >
      {/* List header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          borderBottom: `1px solid ${T.line}`,
          flexShrink: 0,
        }}
      >
        {scope.kind === "carrier" ? (
          <span
            aria-hidden
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: ACCENT[scope.accent],
            }}
          />
        ) : scope.kind === "category" ? (
          <span
            aria-hidden
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: ACCENT[CATEGORY_ACCENT[scope.category]],
            }}
          />
        ) : (
          <Layers className="h-4 w-4" style={{ color: T.mut }} />
        )}
        <span
          className="truncate"
          style={{ font: `700 14px ${T.disp}`, color: T.ink }}
        >
          {scope.kind === "carrier"
            ? scope.name
            : scope.kind === "category"
              ? scope.category
              : "All documents"}
        </span>
        <span
          style={{
            font: `600 11px ${T.mono}`,
            color: T.mut2,
            background: tint("slate", 10),
            borderRadius: 999,
            padding: "1px 8px",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {totalFiltered}
        </span>
        <button
          type="button"
          onClick={onToggleSort}
          className="ml-auto"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            height: 26,
            padding: "0 9px",
            borderRadius: 6,
            font: `600 11px ${T.data}`,
            color: T.mut,
            background: "transparent",
            border: `1px solid ${T.line}`,
          }}
          title={`Sort by name (${sortDir === "asc" ? "A→Z" : "Z→A"})`}
        >
          <ArrowUpDown className="h-3 w-3" />
          Name
        </button>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {rows.length === 0 ? (
          <div
            style={{
              padding: "40px 16px",
              textAlign: "center",
              font: `500 12.5px ${T.data}`,
              color: T.mut2,
            }}
          >
            No documents match the current filter.
          </div>
        ) : (
          rows.map((g) => {
            const active = g.id === selectedId;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => onSelect(g.id)}
                className="group/drow"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  height: 46,
                  padding: "0 12px",
                  textAlign: "left",
                  borderBottom: `1px solid ${T.line}`,
                  background: active ? tint("blue", 10) : "transparent",
                  boxShadow: active
                    ? `inset 0 0 0 1px ${tint("blue", 30)}`
                    : "none",
                  transition: "background 110ms ease",
                }}
                onMouseEnter={(e) => {
                  if (!active)
                    e.currentTarget.style.background = tint("slate", 6);
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 34,
                    height: 34,
                    flexShrink: 0,
                    borderRadius: 8,
                    background: T.surface3,
                    boxShadow: `inset 0 0 0 1px ${T.line}`,
                    display: "grid",
                    placeItems: "center",
                    color: ACCENT.slate,
                  }}
                >
                  <FileText className="h-4 w-4" />
                </span>

                <span
                  className="min-w-0 flex-1 truncate"
                  style={{ font: `600 13px ${T.data}`, color: T.ink }}
                  title={g.name}
                >
                  {g.name}
                </span>

                {showCarrierCol ? (
                  <span
                    className="hidden items-center gap-1.5 truncate md:flex"
                    style={{ width: 140, flexShrink: 0 }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        flexShrink: 0,
                        background: ACCENT[g._accent],
                      }}
                    />
                    <span
                      className="truncate"
                      style={{ font: `500 11.5px ${T.data}`, color: T.mut }}
                      title={g.carrier?.name ?? ""}
                    >
                      {g.carrier?.name ?? "—"}
                    </span>
                  </span>
                ) : null}

                <span
                  className="hidden flex-shrink-0 sm:block"
                  style={{ width: 104 }}
                >
                  <CategoryBadge category={g._category} />
                </span>

                <span
                  className="hidden flex-shrink-0 text-right sm:block"
                  style={{
                    width: 62,
                    font: `600 11px ${T.mono}`,
                    color: T.mut,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmtSize(g.file_size_bytes)}
                </span>

                <span
                  className="hidden flex-shrink-0 text-right md:block"
                  style={{
                    width: 96,
                    font: `500 11px ${T.data}`,
                    color: T.mut2,
                  }}
                >
                  {fmtDate(g.created_at)}
                </span>

                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(g);
                  }}
                  title="Open PDF"
                  className="flex-shrink-0 opacity-100 transition-opacity md:opacity-0 md:group-hover/drow:opacity-100"
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    color: T.mut,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = tint("blue", 14);
                    e.currentTarget.style.color = T.blue;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = T.mut;
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Pager */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 14px",
          borderTop: `1px solid ${T.line}`,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            font: `600 11.5px ${T.mono}`,
            color: T.cream,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {start}–{end} of {totalFiltered}
        </span>

        <label
          className="flex items-center gap-1.5"
          style={{ font: `500 11px ${T.data}`, color: T.mut2 }}
        >
          Rows
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            style={{
              height: 24,
              borderRadius: 6,
              background: T.surface2,
              color: T.ink,
              border: `1px solid ${T.line}`,
              font: `600 11px ${T.mono}`,
              padding: "0 4px",
            }}
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto flex items-center gap-1">
          <PagerBtn
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </PagerBtn>
          {pageWindow(page, totalPages).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPage(p)}
              style={{
                minWidth: 24,
                height: 24,
                padding: "0 6px",
                borderRadius: 6,
                font: `700 11px ${T.mono}`,
                fontVariantNumeric: "tabular-nums",
                color: p === page ? "#fff" : T.mut,
                background: p === page ? T.blue : "transparent",
                border: `1px solid ${p === page ? "transparent" : T.line}`,
              }}
            >
              {p}
            </button>
          ))}
          <PagerBtn
            disabled={page >= totalPages}
            onClick={() => onPage(page + 1)}
            label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </PagerBtn>
        </div>
      </div>
    </div>
  );
}

function PagerBtn({
  disabled,
  onClick,
  label,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        display: "grid",
        placeItems: "center",
        width: 24,
        height: 24,
        borderRadius: 6,
        color: T.mut,
        border: `1px solid ${T.line}`,
        background: "transparent",
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {children}
    </button>
  );
}
