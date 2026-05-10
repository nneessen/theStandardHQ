import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/services/base/supabase";
import { trainingDocumentService } from "@/features/training-hub/services/trainingDocumentService";

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

      type Row = {
        id: string;
        sort_order: number | null;
        lesson: {
          id: string;
          title: string | null;
          sort_order: number | null;
          module: {
            id: string;
            title: string;
            category: string | null;
            is_active: boolean | null;
            updated_at: string | null;
          };
        };
        document: {
          id: string;
          name: string;
          file_name: string;
          storage_path: string;
          file_size: number | null;
        };
      };

      const rows = (data || []) as unknown as Row[];

      return rows
        .filter((r) => r.lesson?.module?.is_active !== false && r.document)
        .map((r) => ({
          contentId: r.id,
          moduleId: r.lesson.module.id,
          moduleTitle: r.lesson.module.title,
          category: r.lesson.module.category,
          lessonId: r.lesson.id,
          lessonTitle: r.lesson.title,
          documentId: r.document.id,
          documentName: r.document.name,
          fileName: r.document.file_name,
          storagePath: r.document.storage_path,
          fileSize: r.document.file_size,
          updatedAt: r.lesson.module.updated_at,
        }))
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
 * Pop-up is opened synchronously to avoid being blocked, then redirected
 * once the signed URL resolves.
 */
export async function openUwGuidePdf(storagePath: string): Promise<void> {
  const popup = window.open("", "_blank");
  try {
    const url = await trainingDocumentService.getSignedUrl(storagePath);
    if (!url) {
      popup?.close();
      throw new Error("Could not create signed URL");
    }
    if (popup) {
      popup.location.href = url;
    } else {
      window.location.href = url;
    }
  } catch (err) {
    popup?.close();
    throw err;
  }
}
