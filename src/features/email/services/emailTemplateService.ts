import { supabase } from "@/services/base/supabase";
import type {
  EmailTemplate,
  CreateEmailTemplateRequest,
  EmailBlock,
} from "@/types/email.types";
import { blocksToHtml } from "../components/block-builder";
import { convertHtmlToText } from "./htmlToTextService";

export interface EmailTemplateFilters {
  category?: string;
  isActive?: boolean;
  isGlobal?: boolean;
  isBlockTemplate?: boolean;
  searchQuery?: string;
}

export interface UserTemplateStatus {
  count: number;
  limit: number;
  canCreate: boolean;
}

const DEFAULT_TEMPLATE_LIMIT = 10;

/** A reviewable AI-generated email draft (NOT yet persisted). */
export interface AiEmailDraft {
  name: string;
  subject: string;
  body_html: string;
  body_text: string | null;
}

/**
 * Generate an email DRAFT via AI (the `generate-workflow-email-template` edge
 * function). The edge fn gates on AI access + rate limits server-side and asks
 * the model for a {name, subject, body_html, body_text}. It does NOT persist —
 * the caller opens the draft in the shared email-template editor to review/edit
 * and saves it there, so there is exactly one build+save path.
 */
export async function generateAiEmailTemplateDraft(
  prompt: string,
  options?: { tone?: string; length?: string },
): Promise<AiEmailDraft> {
  const { data, error } = await supabase.functions.invoke(
    "generate-workflow-email-template",
    { body: { prompt, options } },
  );
  if (error) {
    // supabase wraps non-2xx responses in a FunctionsHttpError; surface the
    // server's JSON error message (e.g. the 403 access gate) when available.
    let msg = error.message || "AI generation failed";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        if (body?.error) msg = body.error;
      }
    } catch {
      /* keep the default message */
    }
    throw new Error(msg);
  }
  const draft = (data as { draft?: AiEmailDraft })?.draft;
  if (!draft?.subject || !draft?.body_html || !draft?.name) {
    throw new Error("AI did not return a template");
  }
  return draft;
}

export async function getEmailTemplates(
  filters?: EmailTemplateFilters,
): Promise<EmailTemplate[]> {
  let query = supabase
    .from("email_templates")
    .select("*")
    .order("updated_at", { ascending: false });

  if (filters?.category) {
    query = query.eq("category", filters.category);
  }
  if (filters?.isActive !== undefined) {
    query = query.eq("is_active", filters.isActive);
  }
  if (filters?.isGlobal !== undefined) {
    query = query.eq("is_global", filters.isGlobal);
  }
  if (filters?.isBlockTemplate !== undefined) {
    query = query.eq("is_block_template", filters.isBlockTemplate);
  }
  if (filters?.searchQuery) {
    // Escape special characters to prevent SQL injection
    const sanitized = filters.searchQuery.replace(/[%_\\]/g, "\\$&");
    query = query.or(`name.ilike.%${sanitized}%,subject.ilike.%${sanitized}%`);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as EmailTemplate[];
}

export async function getEmailTemplate(id: string): Promise<EmailTemplate> {
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as EmailTemplate;
}

export async function createEmailTemplate(
  template: CreateEmailTemplateRequest,
  userId: string,
): Promise<EmailTemplate> {
  // If block template, generate HTML and plain text from blocks
  let bodyHtml = template.body_html;
  let bodyText = template.body_text || null;
  if (template.is_block_template && template.blocks) {
    bodyHtml = blocksToHtml(template.blocks);
    bodyText = convertHtmlToText(bodyHtml);
  }

  const { data, error } = await supabase
    .from("email_templates")
    .insert({
      name: template.name,
      subject: template.subject,
      body_html: bodyHtml,
      body_text: bodyText,
      variables: template.variables || [],
      category: template.category || "general",
      is_global: template.is_global ?? false,
      created_by: userId,
      blocks: template.blocks || null,
      is_block_template: template.is_block_template ?? false,
    })
    .select()
    .single();

  if (error) throw error;
  return data as EmailTemplate;
}

export async function updateEmailTemplate(
  id: string,
  updates: Partial<CreateEmailTemplateRequest>,
): Promise<EmailTemplate> {
  // Build explicit update payload — only include defined fields
  const updateData: Record<string, unknown> = {};

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.subject !== undefined) updateData.subject = updates.subject;
  if (updates.category !== undefined) updateData.category = updates.category;
  if (updates.is_global !== undefined) updateData.is_global = updates.is_global;
  if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
  if (updates.variables !== undefined) updateData.variables = updates.variables;
  if (updates.is_block_template !== undefined)
    updateData.is_block_template = updates.is_block_template;

  // If updating blocks, regenerate HTML and plain text
  if (updates.blocks) {
    updateData.blocks = updates.blocks;
    const html = blocksToHtml(updates.blocks as EmailBlock[]);
    updateData.body_html = html;
    updateData.body_text = convertHtmlToText(html);
  } else {
    if (updates.body_html !== undefined)
      updateData.body_html = updates.body_html;
    if (updates.body_text !== undefined)
      updateData.body_text = updates.body_text;
  }

  const { data, error } = await supabase
    .from("email_templates")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as EmailTemplate;
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  const { data, error } = await supabase
    .from("email_templates")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      "Template not found or you don't have permission to delete it",
    );
  }
}

