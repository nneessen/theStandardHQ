// src/features/workflows/index.ts

export { default as WorkflowAdminPage } from "./components/WorkflowAdminPage";
export {
  WORKFLOW_EVENT_CATALOG,
  ACTIVE_WORKFLOW_EVENTS,
  ACTIVE_EVENT_CATEGORIES,
  getEventDef,
  getEventVariables,
} from "./eventCatalog";
export type { WorkflowEventDef, WorkflowEventCategory } from "./eventCatalog";
