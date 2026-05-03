// src/features/training-modules/components/presentations/PresentationComplianceTable.tsx
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useWeeklyCompliance } from "../../hooks/usePresentationSubmissions";
import { PresentationStatusBadge } from "./PresentationStatusBadge";
import type { PresentationStatus } from "../../types/training-module.types";

interface PresentationComplianceTableProps {
  agencyId: string;
  weekStart: string;
}

export function PresentationComplianceTable({
  agencyId,
  weekStart,
}: PresentationComplianceTableProps) {
  const {
    data: compliance = [],
    isLoading,
    error,
  } = useWeeklyCompliance(agencyId, weekStart);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-destructive">
          Failed to load compliance data
        </p>
      </div>
    );
  }

  const submitted = compliance.filter((c) => c.submitted).length;
  const total = compliance.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold text-v2-ink dark:text-v2-ink-muted uppercase">
          Weekly Compliance
        </h3>
        <span className="text-[11px] text-v2-ink-muted">
          {submitted}/{total} submitted
        </span>
      </div>
      <div className="border border-v2-ring dark:border-v2-ring-strong rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-v2-canvas dark:bg-v2-card-tinted/50 border-b border-v2-ring dark:border-v2-ring-strong">
              <th className="text-left px-3 py-1.5 font-medium text-v2-ink-muted">
                Agent
              </th>
              <th className="text-left px-3 py-1.5 font-medium text-v2-ink-muted">
                Email
              </th>
              <th className="text-center px-3 py-1.5 font-medium text-v2-ink-muted">
                Submitted
              </th>
              <th className="text-left px-3 py-1.5 font-medium text-v2-ink-muted">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {compliance.map((row) => (
              <tr
                key={row.userId}
                className={`border-b border-v2-ring dark:border-v2-ring ${
                  row.submissionId
                    ? "hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/30 cursor-pointer"
                    : ""
                }`}
                onClick={() => {
                  if (row.submissionId) {
                    navigate({
                      to: "/my-training/presentations/$submissionId",
                      params: { submissionId: row.submissionId },
                    });
                  }
                }}
              >
                <td className="px-3 py-2 font-medium text-v2-ink dark:text-v2-ink">
                  {row.firstName} {row.lastName}
                </td>
                <td className="px-3 py-2 text-v2-ink-muted">{row.email}</td>
                <td className="px-3 py-2 text-center">
                  {row.submitted ? (
                    <CheckCircle className="h-3.5 w-3.5 text-success mx-auto" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-v2-ink-subtle dark:text-v2-ink-muted mx-auto" />
                  )}
                </td>
                <td className="px-3 py-2">
                  {row.status ? (
                    <PresentationStatusBadge
                      status={row.status as PresentationStatus}
                    />
                  ) : (
                    <span className="text-[10px] text-v2-ink-subtle">—</span>
                  )}
                </td>
              </tr>
            ))}
            {compliance.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-4 text-center text-v2-ink-subtle"
                >
                  No agents found in this agency
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
