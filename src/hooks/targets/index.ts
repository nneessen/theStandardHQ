// src/hooks/targets/index.ts
export { useTargets } from "./useTargets";
export { useUpdateTargets } from "./useUpdateTargets";
export { useTargetProgress } from "./useTargetProgress";
export { useCalculatedTargets } from "./useCalculatedTargets";
export { useAchievements } from "./useAchievements";
export { useActualMetrics } from "./useActualMetrics";
export { useUserTargets, useUpdateUserTargets } from "./useUserTargets";
export type {
  UseUserTargetsOptions,
  UserTargets,
  UpdateUserTargetsInput,
} from "./useUserTargets";

// Team/Hierarchy target hooks
export {
  useDownlineTargets,
  useImoTargets,
  useInvalidateTeamTargets,
  teamTargetKeys,
} from "./useTeamTargets";
