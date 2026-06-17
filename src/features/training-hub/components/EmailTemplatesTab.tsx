import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useAiAccess } from "@/hooks/subscription";
import AiEmailTemplateDialog from "./AiEmailTemplateDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TINT } from "@/components/ui/StatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  FileText,
  ChevronDown,
  Globe,
  User,
  Eye,
  ArrowLeft,
  Save,
  Sparkles,
} from "lucide-react";
import {
  useGroupedEmailTemplates,
  useEmailTemplate,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
  useDeleteEmailTemplate,
  useDuplicateEmailTemplate,
  useToggleTemplateActive,
  EmailBlockBuilder,
  EMAIL_TEMPLATE_CATEGORIES,
  TEMPLATE_PREVIEW_VARIABLES,
} from "@/features/email";
import { usePermissionCheck } from "@/hooks/permissions";
import { useAuthorizationStatus } from "@/hooks/admin";
import type {
  EmailTemplate,
  EmailBlock,
  EmailTemplateCategory,
} from "@/types/email.types";

interface EmailTemplatesTabProps {
  searchQuery?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  onboarding: "Onboarding",
  documents: "Documents",
  follow_up: "Follow Up",
  general: "General",
};

// Template list row component
function TemplateRow({
  template,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleActive,
  canEdit,
}: {
  template: EmailTemplate;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleActive: () => void;
  canEdit: boolean;
}) {
  return (
    <TableRow className="text-[13px] border-b border-border dark:border-border hover:bg-background dark:hover:bg-v2-card-tinted/50">
      <TableCell className="py-2">
        <span className="font-medium text-foreground dark:text-foreground">
          {template.name}
        </span>
      </TableCell>
      <TableCell className="py-2 text-muted-foreground dark:text-muted-foreground">
        <span className="line-clamp-1">{template.subject}</span>
      </TableCell>
      <TableCell className="py-2">
        <Badge
          variant="outline"
          className={`text-[11px] px-1.5 py-0.5 ${TINT.slate}`}
        >
          {CATEGORY_LABELS[template.category] || template.category}
        </Badge>
      </TableCell>
      <TableCell className="py-2">
        <Badge
          variant="outline"
          className={`text-[11px] px-1.5 py-0.5 ${template.is_active ? TINT.emerald : TINT.slate}`}
        >
          {template.is_active ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      <TableCell className="py-2 text-muted-foreground dark:text-muted-foreground">
        {format(new Date(template.updated_at), "MMM d")}
      </TableCell>
      <TableCell className="py-2 w-8">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-background"
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-[11px]">
            <DropdownMenuItem onClick={onView} className="text-[11px]">
              <Eye className="mr-1.5 h-3 w-3" />
              View
            </DropdownMenuItem>
            {canEdit && (
              <DropdownMenuItem onClick={onEdit} className="text-[11px]">
                <Pencil className="mr-1.5 h-3 w-3" />
                Edit
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onDuplicate} className="text-[11px]">
              <Copy className="mr-1.5 h-3 w-3" />
              Duplicate
            </DropdownMenuItem>
            {canEdit && (
              <>
                <DropdownMenuItem
                  onClick={onToggleActive}
                  className="text-[11px]"
                >
                  {template.is_active ? (
                    <>
                      <ToggleLeft className="mr-1.5 h-3 w-3" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <ToggleRight className="mr-1.5 h-3 w-3" />
                      Activate
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-[11px] text-destructive focus:text-destructive dark:focus:text-destructive"
                >
                  <Trash2 className="mr-1.5 h-3 w-3" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

// Template list table component
function TemplateTable({
  templates,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleActive,
  canEdit,
}: {
  templates: EmailTemplate[];
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  canEdit: boolean;
}) {
  if (templates.length === 0) {
    return (
      <div className="py-3 text-center text-[11px] text-muted-foreground dark:text-muted-foreground">
        No templates
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="h-6 bg-background dark:bg-v2-card-tinted/50 hover:bg-background dark:hover:bg-v2-card-tinted/50">
          <TableHead className="h-6 text-[11px] font-semibold text-muted-foreground dark:text-muted-foreground">
            Name
          </TableHead>
          <TableHead className="h-6 text-[11px] font-semibold text-muted-foreground dark:text-muted-foreground">
            Subject
          </TableHead>
          <TableHead className="h-6 text-[11px] font-semibold text-muted-foreground dark:text-muted-foreground">
            Category
          </TableHead>
          <TableHead className="h-6 text-[11px] font-semibold text-muted-foreground dark:text-muted-foreground">
            Status
          </TableHead>
          <TableHead className="h-6 text-[11px] font-semibold text-muted-foreground dark:text-muted-foreground">
            Updated
          </TableHead>
          <TableHead className="h-6 w-8"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {templates.map((template) => (
          <TemplateRow
            key={template.id}
            template={template}
            onView={() => onView(template.id)}
            onEdit={() => onEdit(template.id)}
            onDelete={() => onDelete(template.id)}
            onDuplicate={() => onDuplicate(template.id)}
            onToggleActive={() =>
              onToggleActive(template.id, !template.is_active)
            }
            canEdit={canEdit}
          />
        ))}
      </TableBody>
    </Table>
  );
}

// Inline template editor component
function InlineTemplateEditor({
  templateId,
  isNew,
  isViewOnly,
  onClose,
}: {
  templateId: string | null;
  isNew: boolean;
  isViewOnly: boolean;
  onClose: () => void;
}) {
  // Only fetch if we have a templateId and we're not creating new
  const shouldFetch = !!templateId && !isNew;
  const { data: existingTemplate, isLoading: loadingTemplate } =
    useEmailTemplate(shouldFetch ? templateId : "");

  const createTemplate = useCreateEmailTemplate();
  const updateTemplate = useUpdateEmailTemplate();

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<EmailTemplateCategory>("general");
  const [isGlobal, setIsGlobal] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [blocks, setBlocks] = useState<EmailBlock[]>([]);

  // Initialize form with existing template data (properly in useEffect)
  useEffect(() => {
    if (existingTemplate && !isNew) {
      setName(existingTemplate.name);
      setSubject(existingTemplate.subject);
      setCategory(existingTemplate.category);
      setIsGlobal(existingTemplate.is_global);
      setIsActive(existingTemplate.is_active);
      setBlocks(existingTemplate.blocks || []);
    }
  }, [existingTemplate, isNew]);

  const handleSave = async () => {
    if (!name.trim() || !subject.trim()) return;

    if (isNew) {
      await createTemplate.mutateAsync({
        name: name.trim(),
        subject: subject.trim(),
        body_html: "",
        category,
        is_global: isGlobal,
        blocks,
        is_block_template: true,
      });
    } else if (templateId) {
      await updateTemplate.mutateAsync({
        id: templateId,
        updates: {
          name: name.trim(),
          subject: subject.trim(),
          category,
          is_global: isGlobal,
          is_active: isActive,
          blocks,
        },
      });
    }
    onClose();
  };

  const isValid = name.trim() && subject.trim();
  const isSaving = createTemplate.isPending || updateTemplate.isPending;

  if (!isNew && loadingTemplate) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const fieldStyle = {
    background: "var(--surface-1)",
    border: "1px solid var(--line2)",
    color: "var(--ink)",
  } as const;

  return (
    <div
      className="flex h-full flex-col"
      style={{ background: "var(--surface-2)" }}
    >
      {/* Header */}
      <div
        className="flex h-12 shrink-0 items-center justify-between px-4"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-4)]"
            style={{ color: "var(--mut)" }}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2
            className="font-display text-[15px] font-extrabold uppercase tracking-wide"
            style={{ color: "var(--ink)" }}
          >
            {isViewOnly
              ? "View Template"
              : isNew
                ? "Create Template"
                : "Edit Template"}
          </h2>
        </div>
        {!isViewOnly && (
          <button
            type="button"
            onClick={handleSave}
            disabled={!isValid || isSaving}
            className="flex h-9 items-center gap-1.5 rounded-lg px-4 font-sans text-[13px] font-semibold transition-opacity disabled:opacity-40"
            style={{ background: "var(--green)", color: "#0a1a0f" }}
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {isNew ? "Create" : "Save"}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Settings sidebar */}
        <div
          className="w-56 shrink-0 space-y-4 overflow-y-auto p-4"
          style={{ borderRight: "1px solid var(--line)" }}
        >
          <div className="space-y-1.5">
            <label
              className="font-sans text-[12px] font-semibold"
              style={{ color: "var(--mut)" }}
            >
              Template Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Welcome Email"
              disabled={isViewOnly}
              className="h-9 w-full rounded-lg px-3 font-sans text-[13px] outline-none placeholder:text-[var(--mut2)] disabled:opacity-60"
              style={fieldStyle}
            />
          </div>

          <div className="space-y-1.5">
            <label
              className="font-sans text-[12px] font-semibold"
              style={{ color: "var(--mut)" }}
            >
              Subject Line
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Welcome to the Team!"
              disabled={isViewOnly}
              className="h-9 w-full rounded-lg px-3 font-sans text-[13px] outline-none placeholder:text-[var(--mut2)] disabled:opacity-60"
              style={fieldStyle}
            />
          </div>

          <div className="space-y-1.5">
            <label
              className="font-sans text-[12px] font-semibold"
              style={{ color: "var(--mut)" }}
            >
              Category
            </label>
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as EmailTemplateCategory)
              }
              disabled={isViewOnly}
              className="h-9 w-full rounded-lg px-3 font-sans text-[13px] outline-none disabled:opacity-60"
              style={fieldStyle}
            >
              {EMAIL_TEMPLATE_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {!isViewOnly && (
            <div className="space-y-2.5 pt-1">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={isGlobal}
                  onChange={(e) => setIsGlobal(e.target.checked)}
                  style={{ accentColor: "var(--blue)" }}
                />
                <span
                  className="font-sans text-[12.5px]"
                  style={{ color: "var(--mut)" }}
                >
                  Global
                </span>
              </label>

              {!isNew && (
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    style={{ accentColor: "var(--green)" }}
                  />
                  <span
                    className="font-sans text-[12.5px]"
                    style={{ color: "var(--mut)" }}
                  >
                    Active
                  </span>
                </label>
              )}
            </div>
          )}
        </div>

        {/* Email builder */}
        <div
          className="flex-1 overflow-hidden"
          style={{ background: "var(--surface-1)" }}
        >
          <EmailBlockBuilder
            blocks={blocks}
            onChange={isViewOnly ? () => {} : setBlocks}
            previewVariables={TEMPLATE_PREVIEW_VARIABLES}
          />
        </div>
      </div>
    </div>
  );
}

// Main component
export function EmailTemplatesTab({ searchQuery }: EmailTemplatesTabProps) {
  const [editorState, setEditorState] = useState<{
    mode: "list" | "create" | "edit" | "view";
    templateId: string | null;
  }>({ mode: "list", templateId: null });
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [globalOpen, setGlobalOpen] = useState(true);
  const [personalOpen, setPersonalOpen] = useState(true);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const { hasAiAccess } = useAiAccess();

  const { data, isLoading } = useGroupedEmailTemplates();
  const deleteTemplate = useDeleteEmailTemplate();
  const duplicateTemplate = useDuplicateEmailTemplate();
  const toggleActive = useToggleTemplateActive();
  const { isAnyRole } = usePermissionCheck();
  const { isSuperAdmin } = useAuthorizationStatus();

  const canManageGlobal =
    isSuperAdmin || isAnyRole(["admin", "trainer", "contracting_manager"]);

  // Non-super-admin staff should not see billing/subscription system templates
  const ADMIN_ONLY_CATEGORIES = ["billing"];

  const filterTemplates = (templates: EmailTemplate[], isGlobal = false) => {
    let filtered = templates;

    // Hide billing templates from non-super-admin users
    if (isGlobal && !isSuperAdmin) {
      filtered = filtered.filter(
        (t) => !ADMIN_ONLY_CATEGORIES.includes(t.category || ""),
      );
    }

    if (!searchQuery) return filtered;
    const query = searchQuery.toLowerCase();
    return filtered.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.subject.toLowerCase().includes(query),
    );
  };

  const globalTemplates = filterTemplates(data?.globalTemplates || [], true);
  const personalTemplates = filterTemplates(
    data?.personalTemplates || [],
    false,
  );
  const status = data?.status;

  const handleDelete = async () => {
    if (!deleteTemplateId) return;
    await deleteTemplate.mutateAsync(deleteTemplateId);
    setDeleteTemplateId(null);
  };

  const allTemplates = [...globalTemplates, ...personalTemplates];
  const templateToDelete = deleteTemplateId
    ? allTemplates.find((t) => t.id === deleteTemplateId)
    : null;

  const canCreateNew = status?.canCreate ?? true;

  // Show editor if in create/edit/view mode
  if (editorState.mode !== "list") {
    return (
      <InlineTemplateEditor
        templateId={editorState.templateId}
        isNew={editorState.mode === "create"}
        isViewOnly={editorState.mode === "view"}
        onClose={() => setEditorState({ mode: "list", templateId: null })}
      />
    );
  }

  // Template list view
  return (
    <div className="space-y-2 p-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1">
            <Globe className="h-3 w-3 text-info" />
            <span className="font-medium text-foreground dark:text-foreground">
              {globalTemplates.length}
            </span>
            <span className="text-muted-foreground dark:text-muted-foreground">
              global
            </span>
          </div>
          <div className="h-3 w-px bg-muted dark:bg-muted" />
          <div className="flex items-center gap-1">
            <User className="h-3 w-3 text-info" />
            <span className="font-medium text-foreground dark:text-foreground">
              {status ? `${status.count}/${status.limit}` : "..."}
            </span>
            <span className="text-muted-foreground dark:text-muted-foreground">
              personal
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasAiAccess && (
            <button
              type="button"
              onClick={() => setShowAiDialog(true)}
              className="flex h-7 items-center gap-1.5 rounded-lg px-3 font-sans text-[12px] font-semibold transition-colors hover:bg-[var(--surface-4)]"
              style={{
                border:
                  "1px solid color-mix(in srgb, var(--violet) 45%, transparent)",
                color: "var(--violet)",
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Generate with AI
            </button>
          )}
          <Button
            size="sm"
            onClick={() => setEditorState({ mode: "create", templateId: null })}
            disabled={!canCreateNew}
            className="h-7 gap-1 text-[12px] px-3"
          >
            <Plus className="h-3.5 w-3.5" />
            New Template
          </Button>
        </div>
      </div>

      <AiEmailTemplateDialog
        open={showAiDialog}
        onOpenChange={setShowAiDialog}
      />

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : allTemplates.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border dark:border-border">
          <FileText className="h-6 w-6 text-muted-foreground" />
          <p className="text-[11px] text-muted-foreground dark:text-muted-foreground">
            No email templates yet
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditorState({ mode: "create", templateId: null })}
            className="mt-1 h-6 text-[10px] border-border dark:border-border"
          >
            Create your first template
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Global Templates Section */}
          <Collapsible open={globalOpen} onOpenChange={setGlobalOpen}>
            <div className="rounded-lg border border-border dark:border-border overflow-hidden">
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center justify-between px-2.5 py-1.5 bg-background dark:bg-v2-card-tinted/50 hover:bg-v2-card-tinted dark:hover:bg-v2-card-tinted transition-colors">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground dark:text-foreground">
                    <Globe className="h-3 w-3 text-info" />
                    Global Templates
                    <Badge
                      variant="secondary"
                      className="ml-1 h-4 px-1 text-[9px] bg-muted dark:bg-muted text-muted-foreground dark:text-muted-foreground"
                    >
                      {globalTemplates.length}
                    </Badge>
                  </div>
                  <ChevronDown
                    className={`h-3 w-3 text-muted-foreground transition-transform ${globalOpen ? "" : "-rotate-90"}`}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t border-border dark:border-border">
                  <TemplateTable
                    templates={globalTemplates}
                    onView={(id) =>
                      setEditorState({ mode: "view", templateId: id })
                    }
                    onEdit={(id) =>
                      setEditorState({ mode: "edit", templateId: id })
                    }
                    onDelete={setDeleteTemplateId}
                    onDuplicate={(id) => duplicateTemplate.mutate(id)}
                    onToggleActive={(id, isActive) =>
                      toggleActive.mutate({ id, isActive })
                    }
                    canEdit={canManageGlobal}
                  />
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Personal Templates Section */}
          <Collapsible open={personalOpen} onOpenChange={setPersonalOpen}>
            <div className="rounded-lg border border-border dark:border-border overflow-hidden">
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center justify-between px-2.5 py-1.5 bg-background dark:bg-v2-card-tinted/50 hover:bg-v2-card-tinted dark:hover:bg-v2-card-tinted transition-colors">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground dark:text-foreground">
                    <User className="h-3 w-3 text-info" />
                    My Templates
                    <Badge
                      variant="secondary"
                      className="ml-1 h-4 px-1 text-[9px] bg-muted dark:bg-muted text-muted-foreground dark:text-muted-foreground"
                    >
                      {status
                        ? `${status.count}/${status.limit}`
                        : personalTemplates.length}
                    </Badge>
                  </div>
                  <ChevronDown
                    className={`h-3 w-3 text-muted-foreground transition-transform ${personalOpen ? "" : "-rotate-90"}`}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t border-border dark:border-border">
                  <TemplateTable
                    templates={personalTemplates}
                    onView={(id) =>
                      setEditorState({ mode: "view", templateId: id })
                    }
                    onEdit={(id) =>
                      setEditorState({ mode: "edit", templateId: id })
                    }
                    onDelete={setDeleteTemplateId}
                    onDuplicate={(id) => duplicateTemplate.mutate(id)}
                    onToggleActive={(id, isActive) =>
                      toggleActive.mutate({ id, isActive })
                    }
                    canEdit={true}
                  />
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTemplateId}
        onOpenChange={(open) => !open && setDeleteTemplateId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">
              Delete Template
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete "{templateToDelete?.name}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="h-7 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTemplate.isPending && (
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
