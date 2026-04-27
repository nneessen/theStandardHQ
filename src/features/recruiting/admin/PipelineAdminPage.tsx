// src/features/recruiting/admin/PipelineAdminPage.tsx

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings2, ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { PipelineTemplatesList } from "./PipelineTemplatesList";
import { PipelineTemplateEditor } from "./PipelineTemplateEditor";
import { useIsAdmin, useUserRoles } from "@/hooks/permissions";
import { useAuth } from "@/contexts/AuthContext";
import { STAFF_ONLY_ROLES } from "@/constants/roles";

export function PipelineAdminPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );

  // Permission check - admins and staff roles can access pipeline administration
  const { data: isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  const { data: userRoles, isLoading: rolesLoading } = useUserRoles();

  // Check if user is a staff role (trainer/contracting_manager)
  const isStaffRole =
    userRoles?.some((role) =>
      STAFF_ONLY_ROLES.includes(role as (typeof STAFF_ONLY_ROLES)[number]),
    ) ?? false;

  // Loading state
  if (isAdminLoading || rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-v2-ink-subtle mx-auto mb-3" />
          <p className="text-[11px] text-v2-ink-muted">
            Checking permissions...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between bg-v2-card rounded-lg px-3 py-2 border border-v2-ring">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => navigate({ to: "/recruiting" })}
          >
            <ArrowLeft className="h-3 w-3 mr-1.5" />
            Back to Recruiting
          </Button>
          <div className="h-4 w-px bg-v2-ring" />
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-v2-ink-muted" />
            <h1 className="text-sm font-semibold text-v2-ink">
              Pipeline Administration
            </h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {selectedTemplateId ? (
          <PipelineTemplateEditor
            templateId={selectedTemplateId}
            onClose={() => setSelectedTemplateId(null)}
            isAdmin={isAdmin ?? false}
            currentUserId={user?.id}
            isStaffRole={isStaffRole}
          />
        ) : (
          <PipelineTemplatesList
            onSelectTemplate={(id) => setSelectedTemplateId(id)}
            isAdmin={isAdmin ?? false}
            currentUserId={user?.id}
            isStaffRole={isStaffRole}
          />
        )}
      </div>
    </div>
  );
}
