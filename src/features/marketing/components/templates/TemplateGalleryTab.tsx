import { Loader2, LayoutTemplate } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEmailTemplates, blocksToHtml } from "@/features/email";
import { STARTER_TEMPLATES } from "../../services/starterTemplateService";
import { toast } from "sonner";
import type { StarterTemplate } from "../../types/marketing.types";
import type { EmailTemplate } from "@/types/email.types";

// ─────────────────────────────────────────────────────────────────────────────
// TemplateCard — inline helper component
// ─────────────────────────────────────────────────────────────────────────────

interface StarterTemplateCardProps {
  template: StarterTemplate;
}

function StarterTemplateCard({ template }: StarterTemplateCardProps) {
  const previewHtml = blocksToHtml(template.blocks, {});

  const handleUseTemplate = () => {
    toast.info(`"${template.name}" — template editor coming soon.`);
  };

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
        onClick={handleUseTemplate}
      >
        Use Template
      </Button>
    </div>
  );
}

interface SavedTemplateCardProps {
  template: EmailTemplate;
}

function SavedTemplateCard({ template }: SavedTemplateCardProps) {
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TemplateGalleryTab
// ─────────────────────────────────────────────────────────────────────────────

export function TemplateGalleryTab() {
  const { data: savedTemplates, isLoading } = useEmailTemplates();

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
            <StarterTemplateCard key={template.id} template={template} />
          ))}
        </div>
      </section>

      {/* Saved Templates */}
      <section className="flex flex-col gap-2">
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
              <SavedTemplateCard key={template.id} template={template} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
