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

// Document management (reused by the Licensing hub "My Documents" self-service view)
export {
  useRecruitDocuments,
  useDeleteDocument,
} from "./hooks/useRecruitDocuments";
export { UploadDocumentDialog } from "./components/UploadDocumentDialog";
export { DocumentViewerDialog } from "./components/DocumentViewerDialog";

// Components
export { RecruitDetailPanel } from "./components/RecruitDetailPanel";
export { AddRecruitDialog } from "./components/AddRecruitDialog";
