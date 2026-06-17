// src/features/workflows/components/EventTypeFormDialog.tsx
// Board (.theme-v2) restyled — dialog shell matches the picker/wizard pattern.

import { Save, X, Zap } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { tint } from "../board";
import { categoryMeta, CATEGORY_META } from "../event-picker-meta";

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

  const cat = editData.category ? categoryMeta(editData.category) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="block gap-0 border-0 p-0 shadow-none sm:max-w-none"
        style={{
          width: 640,
          maxWidth: "95vw",
          maxHeight: "88vh",
          borderRadius: 20,
          background: "var(--surface-2)",
          border: "1px solid var(--line2)",
          boxShadow: "var(--panelshadow)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div
          className="shrink-0 px-6 pt-6 pb-4"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background: tint("--violet", 14),
                  color: "var(--violet)",
                }}
              >
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle
                  className="font-display text-[19px] font-extrabold uppercase tracking-wide"
                  style={{ color: "var(--ink)" }}
                >
                  {isNew ? "Create Event Type" : "Edit Event Type"}
                </DialogTitle>
                <DialogDescription
                  className="font-sans text-[13.5px]"
                  style={{ color: "var(--mut)" }}
                >
                  {isNew
                    ? "Define a new event that can trigger workflows"
                    : "Update the event type configuration"}
                </DialogDescription>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-4)]"
              style={{ color: "var(--mut2)" }}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────────── */}
        <div
          className="flex-1 overflow-y-auto px-6 py-5"
          style={{ minHeight: 0 }}
        >
          <div className="space-y-5">
            {/* Event Name & Category Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Event Name */}
              <div className="space-y-1.5">
                <label
                  className="font-mono text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: "var(--mut2)" }}
                >
                  Event Name
                </label>
                <input
                  className="h-10 w-full rounded-lg px-3 font-mono text-[13.5px] outline-none transition-shadow placeholder:text-[var(--mut2)]"
                  style={{
                    background: "var(--surface-1)",
                    border: errors.eventName
                      ? "1px solid var(--red)"
                      : "1px solid var(--line2)",
                    color: "var(--cream)",
                  }}
                  placeholder="category.action_name"
                  value={editData.eventName ?? ""}
                  onChange={(e) => updateEditField("eventName", e.target.value)}
                  onFocus={(e) =>
                    (e.currentTarget.style.boxShadow =
                      "0 0 0 3px " + tint("--violet", 30))
                  }
                  onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                  autoComplete="off"
                  data-bwignore="true"
                  data-1p-ignore="true"
                  data-lpignore="true"
                />
                {errors.eventName && (
                  <p
                    className="font-sans text-[12px]"
                    style={{ color: "var(--red)" }}
                  >
                    {errors.eventName}
                  </p>
                )}
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label
                  className="font-mono text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: "var(--mut2)" }}
                >
                  Category
                </label>
                {/* Native select styled to Board tokens — avoids Radix portaling issues */}
                <div className="relative">
                  <Select
                    value={editData.category ?? ""}
                    onValueChange={(value) =>
                      updateEditField("category", value)
                    }
                  >
                    <SelectTrigger
                      className="h-10 w-full rounded-lg px-3 font-sans text-[13.5px] outline-none transition-shadow"
                      style={{
                        background: "var(--surface-1)",
                        border: errors.category
                          ? "1px solid var(--red)"
                          : "1px solid var(--line2)",
                        color: cat ? `var(${cat.accent})` : "var(--mut)",
                        boxShadow: "none",
                      }}
                      onFocus={(e) =>
                        (e.currentTarget.style.boxShadow =
                          "0 0 0 3px " + tint("--violet", 30))
                      }
                      onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                    >
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent
                      style={{
                        background: "var(--surface-3)",
                        border: "1px solid var(--line2)",
                        borderRadius: 12,
                      }}
                    >
                      {EVENT_CATEGORIES.map((c) => {
                        const meta = categoryMeta(c);
                        return (
                          <SelectItem
                            key={c}
                            value={c}
                            className="font-sans text-[13px]"
                            style={{ color: `var(${meta.accent})` }}
                          >
                            {meta.label ?? c}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                {errors.category && (
                  <p
                    className="font-sans text-[12px]"
                    style={{ color: "var(--red)" }}
                  >
                    {errors.category}
                  </p>
                )}
              </div>
            </div>

            {/* Category accent pill — visual confirmation */}
            {cat && (
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wide"
                  style={{
                    background: tint(cat.accent, 14),
                    color: `var(${cat.accent})`,
                  }}
                >
                  {(() => {
                    const matched = CATEGORY_META.find(
                      (m) => m.key === editData.category,
                    );
                    if (!matched) return null;
                    const Icon = matched.icon;
                    return <Icon className="h-3.5 w-3.5" />;
                  })()}
                  {cat.label}
                </span>
              </div>
            )}

            {/* Description */}
            <div className="space-y-1.5">
              <label
                className="font-mono text-[11px] font-bold uppercase tracking-widest"
                style={{ color: "var(--mut2)" }}
              >
                Description
              </label>
              <input
                className="h-10 w-full rounded-lg px-3 font-sans text-[13.5px] outline-none transition-shadow placeholder:text-[var(--mut2)]"
                style={{
                  background: "var(--surface-1)",
                  border: errors.description
                    ? "1px solid var(--red)"
                    : "1px solid var(--line2)",
                  color: "var(--ink)",
                }}
                placeholder="Brief description of when this event fires"
                value={editData.description ?? ""}
                onChange={(e) => updateEditField("description", e.target.value)}
                onFocus={(e) =>
                  (e.currentTarget.style.boxShadow =
                    "0 0 0 3px " + tint("--blue", 28))
                }
                onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                autoComplete="off"
                data-bwignore="true"
                data-1p-ignore="true"
                data-lpignore="true"
              />
              {errors.description && (
                <p
                  className="font-sans text-[12px]"
                  style={{ color: "var(--red)" }}
                >
                  {errors.description}
                </p>
              )}
            </div>

            {/* Available Variables — JSON */}
            <div className="space-y-1.5">
              <label
                className="font-mono text-[11px] font-bold uppercase tracking-widest"
                style={{ color: "var(--mut2)" }}
              >
                Available Variables{" "}
                <span style={{ color: "var(--mut3)" }}>(JSON)</span>
              </label>
              <textarea
                rows={5}
                className="w-full rounded-lg p-3 font-mono text-[12.5px] leading-relaxed outline-none transition-shadow placeholder:text-[var(--mut2)] resize-none"
                style={{
                  background: "var(--surface-1)",
                  border: errors.availableVariables
                    ? "1px solid var(--red)"
                    : "1px solid var(--line2)",
                  color: "var(--cream)",
                }}
                placeholder={'{"userId": "UUID", "userName": "string"}'}
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
                onFocus={(e) =>
                  (e.currentTarget.style.boxShadow =
                    "0 0 0 3px " + tint("--blue", 28))
                }
                onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
              />
              {errors.availableVariables ? (
                <p
                  className="font-sans text-[12px]"
                  style={{ color: "var(--red)" }}
                >
                  {errors.availableVariables}
                </p>
              ) : (
                <p
                  className="font-sans text-[12px]"
                  style={{ color: "var(--mut2)" }}
                >
                  Variables available to workflow templates when this event
                  fires.
                </p>
              )}
            </div>

            {/* Submit error */}
            {errors.submit && (
              <div
                className="rounded-lg px-3 py-2.5"
                style={{
                  background: tint("--red", 12),
                  border: `1px solid ${tint("--red", 30)}`,
                }}
              >
                <p
                  className="font-sans text-[13px]"
                  style={{ color: "var(--red)" }}
                >
                  {errors.submit}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div
          className="flex shrink-0 items-center justify-end gap-2 px-6 py-4"
          style={{ borderTop: "1px solid var(--line)" }}
        >
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            className="h-9 rounded-lg px-4 font-sans text-[13px] font-semibold transition-colors hover:bg-[var(--surface-3)] disabled:opacity-40"
            style={{ color: "var(--mut)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex h-9 items-center gap-1.5 rounded-lg px-4 font-sans text-[13px] font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "var(--blue)", color: "#0c1322" }}
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving…" : isNew ? "Create Event" : "Save Changes"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
