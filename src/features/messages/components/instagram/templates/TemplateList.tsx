// src/features/messages/components/instagram/templates/TemplateList.tsx
// Card list component for displaying Instagram message templates

import { useState, type ReactNode } from "react";
import { Edit2, Eye, Trash2, MessageSquare, Loader2 } from "lucide-react";
import {
  MESSAGE_STAGE_LABELS,
  getCategoryLabel,
  type MessageStage,
  type InstagramMessageTemplate,
  type InstagramTemplateCategory,
} from "@/types/instagram.types";
import { useInstagramTemplateCategories } from "@/hooks";
import { T } from "@/components/board/tokens";
import { TemplateDeleteDialog } from "./TemplateDeleteDialog";

interface TemplateListProps {
  templates: InstagramMessageTemplate[];
  isLoading: boolean;
  onEdit: (template: InstagramMessageTemplate) => void;
  onPreview: (template: InstagramMessageTemplate) => void;
  canEdit: boolean;
}

const STAGE_COLORS: Record<string, string> = {
  opener: T.violet,
  follow_up: T.blue,
  engagement: T.green,
  discovery: T.amber,
  closer: T.mut,
};

const MUT3 = "rgba(255,255,255,0.28)";

/** Highlight {{variable}} tokens in content preview */
function HighlightedContent({ content }: { content: string }): ReactNode {
  const parts = content.split(/({{[^}]+}})/g);
  return (
    <>
      {parts.map((part, i) => {
        if (/^{{[^}]+}}$/.test(part)) {
          return (
            <span
              key={i}
              style={{
                color: T.violet,
                fontWeight: 600,
              }}
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function TemplateCard({
  template,
  customCategories,
  onEdit,
  onPreview,
  onDelete,
  canEdit,
}: {
  template: InstagramMessageTemplate;
  customCategories: InstagramTemplateCategory[];
  onEdit: (t: InstagramMessageTemplate) => void;
  onPreview: (t: InstagramMessageTemplate) => void;
  onDelete: (t: InstagramMessageTemplate) => void;
  canEdit: boolean;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: T.surface3,
        border: `1px solid ${hover ? T.line2 : T.line}`,
        borderRadius: 13,
        padding: "15px 17px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        transition: "border-color .12s",
      }}
    >
      {/* Row 1: name + stage chip */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}
      >
        <span
          style={{
            font: `800 14px ${T.disp}`,
            color: T.cream,
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {template.name}
        </span>
        {template.message_stage && (
          <span
            style={{
              flexShrink: 0,
              height: 20,
              padding: "0 8px",
              borderRadius: 5,
              background: "rgba(182,155,255,0.16)",
              border: "1px solid rgba(182,155,255,0.30)",
              color: STAGE_COLORS[template.message_stage] ?? T.violet,
              font: `700 10px ${T.mono}`,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            {MESSAGE_STAGE_LABELS[template.message_stage as MessageStage] ||
              template.message_stage}
          </span>
        )}
        {template.category && (
          <span
            style={{
              flexShrink: 0,
              height: 20,
              padding: "0 8px",
              borderRadius: 5,
              background: "rgba(182,155,255,0.10)",
              border: `1px solid ${T.line}`,
              color: T.mut,
              font: `600 10px ${T.data}`,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            {getCategoryLabel(template.category, customCategories)}
          </span>
        )}
      </div>

      {/* Row 2: content preview */}
      <button
        type="button"
        onClick={() => onPreview(template)}
        title="Preview full content"
        style={{
          textAlign: "left",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          font: `500 12.5px/1.55 ${T.data}`,
          color: T.mut,
        }}
      >
        <HighlightedContent content={template.content} />
      </button>

      {/* Row 3: footer — usage + actions */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 2 }}
      >
        <span
          style={{
            font: `700 10px ${T.mono}`,
            letterSpacing: "0.10em",
            color: MUT3,
            textTransform: "uppercase",
          }}
        >
          {template.use_count || 0} uses
        </span>
        <span style={{ flex: 1 }} />

        {/* Preview (violet-tint primary action) */}
        <button
          type="button"
          onClick={() => onPreview(template)}
          title="Preview template"
          style={{
            height: 28,
            padding: "0 12px",
            borderRadius: 7,
            background: "rgba(182,155,255,0.16)",
            border: "1px solid rgba(182,155,255,0.30)",
            color: T.violet,
            font: `600 11px ${T.data}`,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Eye style={{ width: 12, height: 12 }} />
          Preview
        </button>

        {canEdit && (
          <>
            <button
              type="button"
              onClick={() => onEdit(template)}
              title="Edit template"
              style={{
                height: 28,
                padding: "0 12px",
                borderRadius: 7,
                background: "transparent",
                border: `1px solid ${T.line2}`,
                color: T.mut,
                font: `600 11px ${T.data}`,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Edit2 style={{ width: 11, height: 11 }} />
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(template)}
              title="Delete template"
              style={{
                height: 28,
                width: 28,
                borderRadius: 7,
                background: "transparent",
                border: `1px solid ${T.line}`,
                color: T.red,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Trash2 style={{ width: 12, height: 12 }} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function TemplateList({
  templates,
  isLoading,
  onEdit,
  onPreview,
  canEdit,
}: TemplateListProps): ReactNode {
  const [deleteTemplate, setDeleteTemplate] =
    useState<InstagramMessageTemplate | null>(null);
  const { data: customCategories = [] } = useInstagramTemplateCategories();

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 160,
        }}
      >
        <Loader2
          style={{
            width: 20,
            height: 20,
            color: T.mut2,
            animation: "spin 1s linear infinite",
          }}
        />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: 160,
          gap: 8,
          textAlign: "center",
        }}
      >
        <MessageSquare style={{ width: 28, height: 28, color: T.mut2 }} />
        <span style={{ font: `600 13px ${T.data}`, color: T.mut }}>
          No templates found
        </span>
        <span style={{ font: `500 11.5px ${T.data}`, color: T.mut2 }}>
          {canEdit
            ? "Create a template to get started"
            : "No templates match your filter criteria"}
        </span>
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: "14px 16px",
        }}
      >
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            customCategories={customCategories}
            onEdit={onEdit}
            onPreview={onPreview}
            onDelete={setDeleteTemplate}
            canEdit={canEdit}
          />
        ))}
      </div>

      <TemplateDeleteDialog
        template={deleteTemplate}
        onClose={() => setDeleteTemplate(null)}
      />
    </>
  );
}
