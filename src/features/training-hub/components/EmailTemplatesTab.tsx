import { useState, useEffect } from "react";
import { format } from "date-fns";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
    <TableRow className="text-[11px] border-b border-v2-ring dark:border-v2-ring hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/50">
      <TableCell className="py-1.5">
        <span className="font-medium text-v2-ink dark:text-v2-ink">
          {template.name}
        </span>
      </TableCell>
      <TableCell className="py-1.5 text-v2-ink-muted dark:text-v2-ink-subtle">
        <span className="line-clamp-1">{template.subject}</span>
      </TableCell>
      <TableCell className="py-1.5">
        <Badge
          variant="outline"
          className="text-[9px] px-1 py-0 border-v2-ring dark:border-v2-ring-strong text-v2-ink-muted dark:text-v2-ink-subtle"
        >
          {CATEGORY_LABELS[template.category] || template.category}
        </Badge>
      </TableCell>
      <TableCell className="py-1.5">
        <Badge
          variant="secondary"
          className={`text-[9px] px-1 py-0 ${template.is_active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-v2-card-tinted text-v2-ink-muted dark:bg-v2-card-tinted dark:text-v2-ink-subtle"}`}
        >
          {template.is_active ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      <TableCell className="py-1.5 text-v2-ink-muted dark:text-v2-ink-subtle">
        {format(new Date(template.updated_at), "MMM d")}
      </TableCell>
      <TableCell className="py-1.5 w-8">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-v2-ink-muted hover:text-v2-ink dark:text-v2-ink-subtle dark:hover:text-v2-canvas"
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
                  className="text-[11px] text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
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
      <div className="py-3 text-center text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
        No templates
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="h-6 bg-v2-canvas dark:bg-v2-card-tinted/50 hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/50">
          <TableHead className="h-6 text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-muted">
            Name
          </TableHead>
          <TableHead className="h-6 text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-muted">
            Subject
          </TableHead>
          <TableHead className="h-6 text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-muted">
            Category
          </TableHead>
          <TableHead className="h-6 text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-muted">
            Status
          </TableHead>
          <TableHead className="h-6 text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-muted">
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

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b px-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onClose}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <h2 className="text-xs font-semibold">
            {isViewOnly
              ? "View Template"
              : isNew
                ? "Create Template"
                : "Edit Template"}
          </h2>
        </div>
        {!isViewOnly && (
          <Button
            onClick={handleSave}
            disabled={!isValid || isSaving}
            size="sm"
            className="h-6 gap-1 text-xs px-2"
          >
            {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
            <Save className="h-3 w-3" />
            {isNew ? "Create" : "Save"}
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Settings sidebar */}
        <div className="w-44 shrink-0 space-y-2.5 overflow-y-auto border-r bg-muted/20 p-2.5">
          <div className="space-y-1">
            <Label className="text-[10px] font-medium">Template Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Welcome Email"
              className="h-6 text-[10px]"
              disabled={isViewOnly}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-medium">Subject Line</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Welcome to the Team!"
              className="h-6 text-[10px]"
              disabled={isViewOnly}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-medium">Category</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as EmailTemplateCategory)}
              disabled={isViewOnly}
            >
              <SelectTrigger className="h-6 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMAIL_TEMPLATE_CATEGORIES.map((cat) => (
                  <SelectItem
                    key={cat.value}
                    value={cat.value}
                    className="text-xs"
                  >
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isViewOnly && (
            <>
              <div className="flex items-center gap-1.5">
                <Switch
                  id="global"
                  checked={isGlobal}
                  onCheckedChange={setIsGlobal}
                  className="h-3.5 w-6"
                />
                <Label htmlFor="global" className="text-[10px]">
                  Global
                </Label>
              </div>

              {!isNew && (
                <div className="flex items-center gap-1.5">
                  <Switch
                    id="active"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                    className="h-3.5 w-6"
                  />
                  <Label htmlFor="active" className="text-[10px]">
                    Active
                  </Label>
                </div>
              )}
            </>
          )}
        </div>

        {/* Email builder */}
        <div className="flex-1 overflow-hidden">
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
            <Globe className="h-3 w-3 text-blue-500" />
            <span className="font-medium text-v2-ink dark:text-v2-ink">
              {globalTemplates.length}
            </span>
            <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
              global
            </span>
          </div>
          <div className="h-3 w-px bg-v2-ring dark:bg-v2-ring-strong" />
          <div className="flex items-center gap-1">
            <User className="h-3 w-3 text-purple-500" />
            <span className="font-medium text-v2-ink dark:text-v2-ink">
              {status ? `${status.count}/${status.limit}` : "..."}
            </span>
            <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
              personal
            </span>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => setEditorState({ mode: "create", templateId: null })}
          disabled={!canCreateNew}
          className="h-6 gap-1 text-[10px] px-2"
        >
          <Plus className="h-3 w-3" />
          New Template
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
        </div>
      ) : allTemplates.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-v2-ring dark:border-v2-ring-strong">
          <FileText className="h-6 w-6 text-v2-ink-subtle" />
          <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
            No email templates yet
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditorState({ mode: "create", templateId: null })}
            className="mt-1 h-6 text-[10px] border-v2-ring dark:border-v2-ring-strong"
          >
            Create your first template
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Global Templates Section */}
          <Collapsible open={globalOpen} onOpenChange={setGlobalOpen}>
            <div className="rounded-lg border border-v2-ring dark:border-v2-ring-strong overflow-hidden">
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center justify-between px-2.5 py-1.5 bg-v2-canvas dark:bg-v2-card-tinted/50 hover:bg-v2-card-tinted dark:hover:bg-v2-card-tinted transition-colors">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-v2-ink dark:text-v2-ink">
                    <Globe className="h-3 w-3 text-blue-500" />
                    Global Templates
                    <Badge
                      variant="secondary"
                      className="ml-1 h-4 px-1 text-[9px] bg-v2-ring dark:bg-v2-ring-strong text-v2-ink-muted dark:text-v2-ink-muted"
                    >
                      {globalTemplates.length}
                    </Badge>
                  </div>
                  <ChevronDown
                    className={`h-3 w-3 text-v2-ink-subtle transition-transform ${globalOpen ? "" : "-rotate-90"}`}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t border-v2-ring dark:border-v2-ring-strong">
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
            <div className="rounded-lg border border-v2-ring dark:border-v2-ring-strong overflow-hidden">
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center justify-between px-2.5 py-1.5 bg-v2-canvas dark:bg-v2-card-tinted/50 hover:bg-v2-card-tinted dark:hover:bg-v2-card-tinted transition-colors">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-v2-ink dark:text-v2-ink">
                    <User className="h-3 w-3 text-purple-500" />
                    My Templates
                    <Badge
                      variant="secondary"
                      className="ml-1 h-4 px-1 text-[9px] bg-v2-ring dark:bg-v2-ring-strong text-v2-ink-muted dark:text-v2-ink-muted"
                    >
                      {status
                        ? `${status.count}/${status.limit}`
                        : personalTemplates.length}
                    </Badge>
                  </div>
                  <ChevronDown
                    className={`h-3 w-3 text-v2-ink-subtle transition-transform ${personalOpen ? "" : "-rotate-90"}`}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t border-v2-ring dark:border-v2-ring-strong">
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
