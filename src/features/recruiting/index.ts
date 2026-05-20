// src/features/recruiting/index.ts
export {
  useActiveTemplate,
  usePhases,
  useTemplates,
} from "./hooks/usePipeline";
export { useInitializeRecruitProgress } from "./hooks/useRecruitProgress";
export {
  filterUserSelectableTemplates,
  selectDefaultRecruitTemplate,
} from "./utils/template-filters";
export {
  usePhaseAutomations,
  useChecklistItemAutomations,
  useSystemAutomations,
  useCreateAutomation,
  useUpdateAutomation,
  useDeleteAutomation,
} from "./hooks/usePipelineAutomations";
export {
  useInvitationByToken,
  useSubmitRegistrationWithPassword,
  useCancelInvitation,
} from "./hooks/useRecruitInvitations";
export { useRecruitsChecklistSummary } from "./hooks/useRecruitsChecklistSummary";
export type { ChecklistSummary } from "./hooks/useRecruitsChecklistSummary";
export { AutomationDialog } from "./admin/AutomationDialog";

// Components
export { RecruitDetailPanel } from "./components/RecruitDetailPanel";
export { AddRecruitDialog } from "./components/AddRecruitDialog";
