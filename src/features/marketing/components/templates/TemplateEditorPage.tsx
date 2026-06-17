import { useNavigate } from "@tanstack/react-router";
import { EmailTemplateEditor } from "@/features/email";

interface TemplateEditorPageProps {
  templateId?: string;
}

/**
 * Marketing create/edit template routes. A thin host around the ONE shared
 * EmailTemplateEditor (the same component the Workflows / Training Hub email
 * templates tab uses) — this page only owns navigation. Marketing templates are
 * global, so the Global toggle is hidden and defaultGlobal is set.
 */
export function TemplateEditorPage({ templateId }: TemplateEditorPageProps) {
  const navigate = useNavigate();
  const backToList = () => navigate({ to: "/marketing/templates" });

  return (
    <EmailTemplateEditor
      key={templateId ?? "new"}
      templateId={templateId ?? null}
      mode={templateId ? "edit" : "create"}
      defaultGlobal
      onClose={backToList}
    />
  );
}