export async function duplicateEmailTemplate(
  id: string,
  userId: string,
): Promise<EmailTemplate> {
  const original = await getEmailTemplate(id);

  const { data, error } = await supabase
    .from("email_templates")
    .insert({
      name: `${original.name} (Copy)`,
      subject: original.subject,
      body_html: original.body_html,
      body_text: original.body_text,
      variables: original.variables,
      category: original.category,
      is_global: false,
      created_by: userId,
      blocks: original.blocks,
      is_block_template: original.is_block_template,
    })
    .select()
    .single();

  if (error) throw error;
  return data as EmailTemplate;
}

export async function toggleTemplateActive(
  id: string,
  isActive: boolean,
): Promise<EmailTemplate> {
  const { data, error } = await supabase
    .from("email_templates")
    .update({ is_active: isActive })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as EmailTemplate;
}

/**
 * Get user's personal template count and limit
 */
export async function getUserTemplateStatus(
  userId: string,
): Promise<UserTemplateStatus> {
  // Get user's limit from settings (use maybeSingle since user may not have settings row)
  const { data: settings } = await supabase
    .from("settings")
    .select("email_template_limit")
    .eq("user_id", userId)
    .maybeSingle();

  const limit = settings?.email_template_limit ?? DEFAULT_TEMPLATE_LIMIT;

  // Count user's personal templates
  const { count, error } = await supabase
    .from("email_templates")
    .select("*", { count: "exact", head: true })
    .eq("created_by", userId)
    .eq("is_global", false);

  if (error) throw error;

  const currentCount = count ?? 0;

  return {
    count: currentCount,
    limit,
    canCreate: currentCount < limit,
  };
}

/**
 * Get templates grouped by type (global vs personal)
 */
export async function getGroupedEmailTemplates(userId: string): Promise<{
  globalTemplates: EmailTemplate[];
  personalTemplates: EmailTemplate[];
  status: UserTemplateStatus;
}> {
  // Templates query - RLS will filter to global + user's own
  const { data: templates, error } = await supabase
    .from("email_templates")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;

  const allTemplates = (templates as EmailTemplate[]) || [];

  // Separate global from personal
  const globalTemplates = allTemplates.filter((t) => t.is_global);
  const personalTemplates = allTemplates.filter(
    (t) => !t.is_global && t.created_by === userId,
  );

  // Get user's status
  const status = await getUserTemplateStatus(userId);

  return {
    globalTemplates,
    personalTemplates,
    status,
  };
}
