import { useState } from "react";
import { Check, ChevronDown, Eye, FileText, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useEmailTemplates } from "../hooks/useEmailTemplates";
import type { EmailTemplate } from "@/types/email.types";

interface TemplatePickerProps {
  onSelect: (template: EmailTemplate) => void;
  onCreateNew?: () => void;
  selectedTemplateId?: string;
  category?: string;
  className?: string;
}

export function TemplatePicker({
  onSelect,
  onCreateNew,
  selectedTemplateId,
  category,
  className,
}: TemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(
    null,
  );

  const { data: templates, isLoading } = useEmailTemplates(
    category ? { category } : undefined,
  );

  // Filter templates by search
  const filteredTemplates =
    templates?.filter((t) =>
      t.name.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];

  // Group by category
  const groupedTemplates = filteredTemplates.reduce(
    (acc, template) => {
      const cat = template.category || "General";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(template);
      return acc;
    },
    {} as Record<string, EmailTemplate[]>,
  );

  const selectedTemplate = templates?.find((t) => t.id === selectedTemplateId);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-1.5", className)}
          >
            <FileText className="h-3.5 w-3.5" />
            <span className="text-xs">
              {selectedTemplate?.name || "Use Template"}
            </span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          {/* Search */}
          <div className="border-b p-2">
            <Input
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 text-xs"
            />
          </div>

          {/* Fixed-height scroll div with wheel stopPropagation — prevents Radix DismissableLayer
              from intercepting wheel events before they reach this container */}
          <div
            className="h-[280px] overflow-y-auto overscroll-contain"
            onWheel={(e) => e.stopPropagation()}
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-xs text-muted-foreground">
                  {search
                    ? "No templates match your search"
                    : "No templates yet"}
                </p>
                {onCreateNew && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onCreateNew();
                      setOpen(false);
                    }}
                    className="mt-2 h-7 text-xs"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Create Template
                  </Button>
                )}
              </div>
            ) : (
              <div className="p-1">
                {Object.entries(groupedTemplates).map(([cat, catTemplates]) => (
                  <div key={cat}>
                    <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      {cat}
                    </div>
                    {catTemplates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => {
                          onSelect(template);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-accent",
                          selectedTemplateId === template.id && "bg-accent",
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-medium truncate">
                              {template.name}
                            </span>
                            {selectedTemplateId === template.id && (
                              <Check className="h-3 w-3 text-primary shrink-0" />
                            )}
                          </div>
                          {template.subject && (
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                              {template.subject}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewTemplate(template);
                          }}
                          className="shrink-0 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          title="Preview template"
                        >
                          <Eye className="h-3 w-3" />
                        </button>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Create new */}
          {onCreateNew && filteredTemplates.length > 0 && (
            <div className="border-t p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onCreateNew();
                  setOpen(false);
                }}
                className="w-full h-7 justify-start text-xs"
              >
                <Plus className="mr-1.5 h-3 w-3" />
                Create New Template
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Preview dialog — rendered outside Popover to avoid portal/dismiss conflicts.
          No flex-col/flex-1: let the dialog grid shrink to content, cap only the body. */}
      <Dialog
        open={!!previewTemplate}
        onOpenChange={(o) => !o && setPreviewTemplate(null)}
      >
        <DialogContent className="max-w-xl w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="text-sm pr-6">
              {previewTemplate?.name}
            </DialogTitle>
            {previewTemplate?.subject && (
              <DialogDescription className="text-xs">
                Subject: {previewTemplate.subject}
              </DialogDescription>
            )}
          </DialogHeader>
          {/* Body capped at 40vh so header + footer always stay in viewport */}
          <div className="overflow-y-auto border rounded-md bg-card p-3 max-h-[40vh]">
            <div
              className="prose prose-sm max-w-none text-sm"
              dangerouslySetInnerHTML={{
                __html: previewTemplate?.body_html ?? "",
              }}
            />
          </div>
          <div className="flex justify-between items-center border-t pt-2">
            {previewTemplate?.variables &&
            previewTemplate.variables.length > 0 ? (
              <p className="text-[10px] text-muted-foreground truncate mr-2">
                Variables: {previewTemplate.variables.join(", ")}
              </p>
            ) : (
              <span />
            )}
            <Button
              size="sm"
              className="shrink-0 h-7 text-xs"
              onClick={() => {
                onSelect(previewTemplate!);
                setPreviewTemplate(null);
                setOpen(false);
              }}
            >
              Use This Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
