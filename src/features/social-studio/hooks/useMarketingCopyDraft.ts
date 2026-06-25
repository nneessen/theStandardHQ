// src/features/social-studio/hooks/useMarketingCopyDraft.ts
// Exposes the AI marketing-copy drafter to the carousel builder so the component never
// imports the service/infrastructure layer directly (architecture: features → hooks →
// services). The returned function only SEEDS a slide's copy — the user keeps editing it.

import { useCallback } from "react";
import {
  generateMarketingCopy,
  type MarketingCopyRequest,
  type MarketingCopyResult,
} from "@/services/social-studio";

export type { MarketingCopyRequest, MarketingCopyResult };

export function useMarketingCopyDraft() {
  return useCallback(
    (req: MarketingCopyRequest): Promise<MarketingCopyResult> =>
      generateMarketingCopy(req),
    [],
  );
}
