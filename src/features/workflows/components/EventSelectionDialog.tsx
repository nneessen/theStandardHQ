// src/features/workflows/components/EventSelectionDialog.tsx

import { useState } from "react";
import {
  Search,
  Zap,
  Users,
  FileText,
  DollarSign,
  Mail,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { TriggerEventType } from "@/types/workflow.types";

interface EventSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventTypes: TriggerEventType[];
  selectedEvent?: string;
  onSelectEvent: (eventName: string) => void;
}

// Category icons and colors
const CATEGORY_CONFIG = {
  recruit: {
    icon: Users,
    color: "text-info bg-info/10 border-info/20",
    label: "Recruiting",
  },
  policy: {
    icon: FileText,
    color: "text-success bg-success/10 border-success/20",
    label: "Policies",
  },
  commission: {
    icon: DollarSign,
    color: "text-success bg-success/10 border-success/20",
    label: "Commissions",
  },
  email: {
    icon: Mail,
    color: "text-info bg-info/10 border-info/20",
    label: "Emails",
  },
  user: {
    icon: User,
    color: "text-warning bg-warning/10 border-warning/20",
    label: "Users",
  },
  general: {
    icon: Zap,
    color:
      "text-muted-foreground dark:text-muted-foreground bg-muted/10 border-input/20",
    label: "General",
  },
} as const;

export default function EventSelectionDialog({
  open,
  onOpenChange,
  eventTypes,
  selectedEvent,
  onSelectEvent,
}: EventSelectionDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Filter events based on search and category
  const filteredEvents = eventTypes.filter((event) => {
    const matchesSearch =
      searchQuery === "" ||
      event.eventName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (event.description?.toLowerCase() || "").includes(
        searchQuery.toLowerCase(),
      );

    const matchesCategory =
      selectedCategory === null || event.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Group events by category
  const groupedEvents = filteredEvents.reduce(
    (acc, event) => {
      const category = event.category || "general";
      if (!acc[category]) acc[category] = [];
      acc[category].push(event);
      return acc;
    },
    {} as Record<string, TriggerEventType[]>,
  );

  // Get unique categories for filter buttons
  const categories = [
    ...new Set(eventTypes.map((e) => e.category || "general")),
  ];

  const handleSelectEvent = (eventName: string) => {
    onSelectEvent(eventName);
    onOpenChange(false);
    // Reset filters
    setSearchQuery("");
    setSelectedCategory(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-lg">Select Event Trigger</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Choose an event that will trigger this workflow automatically
          </p>
        </DialogHeader>

        {/* Search and Filter Bar */}
        <div className="px-4 pb-3 space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          {/* Category Filter Buttons */}
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className="h-6 px-2 text-xs"
            >
              All Categories
            </Button>
            {categories.map((category) => {
              const config =
                CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG] ||
                CATEGORY_CONFIG.general;
              const Icon = config.icon;
              return (
                <Button
                  key={category}
                  variant={
                    selectedCategory === category ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className={cn(
                    "h-6 px-2 text-xs",
                    selectedCategory === category ? "" : "hover:bg-muted",
                  )}
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {config.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Events List */}
        <ScrollArea className="flex-1 px-4 pb-4">
          {Object.keys(groupedEvents).length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No events found</p>
              <p className="text-xs mt-1">
                Try adjusting your search or filters
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedEvents).map(([category, events]) => {
                const config =
                  CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG] ||
                  CATEGORY_CONFIG.general;
                const Icon = config.icon;

                return (
                  <div key={category}>
                    {/* Category Header */}
                    <div
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-md mb-2 border",
                        config.color,
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="text-xs font-semibold uppercase">
                        {config.label}
                      </span>
                      <span className="text-xs opacity-60">
                        ({events.length})
                      </span>
                    </div>

                    {/* Events in Category */}
                    <div className="space-y-1">
                      {events.map((event) => (
                        <button
                          key={event.id}
                          onClick={() => handleSelectEvent(event.eventName)}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-md transition-all",
                            "hover:bg-muted/50 border",
                            selectedEvent === event.eventName
                              ? "bg-primary/10 border-primary/50"
                              : "border-transparent hover:border-border",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p
                                className={cn(
                                  "text-xs font-medium",
                                  selectedEvent === event.eventName &&
                                    "text-primary",
                                )}
                              >
                                {event.eventName}
                              </p>
                              {event.description && (
                                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                                  {event.description}
                                </p>
                              )}
                            </div>
                            {selectedEvent === event.eventName && (
                              <div className="w-2 h-2 rounded-full bg-primary mt-1 shrink-0" />
                            )}
                          </div>

                          {/* Show available variables on hover/focus */}
                          {event.availableVariables &&
                            Object.keys(event.availableVariables).length >
                              0 && (
                              <div className="mt-1.5 pt-1.5 border-t border-border/50">
                                <p className="text-[9px] text-muted-foreground mb-1">
                                  Available variables:
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {Object.entries(event.availableVariables)
                                    .slice(0, 4)
                                    .map(([key, type]) => (
                                      <span
                                        key={key}
                                        className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-[9px] text-muted-foreground"
                                      >
                                        {key}: {type as string}
                                      </span>
                                    ))}
                                  {Object.keys(event.availableVariables)
                                    .length > 4 && (
                                    <span className="text-[9px] text-muted-foreground">
                                      +
                                      {Object.keys(event.availableVariables)
                                        .length - 4}{" "}
                                      more
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
