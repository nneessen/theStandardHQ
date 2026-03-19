import type { CreateRecruitInput } from "@/types/recruiting.types";

type RecruitCreateAssignmentParams = {
  canManageUsers: boolean;
  currentUserId?: string;
  selectedUplineId?: string | null;
  imoId?: string | null;
  agencyId?: string | null;
};

type RecruitCreateAssignmentFields = Pick<
  CreateRecruitInput,
  "recruiter_id" | "upline_id" | "imo_id" | "agency_id"
>;

export function buildRecruitCreateAssignmentFields({
  canManageUsers,
  currentUserId,
  selectedUplineId,
  imoId,
  agencyId,
}: RecruitCreateAssignmentParams): RecruitCreateAssignmentFields {
  const normalizedUplineId = selectedUplineId?.trim() || undefined;

  if (canManageUsers) {
    return {
      recruiter_id: currentUserId,
      upline_id: normalizedUplineId,
      imo_id: imoId ?? undefined,
      agency_id: agencyId ?? undefined,
    };
  }

  // Let the edge function derive caller-owned fields for standard agents.
  // This avoids client-side self-assignment and tenant metadata drift.
  if (!normalizedUplineId || normalizedUplineId === currentUserId) {
    return {};
  }

  return {
    upline_id: normalizedUplineId,
  };
}
