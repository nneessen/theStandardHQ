// src/features/billing/components/admin/SpotlightManager.tsx
// Admin CRUD interface for feature spotlights

import { useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Eye, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  useAdminSpotlights,
  useCreateSpotlight,
  useUpdateSpotlight,
  useDeleteSpotlight,
  type FeatureSpotlight,
  type CreateSpotlightParams,
} from "@/hooks/admin";
import { useAuth } from "@/contexts/AuthContext";
import { FeatureSpotlightDialog } from "@/components/subscription/FeatureSpotlightDialog";
import type { SpotlightHighlight } from "@/hooks/subscription";

// Common Lucide icon names for the dropdown
const ICON_OPTIONS = [
  "Bot",
  "Calendar",
  "Zap",
  "Clock",
  "BarChart3",
  "Users",
  "Sparkles",
  "Star",
  "Shield",
  "Target",
  "Mail",
  "MessageSquare",
  "TrendingUp",
  "Award",
  "Crown",
  "Rocket",
  "Globe",
  "Lock",
  "Eye",
  "Bell",
];

const AUDIENCE_PRESETS = [
  { value: "all", label: "All Users" },
  { value: "plan:free", label: "Free Plan Users" },
  { value: "plan:pro", label: "Pro Plan Users" },
  { value: "plan:team", label: "Team Plan Users" },
  { value: "missing_addon:", label: "Missing Add-on..." },
];

function getAudienceLabel(audience: string): string {
  if (audience === "all") return "All Users";
  if (audience.startsWith("plan:"))
    return `${audience.slice(5).charAt(0).toUpperCase()}${audience.slice(6)} Plan`;
  if (audience.startsWith("missing_addon:"))
    return `Missing: ${audience.slice(14)}`;
  return audience;
}

interface SpotlightFormState {
  title: string;
  subtitle: string;
  description: string;
  hero_icon: string;
  accent_color: string;
  target_audience: string;
  cta_text: string;
  cta_link: string;
  priority: number;
  is_active: boolean;
  highlights: SpotlightHighlight[];
  logos: string[];
}

const LOGO_OPTIONS = [
  { value: "close_crm", label: "Close CRM" },
  { value: "calendly", label: "Calendly" },
  { value: "google_calendar", label: "Google Calendar" },
];

const DEFAULT_FORM: SpotlightFormState = {
  title: "",
  subtitle: "",
  description: "",
  hero_icon: "Sparkles",
  accent_color: "#3b82f6",
  target_audience: "all",
  cta_text: "Learn More",
  cta_link: "/",
  priority: 0,
  is_active: true,
  highlights: [],
  logos: [],
};

function spotlightToForm(s: FeatureSpotlight): SpotlightFormState {
  return {
    title: s.title,
    subtitle: s.subtitle || "",
    description: s.description || "",
    hero_icon: s.hero_icon,
    accent_color: s.accent_color,
    target_audience: s.target_audience,
    cta_text: s.cta_text,
    cta_link: s.cta_link,
    priority: s.priority,
    is_active: s.is_active,
    highlights: s.highlights,
    logos: s.logos || [],
  };
}

function formToParams(
  form: SpotlightFormState,
  userId?: string,
): CreateSpotlightParams {
  return {
    title: form.title,
    subtitle: form.subtitle || undefined,
    description: form.description || undefined,
    hero_icon: form.hero_icon,
    accent_color: form.accent_color,
    target_audience: form.target_audience,
    cta_text: form.cta_text,
    cta_link: form.cta_link,
    priority: form.priority,
    is_active: form.is_active,
    highlights: form.highlights,
    logos: form.logos,
    created_by: userId,
  };
}

