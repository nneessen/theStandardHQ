import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/services/base/supabase";
import { trainingDocumentService } from "@/features/training-hub/services/trainingDocumentService";
import type { Database } from "@/types/database.types";

type Tables = Database["public"]["Tables"];
type LessonPick = Pick<
  Tables["training_lessons"]["Row"],
  "id" | "title" | "sort_order"
>;
type ModulePick = Pick<
  Tables["training_modules"]["Row"],
  "id" | "title" | "category" | "is_active" | "updated_at"
>;
type DocumentPick = Pick<
  Tables["training_documents"]["Row"],
  "id" | "name" | "file_name" | "storage_path" | "file_size"
>;
// PostgREST returns nested relations as arrays even with !inner, so we
// model the wire shape exactly and unwrap to the first element below.
type ContentRow = Pick<
  Tables["training_lesson_content"]["Row"],
  "id" | "sort_order"
> & {
  lesson: Array<LessonPick & { module: ModulePick[] }>;
  document: DocumentPick[];
};

export interface UwGuideModuleRow {
  contentId: string;
  moduleId: string;
  moduleTitle: string;
  category: string | null;
  lessonId: string;
  lessonTitle: string | null;
  documentId: string;
  documentName: string;
  fileName: string;
  storagePath: string;
  fileSize: number | null;
  updatedAt: string | null;
}

export const uwGuideModuleKeys = {
  all: ["uw-guide-modules"] as const,
  list: () => [...uwGuideModuleKeys.all, "list"] as const,
  signedUrl: (storagePath: string) =>
    [...uwGuideModuleKeys.all, "signed-url", storagePath] as const,
};

/**
 * Lists every training module that contains a PDF content block.
 * The page treats each PDF as a "UW guide" — the user's actual library
 * lives in the training-modules system, not the AI Wizard's
 * `underwriting_guides` table.
 */
export function useUwGuideModules() {
  return useQuery({
    queryKey: uwGuideModuleKeys.list(),
    queryFn: async (): Promise<UwGuideModuleRow[]> => {
      const { data, error } = await supabase
        .from("training_lesson_content")
        .select(
          `
          id,
          sort_order,
          lesson:training_lessons!inner (
            id,
            title,
            sort_order,
            module:training_modules!inner (
              id,
              title,
              category,
              is_active,
              updated_at
            )
          ),
          document:training_documents!inner (
            id,
            name,
            file_name,
            storage_path,
            file_size
          )
        `,
        )
        .eq("content_type", "pdf");

      if (error) {
        throw new Error(`Failed to fetch UW guide modules: ${error.message}`);
      }

      const rows = (data ?? []) as ContentRow[];

      return rows
        .flatMap<UwGuideModuleRow>((r) => {
          const lesson = r.lesson?.[0];
          const moduleRow = lesson?.module?.[0];
          const doc = r.document?.[0];
          if (!lesson || !moduleRow || !doc) return [];
          if (moduleRow.is_active === false) return [];
          return [
            {
              contentId: r.id,
              moduleId: moduleRow.id,
              moduleTitle: moduleRow.title,
              category: moduleRow.category,
              lessonId: lesson.id,
              lessonTitle: lesson.title,
              documentId: doc.id,
              documentName: doc.name,
              fileName: doc.file_name,
              storagePath: doc.storage_path,
              fileSize: doc.file_size,
              updatedAt: moduleRow.updated_at,
            },
          ];
        })
        .sort((a, b) =>
          a.moduleTitle.localeCompare(b.moduleTitle, undefined, {
            sensitivity: "base",
          }),
        );
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Open a PDF in a new tab using a fresh signed URL.
 * Pop-up is opened synchronously (inside the user-gesture frame) so the
 * browser doesn't block it, then redirected once the signed URL resolves.
 * If the browser blocks the pop-up (returns null), surface a clear error
 * rather than navigating the current tab away.
 */
export async function openUwGuidePdf(storagePath: string): Promise<void> {
  const popup = window.open("", "_blank");
  if (!popup) {
    throw new Error(
      "Pop-up blocked. Allow pop-ups for this site, or right-click the row and choose Open in new tab.",
    );
  }
  try {
    const url = await trainingDocumentService.getSignedUrl(storagePath);
    if (!url) {
      popup.close();
      throw new Error("Could not create signed URL for this PDF.");
    }
    popup.location.href = url;
  } catch (err) {
    popup.close();
    throw err;
  }
}
