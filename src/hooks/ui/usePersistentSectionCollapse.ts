// src/hooks/ui/usePersistentSectionCollapse.ts
// Persist per-section collapsed state for grouped navigation UIs.

import { useCallback, useState } from "react";

export function usePersistentSectionCollapse(storageKey: string) {
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const writeState = useCallback(
    (next: Record<string, boolean>) => {
      setCollapsedSections(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Ignore storage write failures; in-memory state still works.
      }
    },
    [storageKey],
  );

  const toggleSection = useCallback(
    (sectionId: string) => {
      writeState({
        ...collapsedSections,
        [sectionId]: !collapsedSections[sectionId],
      });
    },
    [collapsedSections, writeState],
  );

  const expandSection = useCallback(
    (sectionId: string) => {
      if (!collapsedSections[sectionId]) return;
      const next = { ...collapsedSections };
      delete next[sectionId];
      writeState(next);
    },
    [collapsedSections, writeState],
  );

  return {
    collapsedSections,
    expandSection,
    toggleSection,
  };
}
