// src/features/messages/services/contactService.ts
// Comprehensive service for contacts - supports pagination, filtering, favorites, team

import { supabase } from "@/services/base/supabase";

export type ContactType = "team" | "client";

export interface Contact {
  id: string;
  name: string;
  email: string;
  type: ContactType;
  role?: string;
  isFavorite?: boolean;
  hierarchyDepth?: number;
}

export interface ContactFilters {
  search?: string;
  type?: ContactType | "all";
  role?: string;
  teamOnly?: boolean; // Only show user's downlines
  favoritesOnly?: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================================
// HELPER: Get user's hierarchy context for team filtering
// ============================================================================

/**
 * Get the user's hierarchy_path and agency_id for team filtering.
 * Used to show only the user's actual downlines within their agency.
 */
async function getUserHierarchyContext(userId: string): Promise<{
  hierarchyPath: string | null;
  agencyId: string | null;
}> {
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("hierarchy_path, agency_id")
    .eq("id", userId)
    .single();

  return {
    hierarchyPath: profile?.hierarchy_path || null,
    agencyId: profile?.agency_id || null,
  };
}

// ============================================================================
// PAGINATED CONTACTS - Main function for contact browser
// ============================================================================

export async function getPaginatedContacts(
  userId: string,
  filters: ContactFilters = {},
  page = 1,
  pageSize = 50,
): Promise<PaginatedResult<Contact>> {
  const { search, type = "all", role, teamOnly, favoritesOnly } = filters;
  const offset = (page - 1) * pageSize;
  const results: Contact[] = [];

  try {
    // Get user's favorites for marking
    const { data: favorites } = await supabase
      .from("contact_favorites")
      .select("contact_user_id, client_id")
      .eq("user_id", userId);

    const favoriteUserIds = new Set(
      (favorites || [])
        .filter((f) => f.contact_user_id)
        .map((f) => f.contact_user_id),
    );
    const favoriteClientIds = new Set(
      (favorites || []).filter((f) => f.client_id).map((f) => f.client_id),
    );

    // If favorites only, we need to query differently
    if (favoritesOnly) {
      return getFavoriteContacts(userId, search, page, pageSize);
    }

    // Query team members
    if (type === "all" || type === "team") {
      let teamQuery = supabase
        .from("user_profiles")
        .select("id, first_name, last_name, email, roles, hierarchy_depth", {
          count: "exact",
        })
        .not("email", "is", null)
        .eq("approval_status", "approved")
        .neq("id", userId); // Exclude current user from results

      // Apply search filter
      if (search && search.length >= 2) {
        const searchPattern = `%${search.toLowerCase()}%`;
        teamQuery = teamQuery.or(
          `first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},email.ilike.${searchPattern}`,
        );
      }

      // Apply role filter
      if (role) {
        teamQuery = teamQuery.contains("roles", [role]);
      }

      // Apply team filter - show only user's actual downlines within their agency
      if (teamOnly) {
        const { hierarchyPath, agencyId } =
          await getUserHierarchyContext(userId);

        // Filter by agency for data isolation
        if (agencyId) {
          teamQuery = teamQuery.eq("agency_id", agencyId);
        }

        // Only show user's downlines (hierarchy_path starts with user's path + ".")
        if (hierarchyPath) {
          teamQuery = teamQuery.like("hierarchy_path", `${hierarchyPath}.%`);
        }
      }

      // Apply pagination for team-only queries
      if (type === "team") {
        teamQuery = teamQuery.range(offset, offset + pageSize - 1);
      }

      teamQuery = teamQuery.order("first_name");

      const { data: team, count: teamCount } = await teamQuery;

      if (team) {
        results.push(
          ...team.map((t) => ({
            id: t.id,
            name:
              `${t.first_name || ""} ${t.last_name || ""}`.trim() || t.email,
            email: t.email,
            type: "team" as ContactType,
            role: Array.isArray(t.roles) ? t.roles[0] : undefined,
            isFavorite: favoriteUserIds.has(t.id),
            hierarchyDepth: t.hierarchy_depth || undefined,
          })),
        );
      }

      // If team only, return now
      if (type === "team") {
        return {
          data: results,
          total: teamCount || 0,
          page,
          pageSize,
          hasMore: (teamCount || 0) > offset + pageSize,
        };
      }
    }

    // Query clients
    if ((type === "all" || type === "client") && !teamOnly) {
      let clientQuery = supabase
        .from("clients")
        .select("id, name, email, status", { count: "exact" })
        .not("email", "is", null)
        .eq("status", "active");

      // Apply search filter
      if (search && search.length >= 2) {
        const searchPattern = `%${search.toLowerCase()}%`;
        clientQuery = clientQuery.or(
          `name.ilike.${searchPattern},email.ilike.${searchPattern}`,
        );
      }

      // Apply pagination for client-only queries
      if (type === "client") {
        clientQuery = clientQuery.range(offset, offset + pageSize - 1);
      }

      clientQuery = clientQuery.order("name");

      const { data: clients, count: clientCount } = await clientQuery;

      if (clients) {
        results.push(
          ...clients
            .filter((c) => c.email)
            .map((c) => ({
              id: c.id,
              name: c.name,
              email: c.email!,
              type: "client" as ContactType,
              isFavorite: favoriteClientIds.has(c.id),
            })),
        );
      }

      // If client only, return now
      if (type === "client") {
        return {
          data: results,
          total: clientCount || 0,
          page,
          pageSize,
          hasMore: (clientCount || 0) > offset + pageSize,
        };
      }
    }

    // For "all" type, sort by favorites first, then alphabetically
    results.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return a.name.localeCompare(b.name);
    });

