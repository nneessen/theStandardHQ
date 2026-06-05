import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";

/** A durable Jarvis memory row (Phase A: facts/preferences injected each session). */
export interface JarvisMemory {
  id: string;
  content: string;
  kind: string;
  pinned: boolean;
  created_at: string | null;
}

export const jarvisMemoryKeys = {
  all: ["jarvis-memory"] as const,
};

/** The current user's active memories (RLS-scoped), pinned first then most-recent. */
export function useJarvisMemory() {
  return useQuery({
    queryKey: jarvisMemoryKeys.all,
    queryFn: async (): Promise<JarvisMemory[]> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("jarvis_memory")
        .select("id, content, kind, pinned, created_at")
        .eq("user_id", user.id)
        .eq("active", true)
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60 * 1000,
  });
}

/** Permanently delete one of the user's memories (RLS allows only their own rows). */
export function useDeleteJarvisMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      // RLS already scopes deletes to the owner; the explicit user_id filter is
      // defense-in-depth (every read in this hook is user-scoped too).
      const { error } = await supabase
        .from("jarvis_memory")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: jarvisMemoryKeys.all }),
  });
}
