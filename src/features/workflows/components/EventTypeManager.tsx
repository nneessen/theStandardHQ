// src/features/workflows/components/EventTypeManager.tsx

import { useState, useCallback } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Power,
  PowerOff,
  Zap,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import EventTypeFormDialog from "./EventTypeFormDialog";
import {
  useEventTypes,
  useCreateEventType,
  useUpdateEventType,
  useDeleteEventType,
} from "@/hooks/workflows";
import type { TriggerEventType } from "@/types/workflow.types";

interface EditableEventType extends Partial<TriggerEventType> {
  isNew?: boolean;
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

const CATEGORY_COLORS: Record<string, string> = {
  recruit:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0",
  policy:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0",
  commission:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0",
  user: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-0",
  email:
    "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 border-0",
  system:
    "bg-v2-card-tinted text-v2-ink dark:bg-v2-card-tinted dark:text-v2-ink-subtle border-0",
  custom:
    "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400 border-0",
};

export default function EventTypeManager() {
  const { data: eventTypes = [], isLoading } = useEventTypes();
  const createEvent = useCreateEventType();
  const updateEvent = useUpdateEventType();
  const deleteEvent = useDeleteEventType();

  const [editingId, setEditingId] = useState<string | null>(null);
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

  // Group filtered events by category
  const groupedEvents = filteredEvents.reduce(
    (acc, event) => {
      const category = event.category || "custom";
      if (!acc[category]) acc[category] = [];
      acc[category].push(event);
      return acc;
    },
    {} as Record<string, typeof filteredEvents>,
  );

  // Count active filters
  const filterCount =
    (searchQuery ? 1 : 0) + (selectedCategory !== null ? 1 : 0);

  if (isLoading) {
    return (
      <div className="p-3 text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
        Loading event types...
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between p-2.5 bg-v2-canvas dark:bg-v2-card-tinted/50 rounded-lg border border-v2-ring dark:border-v2-ring-strong">
        <div>
          <h3 className="text-sm font-semibold text-v2-ink dark:text-v2-ink">
            Event Type Management
          </h3>
          <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
            Define events that can trigger workflows
          </p>
        </div>
        <Button size="sm" onClick={handleCreate} className="h-6 text-[10px]">
          <Plus className="h-3 w-3 mr-1" />
          Add Event
        </Button>
      </div>

      {/* Search and Filter Bar */}
      <div className="space-y-2">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-v2-ink-muted dark:text-v2-ink-subtle" />
          <Input
            type="text"
            placeholder="Search events by name, description, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs border-v2-ring dark:border-v2-ring-strong"
          />
        </div>

        {/* Category Filter Buttons & Event Count */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className="h-6 px-2 text-xs"
            >
              All Categories
            </Button>
            {EVENT_CATEGORIES.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="h-6 px-2 text-xs"
              >
                {category}
              </Button>
            ))}
          </div>
          <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle whitespace-nowrap">
            Showing {filteredEvents.length} of {eventTypes.length} events
            {filterCount > 0 &&
              ` • ${filterCount} filter${filterCount > 1 ? "s" : ""} active`}
          </span>
        </div>
      </div>

      {/* Event Categories - Wrapped in ScrollArea */}
      {Object.keys(groupedEvents).length === 0 ? (
        <div className="py-12 text-center">
          <Zap className="h-10 w-10 mx-auto mb-3 text-v2-ink-subtle dark:text-v2-ink-muted" />
          <p className="text-sm text-v2-ink-muted dark:text-v2-ink-subtle font-medium">
            No events found
          </p>
          <p className="text-xs text-v2-ink-muted dark:text-v2-ink-subtle mt-1">
            {searchQuery || selectedCategory
              ? "Try adjusting your search or filters"
              : "Create your first event type to get started"}
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-20rem)] pr-2">
          <div className="space-y-2">
            {/* Event Categories */}
            {Object.entries(groupedEvents).map(([category, events]) => (
              <div key={category} className="space-y-2">
                <div className="flex items-center gap-2 px-2">
                  <Badge
                    className={cn(
                      "text-[10px] px-2 py-0",
                      CATEGORY_COLORS[category],
                    )}
                  >
                    {category}
                  </Badge>
                  <span className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                    {events.length} event{events.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="rounded-lg border border-v2-ring dark:border-v2-ring-strong overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="h-6 bg-v2-canvas dark:bg-v2-card-tinted/50">
                        <TableHead className="text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-muted">
                          Event Name
                        </TableHead>
                        <TableHead className="text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-muted">
                          Description
                        </TableHead>
                        <TableHead className="text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-muted">
                          Variables
                        </TableHead>
                        <TableHead className="text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-muted text-center">
                          Status
                        </TableHead>
                        <TableHead className="text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-muted text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((event) => (
                        <TableRow
                          key={event.id}
                          className="h-8 border-b border-v2-ring dark:border-v2-ring hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/50"
                        >
                          {editingId === event.id && editData ? (
                            <>
                              <TableCell className="py-1">
                                <Input
                                  className="h-5 text-[11px] border-v2-ring dark:border-v2-ring-strong"
                                  value={editData.eventName}
                                  onChange={(e) =>
                                    updateEditField("eventName", e.target.value)
                                  }
                                />
                              </TableCell>
                              <TableCell className="py-1">
                                <Input
                                  className="h-5 text-[11px] border-v2-ring dark:border-v2-ring-strong"
                                  value={editData.description}
                                  onChange={(e) =>
                                    updateEditField(
                                      "description",
                                      e.target.value,
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell className="py-1">
                                <Textarea
                                  className="h-5 text-[10px] font-mono p-1 border-v2-ring dark:border-v2-ring-strong"
                                  value={JSON.stringify(
                                    editData.availableVariables,
                                    null,
                                    0,
                                  )}
                                  onChange={(e) => {
                                    try {
                                      updateEditField(
                                        "availableVariables",
                                        JSON.parse(e.target.value),
                                      );
                                    } catch {
                                      updateEditField(
                                        "availableVariables",
                                        e.target.value,
                                      );
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell className="text-center py-1">
                                <Switch
                                  checked={editData.isActive ?? false}
                                  onCheckedChange={(checked) =>
                                    updateEditField("isActive", checked)
                                  }
                                />
                              </TableCell>
                              <TableCell className="text-right py-1">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleSave}
                                    className="h-5 px-1"
                                    disabled={updateEvent.isPending}
                                  >
                                    <Save className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleCancel}
                                    className="h-5 px-1"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell className="text-[11px] font-mono">
                                <div className="flex items-center gap-1 text-v2-ink dark:text-v2-ink">
                                  <Zap className="h-3 w-3 text-amber-500" />
                                  {event.eventName}
                                </div>
                              </TableCell>
                              <TableCell className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
                                {event.description}
                              </TableCell>
                              <TableCell className="text-[10px] font-mono text-v2-ink-muted dark:text-v2-ink-subtle">
                                {event.availableVariables
                                  ? Object.keys(
                                      event.availableVariables as object,
                                    ).length + " vars"
                                  : "None"}
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleToggleActive(event)}
                                  className={cn(
                                    "h-5 px-1",
                                    event.isActive
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-v2-ink-subtle dark:text-v2-ink-muted",
                                  )}
                                >
                                  {event.isActive ? (
                                    <Power className="h-3 w-3" />
                                  ) : (
                                    <PowerOff className="h-3 w-3" />
                                  )}
                                </Button>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEdit(event)}
                                    className="h-5 px-1 text-v2-ink-muted hover:text-v2-ink dark:text-v2-ink-subtle dark:hover:text-v2-canvas"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDelete(event.id)}
                                    className="h-5 px-1 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Event Type Form Dialog */}
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
