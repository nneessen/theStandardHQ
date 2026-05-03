// src/features/messages/components/instagram/templates/InstagramTemplatesSettings.tsx
// Main settings component for managing Instagram message templates

import { useState, useMemo, type ReactNode } from "react";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useImo } from "@/contexts/ImoContext";
import { useInstagramTemplates, useInstagramTemplateCategories } from "@/hooks";
import {
  PROSPECT_TYPE_LABELS,
  MESSAGE_STAGE_LABELS,
  BUILT_IN_PROSPECT_TYPES,
  createCustomCategoryValue,
  type InstagramMessageTemplate,
} from "@/types/instagram.types";
import { TemplateList } from "./TemplateList";
import { TemplateForm } from "./TemplateForm";
import { TemplatePreviewSheet } from "./TemplatePreviewSheet";
import { CategoryManager } from "./CategoryManager";

export function InstagramTemplatesSettings(): ReactNode {
  const { isSuperAdmin } = useImo();
  const [search, setSearch] = useState("");
  const [prospectTypeFilter, setProspectTypeFilter] = useState<string>("all");
  const [messageStageFilter, setMessageStageFilter] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<InstagramMessageTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] =
    useState<InstagramMessageTemplate | null>(null);

  const { data: templates = [], isLoading } = useInstagramTemplates();
  const { data: customCategories = [] } = useInstagramTemplateCategories();

  // Only super-admin can edit templates
  const canEdit = isSuperAdmin;

  // Filter templates based on search and filters
  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        if (
          !template.name.toLowerCase().includes(searchLower) &&
          !template.content.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      // Prospect type filter
      if (prospectTypeFilter !== "all") {
        // Handle both new format (custom:{uuid}) and legacy format (category name)
        const filterValue = prospectTypeFilter;
        const templateCategory = template.category;

        if (!templateCategory) {
          return false;
        }

        // Direct match (handles built-in types and new custom format)
        if (templateCategory === filterValue) {
          // Match
        }
        // Legacy support: if filter is custom:{uuid}, also check if template has legacy name
        else if (filterValue.startsWith("custom:")) {
          const categoryId = filterValue.slice(7);
          const matchingCategory = customCategories.find(
            (c) => c.id === categoryId,
          );
          if (matchingCategory && templateCategory === matchingCategory.name) {
            // Match - legacy template with name
          } else {
            return false;
          }
        } else {
          return false;
        }
      }

      // Message stage filter
      if (messageStageFilter !== "all") {
        if (template.message_stage !== messageStageFilter) {
          return false;
        }
      }

      return true;
    });
  }, [
    templates,
    search,
    prospectTypeFilter,
    messageStageFilter,
    customCategories,
  ]);

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setIsFormOpen(true);
  };

  const handleEditTemplate = (template: InstagramMessageTemplate) => {
    setEditingTemplate(template);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingTemplate(null);
  };

  const handlePreviewToEdit = (template: InstagramMessageTemplate) => {
    setPreviewTemplate(null);
    handleEditTemplate(template);
  };

  return (
    <div className="h-full flex bg-card rounded-v2-md border border-border shadow-v2-soft overflow-hidden">
      {/* Sidebar - Categories */}
      <div className="w-48 border-r border-border flex flex-col">
        <CategoryManager
          selectedCategory={prospectTypeFilter}
          onSelectCategory={setProspectTypeFilter}
          canEdit={canEdit}
        />
      </div>

      {/* Main Content - Templates */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-3 border-b border-border flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="h-7 pl-7 text-[11px]"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />

            <Select
              value={messageStageFilter}
              onValueChange={setMessageStageFilter}
            >
              <SelectTrigger className="h-7 w-28 text-[11px]">
                <SelectValue placeholder="Stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-[11px]">
                  All Stages
                </SelectItem>
                {Object.entries(MESSAGE_STAGE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value} className="text-[11px]">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={prospectTypeFilter}
              onValueChange={setProspectTypeFilter}
            >
              <SelectTrigger className="h-7 w-32 text-[11px]">
                <SelectValue placeholder="Prospect Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-[11px]">
                  All Types
                </SelectItem>
                {/* Built-in types */}
                {BUILT_IN_PROSPECT_TYPES.map((type) => (
                  <SelectItem key={type} value={type} className="text-[11px]">
                    {PROSPECT_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
                {/* Custom categories */}
                {customCategories.length > 0 && (
                  <>
                    <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      Custom
                    </div>
                    {customCategories.map((cat) => (
                      <SelectItem
                        key={cat.id}
                        value={createCustomCategoryValue(cat.id)}
                        className="text-[11px]"
                      >
                        {cat.name}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* New Template Button - Super Admin Only */}
          {canEdit && (
            <Button
              size="sm"
              onClick={handleNewTemplate}
              className="h-7 text-[11px]"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              New Template
            </Button>
          )}
        </div>

        {/* Template List */}
        <div className="flex-1 overflow-auto">
          <TemplateList
            templates={filteredTemplates}
            isLoading={isLoading}
            onEdit={handleEditTemplate}
            onPreview={setPreviewTemplate}
            canEdit={canEdit}
          />
        </div>
      </div>

      {/* Template Form Sheet */}
      <TemplateForm
        open={isFormOpen}
        onOpenChange={handleCloseForm}
        template={editingTemplate}
      />

      {/* Template Preview Sheet */}
      <TemplatePreviewSheet
        template={previewTemplate}
        onOpenChange={(open) => !open && setPreviewTemplate(null)}
        canEdit={canEdit}
        onEdit={handlePreviewToEdit}
      />
    </div>
  );
}
