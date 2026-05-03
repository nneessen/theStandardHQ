import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Loader2,
  LayoutTemplate,
  Plus,
  Pencil,
  Copy,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useEmailTemplates,
  useDeleteEmailTemplate,
  useDuplicateEmailTemplate,
  blocksToHtml,
} from "@/features/email";
import { STARTER_TEMPLATES } from "../../services/starterTemplateService";
import { toast } from "sonner";
import type { StarterTemplate } from "../../types/marketing.types";
import type {
  EmailBlock,
  EmailTemplate,
  ColumnsBlockContent,
} from "@/types/email.types";

// Deep-clone blocks with fresh UUIDs
function cloneBlocksWithNewIds(blocks: EmailBlock[]): EmailBlock[] {
  return blocks.map((b): EmailBlock => {
    const newId = crypto.randomUUID();
    if (
      b.type === "columns" &&
      b.content.type === "columns" &&
      "columns" in b.content
    ) {
      const src = b.content as ColumnsBlockContent;
      return {
        ...b,
        id: newId,
        content: {
          ...src,
          columns: src.columns.map((col) => ({
            blocks: cloneBlocksWithNewIds(col.blocks),
          })),
        },
      };
    }
    return { ...b, id: newId };
  });
}

interface TemplateGalleryTabProps {
  onStartCampaignWithBlocks?: (blocks: EmailBlock[], subject?: string) => void;
}

interface StarterTemplateCardProps {
  template: StarterTemplate;
  onUse: () => void;
}

function StarterTemplateCard({ template, onUse }: StarterTemplateCardProps) {
  const previewHtml = blocksToHtml(template.blocks, {});

  return (
    <div className="flex flex-col gap-1.5 rounded border border-border bg-card p-2">
      <div className="h-[120px] overflow-hidden rounded-sm border border-border bg-white">
        <div
          className="origin-top-left"
          style={{ transform: "scale(0.25)", width: "400%", height: "400%" }}
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </div>

      <div className="flex items-start justify-between gap-1">
        <span className="text-[11px] font-medium leading-tight text-foreground line-clamp-1">
          {template.name}
        </span>
        <Badge
          variant="secondary"
          className="h-4 shrink-0 px-1 text-[10px] leading-none"
        >
          {template.category}
        </Badge>
      </div>

      <Button
        size="sm"
        variant="outline"
        className="h-5 w-full text-[10px]"
        onClick={onUse}
      >
        Use Template
      </Button>
    </div>
  );
}

interface SavedTemplateCardProps {
  template: EmailTemplate;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onUse: () => void;
  deleting: boolean;
  duplicating: boolean;
}