export function SpotlightManager() {
  const { user } = useAuth();
  const { data: spotlights, isLoading } = useAdminSpotlights();
  const createMutation = useCreateSpotlight();
  const updateMutation = useUpdateSpotlight();
  const deleteMutation = useDeleteSpotlight();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SpotlightFormState>(DEFAULT_FORM);
  const [previewSpotlight, setPreviewSpotlight] =
    useState<FeatureSpotlight | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setEditDialogOpen(true);
  }, []);

  const openEdit = useCallback((spotlight: FeatureSpotlight) => {
    setEditingId(spotlight.id);
    setForm(spotlightToForm(spotlight));
    setEditDialogOpen(true);
  }, []);

  const openPreview = useCallback((spotlight: FeatureSpotlight) => {
    setPreviewSpotlight(spotlight);
    setPreviewOpen(true);
  }, []);

  const openPreviewFromForm = useCallback(() => {
    // Build a fake FeatureSpotlight from form data for preview
    const fake: FeatureSpotlight = {
      id: "preview",
      title: form.title || "Preview Title",
      subtitle: form.subtitle || null,
      description: form.description || null,
      highlights: form.highlights,
      logos: form.logos,
      cta_text: form.cta_text,
      cta_link: form.cta_link,
      hero_icon: form.hero_icon,
      accent_color: form.accent_color,
      target_audience: form.target_audience,
      priority: form.priority,
      is_active: form.is_active,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setPreviewSpotlight(fake);
    setPreviewOpen(true);
  }, [form]);

  const handleSave = useCallback(async () => {
    if (!form.title.trim()) return;

    if (editingId) {
      await updateMutation.mutateAsync({
        id: editingId,
        params: formToParams(form),
      });
    } else {
      await createMutation.mutateAsync(formToParams(form, user?.id));
    }
    setEditDialogOpen(false);
  }, [editingId, form, user?.id, updateMutation, createMutation]);

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteMutation.mutateAsync(id);
      setDeleteConfirmId(null);
    },
    [deleteMutation],
  );

  const handleToggleActive = useCallback(
    async (id: string, isActive: boolean) => {
      await updateMutation.mutateAsync({ id, params: { is_active: isActive } });
    },
    [updateMutation],
  );

  const updateField = useCallback(
    <K extends keyof SpotlightFormState>(
      key: K,
      value: SpotlightFormState[K],
    ) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const addHighlight = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      highlights: [...prev.highlights, { icon: "Star", label: "" }],
    }));
  }, []);

  const removeHighlight = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      highlights: prev.highlights.filter((_, i) => i !== index),
    }));
  }, []);

  const updateHighlight = useCallback(
    (index: number, field: keyof SpotlightHighlight, value: string) => {
      setForm((prev) => ({
        ...prev,
        highlights: prev.highlights.map((h, i) =>
          i === index ? { ...h, [field]: value } : h,
        ),
      }));
    },
    [],
  );

  // Audience select handling
  const isMissingAddon = form.target_audience.startsWith("missing_addon:");
  const missingAddonName = isMissingAddon ? form.target_audience.slice(14) : "";

  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground py-4">
        Loading spotlights...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Feature Spotlights
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Rotating dialogs shown to users on login. Highest priority shown
            first.
          </p>
        </div>
        <Button size="sm" onClick={openCreate} className="h-7 text-xs gap-1">
          <Plus className="h-3 w-3" />
          New Spotlight
        </Button>
      </div>

      {/* Table */}
      {!spotlights?.length ? (
        <div className="text-xs text-muted-foreground py-6 text-center border border-dashed rounded-lg">
          No spotlights configured. Create one to get started.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground w-12">
                  Pri
                </th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                  Title
                </th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                  Audience
                </th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground w-16">
                  Active
                </th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground w-28">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {spotlights.map((spotlight) => (
                <tr
                  key={spotlight.id}
                  className="border-b last:border-0 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <GripVertical className="h-3 w-3" />
                      <span className="font-mono">{spotlight.priority}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-foreground">
                      {spotlight.title}
                    </div>
                    {spotlight.subtitle && (
                      <div className="text-muted-foreground text-[10px]">
                        {spotlight.subtitle}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] font-medium">
                      {getAudienceLabel(spotlight.target_audience)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Switch
                      checked={spotlight.is_active}
                      onCheckedChange={(checked) =>
                        handleToggleActive(spotlight.id, checked)
                      }
                      className="scale-75"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openPreview(spotlight)}
                        className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-muted-foreground hover:text-foreground transition-colors"
                        title="Preview"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => openEdit(spotlight)}
                        className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(spotlight.id)}
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogTitle className="text-sm font-semibold">
            Delete Spotlight
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            This will permanently delete this spotlight and all associated view
            records. This action cannot be undone.
          </DialogDescription>
          <div className="flex justify-end gap-2 mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="h-7 text-xs"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => !open && setEditDialogOpen(false)}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogTitle className="text-sm font-semibold">
            {editingId ? "Edit Spotlight" : "Create Spotlight"}
          </DialogTitle>
          <VisuallyHidden>
            <DialogDescription>Configure spotlight settings</DialogDescription>
          </VisuallyHidden>

          <div className="space-y-4 mt-2">
            {/* Title & Subtitle */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                  Title *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  className="w-full h-8 px-2 text-xs border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="AI-Powered SMS Appointment Setter"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                  Subtitle
                </label>
                <input
                  type="text"
                  value={form.subtitle}
                  onChange={(e) => updateField("subtitle", e.target.value)}
                  className="w-full h-8 px-2 text-xs border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Never miss a lead again"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                className="w-full h-16 px-2 py-1.5 text-xs border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                placeholder="Main body text..."
              />
            </div>

            {/* Icon, Color, Priority row */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                  Hero Icon
                </label>
                <select
                  value={form.hero_icon}
                  onChange={(e) => updateField("hero_icon", e.target.value)}
                  className="w-full h-8 px-2 text-xs border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {ICON_OPTIONS.map((icon) => (
                    <option key={icon} value={icon}>
                      {icon}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                  Accent Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.accent_color}
                    onChange={(e) =>
                      updateField("accent_color", e.target.value)
                    }
                    className="w-8 h-8 rounded border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={form.accent_color}
                    onChange={(e) =>
                      updateField("accent_color", e.target.value)
                    }
                    className="flex-1 h-8 px-2 text-xs border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                    placeholder="#3b82f6"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                  Priority
                </label>
                <input
                  type="number"
                  value={form.priority}
                  onChange={(e) =>
                    updateField("priority", parseInt(e.target.value) || 0)
                  }
                  className="w-full h-8 px-2 text-xs border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            {/* Target Audience */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                Target Audience
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={
                    isMissingAddon ? "missing_addon:" : form.target_audience
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "missing_addon:") {
                      updateField("target_audience", "missing_addon:");
                    } else {
                      updateField("target_audience", val);
                    }
                  }}
                  className="flex-1 h-8 px-2 text-xs border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {AUDIENCE_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
                {isMissingAddon && (
                  <input
                    type="text"
                    value={missingAddonName}
                    onChange={(e) =>
                      updateField(
                        "target_audience",
                        `missing_addon:${e.target.value}`,
                      )
                    }
                    className="flex-1 h-8 px-2 text-xs border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="addon_name"
                  />
                )}
              </div>
            </div>

            {/* Integration Logos */}
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                Integration Logos
              </label>
              <div className="flex items-center gap-3">
                {LOGO_OPTIONS.map((logo) => (
                  <label
                    key={logo.value}
                    className="flex items-center gap-1.5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={form.logos.includes(logo.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateField("logos", [...form.logos, logo.value]);
                        } else {
                          updateField(
                            "logos",
                            form.logos.filter((l) => l !== logo.value),
                          );
                        }
                      }}
                      className="rounded border-zinc-300 text-blue-500 focus:ring-blue-500 h-3.5 w-3.5"
                    />
                    <span className="text-[11px] text-foreground">
                      {logo.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                  CTA Button Text
                </label>
                <input
                  type="text"
                  value={form.cta_text}
                  onChange={(e) => updateField("cta_text", e.target.value)}
                  className="w-full h-8 px-2 text-xs border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Learn More"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                  CTA Link (Route)
                </label>
                <input
                  type="text"
                  value={form.cta_link}
                  onChange={(e) => updateField("cta_link", e.target.value)}
                  className="w-full h-8 px-2 text-xs border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="/chat-bot"
                />
              </div>
            </div>

            {/* Highlights */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Highlights
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addHighlight}
                  className="h-6 text-[10px] gap-1"
                >
                  <Plus className="h-2.5 w-2.5" />
                  Add
                </Button>
              </div>
              <div className="space-y-1.5">
                {form.highlights.map((highlight, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <select
                      value={highlight.icon}
                      onChange={(e) =>
                        updateHighlight(index, "icon", e.target.value)
                      }
                      className="w-28 h-7 px-1.5 text-[11px] border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {ICON_OPTIONS.map((icon) => (
                        <option key={icon} value={icon}>
                          {icon}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={highlight.label}
                      onChange={(e) =>
                        updateHighlight(index, "label", e.target.value)
                      }
                      className="flex-1 h-7 px-2 text-[11px] border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="Feature description"
                    />
                    <button
                      onClick={() => removeHighlight(index)}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {form.highlights.length === 0 && (
                  <div className="text-[10px] text-muted-foreground py-2 text-center border border-dashed rounded">
                    No highlights added
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={openPreviewFromForm}
                className="h-7 text-xs gap-1"
              >
                <Eye className="h-3 w-3" />
                Preview
              </Button>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                  className="h-7 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  className="h-7 text-xs"
                  disabled={
                    !form.title.trim() ||
                    createMutation.isPending ||
                    updateMutation.isPending
                  }
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : editingId
                      ? "Update"
                      : "Create"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      {previewSpotlight && (
        <FeatureSpotlightDialog
          spotlight={previewSpotlight}
          open={previewOpen}
          onDismiss={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
