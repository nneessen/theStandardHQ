import {
  Download,
  ExternalLink,
  FileText,
  Folder,
  Loader2,
  Trash2,
} from "lucide-react";
import { T } from "@/components/board";
import { CategoryBadge } from "./CategoryBadge";
import {
  ACCENT,
  fmtDate,
  fmtSize,
  tint,
  type EnrichedGuide,
} from "./guideAttributes";

interface GuidePreviewProps {
  guide: EnrichedGuide | null;
  canManage: boolean;
  opening: boolean;
  downloading: boolean;
  onOpen: (guide: EnrichedGuide) => void;
  onDownload: (guide: EnrichedGuide) => void;
  onDelete: (guide: EnrichedGuide) => void;
}

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "7px 0",
        borderBottom: `1px solid ${T.line}`,
      }}
    >
      <span
        style={{
          font: `600 11px ${T.data}`,
          color: T.mut2,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <span
        className="min-w-0 truncate text-right"
        style={{ font: `600 12px ${T.data}`, color: T.ink }}
      >
        {children}
      </span>
    </div>
  );
}

/**
 * Pane 3 — the preview / detail pane. A faux PDF cover (carrier-colored band +
 * full carrier name, never initials), the document title, a facts card, and the
 * Open / Download actions.
 */
export function GuidePreview({
  guide,
  canManage,
  opening,
  downloading,
  onOpen,
  onDownload,
  onDelete,
}: GuidePreviewProps) {
  if (!guide) {
    return (
      <div
        style={{
          background: T.panelGradient,
          borderLeft: `1px solid ${T.line}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: 20,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: "50%",
            border: `1.5px dashed ${T.line2}`,
            display: "grid",
            placeItems: "center",
            color: T.mut2,
          }}
        >
          <FileText className="h-5 w-5" />
        </div>
        <div style={{ font: `600 12.5px ${T.data}`, color: T.mut }}>
          Select a document to preview
        </div>
      </div>
    );
  }

  const accent = guide._accent;
  const carrierName = guide.carrier?.name ?? "Unknown carrier";

  return (
    <div
      style={{
        background: T.panelGradient,
        borderLeft: `1px solid ${T.line}`,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflowY: "auto",
        padding: 16,
        gap: 14,
      }}
    >
      {/* Faux PDF cover */}
      <div
        style={{
          alignSelf: "center",
          width: "78%",
          maxWidth: 210,
          aspectRatio: "8.5 / 11",
          background: "#ffffff",
          borderRadius: 6,
          boxShadow: "0 10px 26px rgba(0,0,0,0.35)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            background: ACCENT[accent],
            padding: "12px 12px 10px",
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          <Folder className="h-4 w-4 shrink-0" style={{ color: "#fff" }} />
          <span
            className="truncate"
            style={{
              font: `700 11px ${T.data}`,
              color: "#fff",
              letterSpacing: "0.01em",
            }}
            title={carrierName}
          >
            {carrierName}
          </span>
        </div>
        <div
          style={{
            flex: 1,
            padding: "14px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 7,
          }}
        >
          <div
            style={{
              height: 9,
              width: "82%",
              borderRadius: 3,
              background: "#2b2b2b",
            }}
          />
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 5,
                width: `${[96, 88, 92, 70, 84, 60, 78][i]}%`,
                borderRadius: 3,
                background: "#e2e3e6",
              }}
            />
          ))}
        </div>
      </div>

      {/* Title */}
      <div>
        <div
          style={{
            font: `800 17px ${T.disp}`,
            color: T.ink,
            lineHeight: 1.25,
          }}
        >
          {guide.name}
        </div>
        <div
          style={{
            marginTop: 3,
            font: `600 11px ${T.mono}`,
            color: T.mut2,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          PDF · {fmtSize(guide.file_size_bytes)}
        </div>
      </div>

      {/* Facts card */}
      <div
        style={{
          background: T.panel,
          borderRadius: 10,
          border: `1px solid ${T.line}`,
          padding: "4px 12px",
        }}
      >
        <Fact label="Carrier">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: ACCENT[accent],
              }}
            />
            <span className="truncate">{carrierName}</span>
          </span>
        </Fact>
        <Fact label="Category">
          <CategoryBadge category={guide._category} />
        </Fact>
        <Fact label="Product">{guide._product}</Fact>
        {guide.version ? <Fact label="Version">{guide.version}</Fact> : null}
        <Fact label="File size">
          <span
            style={{ fontFamily: T.mono, fontVariantNumeric: "tabular-nums" }}
          >
            {fmtSize(guide.file_size_bytes)}
          </span>
        </Fact>
        <div style={{ borderBottom: "none" }}>
          <Fact label="Updated">
            {fmtDate(guide.updated_at ?? guide.created_at) || "—"}
          </Fact>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={() => onOpen(guide)}
          disabled={opening}
          style={{
            flex: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            height: 34,
            borderRadius: 8,
            font: `700 12.5px ${T.data}`,
            color: "#fff",
            background: T.blue,
            border: "none",
            cursor: opening ? "default" : "pointer",
            opacity: opening ? 0.7 : 1,
          }}
        >
          {opening ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ExternalLink className="h-3.5 w-3.5" />
          )}
          {opening ? "Opening…" : "Open PDF"}
        </button>
        <button
          type="button"
          onClick={() => onDownload(guide)}
          disabled={downloading}
          aria-label="Download PDF"
          title="Download PDF"
          style={{
            display: "grid",
            placeItems: "center",
            width: 34,
            height: 34,
            borderRadius: 8,
            color: T.mut,
            background: "transparent",
            border: `1px solid ${T.line}`,
            cursor: downloading ? "default" : "pointer",
          }}
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </button>
        {canManage ? (
          <button
            type="button"
            onClick={() => onDelete(guide)}
            aria-label="Delete guide"
            title="Delete guide"
            style={{
              display: "grid",
              placeItems: "center",
              width: 34,
              height: 34,
              borderRadius: 8,
              color: T.mut,
              background: "transparent",
              border: `1px solid ${T.line}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = T.red;
              e.currentTarget.style.background = tint("slate", 8);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = T.mut;
              e.currentTarget.style.background = "transparent";
            }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
