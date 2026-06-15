// src/features/messages/components/unified/types.ts
// Shared types for the unified-inbox (Option C) components. `OpenTarget`
// previously lived in ThreadDrawer; it now has its own home so the reading-pane
// layout (and the feed / insight rail that reference it) don't depend on a
// specific detail container.

import type { UnifiedChannel } from "../../hooks/useUnifiedInbox";

/** A conversation the user has opened into the reading pane. */
export interface OpenTarget {
  channel: UnifiedChannel;
  refId: string;
}
