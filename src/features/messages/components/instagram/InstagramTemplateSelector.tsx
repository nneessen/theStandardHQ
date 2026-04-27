// src/features/messages/components/instagram/InstagramTemplateSelector.tsx
// Full dialog for browsing and selecting Instagram message templates

import { useState, useMemo, type ReactNode } from "react";
import {
  FileText,
  Search,
  Loader2,
  Clock,
  MessageSquare,
  TrendingUp,
  User,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useInstagramTemplates, useInstagramTemplateCategories } from "@/hooks";
import {
  MESSAGE_STAGE_LABELS,
  PROSPECT_TYPE_LABELS,
  getCategoryLabel,
  type MessageStage,
  type InstagramMessageTemplate,
  type InstagramTemplateCategory,
  type InstagramConversation,
  type InstagramMessage,
} from "@/types/instagram.types";

// ============================================================================
// Types
// ============================================================================

interface InstagramTemplateSelectorProps {
  onSelect: (content: string, templateId: string) => void;
  disabled?: boolean;
  className?: string;
  /** Conversation context for the left panel */
  conversation?: InstagramConversation | null;
  /** Recent messages to display context */
  recentMessages?: InstagramMessage[];
}

// Sort order for message stages
const STAGE_ORDER: MessageStage[] = [
  "opener",
  "follow_up",
  "engagement",
  "discovery",
  "closer",
];

type CategoryFilter = "all" | string;

// ============================================================================
// Main Component
// ============================================================================

