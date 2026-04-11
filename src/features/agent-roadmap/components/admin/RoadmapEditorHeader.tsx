// src/features/agent-roadmap/components/admin/RoadmapEditorHeader.tsx
//
// Top bar of the roadmap editor. Shows:
//   - Back button to the list
//   - Debounced title input
//   - Publish toggle
//   - Set-default toggle
//   - Icon/description field (optional, collapsed in a dropdown)

import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Star, Eye, EyeOff, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useDebouncedField } from "@/features/training-modules";
import { useUpdateRoadmap, useSetDefaultRoadmap } from "../../index";
import type { RoadmapTree } from "../../types/roadmap";

interface RoadmapEditorHeaderProps {
  roadmap: RoadmapTree;
}

export function RoadmapEditorHeader({ roadmap }: RoadmapEditorHeaderProps) {
  const navigate = useNavigate();
  const updateMutation = useUpdateRoadmap();
  const setDefaultMutation = useSetDefaultRoadmap();

  const commitTitle = useCallback(
    (title: string) => {
      if (title.trim() && title !== roadmap.title) {
        updateMutation.mutate({
          roadmapId: roadmap.id,
          patch: { title: title.trim() },
        });
      }
    },
    [roadmap.id, roadmap.title, updateMutation],
  );

  const [titleLocal, setTitleLocal] = useDebouncedField(
    roadmap.title,
    commitTitle,
  );

  function handleTogglePublish(checked: boolean) {
    updateMutation.mutate({
      roadmapId: roadmap.id,
      patch: { is_published: checked },
    });
  }

  function handleSetDefault() {
    setDefaultMutation.mutate({
      roadmapId: roadmap.id,
      agencyId: roadmap.agency_id,
    });
  }

  return (
    <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <div className="flex items-center gap-3 px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => navigate({ to: "/admin/agent-roadmap" })}
          aria-label="Back to roadmap list"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1 min-w-0">
          <Input
            value={titleLocal}
            onChange={(e) => setTitleLocal(e.target.value)}
            placeholder="Roadmap title"
            className="h-8 text-base font-semibold border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 focus:border-zinc-300 dark:focus:border-zinc-700 px-2 -mx-2 bg-transparent"
          />
        </div>

        {roadmap.is_default && (
          <Badge variant="warning" size="sm" className="gap-1">
            <Star className="h-3 w-3 fill-current" />
            Default
          </Badge>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() =>
            navigate({
              to: "/admin/agent-roadmap/$roadmapId/team",
              params: { roadmapId: roadmap.id },
            })
          }
        >
          <Users className="h-3.5 w-3.5" />
          Team progress
        </Button>

        {!roadmap.is_default && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleSetDefault}
            disabled={setDefaultMutation.isPending}
          >
            <Star className="h-3.5 w-3.5" />
            Set as default
          </Button>
        )}

        <div className="flex items-center gap-2 pl-2 border-l border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
            {roadmap.is_published ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
            {roadmap.is_published ? "Published" : "Draft"}
          </div>
          <Switch
            checked={roadmap.is_published}
            onCheckedChange={handleTogglePublish}
            disabled={updateMutation.isPending}
            aria-label="Toggle published"
          />
        </div>
      </div>
    </div>
  );
}
