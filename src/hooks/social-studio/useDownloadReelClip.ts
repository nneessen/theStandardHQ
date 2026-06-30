// src/hooks/social-studio/useDownloadReelClip.ts
// Hook that wraps downloadReelClip and tracks per-clip loading state.

import { useState, useCallback } from "react";
import { downloadReelClip } from "@/services/social-studio/reelService";
import type { ReelClip } from "@/types/reel.types";

export function useDownloadReelClip() {
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

  const download = useCallback(async (clip: ReelClip): Promise<void> => {
    setDownloadingIds((prev) => new Set([...prev, clip.id]));
    try {
      // Build a safe filename from the clip title.
      const safeName = (clip.title ?? "reel-clip")
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 60);
      const filename = `${safeName}-${clip.id.slice(0, 8)}.mp4`;
      await downloadReelClip(clip.id, filename);
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(clip.id);
        return next;
      });
    }
  }, []);

  return { download, downloadingIds };
}