    // Apply pagination to combined results
    const paginatedResults = results.slice(offset, offset + pageSize);

    return {
      data: paginatedResults,
      total: results.length,
      page,
      pageSize,
      hasMore: results.length > offset + pageSize,
    };
  } catch (error) {
    console.error("Error in getPaginatedContacts:", error);
    return { data: [], total: 0, page, pageSize, hasMore: false };
  }
}

// ============================================================================
// FAVORITE CONTACTS
// ============================================================================

export async function getFavoriteContacts(
  userId: string,
  search?: string,
  page = 1,
  pageSize = 50,
): Promise<PaginatedResult<Contact>> {
  const offset = (page - 1) * pageSize;

  try {
    // Get all favorites with joined data
    const { data: favorites, count } = await supabase
      .from("contact_favorites")
      .select(
        `
        id,
        contact_user_id,
        client_id,
        team_contact:user_profiles!contact_favorites_contact_user_id_fkey(id, first_name, last_name, email, roles),
        client_contact:clients!contact_favorites_client_id_fkey(id, name, email)
      `,
        { count: "exact" },
      )
      .eq("user_id", userId)
      .range(offset, offset + pageSize - 1);

    const results: Contact[] = [];

    for (const fav of favorites || []) {
      // Handle team contact (may be object or null depending on join)
      const teamContact = fav.team_contact as unknown as {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string;
        roles: string[] | null;
      } | null;

      // Handle client contact (may be object or null depending on join)
      const clientContact = fav.client_contact as unknown as {
        id: string;
        name: string;
        email: string | null;
      } | null;

      if (teamContact && teamContact.id) {
        const name =
          `${teamContact.first_name || ""} ${teamContact.last_name || ""}`.trim() ||
          teamContact.email;

        // Apply search filter
        if (search && search.length >= 2) {
          const searchLower = search.toLowerCase();
          if (
            !name.toLowerCase().includes(searchLower) &&
            !teamContact.email.toLowerCase().includes(searchLower)
          ) {
            continue;
          }
        }

        results.push({
          id: teamContact.id,
          name,
          email: teamContact.email,
          type: "team",
          role: Array.isArray(teamContact.roles)
            ? teamContact.roles[0]
            : undefined,
          isFavorite: true,
        });
      } else if (clientContact && clientContact.id) {
        if (!clientContact.email) continue;

        // Apply search filter
        if (search && search.length >= 2) {
          const searchLower = search.toLowerCase();
          if (
            !clientContact.name.toLowerCase().includes(searchLower) &&
            !clientContact.email.toLowerCase().includes(searchLower)
          ) {
            continue;
          }
        }

        results.push({
          id: clientContact.id,
          name: clientContact.name,
          email: clientContact.email,
          type: "client",
          isFavorite: true,
        });
      }
    }

    return {
      data: results,
      total: count || 0,
      page,
      pageSize,
      hasMore: (count || 0) > offset + pageSize,
    };
  } catch (error) {
    console.error("Error in getFavoriteContacts:", error);
    return { data: [], total: 0, page, pageSize, hasMore: false };
  }
}

