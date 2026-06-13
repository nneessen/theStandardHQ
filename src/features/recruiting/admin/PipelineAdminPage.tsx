// src/features/recruiting/admin/PipelineAdminPage.tsx

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { SectionShell } from "@/components/v2";
import { Cap, T } from "@/components/board";
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
    <SectionShell className="dashboard-canvas">
      <div className="mx-auto w-full max-w-[2400px] px-4 py-5 lg:py-6">
        <div className="flex flex-col gap-4">
          {/* Departure-board header — back link + eyebrow + title */}
          <header
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px] mt-1"
              onClick={() => navigate({ to: "/recruiting" })}
            >
              <ArrowLeft className="h-3 w-3 mr-1.5" />
              Back to Recruiting
            </Button>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Cap>RECRUITING ADMIN</Cap>
              <h1
                style={{
                  font: `800 26px ${T.disp}`,
                  color: T.ink,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  margin: 0,
                }}
              >
                Pipeline Administration
              </h1>
            </div>
          </header>

          {/* Content */}
          <div className="flex-1 min-h-0">
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
      </div>
    </SectionShell>
  );
}
