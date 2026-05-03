// src/features/close-kpi/components/WidgetConfigSheet.tsx
// Right-sliding sheet for editing a widget's title and configuration.

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { getConfigForm } from "../config/config-form-map";
import { WIDGET_REGISTRY } from "../config/widget-registry";
import {
  useUpdateWidget,
  useDeleteWidget,
} from "../hooks/useCloseKpiDashboard";
import { ACCENT_SWATCHES, getAccentStyle } from "../lib/widget-styles";
import type {
  CloseKpiWidget,
  WidgetAccentColor,
  WidgetConfig,
  WidgetSize,
} from "../types/close-kpi.types";

interface WidgetConfigSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widget: CloseKpiWidget | null;
}

export const WidgetConfigSheet: React.FC<WidgetConfigSheetProps> = ({
  open,
  onOpenChange,
  widget,
}) => {
  const updateWidget = useUpdateWidget();
  const deleteWidget = useDeleteWidget();

  // Local form state — reset when widget changes
  const [title, setTitle] = useState("");
  const [size, setSize] = useState<WidgetSize>("medium");
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (widget) {
      setTitle(widget.title);
      setSize(widget.size);
      setConfig(widget.config);
      setConfirmDelete(false);
    }
  }, [widget]);

  const registry = widget ? WIDGET_REGISTRY[widget.widget_type] : null;
  const ConfigForm = widget ? getConfigForm(widget.widget_type) : null;

  const handleSave = useCallback(async () => {
    if (!widget || !config) return;
    try {
      await updateWidget.mutateAsync({
        widgetId: widget.id,
        updates: { title, size, config },
      });
      toast.success("Widget updated");
      onOpenChange(false);
    } catch {
      toast.error("Failed to update widget");
    }
  }, [widget, config, title, size, updateWidget, onOpenChange]);

  const handleDelete = useCallback(async () => {
    if (!widget) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await deleteWidget.mutateAsync(widget.id);
      toast.success("Widget removed");
      onOpenChange(false);
    } catch {
      toast.error("Failed to remove widget");
    }
  }, [widget, confirmDelete, deleteWidget, onOpenChange]);

  const isSaving = updateWidget.isPending;
  const isDeleting = deleteWidget.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[340px] sm:w-[380px] flex flex-col"
      >
        <SheetHeader>
          <SheetTitle className="text-sm font-bold">
            Configure Widget
          </SheetTitle>
          <SheetDescription className="text-[10px] text-muted-foreground">
            {registry?.label ?? "Widget"} settings
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-3 py-3">
          {/* Title */}
          <div>
            <Label className="text-[10px] text-muted-foreground">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-7 text-[11px]"
              placeholder="Widget title"
            />
          </div>

          {/* Size */}
          {registry && registry.allowedSizes.length > 1 && (
            <div>
              <Label className="text-[10px] text-muted-foreground">Size</Label>
              <Select
                value={size}
                onValueChange={(v) => setSize(v as WidgetSize)}
              >
                <SelectTrigger className="h-7 text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {registry.allowedSizes.map((s) => (
                    <SelectItem key={s} value={s} className="text-[11px]">
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Color */}
          <div>
            <Label className="text-[10px] text-muted-foreground mb-1.5 block">
              Color
            </Label>
            <div className="flex items-center gap-2">
              {ACCENT_SWATCHES.map((sw) => {
                const isSelected = (config?.accentColor ?? "zinc") === sw.color;
                return (
                  <button
                    key={sw.color}
                    type="button"
                    title={sw.label}
                    onClick={() => {
                      if (!config) return;
                      setConfig({
                        ...config,
                        accentColor: sw.color as WidgetAccentColor,
                      });
                    }}
                    className={`h-6 w-6 rounded-full transition-all ${sw.swatch} ${
                      isSelected
                        ? `ring-2 ring-offset-2 ring-offset-background ${getAccentStyle(sw.color).ring}`
                        : "hover:scale-110"
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Config Form */}
          {ConfigForm && config ? (
            <ConfigForm config={config} onChange={setConfig} />
          ) : (
            <p className="text-[10px] text-muted-foreground py-2">
              No additional settings for this widget type.
            </p>
          )}
        </div>

        <SheetFooter className="flex-shrink-0 border-t border-border pt-3 gap-2">
          {/* Delete */}
          <Button
            variant="destructive"
            size="sm"
            className="h-7 text-[10px] gap-1 mr-auto"
            onClick={handleDelete}
            disabled={isDeleting || isSaving}
          >
            {isDeleting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
            {confirmDelete ? "Confirm Remove" : "Remove"}
          </Button>

          {/* Cancel */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px]"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>

          {/* Save */}
          <Button
            size="sm"
            className="h-7 text-[10px]"
            onClick={handleSave}
            disabled={isSaving || isDeleting}
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : null}
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
