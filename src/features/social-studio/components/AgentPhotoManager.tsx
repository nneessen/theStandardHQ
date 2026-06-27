// src/features/social-studio/components/AgentPhotoManager.tsx
// Manage one agent's photo set (New Agents section): upload multiple photos, reorder them
// (= rotation order), mark a primary (= the avatar), and remove them. Reorder is via
// up/down (no drag-dnd dependency — same sort_order outcome). Owner-only (the page is
// super-admin gated). All Storage/DB access goes through useAgentPhotos.

import { useRef } from "react";
import {
  ImagePlus,
  Loader2,
  Star,
  Trash2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useAgentPhotos } from "../hooks/useAgentPhotos";

// Same set the spotlight-assets / recruiting-assets buckets + a browser <img> accept.
const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

interface AgentPhotoManagerProps {
  agentId: string;
  imoId: string | null;
}

export function AgentPhotoManager({ agentId, imoId }: AgentPhotoManagerProps) {
  const { photos, isLoading, add, remove, setPrimary, reorder } =
    useAgentPhotos(agentId);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploading = add.isPending;

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!imoId) return;
    const list = Array.from(files);
    let appendAt = photos.length;
    let first = photos.length === 0;
    for (const file of list) {
      if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
        // Skip unsupported files but keep going with the rest.
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) continue;
      add.mutate({
        agentId,
        imoId,
        file,
        sortOrder: appendAt,
        // The agent's very first photo becomes the avatar so it syncs predictably.
        isPrimary: first,
      });
      appendAt += 1;
      first = false;
    }
  }

  function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= photos.length) return;
    const ids = photos.map((p) => p.id);
    [ids[index], ids[next]] = [ids[next], ids[index]];
    reorder.mutate(ids);
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-background p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-foreground">
          Photos {photos.length > 0 ? `(${photos.length})` : ""}
        </span>
        <label
          className={`flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-accent hover:text-foreground ${
            uploading || !imoId ? "pointer-events-none opacity-60" : ""
          }`}
          title={imoId ? "Upload one or more photos" : "Agency not loaded yet"}
        >
          {uploading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
            </>
          ) : (
            <>
              <ImagePlus className="h-3.5 w-3.5" /> Add photos
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            disabled={uploading || !imoId}
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 px-1 py-2 text-[11px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading photos…
        </div>
      ) : photos.length === 0 ? (
        <p className="px-1 py-1 text-[10px] text-muted-foreground">
          No photos yet. Add a few — welcome posts auto-rotate through them.
        </p>
      ) : (
        <div className="space-y-1.5">
          {photos.map((p, i) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-md border border-border bg-card/50 p-1.5"
            >
              <img
                src={p.photoUrl}
                alt=""
                className="h-10 w-10 flex-none rounded object-cover"
              />
              <span className="flex-1 truncate text-[10px] text-muted-foreground">
                #{i + 1} {p.isPrimary ? "· avatar" : ""}
              </span>
              {/* Reorder */}
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0 || reorder.isPending}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="Move up (earlier in rotation)"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === photos.length - 1 || reorder.isPending}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                title="Move down (later in rotation)"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {/* Mark primary */}
              <button
                type="button"
                onClick={() => setPrimary.mutate(p.id)}
                disabled={p.isPrimary || setPrimary.isPending}
                className={`rounded p-0.5 ${
                  p.isPrimary
                    ? "text-accent"
                    : "text-muted-foreground hover:text-foreground"
                } disabled:opacity-60`}
                title={p.isPrimary ? "Current avatar" : "Use as the avatar"}
              >
                <Star
                  className="h-3.5 w-3.5"
                  fill={p.isPrimary ? "currentColor" : "none"}
                />
              </button>
              {/* Delete */}
              <button
                type="button"
                onClick={() => remove.mutate(p)}
                disabled={remove.isPending}
                className="rounded p-0.5 text-muted-foreground hover:text-destructive disabled:opacity-30"
                title="Remove this photo"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
