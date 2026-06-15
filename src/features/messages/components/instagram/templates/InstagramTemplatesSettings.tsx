// src/features/messages/components/instagram/templates/InstagramTemplatesSettings.tsx
// Main settings component for managing Instagram message templates

import { useState, useMemo, type ReactNode } from "react";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
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
import { T } from "@/components/board/tokens";

const MUT3 = "rgba(255,255,255,0.28)";

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

  const canEdit = isSuperAdmin;

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      if (search) {
        const searchLower = search.toLowerCase();
        if (
          !template.name.toLowerCase().includes(searchLower) &&
          !template.content.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      if (prospectTypeFilter !== "all") {
        const filterValue = prospectTypeFilter;
        const templateCategory = template.category;

        if (!templateCategory) {
          return false;
        }

        if (templateCategory === filterValue) {
          // Match
        } else if (filterValue.startsWith("custom:")) {
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
    <div
      style={{
        height: "100%",
        display: "flex",
        background: T.surface3,
        border: `1px solid ${T.line}`,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* Left sidebar — category rail */}
      <div
        style={{
          width: 192,
          flexShrink: 0,
          borderRight: `1px solid ${T.line}`,
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(180deg, #1c1c1c, #181818)",
        }}
      >
        <CategoryManager
          selectedCategory={prospectTypeFilter}
          onSelectCategory={setProspectTypeFilter}
          canEdit={canEdit}
        />
      </div>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Filters bar */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: `1px solid ${T.line}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          {/* Search */}
          <div style={{ position: "relative", flex: 1, maxWidth: 280 }}>
            <Search
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                width: 13,
                height: 13,
                color: T.mut2,
                pointerEvents: "none",
              }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="placeholder-v2-ink-subtle"
              style={{
                width: "100%",
                paddingLeft: 32,
                paddingRight: 10,
                height: 32,
                background: T.surface3,
                border: `1px solid ${T.line2}`,
                borderRadius: 10,
                font: `500 13px ${T.data}`,
                color: T.ink,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Filters icon */}
          <SlidersHorizontal
            style={{ width: 14, height: 14, color: T.mut2, flexShrink: 0 }}
          />

          {/* Stage select */}
          <Select
            value={messageStageFilter}
            onValueChange={setMessageStageFilter}
          >
            <SelectTrigger
              style={{
                height: 32,
                width: 120,
                background: T.surface3,
                border: `1px solid ${T.line2}`,
                borderRadius: 8,
                font: `500 12px ${T.data}`,
                color: T.ink,
                flexShrink: 0,
              }}
            >
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent
              style={{
                background: T.surface5,
                border: `1px solid ${T.line2}`,
                borderRadius: 10,
              }}
            >
              <SelectItem
                value="all"
                style={{ font: `500 12px ${T.data}`, color: T.ink }}
              >
                All Stages
              </SelectItem>
              {Object.entries(MESSAGE_STAGE_LABELS).map(([value, label]) => (
                <SelectItem
                  key={value}
                  value={value}
                  style={{ font: `500 12px ${T.data}`, color: T.ink }}
                >
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Prospect type select */}
          <Select
            value={prospectTypeFilter}
            onValueChange={setProspectTypeFilter}
          >
            <SelectTrigger
              style={{
                height: 32,
                width: 138,
                background: T.surface3,
                border: `1px solid ${T.line2}`,
                borderRadius: 8,
                font: `500 12px ${T.data}`,
                color: T.ink,
                flexShrink: 0,
              }}
            >
              <SelectValue placeholder="Prospect Type" />
            </SelectTrigger>
            <SelectContent
              style={{
                background: T.surface5,
                border: `1px solid ${T.line2}`,
                borderRadius: 10,
              }}
            >
              <SelectItem
                value="all"
                style={{ font: `500 12px ${T.data}`, color: T.ink }}
              >
                All Types
              </SelectItem>
              {BUILT_IN_PROSPECT_TYPES.map((type) => (
                <SelectItem
                  key={type}
                  value={type}
                  style={{ font: `500 12px ${T.data}`, color: T.ink }}
                >
                  {PROSPECT_TYPE_LABELS[type]}
                </SelectItem>
              ))}
              {customCategories.length > 0 && (
                <>
                  <div
                    style={{
                      padding: "8px 10px 4px",
                      font: `700 10px ${T.mono}`,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: MUT3,
                    }}
                  >
                    Custom
                  </div>
                  {customCategories.map((cat) => (
                    <SelectItem
                      key={cat.id}
                      value={createCustomCategoryValue(cat.id)}
                      style={{ font: `500 12px ${T.data}`, color: T.ink }}
                    >
                      {cat.name}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>

          {/* New template button */}
          {canEdit && (
            <button
              type="button"
              onClick={handleNewTemplate}
              style={{
                flexShrink: 0,
                height: 32,
                padding: "0 14px",
                borderRadius: 8,
                background: T.violet,
                border: "none",
                color: "#1a0f33",
                font: `700 12px ${T.data}`,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Plus style={{ width: 13, height: 13 }} />
              New Template
            </button>
          )}
        </div>

        {/* Template list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
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
