import { supabase } from "@/services/base/supabase";
import type {
  MarketingAudience,
  MarketingAudienceMember,
  MarketingExternalContact,
} from "../types/marketing.types";

export async function getAudiences(): Promise<MarketingAudience[]> {
  const { data, error } = await supabase
    .from("marketing_audiences")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getAudience(id: string): Promise<MarketingAudience> {
  const { data, error } = await supabase
    .from("marketing_audiences")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as MarketingAudience;
}

export async function createAudience(audience: {
  name: string;
  description?: string;
  audience_type: string;
  source_pool: string;
  filters?: Record<string, unknown>;
  contact_count?: number;
  created_by: string;
}): Promise<MarketingAudience> {
  const { data, error } = await supabase
    .from("marketing_audiences")
    .insert(audience)
    .select()
    .single();

  if (error) throw error;
  return data as MarketingAudience;
}

export async function updateAudience(
  id: string,
  updates: Partial<
    Pick<
      MarketingAudience,
      "name" | "description" | "filters" | "contact_count"
    >
  >,
): Promise<MarketingAudience> {
  const { data, error } = await supabase
    .from("marketing_audiences")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as MarketingAudience;
}

export async function deleteAudience(id: string): Promise<void> {
  const { error } = await supabase
    .from("marketing_audiences")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function getAudienceMembers(
  audienceId: string,
): Promise<MarketingAudienceMember[]> {
  const { data, error } = await supabase
    .from("marketing_audience_members")
    .select("*")
    .eq("audience_id", audienceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function addAudienceMembers(
  audienceId: string,
  members: Omit<MarketingAudienceMember, "id" | "audience_id" | "created_at">[],
): Promise<void> {
  const rows = members.map((m) => ({ ...m, audience_id: audienceId }));
  const { error } = await supabase
    .from("marketing_audience_members")
    .upsert(rows, { onConflict: "audience_id,email" });

  if (error) throw error;

  // Update contact count
  const { count } = await supabase
    .from("marketing_audience_members")
    .select("*", { count: "exact", head: true })
    .eq("audience_id", audienceId);

  await supabase
    .from("marketing_audiences")
    .update({ contact_count: count || 0, updated_at: new Date().toISOString() })
    .eq("id", audienceId);
}

// Resolve audience contacts based on source pool
export async function resolveAudienceContacts(
  sourcePool: string,
  _filters: Record<string, unknown> = {},
): Promise<
  {
    email: string;
    first_name: string;
    last_name: string;
    contact_type: string;
  }[]
> {
  const contacts: {
    email: string;
    first_name: string;
    last_name: string;
    contact_type: string;
  }[] = [];

  if (sourcePool === "agents" || sourcePool === "mixed") {
    const { data } = await supabase
      .from("user_profiles")
      .select("email, first_name, last_name")
      .eq("approval_status", "approved");
    if (data) {
      contacts.push(
        ...data.map((u) => ({
          email: u.email,
          first_name: u.first_name || "",
          last_name: u.last_name || "",
          contact_type: "agent" as const,
        })),
      );
    }
  }

  if (sourcePool === "clients" || sourcePool === "mixed") {
    const { data } = await supabase
      .from("clients")
      .select("email, name")
      .not("email", "is", null);
    if (data) {
      contacts.push(
        ...data.map((c) => {
          const parts = (c.name || "").trim().split(/\s+/);
          const firstName = parts[0] || "";
          const lastName = parts.slice(1).join(" ");
          return {
            email: c.email || "",
            first_name: firstName,
            last_name: lastName,
            contact_type: "client" as const,
          };
        }),
      );
    }
  }

  if (sourcePool === "leads" || sourcePool === "mixed") {
    const { data } = await supabase
      .from("recruiting_leads")
      .select("email, first_name, last_name")
      .not("email", "is", null);
    if (data) {
      contacts.push(
        ...data.map((l) => ({
          email: l.email || "",
          first_name: l.first_name || "",
          last_name: l.last_name || "",
          contact_type: "lead" as const,
        })),
      );
    }
  }

  if (sourcePool === "external" || sourcePool === "mixed") {
    const { data } = await supabase
      .from("marketing_external_contacts")
      .select("email, first_name, last_name");
    if (data) {
      contacts.push(
        ...data.map(
          (e: {
            email: string;
            first_name: string | null;
            last_name: string | null;
          }) => ({
            email: e.email,
            first_name: e.first_name || "",
            last_name: e.last_name || "",
            contact_type: "external" as const,
          }),
        ),
      );
    }
  }

  // Deduplicate by email
  const seen = new Set<string>();
  return contacts.filter((c) => {
    if (!c.email || seen.has(c.email.toLowerCase())) return false;
    seen.add(c.email.toLowerCase());
    return true;
  });
}

// External contacts CRUD
export async function getExternalContacts(): Promise<
  MarketingExternalContact[]
> {
  const { data, error } = await supabase
    .from("marketing_external_contacts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createExternalContact(contact: {
  email: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  tags?: string[];
  source?: string;
  created_by: string;
}): Promise<MarketingExternalContact> {
  const { data, error } = await supabase
    .from("marketing_external_contacts")
    .insert(contact)
    .select()
    .single();

  if (error) throw error;
  return data as MarketingExternalContact;
}

export async function deleteExternalContact(id: string): Promise<void> {
  const { error } = await supabase
    .from("marketing_external_contacts")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
