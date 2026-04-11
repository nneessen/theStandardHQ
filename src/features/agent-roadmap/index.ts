// src/features/agent-roadmap/index.ts
//
// Public barrel for the agent-roadmap feature. Import from here when consuming
// from outside the feature (e.g., Sidebar.tsx, router). Internal components
// should import directly from their neighboring files.

// Types
export type {
  RoadmapContentBlock,
  RoadmapContentBlockType,
  RichTextBlock,
  ImageBlock,
  VideoBlock,
  ExternalLinkBlock,
  CalloutBlock,
  CodeSnippetBlock,
  VideoPlatform,
  CalloutVariant,
} from "./types/contentBlocks";

export {
  CONTENT_BLOCK_TYPES,
  CONTENT_BLOCK_LABELS,
} from "./types/contentBlocks";

export type {
  RoadmapTemplateRow,
  RoadmapSectionRow,
  RoadmapItemRow,
  RoadmapItemProgressRow,
  RoadmapItem,
  RoadmapSectionWithItems,
  RoadmapTree,
  RoadmapProgressMap,
  RoadmapProgressStatus,
  RoadmapCompletionStats,
  RoadmapTeamProgressRow,
  CreateRoadmapInput,
  UpdateRoadmapInput,
  CreateSectionInput,
  UpdateSectionInput,
  CreateItemInput,
  UpdateItemInput,
  UpsertProgressInput,
} from "./types/roadmap";

// Constants
export {
  ROADMAP_STORAGE_BUCKET,
  MAX_CONTENT_BLOCKS_PER_ITEM,
  AUTOSAVE_DEBOUNCE_MS,
} from "./constants";

// Services (re-exported for convenience; prefer hooks in components)
export { roadmapService } from "./services/roadmapService";
export { roadmapProgressService } from "./services/roadmapProgressService";
export { roadmapStorage } from "./services/roadmapStorage";
export { parseVideoUrl } from "./services/videoUrlParser";
export { computeRoadmapStats } from "./services/completionCalc";
export { validateContentBlocks } from "./services/contentBlocksValidator";

// Hooks
export { roadmapKeys } from "./hooks/queryKeys";
export { useRoadmapList } from "./hooks/useRoadmapList";
export { useRoadmapTree } from "./hooks/useRoadmapTree";
export { useRoadmapProgress } from "./hooks/useRoadmapProgress";
export { useTeamProgressOverview } from "./hooks/useTeamProgressOverview";
export {
  useCreateRoadmap,
  useUpdateRoadmap,
  useDeleteRoadmap,
  useSetDefaultRoadmap,
} from "./hooks/useUpsertRoadmap";
export {
  useCreateSection,
  useUpdateSection,
  useDeleteSection,
  useReorderSections,
} from "./hooks/useUpsertSection";
export {
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
  useReorderItems,
  useMoveItem,
} from "./hooks/useUpsertItem";
export {
  useUpsertProgress,
  useUpdateProgressNotes,
} from "./hooks/useUpsertProgress";

// Pages (consumed by router.tsx)
export { RoadmapListPage } from "./components/admin/RoadmapListPage";
export { RoadmapEditorPage } from "./components/admin/RoadmapEditorPage";
export { TeamProgressPanel } from "./components/admin/TeamProgressPanel";
export { RoadmapLandingPage } from "./components/user/RoadmapLandingPage";
export { RoadmapRunnerPage } from "./components/user/RoadmapRunnerPage";
