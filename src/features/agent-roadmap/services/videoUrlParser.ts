// src/features/agent-roadmap/services/videoUrlParser.ts
//
// Detects the video platform from a pasted URL and (where possible) extracts
// an embeddable URL. Kept narrow to YouTube, Vimeo, and Loom — anything else
// falls back to "other" and the consumer renders it as an external link.

import type { VideoPlatform } from "../types/contentBlocks";

export interface ParsedVideoUrl {
  platform: VideoPlatform;
  /** The original URL, normalized if possible */
  url: string;
  /** Embeddable iframe src when we can compute one */
  embedUrl?: string;
  /** Video id when known */
  id?: string;
}

const YOUTUBE_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const VIMEO_RE = /vimeo\.com\/(?:video\/)?(\d+)/;
const LOOM_RE = /loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/;

export function parseVideoUrl(input: string): ParsedVideoUrl {
  const url = input.trim();

  const youtubeMatch = url.match(YOUTUBE_RE);
  if (youtubeMatch) {
    return {
      platform: "youtube",
      url,
      id: youtubeMatch[1],
      embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}`,
    };
  }

  const vimeoMatch = url.match(VIMEO_RE);
  if (vimeoMatch) {
    return {
      platform: "vimeo",
      url,
      id: vimeoMatch[1],
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
    };
  }

  const loomMatch = url.match(LOOM_RE);
  if (loomMatch) {
    return {
      platform: "loom",
      url,
      id: loomMatch[1],
      embedUrl: `https://www.loom.com/embed/${loomMatch[1]}`,
    };
  }

  return { platform: "other", url };
}
