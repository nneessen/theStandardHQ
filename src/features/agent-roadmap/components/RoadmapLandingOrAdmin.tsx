// src/features/agent-roadmap/components/RoadmapLandingOrAdmin.tsx
//
// Switcher: super-admin sees the admin list (manage roadmaps) by default,
// with a "Preview as agent" button. Regular agents always see the landing
// page. Triggered by the route at /agent-roadmap — one sidebar entry,
// two views based on role.

import { useNavigate } from "@tanstack/react-router";
import { Eye, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useImo } from "@/contexts/ImoContext";
import { RoadmapListPage } from "./admin/RoadmapListPage";
import { RoadmapLandingPage } from "./user/RoadmapLandingPage";

interface RoadmapLandingOrAdminProps {
  preview: boolean;
}

export function RoadmapLandingOrAdmin({ preview }: RoadmapLandingOrAdminProps) {
  const navigate = useNavigate();
  const { isSuperAdmin } = useImo();

  // Non-super-admin: always show the agent landing page
  if (!isSuperAdmin) {
    return <RoadmapLandingPage />;
  }

  // Super-admin in preview mode: show agent landing with a "Back to admin" bar
  if (preview) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        <div className="flex items-center justify-between bg-info/10 border-b border-info/20 px-4 py-2">
          <div className="flex items-center gap-2 text-xs font-medium text-info">
            <Eye className="h-3.5 w-3.5" />
            Previewing as agent — this is what your team sees
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => navigate({ to: "/agent-roadmap" })}
          >
            <Settings className="h-3 w-3" />
            Back to admin
          </Button>
        </div>
        <div className="flex-1 overflow-auto">
          <RoadmapLandingPage />
        </div>
      </div>
    );
  }

  // Super-admin default: show the admin list (manage roadmaps)
  return <RoadmapListPage />;
}