export async function addFavoriteContact(
  userId: string,
  contactId: string,
  type: ContactType,
): Promise<boolean> {
  try {
    const { error } =
      type === "team"
        ? await supabase
            .from("contact_favorites")
            .insert({
              user_id: userId,
              contact_user_id: contactId,
              client_id: null,
            })
        : await supabase
            .from("contact_favorites")
            .insert({
              user_id: userId,
              client_id: contactId,
              contact_user_id: null,
            });

    if (error) {
      // Ignore duplicate errors
      if (error.code === "23505") return true;
      console.error("Error adding favorite:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error in addFavoriteContact:", error);
    return false;
  }
}

export async function removeFavoriteContact(
  userId: string,
  contactId: string,
  type: ContactType,
): Promise<boolean> {
  try {
    const query =
      type === "team"
        ? supabase
            .from("contact_favorites")
            .delete()
            .eq("user_id", userId)
            .eq("contact_user_id", contactId)
        : supabase
            .from("contact_favorites")
            .delete()
            .eq("user_id", userId)
            .eq("client_id", contactId);

    const { error } = await query;

    if (error) {
      console.error("Error removing favorite:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error in removeFavoriteContact:", error);
    return false;
  }
}

// ============================================================================
// TEAM CONTACTS (Downlines)
// ============================================================================

export async function getTeamContacts(
  userId: string,
  search?: string,
  page = 1,
  pageSize = 50,
): Promise<PaginatedResult<Contact>> {
  return getPaginatedContacts(
    userId,
    { search, type: "team", teamOnly: true },
    page,
    pageSize,
  );
}

/**
 * Get ALL team contacts (downlines) without pagination.
 * Used for "Add Entire Team" bulk add feature.
 */
export async function getAllTeamContacts(userId: string): Promise<Contact[]> {
  try {
    const { hierarchyPath, agencyId } = await getUserHierarchyContext(userId);

    if (!hierarchyPath) return [];

    let query = supabase
      .from("user_profiles")
      .select("id, first_name, last_name, email, roles, hierarchy_depth")
      .not("email", "is", null)
      .eq("approval_status", "approved")
      .neq("id", userId)
      .like("hierarchy_path", `${hierarchyPath}.%`)
      .order("first_name");

    // Filter by agency for data isolation
    if (agencyId) {
      query = query.eq("agency_id", agencyId);
    }

    const { data: team } = await query;

    if (!team) return [];

    return team.map((t) => ({
      id: t.id,
      name: `${t.first_name || ""} ${t.last_name || ""}`.trim() || t.email,
      email: t.email,
      type: "team" as ContactType,
      role: Array.isArray(t.roles) ? t.roles[0] : undefined,
      hierarchyDepth: t.hierarchy_depth || undefined,
    }));
  } catch (error) {
    console.error("Error in getAllTeamContacts:", error);
    return [];
  }
}

// ============================================================================
// ALL USERS (Super-Admin Only)
// ============================================================================

/**
 * Get all users in the system (super-admin only, bypasses RLS).
 * Uses admin_get_allusers RPC which is SECURITY DEFINER.
 */
export async function getAllUsersContacts(): Promise<Contact[]> {
  try {
    const { data, error } = await supabase.rpc("admin_get_allusers");

    if (error) {
      console.error("Error fetching all users:", error);
      return [];
    }

    if (!data) return [];

    // Filter to only approved users with valid emails
    const approvedUsers = (
      data as Array<{
        id: string;
        email: string;
        first_name: string | null;
        last_name: string | null;
        roles: string[] | null;
        approval_status: string;
      }>
    ).filter((u) => u.approval_status === "approved" && u.email);

    return approvedUsers.map((u) => ({
      id: u.id,
      name: `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email,
      email: u.email,
      type: "team" as ContactType,
      role: Array.isArray(u.roles) ? u.roles[0] : undefined,
    }));
  } catch (error) {
    console.error("Error in getAllUsersContacts:", error);
    return [];
  }
}

/**
 * Get paginated all users (super-admin only).
 * Client-side pagination since RPC returns all users.
 */
export async function getPaginatedAllUsers(
  page: number,
  pageSize: number,
  search?: string,
): Promise<PaginatedResult<Contact>> {
  try {
    const allContacts = await getAllUsersContacts();

    // Apply search filter if provided
    let filtered = allContacts;
    if (search && search.length >= 2) {
      const searchLower = search.toLowerCase();
      filtered = allContacts.filter(
        (c) =>
          c.name.toLowerCase().includes(searchLower) ||
          c.email.toLowerCase().includes(searchLower),
      );
    }

    // Apply pagination
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const data = filtered.slice(start, end);

    return {
      data,
      total,
      page,
      pageSize,
      hasMore: end < total,
    };
  } catch (error) {
    console.error("Error in getPaginatedAllUsers:", error);
    return { data: [], total: 0, page, pageSize, hasMore: false };
  }
}

// ============================================================================
// ROLE QUERIES
// ============================================================================

export interface RoleOption {
  name: string;
  displayName: string;
}

export async function getAvailableRoles(): Promise<RoleOption[]> {
  try {
    // Get roles from the roles table
    const { data } = await supabase
      .from("roles")
      .select("name, display_name")
      .order("display_name");

    if (!data) return [];

    return data.map((r) => ({
      name: r.name,
      displayName: r.display_name,
    }));
  } catch (error) {
    console.error("Error in getAvailableRoles:", error);
    return [];
  }
}

export async function getContactsByRole(
  role: string,
  page = 1,
  pageSize = 50,
): Promise<PaginatedResult<Contact>> {
  const offset = (page - 1) * pageSize;

  try {
    const { data: team, count } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name, email, roles", { count: "exact" })
      .not("email", "is", null)
      .eq("approval_status", "approved")
      .contains("roles", [role])
      .order("first_name")
      .range(offset, offset + pageSize - 1);

    const results: Contact[] = (team || []).map((t) => ({
      id: t.id,
      name: `${t.first_name || ""} ${t.last_name || ""}`.trim() || t.email,
      email: t.email,
      type: "team" as ContactType,
      role: Array.isArray(t.roles) ? t.roles[0] : undefined,
    }));

    return {
      data: results,
      total: count || 0,
      page,
      pageSize,
      hasMore: (count || 0) > offset + pageSize,
    };
  } catch (error) {
    console.error("Error in getContactsByRole:", error);
    return { data: [], total: 0, page, pageSize, hasMore: false };
  }
}

// ============================================================================
// SEARCH (for autocomplete)
// ============================================================================

export async function searchContacts(
  query: string,
  options?: ContactSearchOptions,
): Promise<Contact[]> {
  const limit = options?.limit ?? 10;
  if (query.length < 2) return [];

  const searchPattern = `%${query.toLowerCase()}%`;
  const results: Contact[] = [];

  try {
    // Search team
    const { data: team } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name, email, roles")
      .not("email", "is", null)
      .eq("approval_status", "approved")
      .or(
        `first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},email.ilike.${searchPattern}`,
      )
      .limit(limit);

    if (team) {
      results.push(
        ...team.map((t) => ({
          id: t.id,
          name: `${t.first_name || ""} ${t.last_name || ""}`.trim() || t.email,
          email: t.email,
          type: "team" as ContactType,
          role: Array.isArray(t.roles) ? t.roles[0] : undefined,
        })),
      );
    }

    // Search clients
    const { data: clients } = await supabase
      .from("clients")
      .select("id, name, email")
      .not("email", "is", null)
      .eq("status", "active")
      .or(`name.ilike.${searchPattern},email.ilike.${searchPattern}`)
      .limit(limit);

    if (clients) {
      results.push(
        ...clients
          .filter((c) => c.email)
          .map((c) => ({
            id: c.id,
            name: c.name,
            email: c.email!,
            type: "client" as ContactType,
          })),
      );
    }

    // Sort by relevance
    const lowerQuery = query.toLowerCase();
    results.sort((a, b) => {
      const aMatch = a.email.toLowerCase().startsWith(lowerQuery) ? 0 : 1;
      const bMatch = b.email.toLowerCase().startsWith(lowerQuery) ? 0 : 1;
      return aMatch - bMatch;
    });

    return results.slice(0, limit);
  } catch (error) {
    console.error("Error in searchContacts:", error);
    return [];
  }
}

// ============================================================================
// CHECK IF USER HAS DOWNLINES
// ============================================================================

export async function userHasDownlines(userId: string): Promise<boolean> {
  try {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("hierarchy_path")
      .eq("id", userId)
      .single();

    if (!profile?.hierarchy_path) return false;

    const { count } = await supabase
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .like("hierarchy_path", `${profile.hierarchy_path}.%`);

    return (count || 0) > 0;
  } catch (error) {
    console.error("Error in userHasDownlines:", error);
    return false;
  }
}

// ============================================================================
// LEGACY EXPORTS - For backward compatibility with useContacts.ts
// ============================================================================

export interface ContactSearchOptions {
  types?: ContactType[];
  limit?: number;
}

/**
 * Legacy function: Get contacts by type (team or client)
 */
export async function getContactsByType(type: ContactType): Promise<Contact[]> {
  try {
    if (type === "team") {
      const { data: team } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name, email, roles")
        .not("email", "is", null)
        .eq("approval_status", "approved")
        .order("first_name")
        .limit(100);

      return (team || []).map((t) => ({
        id: t.id,
        name: `${t.first_name || ""} ${t.last_name || ""}`.trim() || t.email,
        email: t.email,
        type: "team" as ContactType,
        role: Array.isArray(t.roles) ? t.roles[0] : undefined,
      }));
    } else {
      const { data: clients } = await supabase
        .from("clients")
        .select("id, name, email")
        .not("email", "is", null)
        .eq("status", "active")
        .order("name")
        .limit(100);

      return (clients || [])
        .filter((c) => c.email)
        .map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email!,
          type: "client" as ContactType,
        }));
    }
  } catch (error) {
    console.error("Error in getContactsByType:", error);
    return [];
  }
}

/**
 * Legacy function: Get recent contacts for a user
 */
export async function getRecentContacts(
  userId: string,
  limit = 10,
): Promise<Contact[]> {
  try {
    // Get recent emails sent by this user
    const { data: recentEmails } = await supabase
      .from("email_messages")
      .select("recipients")
      .eq("sender_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!recentEmails || recentEmails.length === 0) {
      return [];
    }

    // Extract unique email addresses
    const emailSet = new Set<string>();
    for (const email of recentEmails) {
      if (email.recipients && Array.isArray(email.recipients)) {
        for (const recipient of email.recipients) {
          if (typeof recipient === "string") {
            emailSet.add(recipient.toLowerCase());
          } else if (recipient && typeof recipient.email === "string") {
            emailSet.add(recipient.email.toLowerCase());
          }
        }
      }
    }

    const recentEmailList = Array.from(emailSet).slice(0, limit);
    if (recentEmailList.length === 0) return [];

    // Look up these contacts
    const results: Contact[] = [];

    // Check team members
    const { data: teamMatches } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name, email, roles")
      .in("email", recentEmailList);

    if (teamMatches) {
      results.push(
        ...teamMatches.map((t) => ({
          id: t.id,
          name: `${t.first_name || ""} ${t.last_name || ""}`.trim() || t.email,
          email: t.email,
          type: "team" as ContactType,
          role: Array.isArray(t.roles) ? t.roles[0] : undefined,
        })),
      );
    }

    // Check clients
    const { data: clientMatches } = await supabase
      .from("clients")
      .select("id, name, email")
      .in("email", recentEmailList);

    if (clientMatches) {
      results.push(
        ...clientMatches
          .filter((c) => c.email)
          .map((c) => ({
            id: c.id,
            name: c.name,
            email: c.email!,
            type: "client" as ContactType,
          })),
      );
    }

    return results.slice(0, limit);
  } catch (error) {
    console.error("Error in getRecentContacts:", error);
    return [];
  }
}
