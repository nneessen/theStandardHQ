// src/features/agent-roadmap/components/admin/RoadmapEditorPage.tsx
//
// The main admin editor. 3-pane layout:
//   - Top: RoadmapEditorHeader (title, publish, back)
//   - Left: SectionSidebar (sortable sections)
//   - Center: ItemListPanel (items in selected section, sortable)
//   - Right (overlay): ItemEditorDrawer (opens when clicking an item)

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoadmapTree } from "../../index";
import { RoadmapEditorHeader } from "./RoadmapEditorHeader";
import { SectionSidebar } from "./SectionSidebar";
import { ItemListPanel } from "./ItemListPanel";
import { ItemEditorDrawer } from "./ItemEditorDrawer";

interface RoadmapEditorPageProps {
  roadmapId: string;
}

export function RoadmapEditorPage({ roadmapId }: RoadmapEditorPageProps) {
  const { data: roadmap, isLoading, error } = useRoadmapTree(roadmapId);

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    null,
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Auto-select first section when the tree loads or after a delete
  useEffect(() => {
    if (!roadmap) return;
    if (
      roadmap.sections.length > 0 &&
      (!selectedSectionId ||
        !roadmap.sections.some((s) => s.id === selectedSectionId))
    ) {
      setSelectedSectionId(roadmap.sections[0].id);
    } else if (roadmap.sections.length === 0) {
      setSelectedSectionId(null);
    }
  }, [roadmap, selectedSectionId]);

  const selectedSection = useMemo(() => {
    if (!roadmap || !selectedSectionId) return null;
    return roadmap.sections.find((s) => s.id === selectedSectionId) ?? null;
  }, [roadmap, selectedSectionId]);

  const selectedItem = useMemo(() => {
    if (!roadmap || !selectedItemId) return null;
    for (const section of roadmap.sections) {
      const found = section.items.find((i) => i.id === selectedItemId);
      if (found) return found;
    }
    return null;
  }, [roadmap, selectedItemId]);

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col">
        <div className="border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
          <Skeleton className="h-6 w-60" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      </div>
    );
  }

  if (error || !roadmap) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {error ? error.message : "Roadmap not found"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-zinc-950">
      <RoadmapEditorHeader roadmap={roadmap} />
      <div className="flex-1 flex min-h-0">
        <SectionSidebar
          roadmap={roadmap}
          selectedSectionId={selectedSectionId}
          onSelectSection={(id) => {
            setSelectedSectionId(id);
            setSelectedItemId(null);
          }}
        />
        <ItemListPanel
          roadmapId={roadmap.id}
          section={selectedSection}
          selectedItemId={selectedItemId}
          onSelectItem={(id) => setSelectedItemId(id || null)}
        />
      </div>

      <ItemEditorDrawer
        item={selectedItem}
        roadmapId={roadmap.id}
        agencyId={roadmap.agency_id}
        open={!!selectedItem}
        onOpenChange={(open) => {
          if (!open) setSelectedItemId(null);
        }}
      />
    </div>
  );
}
