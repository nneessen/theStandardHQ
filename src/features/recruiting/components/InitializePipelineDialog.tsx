// src/features/recruiting/components/InitializePipelineDialog.tsx
// Dialog for selecting a pipeline template when initializing recruit progress

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileStack, Check } from "lucide-react";
import { useTemplates } from "../hooks/usePipeline";
import { filterUserSelectableTemplates } from "../utils/template-filters";
import type { PipelineTemplate } from "@/types/recruiting.types";
import { cn } from "@/lib/utils";

interface InitializePipelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (templateId: string) => Promise<void> | void;
  isLoading?: boolean;
}

export function InitializePipelineDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: InitializePipelineDialogProps) {
  const { data: allTemplates, isLoading: templatesLoading } = useTemplates();
  // Only the two DEFAULT-named templates are user-selectable; legacy / system
  // templates stay in the DB but don't appear in the picker.
  const templates = useMemo(
    () => filterUserSelectableTemplates(allTemplates),
    [allTemplates],
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );

  // Stable ref so the auto-confirm effect doesn't re-run when the parent
  // re-renders and produces a new callback reference (React 19: no useCallback).
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  // Prevent duplicate auto-confirm fires within a single open session.
  const autoConfirmedRef = useRef(false);
  useEffect(() => {
    if (!open) autoConfirmedRef.current = false;
  }, [open]);

  // Set default template when templates load
  useEffect(() => {
    if (templates && templates.length > 0 && !selectedTemplateId) {
      // Prefer the default template, otherwise pick the first one
      const defaultTemplate = templates.find((t) => t.is_default);
      setSelectedTemplateId(defaultTemplate?.id || templates[0].id);
    }
  }, [templates, selectedTemplateId]);

  const handleConfirm = () => {
    if (selectedTemplateId) {
      // onConfirm (= handleConfirmInitialize) has internal try/catch — won't reject
      void onConfirmRef.current(selectedTemplateId);
    }
  };

  // Auto-confirm if only one template exists. Uses onConfirmRef to avoid
  // retriggering on every parent render, and autoConfirmedRef to fire at most once.
  useEffect(() => {
    if (
      open &&
      templates &&
      templates.length === 1 &&
      !isLoading &&
      !autoConfirmedRef.current
    ) {
      autoConfirmedRef.current = true;
      void onConfirmRef.current(templates[0].id);
    }
    // onConfirmRef is a stable ref — intentionally excluded from deps
  }, [open, templates, isLoading]);

  // Don't render dialog if only one template (auto-confirmed above)
  if (templates && templates.length === 1) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5 text-sm">
            <FileStack className="h-4 w-4" />
            Select Pipeline
          </DialogTitle>
          <DialogDescription className="text-xs">
            Choose which pipeline to use for this recruit.
          </DialogDescription>
        </DialogHeader>

        {templatesLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : templates && templates.length > 0 ? (
          <RadioGroup
            value={selectedTemplateId || ""}
            onValueChange={setSelectedTemplateId}
            className="space-y-1.5"
          >
            {templates.map((template: PipelineTemplate) => {
              const isSelected = selectedTemplateId === template.id;
              return (
                <div
                  key={template.id}
                  className={cn(
                    "flex items-center gap-2 py-2 px-2.5 rounded-md border cursor-pointer transition-colors",
                    isSelected
                      ? "border-foreground bg-accent"
                      : "border-border hover:border-foreground/30 hover:bg-accent/50",
                  )}
                  onClick={() => setSelectedTemplateId(template.id)}
                >
                  <div
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      isSelected
                        ? "border-foreground bg-foreground text-background"
                        : "border-muted-foreground/50",
                    )}
                  >
                    {isSelected && <Check className="h-2.5 w-2.5" />}
                  </div>
                  <RadioGroupItem
                    value={template.id}
                    id={template.id}
                    className="sr-only"
                  />
                  <Label
                    htmlFor={template.id}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-foreground">
                        {template.name}
                      </span>
                      {template.is_default && (
                        <Badge
                          variant="secondary"
                          className="text-[9px] h-3.5 px-1"
                        >
                          Default
                        </Badge>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                        {template.description}
                      </p>
                    )}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        ) : (
          <div className="py-6 text-center">
            <FileStack className="h-6 w-6 text-muted-foreground/50 mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground">
              No pipeline templates found
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              Create a template in Pipeline Admin first.
            </p>
          </div>
        )}

        <DialogFooter className="gap-1">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="h-7 text-xs"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedTemplateId || isLoading || templatesLoading}
            className="h-7 text-xs"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Initializing...
              </>
            ) : (
              "Initialize"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
