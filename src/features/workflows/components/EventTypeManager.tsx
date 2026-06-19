// src/features/workflows/components/EventTypeManager.tsx
// Board (.theme-v2) restyled — header, search, category filter chips, and event rows.

import { useState, useCallback } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Zap,
  Search,
  Power,
  PowerOff,
} from "lucide-react";
import EventTypeFormDialog from "./EventTypeFormDialog";
import {
  useEventTypes,
  useCreateEventType,
  useUpdateEventType,
  useDeleteEventType,
} from "@/hooks/workflows";
import type { TriggerEventType } from "@/types/workflow.types";
import { tint } from "../board";
import {
  categoryMeta,
  categoryOrder,
  CATEGORY_META,
} from "../event-picker-meta";

interface EditableEventType extends Partial<TriggerEventType> {
  isNew?: boolean;
}

// Canonical active categories — matches the wizard picker and the seeded
// trigger_event_types (src/features/workflows/eventCatalog.ts). Dead categories
// (user/email/system/custom) were removed when their never-emitted events were
// pruned; re-add a category here only when a real event in it is wired + seeded.
const EVENT_CATEGORIES = [
  "recruit",
  "policy",
  "commission",
  "lead",
  "agent",
  "contracting",
  "document",
  "hierarchy",
  "client",
  "underwriting",
  "training",
];