function SavedTemplateCard({
  template,
  onEdit,
  onDuplicate,
  onDelete,
  onUse,
  deleting,
  duplicating,
}: SavedTemplateCardProps) {
  const previewHtml = template.body_html ?? "";

  return (
    <div className="flex flex-col gap-1.5 rounded border border-border bg-card p-2">
      <div className="h-[120px] overflow-hidden rounded-sm border border-border bg-white">
        <div
          className="origin-top-left"
          style={{ transform: "scale(0.25)", width: "400%", height: "400%" }}
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </div>

      <div className="flex items-start justify-between gap-1">
        <span className="text-[11px] font-medium leading-tight text-foreground line-clamp-1">
          {template.name}
        </span>
        <Badge
          variant="secondary"
          className="h-4 shrink-0 px-1 text-[10px] leading-none"
        >
          {template.category}
        </Badge>
      </div>

      <div className="flex gap-1">
        <Button
          size="sm"
          variant="outline"
          className="h-5 flex-1 text-[10px]"
          onClick={onUse}
        >
          Use
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-5 w-5 p-0"
          onClick={onEdit}
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-5 w-5 p-0"
          onClick={onDuplicate}
          disabled={duplicating}
        >
          {duplicating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-5 w-5 p-0 text-destructive hover:text-destructive"
          onClick={onDelete}
          disabled={deleting}
        >
          {deleting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
        </Button>
      </div>
    </div>
  );
}

export function TemplateGalleryTab({
  onStartCampaignWithBlocks,
}: TemplateGalleryTabProps) {
  const navigate = useNavigate();
  const { data: savedTemplates, isLoading } = useEmailTemplates();
  const deleteTemplate = useDeleteEmailTemplate();
  const duplicateTemplate = useDuplicateEmailTemplate();

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  function handleUseStarter(template: StarterTemplate) {
    if (onStartCampaignWithBlocks) {
      const blocks = cloneBlocksWithNewIds(template.blocks);
      onStartCampaignWithBlocks(blocks, template.name);
    } else {
      toast.info("Switch to the Campaigns tab to use this template.");
    }
  }

  function handleUseSaved(template: EmailTemplate) {
    if (onStartCampaignWithBlocks) {
      const blocks = template.blocks
        ? cloneBlocksWithNewIds(template.blocks)
        : [];
      onStartCampaignWithBlocks(blocks, template.subject);
    } else {
      toast.info("Switch to the Campaigns tab to use this template.");
    }
  }

  function handleEdit(template: EmailTemplate) {
    navigate({ to: `/marketing/templates/${template.id}/edit` });
  }

  function handleDuplicate(template: EmailTemplate) {
    setDuplicatingId(template.id);
    duplicateTemplate.mutate(template.id, {
      onSuccess: () => {
        toast.success("Template duplicated.");
        setDuplicatingId(null);
      },
      onError: () => {
        toast.error("Failed to duplicate template.");
        setDuplicatingId(null);
      },
    });
  }

  function handleDelete(template: EmailTemplate) {
    setDeletingId(template.id);
    deleteTemplate.mutate(template.id, {
      onSuccess: () => {
        toast.success("Template deleted.");
        setDeletingId(null);
      },
      onError: () => {
        toast.error("Failed to delete template.");
        setDeletingId(null);
      },
    });
  }

  return (
    <div className="flex flex-col gap-4 p-2">
      {/* Starter Templates */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <LayoutTemplate className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold text-foreground">
            Starter Templates
          </span>
          <Badge
            variant="secondary"
            className="h-4 px-1 text-[10px] leading-none"
          >
            {STARTER_TEMPLATES.length}
          </Badge>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {STARTER_TEMPLATES.map((template) => (
            <StarterTemplateCard
              key={template.id}
              template={template}
              onUse={() => handleUseStarter(template)}
            />
          ))}
        </div>
      </section>

      {/* Saved Templates */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <LayoutTemplate className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-foreground">
              Saved Templates
            </span>
            {!isLoading && savedTemplates !== undefined && (
              <Badge
                variant="secondary"
                className="h-4 px-1 text-[10px] leading-none"
              >
                {savedTemplates.length}
              </Badge>
            )}
          </div>
          <Button
            size="sm"
            className="h-6 text-[11px] gap-1"
            onClick={() => navigate({ to: "/marketing/templates/new" })}
          >
            <Plus className="h-3 w-3" />
            Create Template
          </Button>
        </div>

        {isLoading ? (
          <div className="flex h-20 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : !savedTemplates || savedTemplates.length === 0 ? (
          <div className="flex h-20 flex-col items-center justify-center gap-1 rounded border border-dashed border-border">
            <LayoutTemplate className="h-4 w-4 text-muted-foreground/50" />
            <span className="text-[10px] text-muted-foreground">
              No saved templates yet
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {savedTemplates.map((template) => (
              <SavedTemplateCard
                key={template.id}
                template={template}
                onUse={() => handleUseSaved(template)}
                onEdit={() => handleEdit(template)}
                onDuplicate={() => handleDuplicate(template)}
                onDelete={() => handleDelete(template)}
                deleting={deletingId === template.id}
                duplicating={duplicatingId === template.id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
