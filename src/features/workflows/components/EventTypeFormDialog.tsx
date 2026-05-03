// src/features/workflows/components/EventTypeFormDialog.tsx

import { Save, X } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface EditableEventType {
  id?: string;
  eventName?: string;
  category?: string;
  description?: string;
  availableVariables?: Record<string, unknown> | string;
  isActive?: boolean;
  isNew?: boolean;
}

interface EventTypeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData: EditableEventType | null;
  onSave: () => Promise<void>;
  onCancel: () => void;
  updateEditField: (field: keyof EditableEventType, value: unknown) => void;
  errors: Record<string, string>;
  isSaving: boolean;
  isNew: boolean;
}

const EVENT_CATEGORIES = [
  "recruit",
  "policy",
  "commission",
  "user",
  "email",
  "system",
  "custom",
];

export default function EventTypeFormDialog({
  open,
  onOpenChange,
  editData,
  onSave,
  onCancel,
  updateEditField,
  errors,
  isSaving,
  isNew,
}: EventTypeFormDialogProps) {
  if (!editData) return null;

  const handleSave = async () => {
    await onSave();
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0">
        <DialogHeader className="p-4 pb-3">
          <DialogTitle className="text-sm font-semibold">
            {isNew ? "Create New Event Type" : "Edit Event Type"}
          </DialogTitle>
          <p className="text-[10px] text-muted-foreground dark:text-muted-foreground mt-0.5">
            {isNew
              ? "Define a new event that can trigger workflows"
              : "Update the event type configuration"}
          </p>
        </DialogHeader>

        <div className="px-4 pb-4 space-y-3 overflow-y-auto max-h-[calc(85vh-8rem)]">
          {/* Event Name & Category Row */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                Event Name
              </Label>
              <Input
                className={cn(
                  "h-7 text-[11px] border-border dark:border-border",
                  errors.eventName &&
                    "border-destructive/70 dark:border-destructive",
                )}
                placeholder="category.action_name"
                value={editData.eventName}
                onChange={(e) => updateEditField("eventName", e.target.value)}
                autoComplete="off"
                data-bwignore="true"
                data-1p-ignore="true"
                data-lpignore="true"
              />
              {errors.eventName && (
                <p className="text-[10px] text-destructive mt-0.5">
                  {errors.eventName}
                </p>
              )}
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                Category
              </Label>
              <Select
                value={editData.category}
                onValueChange={(value) => updateEditField("category", value)}
              >
                <SelectTrigger
                  className={cn(
                    "h-7 text-[11px] border-border dark:border-border",
                    errors.category &&
                      "border-destructive/70 dark:border-destructive",
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-[11px]">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-[10px] text-destructive mt-0.5">
                  {errors.category}
                </p>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
              Description
            </Label>
            <Input
              className={cn(
                "h-7 text-[11px] border-border dark:border-border",
                errors.description &&
                  "border-destructive/70 dark:border-destructive",
              )}
              placeholder="Brief description of when this event fires"
              value={editData.description}
              onChange={(e) => updateEditField("description", e.target.value)}
              autoComplete="off"
              data-bwignore="true"
              data-1p-ignore="true"
              data-lpignore="true"
            />
            {errors.description && (
              <p className="text-[10px] text-destructive mt-0.5">
                {errors.description}
              </p>
            )}
          </div>

          {/* Available Variables */}
          <div>
            <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
              Available Variables (JSON)
            </Label>
            <Textarea
              className={cn(
                "min-h-[80px] text-[11px] font-mono border-border dark:border-border",
                errors.availableVariables &&
                  "border-destructive/70 dark:border-destructive",
              )}
              placeholder='{"userId": "UUID", "userName": "string"}'
              value={JSON.stringify(editData.availableVariables, null, 2)}
              onChange={(e) => {
                try {
                  updateEditField(
                    "availableVariables",
                    JSON.parse(e.target.value),
                  );
                } catch {
                  updateEditField("availableVariables", e.target.value);
                }
              }}
            />
            {errors.availableVariables && (
              <p className="text-[10px] text-destructive mt-0.5">
                {errors.availableVariables}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground dark:text-muted-foreground mt-1">
              Define variables that will be available to workflows when this
              event fires
            </p>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <p className="text-[11px] text-destructive">{errors.submit}</p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border dark:border-border bg-background dark:bg-card-tinted/50">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            className="h-7 px-3 text-[11px]"
            disabled={isSaving}
          >
            <X className="h-3 w-3 mr-1" />
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            className="h-7 px-3 text-[11px]"
            disabled={isSaving}
          >
            <Save className="h-3 w-3 mr-1" />
            {isSaving ? "Saving..." : isNew ? "Create Event" : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