export default function EventTypeManager() {
  const { data: eventTypes = [], isLoading } = useEventTypes();
  const createEvent = useCreateEventType();
  const updateEvent = useUpdateEventType();
  const deleteEvent = useDeleteEventType();

  const [_editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<EditableEventType | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Start editing an event
  const handleEdit = useCallback((event: TriggerEventType) => {
    setEditingId(event.id);
    setEditData({
      ...event,
      availableVariables: event.availableVariables || {},
    });
    setErrors({});
    setIsDialogOpen(true);
  }, []);

  // Start creating a new event
  const handleCreate = useCallback(() => {
    const newEvent: EditableEventType = {
      id: "new",
      eventName: "",
      category: "custom",
      description: "",
      availableVariables: {},
      isActive: true,
      isNew: true,
    };
    setEditingId("new");
    setEditData(newEvent);
    setErrors({});
    setIsDialogOpen(true);
  }, []);

  // Cancel editing
  const handleCancel = useCallback(() => {
    setEditingId(null);
    setEditData(null);
    setErrors({});
    setIsDialogOpen(false);
  }, []);

  // Validate event data
  const validateEvent = (data: EditableEventType): boolean => {
    const newErrors: Record<string, string> = {};

    if (!data.eventName?.trim()) {
      newErrors.eventName = "Event name is required";
    } else if (!/^[a-z]+\.[a-z_]+$/.test(data.eventName)) {
      newErrors.eventName =
        "Event name must be in format: category.action_name";
    }

    if (!data.category) {
      newErrors.category = "Category is required";
    }

    if (!data.description?.trim()) {
      newErrors.description = "Description is required";
    }

    // Validate JSON for availableVariables
    if (data.availableVariables) {
      try {
        if (typeof data.availableVariables === "string") {
          JSON.parse(data.availableVariables);
        }
      } catch (_e) {
        newErrors.availableVariables = "Invalid JSON format";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Save event (create or update)
  const handleSave = useCallback(async () => {
    if (!editData || !validateEvent(editData)) {
      return;
    }

    try {
      const eventData = {
        eventName: editData.eventName!,
        category: editData.category!,
        description: editData.description || "",
        availableVariables: editData.availableVariables || {},
        isActive: editData.isActive ?? true,
      };

      if (editData.isNew) {
        await createEvent.mutateAsync(eventData);
      } else {
        await updateEvent.mutateAsync({
          id: editData.id!,
          ...eventData,
        });
      }

      handleCancel();
    } catch (error) {
      console.error("Failed to save event:", error);
      setErrors({ submit: "Failed to save event. Please try again." });
    }
  }, [editData, createEvent, updateEvent, handleCancel]);

  // Delete event
  const handleDelete = useCallback(
    async (id: string) => {
      if (
        !window.confirm(
          "Are you sure you want to delete this event type? Workflows using this event will no longer trigger.",
        )
      ) {
        return;
      }

      try {
        await deleteEvent.mutateAsync(id);
      } catch (error) {
        console.error("Failed to delete event:", error);
      }
    },
    [deleteEvent],
  );

  // Toggle event active status
  const handleToggleActive = useCallback(
    async (event: TriggerEventType) => {
      try {
        await updateEvent.mutateAsync({
          id: event.id,
          isActive: !event.isActive,
        });
      } catch (error) {
        console.error("Failed to toggle event status:", error);
      }
    },
    [updateEvent],
  );

  // Update edit data field
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic field value type
  const updateEditField = (field: keyof EditableEventType, value: any) => {
    if (editData) {
      setEditData({ ...editData, [field]: value });
      // Clear error for this field
      if (errors[field]) {
        setErrors((prev) => {
          const { [field]: _, ...rest } = prev;
          return rest;
        });
      }
    }
  };

  // Filter events based on search and category (must be before early returns)
  const filteredEvents = eventTypes.filter((event) => {
    const matchesSearch =
      searchQuery === "" ||
      event.eventName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (event.description?.toLowerCase() || "").includes(
        searchQuery.toLowerCase(),
      ) ||
      (event.category?.toLowerCase() || "").includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === null || event.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Group filtered events by category, sorted by canonical order
  const groupedEvents = filteredEvents.reduce(
    (acc, event) => {
      const category = event.category || "custom";
      if (!acc[category]) acc[category] = [];
      acc[category].push(event);
      return acc;
    },
    {} as Record<string, typeof filteredEvents>,
  );

  const sortedGroups = Object.entries(groupedEvents).sort(
    ([a], [b]) => categoryOrder(a) - categoryOrder(b),
  );

  // Count active filters
  const filterCount =
    (searchQuery ? 1 : 0) + (selectedCategory !== null ? 1 : 0);

  if (isLoading) {
    return (
      <div
        className="px-6 py-10 text-center font-sans text-[14px]"
        style={{ color: "var(--mut2)" }}
      >
        Loading event types…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: tint("--violet", 14), color: "var(--violet)" }}
          >
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-baseline gap-2.5">
              <h2
                className="font-display text-[20px] font-extrabold uppercase tracking-wide"
                style={{ color: "var(--ink)" }}
              >
                Event Types
              </h2>
              <span
                className="font-mono text-[13px]"
                style={{ color: "var(--mut2)" }}
              >
                {eventTypes.length}
              </span>
            </div>
            <p
              className="font-sans text-[13.5px]"
              style={{ color: "var(--mut)" }}
            >
              Define the events that trigger workflows
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="flex h-9 items-center gap-1.5 rounded-lg px-4 font-sans text-[13px] font-semibold transition-opacity hover:opacity-85"
          style={{ background: "var(--blue)", color: "var(--on-accent)" }}
        >
          <Plus className="h-4 w-4" />
          Add Event
        </button>
      </div>

      {/* ── Search ────────────────────────────────────────────────────────── */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: "var(--mut2)" }}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search events by name, description, or category…"
          className="h-[46px] w-full rounded-xl pl-11 pr-4 font-sans text-[14px] outline-none transition-shadow placeholder:text-[var(--mut2)]"
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--line2)",
            color: "var(--ink)",
          }}
          onFocus={(e) =>
            (e.currentTarget.style.boxShadow =
              "0 0 0 3px " + tint("--violet", 30))
          }
          onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
        />
      </div>

      {/* ── Category filter chips ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* All */}
        <button
          type="button"
          onClick={() => setSelectedCategory(null)}
          className="flex h-8 items-center gap-1.5 rounded-lg px-3 font-sans text-[13px] font-semibold transition-colors"
          style={{
            background:
              selectedCategory === null
                ? tint("--violet", 14)
                : "var(--surface-3)",
            color: selectedCategory === null ? "var(--violet)" : "var(--mut)",
            boxShadow:
              selectedCategory === null
                ? `inset 0 0 0 1px ${tint("--violet", 40)}`
                : "none",
          }}
          onMouseEnter={(e) => {
            if (selectedCategory !== null)
              e.currentTarget.style.background = "var(--surface-4)";
          }}
          onMouseLeave={(e) => {
            if (selectedCategory !== null)
              e.currentTarget.style.background = "var(--surface-3)";
          }}
        >
          <Zap className="h-3.5 w-3.5" />
          All
          <span
            className="font-mono text-[11px]"
            style={{ color: "var(--mut2)" }}
          >
            {eventTypes.length}
          </span>
        </button>

        {EVENT_CATEGORIES.map((cat) => {
          const meta = categoryMeta(cat);
          const matched = CATEGORY_META.find((m) => m.key === cat);
          const Icon = matched?.icon ?? Zap;
          const count = eventTypes.filter((e) => e.category === cat).length;
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className="flex h-8 items-center gap-1.5 rounded-lg px-3 font-sans text-[13px] font-semibold transition-colors"
              style={{
                background: active ? tint(meta.accent, 14) : "var(--surface-3)",
                color: active ? `var(${meta.accent})` : "var(--mut)",
                boxShadow: active
                  ? `inset 0 0 0 1px ${tint(meta.accent, 40)}`
                  : "none",
              }}
              onMouseEnter={(e) => {
                if (!active)
                  e.currentTarget.style.background = "var(--surface-4)";
              }}
              onMouseLeave={(e) => {
                if (!active)
                  e.currentTarget.style.background = "var(--surface-3)";
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              {meta.label}
              <span
                className="font-mono text-[11px]"
                style={{ color: "var(--mut2)" }}
              >
                {count}
              </span>
            </button>
          );
        })}

        {/* Filter count indicator */}
        {filterCount > 0 && (
          <span
            className="ml-auto font-sans text-[12.5px]"
            style={{ color: "var(--mut2)" }}
          >
            Showing {filteredEvents.length} of {eventTypes.length}
            {filterCount > 1 && ` · ${filterCount} filters`}
          </span>
        )}
      </div>

      {/* ── Event list ────────────────────────────────────────────────────── */}
      {sortedGroups.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-3 py-16 text-center"
          style={{ color: "var(--mut2)" }}
        >
          <Zap className="h-8 w-8 opacity-40" />
          <p
            className="font-sans text-[14px] font-semibold"
            style={{ color: "var(--mut)" }}
          >
            No events found
          </p>
          <p className="font-sans text-[13px]">
            {searchQuery || selectedCategory
              ? "Try adjusting your search or filters"
              : "Create your first event type to get started"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedGroups.map(([category, events]) => {
            const meta = categoryMeta(category);
            const matched = CATEGORY_META.find((m) => m.key === category);
            const CatIcon = matched?.icon ?? Zap;
            return (
              <div key={category}>
                {/* Category heading */}
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="flex h-[26px] w-[26px] items-center justify-center rounded-lg"
                    style={{
                      background: tint(meta.accent, 14),
                      color: `var(${meta.accent})`,
                    }}
                  >
                    <CatIcon className="h-3.5 w-3.5" />
                  </span>
                  <span
                    className="font-mono text-[11.5px] font-bold uppercase tracking-widest"
                    style={{ color: `var(${meta.accent})` }}
                  >
                    {meta.label}
                  </span>
                  <span
                    className="font-mono text-[11px]"
                    style={{ color: "var(--mut2)" }}
                  >
                    {events.length}
                  </span>
                </div>

                {/* Rows */}
                <div
                  className="overflow-hidden rounded-xl"
                  style={{
                    border: "1px solid var(--line2)",
                    background: "var(--surface-1)",
                  }}
                >
                  {/* Table header */}
                  <div
                    className="grid items-center px-4 py-2"
                    style={{
                      gridTemplateColumns: "2fr 3fr 80px 64px 72px",
                      borderBottom: "1px solid var(--line)",
                      background: "var(--surface-2)",
                    }}
                  >
                    {["Event Name", "Description", "Vars", "Status", ""].map(
                      (h) => (
                        <span
                          key={h}
                          className="font-mono text-[10.5px] font-bold uppercase tracking-widest"
                          style={{ color: "var(--mut2)" }}
                        >
                          {h}
                        </span>
                      ),
                    )}
                  </div>

                  {/* Rows */}
                  {events.map((event, idx) => {
                    const varCount = event.availableVariables
                      ? Object.keys(event.availableVariables as object).length
                      : 0;
                    return (
                      <div
                        key={event.id}
                        className="group grid items-center px-4 py-3 transition-colors"
                        style={{
                          gridTemplateColumns: "2fr 3fr 80px 64px 72px",
                          borderTop:
                            idx === 0 ? "none" : "1px solid var(--line)",
                          cursor: "default",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background =
                            "var(--surface-2)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                      >
                        {/* Event name — always mono */}
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="truncate font-mono text-[13.5px] font-semibold"
                            style={{ color: "var(--cream)" }}
                          >
                            {event.eventName}
                          </span>
                        </div>

                        {/* Description */}
                        <span
                          className="truncate font-sans text-[13px]"
                          style={{ color: "var(--mut)" }}
                        >
                          {event.description || (
                            <span style={{ color: "var(--mut3)" }}>
                              No description
                            </span>
                          )}
                        </span>

                        {/* Vars count */}
                        <span
                          className="font-mono text-[12px]"
                          style={{ color: "var(--mut2)" }}
                        >
                          {varCount > 0
                            ? `${varCount} var${varCount !== 1 ? "s" : ""}`
                            : "—"}
                        </span>

                        {/* Status toggle */}
                        <div>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(event)}
                            className="flex h-[26px] items-center gap-1 rounded-md px-2 font-mono text-[10.5px] font-bold uppercase tracking-wide transition-colors"
                            style={
                              event.isActive
                                ? {
                                    background: tint("--green", 14),
                                    color: "var(--green)",
                                  }
                                : {
                                    background: "var(--surface-3)",
                                    color: "var(--mut2)",
                                  }
                            }
                            title={
                              event.isActive
                                ? "Active — click to deactivate"
                                : "Inactive — click to activate"
                            }
                          >
                            {event.isActive ? (
                              <Power className="h-3 w-3" />
                            ) : (
                              <PowerOff className="h-3 w-3" />
                            )}
                            {event.isActive ? "On" : "Off"}
                          </button>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEdit(event)}
                            className="flex h-[30px] w-[30px] items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-3)]"
                            style={{ color: "var(--mut2)" }}
                            title="Edit"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(event.id)}
                            className="flex h-[30px] w-[30px] items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-3)]"
                            style={{ color: "var(--mut2)" }}
                            title="Delete"
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = "var(--red)";
                              e.currentTarget.style.background = tint(
                                "--red",
                                12,
                              );
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = "var(--mut2)";
                              e.currentTarget.style.background = "transparent";
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Event Type Form Dialog ─────────────────────────────────────────── */}
      <EventTypeFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editData={editData}
        onSave={handleSave}
        onCancel={handleCancel}
        updateEditField={updateEditField}
        errors={errors}
        isSaving={createEvent.isPending || updateEvent.isPending}
        isNew={editData?.isNew || false}
      />
    </div>
  );
}