export function InstagramTemplateSelector({
  onSelect,
  disabled = false,
  className,
  conversation,
  recentMessages = [],
}: InstagramTemplateSelectorProps): ReactNode {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [stageFilter, setStageFilter] = useState<MessageStage | "all">("all");

  const { data: templates = [], isLoading } = useInstagramTemplates();
  const { data: customCategories = [] } = useInstagramTemplateCategories();

  // Filter templates based on search, category, and stage
  const filteredTemplates = useMemo(() => {
    let filtered = [...templates];

    // Filter by search
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(searchLower) ||
          t.content.toLowerCase().includes(searchLower),
      );
    }

    // Filter by category
    if (categoryFilter !== "all") {
      filtered = filtered.filter((t) => t.category === categoryFilter);
    }

    // Filter by stage
    if (stageFilter !== "all") {
      filtered = filtered.filter((t) => t.message_stage === stageFilter);
    }

    // Sort by use_count descending, then by name
    filtered.sort((a, b) => {
      const countDiff = (b.use_count || 0) - (a.use_count || 0);
      if (countDiff !== 0) return countDiff;
      return a.name.localeCompare(b.name);
    });

    return filtered;
  }, [templates, search, categoryFilter, stageFilter]);

  // Get recently used templates (top 5)
  const recentlyUsed = useMemo(() => {
    return [...templates]
      .filter((t) => t.last_used_at)
      .sort(
        (a, b) =>
          new Date(b.last_used_at!).getTime() -
          new Date(a.last_used_at!).getTime(),
      )
      .slice(0, 5);
  }, [templates]);

  const handleSelect = (template: InstagramMessageTemplate) => {
    onSelect(template.content, template.id);
    setOpen(false);
    // Reset filters for next open
    setSearch("");
    setCategoryFilter("all");
    setStageFilter("all");
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset filters when closing
      setSearch("");
      setCategoryFilter("all");
      setStageFilter("all");
    }
  };

  // Count templates by category for filter badges
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: templates.length };
    for (const t of templates) {
      const cat = t.category || "uncategorized";
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [templates]);

  return (
    <>
      {/* Trigger button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-7 w-7", className)}
        disabled={disabled || isLoading}
        onClick={() => setOpen(true)}
        title="Insert template"
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileText className="h-3.5 w-3.5" />
        )}
      </Button>

      {/* Full dialog */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-[900px] h-[600px] p-0 gap-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="px-4 py-3 border-b border-v2-ring">
            <DialogTitle className="text-sm font-semibold">
              Select Message Template
            </DialogTitle>
          </DialogHeader>

          {/* Two-panel layout */}
          <div className="flex flex-1 min-h-0">
            {/* Left panel - Conversation context */}
            <ConversationContextPanel
              conversation={conversation}
              recentMessages={recentMessages}
            />

            {/* Right panel - Template browser */}
            <div className="flex-1 flex flex-col min-w-0 border-l border-v2-ring">
              {/* Filters row */}
              <div className="px-3 py-2 border-b border-v2-ring space-y-2">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-v2-ink-subtle" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search templates..."
                    className="h-8 pl-8 text-[11px]"
                  />
                </div>

                {/* Category filter */}
                <div className="flex flex-wrap gap-1">
                  <FilterChip
                    active={categoryFilter === "all"}
                    onClick={() => setCategoryFilter("all")}
                    count={categoryCounts["all"]}
                  >
                    All
                  </FilterChip>
                  {Object.keys(PROSPECT_TYPE_LABELS).map((cat) => (
                    <FilterChip
                      key={cat}
                      active={categoryFilter === cat}
                      onClick={() => setCategoryFilter(cat)}
                      count={categoryCounts[cat] || 0}
                    >
                      {PROSPECT_TYPE_LABELS[cat]}
                    </FilterChip>
                  ))}
                  {/* Custom categories */}
                  {customCategories.map((cat) => (
                    <FilterChip
                      key={cat.id}
                      active={categoryFilter === `custom:${cat.id}`}
                      onClick={() => setCategoryFilter(`custom:${cat.id}`)}
                      count={categoryCounts[`custom:${cat.id}`] || 0}
                    >
                      {cat.name}
                    </FilterChip>
                  ))}
                </div>

                {/* Stage filter */}
                <div className="flex gap-1">
                  <StageChip
                    active={stageFilter === "all"}
                    onClick={() => setStageFilter("all")}
                  >
                    All Stages
                  </StageChip>
                  {STAGE_ORDER.map((stage) => (
                    <StageChip
                      key={stage}
                      active={stageFilter === stage}
                      onClick={() => setStageFilter(stage)}
                      stage={stage}
                    >
                      {MESSAGE_STAGE_LABELS[stage]}
                    </StageChip>
                  ))}
                </div>
              </div>

              {/* Template list */}
              <ScrollArea className="flex-1">
                {templates.length === 0 ? (
                  <EmptyState type="no-templates" />
                ) : filteredTemplates.length === 0 ? (
                  <EmptyState type="no-results" search={search} />
                ) : (
                  <div className="p-2 space-y-2">
                    {/* Recently used section (only show when no filters applied) */}
                    {!search &&
                      categoryFilter === "all" &&
                      stageFilter === "all" &&
                      recentlyUsed.length > 0 && (
                        <div className="mb-4">
                          <div className="flex items-center gap-1.5 px-2 py-1 mb-1">
                            <Clock className="h-3 w-3 text-v2-ink-subtle" />
                            <span className="text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide">
                              Recently Used
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {recentlyUsed.map((template) => (
                              <TemplateCard
                                key={`recent-${template.id}`}
                                template={template}
                                customCategories={customCategories}
                                onSelect={handleSelect}
                                variant="compact"
                              />
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Main template list */}
                    <div className="space-y-1.5">
                      {filteredTemplates.map((template) => (
                        <TemplateCard
                          key={template.id}
                          template={template}
                          customCategories={customCategories}
                          onSelect={handleSelect}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </ScrollArea>

              {/* Footer with count */}
              <div className="px-3 py-2 border-t border-v2-ring bg-v2-canvas dark:bg-v2-card-dark/50">
                <p className="text-[10px] text-v2-ink-muted">
                  {filteredTemplates.length} of {templates.length} templates
                  {search && ` matching "${search}"`}
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

interface ConversationContextPanelProps {
  conversation?: InstagramConversation | null;
  recentMessages?: InstagramMessage[];
}

function ConversationContextPanel({
  conversation,
  recentMessages = [],
}: ConversationContextPanelProps): ReactNode {
  if (!conversation) {
    return (
      <div className="w-[280px] bg-v2-canvas dark:bg-v2-card-dark/50 p-4 flex items-center justify-center">
        <div className="text-center">
          <User className="h-8 w-8 mx-auto text-v2-ink-subtle mb-2" />
          <p className="text-[11px] text-v2-ink-muted">
            No conversation selected
          </p>
        </div>
      </div>
    );
  }

  const displayName =
    conversation.participant_name ||
    conversation.participant_username ||
    "Unknown";
  const initials = displayName.slice(0, 2).toUpperCase();

  // Show last 5 messages for context
  const contextMessages = recentMessages.slice(0, 5);

  return (
    <div className="w-[280px] bg-v2-canvas dark:bg-v2-card-dark/50 flex flex-col">
      {/* Contact header */}
      <div className="p-3 border-b border-v2-ring">
        <div className="flex items-center gap-2">
          <Avatar className="h-10 w-10">
            <AvatarImage
              src={conversation.participant_profile_picture_url || undefined}
              alt={displayName}
            />
            <AvatarFallback className="text-[11px] bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-v2-ink truncate">
              {conversation.participant_username
                ? `@${conversation.participant_username}`
                : displayName}
            </p>
            {conversation.participant_name &&
              conversation.participant_username && (
                <p className="text-[10px] text-v2-ink-muted truncate">
                  {conversation.participant_name}
                </p>
              )}
          </div>
        </div>
      </div>

      {/* Recent messages */}
      <div className="flex-1 overflow-auto p-2">
        <p className="text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide px-1 mb-2">
          Recent Messages
        </p>

        {contextMessages.length === 0 ? (
          <div className="text-center py-4">
            <MessageSquare className="h-6 w-6 mx-auto text-v2-ink-subtle mb-1" />
            <p className="text-[10px] text-v2-ink-subtle">No messages yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {contextMessages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "p-2 rounded-lg text-[11px]",
                  message.isOutbound
                    ? "bg-v2-ring ml-4"
                    : "bg-v2-card mr-4 border border-v2-ring",
                )}
              >
                <p className="text-v2-ink-muted whitespace-pre-wrap break-words">
                  {message.message_text || "[Media]"}
                </p>
                <p className="text-[9px] text-v2-ink-subtle mt-1">
                  {message.sent_at
                    ? formatDistanceToNow(new Date(message.sent_at), {
                        addSuffix: true,
                      })
                    : "Unknown time"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Context hint */}
      <div className="p-2 border-t border-v2-ring">
        <p className="text-[9px] text-v2-ink-subtle text-center">
          Choose a template that matches the conversation
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Filter Chips
// ============================================================================

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: ReactNode;
}

function FilterChip({
  active,
  onClick,
  count,
  children,
}: FilterChipProps): ReactNode {
  if (count === 0 && !active) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
        active
          ? "bg-v2-card-dark text-white dark:bg-v2-ring dark:text-v2-ink"
          : "bg-v2-ring text-v2-ink-muted hover:bg-v2-ring dark:text-v2-ink-subtle dark:hover:bg-v2-card-dark",
      )}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className="ml-1 opacity-60">({count})</span>
      )}
    </button>
  );
}

interface StageChipProps {
  active: boolean;
  onClick: () => void;
  stage?: MessageStage;
  children: ReactNode;
}

function StageChip({
  active,
  onClick,
  stage,
  children,
}: StageChipProps): ReactNode {
  const stageColors: Record<MessageStage, string> = {
    opener: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    follow_up:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    engagement:
      "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    discovery:
      "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    closer:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
        active
          ? stage
            ? stageColors[stage]
            : "bg-v2-card-dark text-white dark:bg-v2-ring dark:text-v2-ink"
          : "bg-v2-ring text-v2-ink-muted hover:bg-v2-ring dark:text-v2-ink-muted dark:hover:bg-v2-card-dark",
      )}
    >
      {children}
    </button>
  );
}

// ============================================================================
// Template Card
// ============================================================================

interface TemplateCardProps {
  template: InstagramMessageTemplate;
  customCategories: InstagramTemplateCategory[];
  onSelect: (template: InstagramMessageTemplate) => void;
  variant?: "default" | "compact";
}

function TemplateCard({
  template,
  customCategories,
  onSelect,
  variant = "default",
}: TemplateCardProps): ReactNode {
  const categoryLabel = template.category
    ? getCategoryLabel(template.category, customCategories)
    : null;

  const stageColors: Record<MessageStage, string> = {
    opener: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    follow_up:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    engagement:
      "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    discovery:
      "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    closer:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  };

  return (
    <button
      onClick={() => onSelect(template)}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-all",
        "border-v2-ring",
        "bg-v2-card",
        "hover:border-v2-ring-strong ",
        "hover:shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-v2-accent/50",
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-v2-ink truncate">
            {template.name}
          </p>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {template.message_stage && (
            <span
              className={cn(
                "text-[9px] px-1.5 py-0.5 rounded font-medium",
                stageColors[template.message_stage as MessageStage],
              )}
            >
              {MESSAGE_STAGE_LABELS[template.message_stage as MessageStage]}
            </span>
          )}
          {categoryLabel && (
            <span className="text-[9px] px-1.5 py-0.5 bg-v2-ring dark:bg-v2-card-dark text-v2-ink-muted rounded">
              {categoryLabel}
            </span>
          )}
        </div>
      </div>

      {/* Content preview - show full content */}
      <p
        className={cn(
          "text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle whitespace-pre-wrap break-words",
          variant === "compact" ? "line-clamp-2" : "line-clamp-4",
        )}
      >
        {template.content}
      </p>

      {/* Footer - use stats */}
      {(template.use_count ?? 0) > 0 && (
        <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-v2-ring/60 /50">
          <TrendingUp className="h-3 w-3 text-v2-ink-subtle" />
          <span className="text-[9px] text-v2-ink-subtle">
            Used {template.use_count} time{template.use_count !== 1 ? "s" : ""}
          </span>
          {template.last_used_at && (
            <>
              <span className="text-[9px] text-v2-ink-subtle">•</span>
              <span className="text-[9px] text-v2-ink-subtle">
                Last{" "}
                {formatDistanceToNow(new Date(template.last_used_at), {
                  addSuffix: true,
                })}
              </span>
            </>
          )}
        </div>
      )}
    </button>
  );
}

// ============================================================================
// Empty State
// ============================================================================

interface EmptyStateProps {
  type: "no-templates" | "no-results";
  search?: string;
}

function EmptyState({ type, search }: EmptyStateProps): ReactNode {
  if (type === "no-templates") {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <MessageSquare className="h-10 w-10 text-v2-ink-subtle mb-3" />
        <p className="text-[12px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle mb-1">
          No templates yet
        </p>
        <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-muted">
          Create templates in Settings → Instagram Templates
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <Search className="h-10 w-10 text-v2-ink-subtle mb-3" />
      <p className="text-[12px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle mb-1">
        No templates found
      </p>
      <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-muted">
        {search
          ? `No templates match "${search}"`
          : "Try adjusting your filters"}
      </p>
    </div>
  );
}
