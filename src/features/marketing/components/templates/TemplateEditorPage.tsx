import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EmailBlockBuilder,
  EMAIL_TEMPLATE_CATEGORIES,
  TEMPLATE_PREVIEW_VARIABLES,
  useCreateEmailTemplate,
  useEmailTemplate,
  useUpdateEmailTemplate,
} from "@/features/email";
import type { EmailBlock, EmailTemplateCategory } from "@/types/email.types";

interface TemplateEditorPageProps {
  templateId?: string;
}

export function TemplateEditorPage({ templateId }: TemplateEditorPageProps) {
  const navigate = useNavigate();
  const isEditing = !!templateId;

  const { data: template, isLoading: isLoadingTemplate } = useEmailTemplate(
    templateId ?? null,
  );
  const createTemplate = useCreateEmailTemplate();
  const updateTemplate = useUpdateEmailTemplate();

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<EmailTemplateCategory>("general");
  const [blocks, setBlocks] = useState<EmailBlock[]>([]);

  useEffect(() => {
    if (isEditing && template) {
      setName(template.name);
      setSubject(template.subject);
      setCategory(template.category);
      setBlocks(template.blocks || []);
      return;
    }

    if (!isEditing) {
      setName("");
      setSubject("");
      setCategory("general");
      setBlocks([]);
    }
  }, [isEditing, template]);

  function goBackToTemplates() {
    navigate({ to: "/marketing/templates" });
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Template name is required.");
      return;
    }

    if (!subject.trim()) {
      toast.error("Subject is required.");
      return;
    }

    try {
      if (isEditing && templateId) {
        await updateTemplate.mutateAsync({
          id: templateId,
          updates: {
            name: name.trim(),
            subject: subject.trim(),
            category,
            blocks,
            is_block_template: true,
          },
        });
      } else {
        await createTemplate.mutateAsync({
          name: name.trim(),
          subject: subject.trim(),
          body_html: "",
          category,
          is_global: true,
          is_active: true,
          blocks,
          is_block_template: true,
        });
      }

      goBackToTemplates();
    } catch {
      // Mutation hooks already handle and toast errors.
    }
  }

  const isPending = createTemplate.isPending || updateTemplate.isPending;

  if (isEditing && isLoadingTemplate) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isEditing && !template) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">
          Template not found or unavailable.
        </p>
        <Button onClick={goBackToTemplates} variant="outline" size="sm">
          Back to Templates
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={goBackToTemplates}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
          <h1 className="font-display text-base font-extrabold uppercase tracking-tight">
            {isEditing ? "Edit Template" : "Create Template"}
          </h1>
        </div>

        <Button
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={handleSave}
          disabled={isPending || !name.trim() || !subject.trim()}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {isEditing ? "Save Changes" : "Create Template"}
        </Button>
      </div>

      <div className="flex gap-3 border-b px-4 py-2 shrink-0">
        <div className="flex-1 space-y-0.5">
          <Label className="text-[10px]">Name</Label>
          <Input
            className="h-7 text-[11px]"
            placeholder="Template name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex-1 space-y-0.5">
          <Label className="text-[10px]">Subject</Label>
          <Input
            className="h-7 text-[11px]"
            placeholder="Email subject line"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <div className="w-[180px] space-y-0.5">
          <Label className="text-[10px]">Category</Label>
          <Select
            value={category}
            onValueChange={(v) => setCategory(v as EmailTemplateCategory)}
          >
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EMAIL_TEMPLATE_CATEGORIES.map((cat) => (
                <SelectItem
                  key={cat.value}
                  value={cat.value}
                  className="text-[11px]"
                >
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <EmailBlockBuilder
          blocks={blocks}
          onChange={setBlocks}
          subject={subject}
          onSubjectChange={setSubject}
          previewVariables={TEMPLATE_PREVIEW_VARIABLES}
        />
      </div>
    </div>
  );
}
