// src/features/the-standard-team/components/SureLcLinksPanel.tsx
// Body-only panel for the Licensing hub "SureLC" tab.
// - Company links: super-admin can add/edit/delete; everyone in the IMO can open.
// - My links: each agent manages their own labeled SureLC logins.

import { useState } from "react";
import { toast } from "sonner";
import {
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Link2,
  Loader2,
  Building2,
  User as UserIcon,
} from "lucide-react";
import { Board, Cap, EmptyState, T } from "@/components/board";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUserProfile } from "@/hooks/admin";
import {
  useSharedSureLcLinks,
  useMySureLcLinks,
  useCreateSureLcLink,
  useUpdateSureLcLink,
  useDeleteSureLcLink,
} from "@/hooks/surelc";
import type { SureLcLink, SureLcLinkScope } from "@/types/surelc.types";

interface DraftState {
  label: string;
  url: string;
  description: string;
}

const EMPTY_DRAFT: DraftState = { label: "", url: "", description: "" };

export function SureLcLinksPanel() {
  const { data: profile } = useCurrentUserProfile();
  const isSuperAdmin = profile?.is_super_admin === true;

  const shared = useSharedSureLcLinks();
  const mine = useMySureLcLinks();

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <LinkSection
        scope="shared"
        icon={<Building2 size={14} />}
        title="Company SureLC links"
        hint={
          isSuperAdmin
            ? "Shared with every agent in your organization. You manage these."
            : "Shared links provided by your organization."
        }
        links={shared.data ?? []}
        isLoading={shared.isLoading}
        error={shared.error}
        canManage={isSuperAdmin}
      />

      <LinkSection
        scope="personal"
        icon={<UserIcon size={14} />}
        title="My SureLC logins"
        hint="Your own SureLC logins. Add one for each account you use."
        links={mine.data ?? []}
        isLoading={mine.isLoading}
        error={mine.error}
        canManage
      />
    </div>
  );
}

interface LinkSectionProps {
  scope: SureLcLinkScope;
  icon: React.ReactNode;
  title: string;
  hint: string;
  links: SureLcLink[];
  isLoading: boolean;
  error: Error | null;
  canManage: boolean;
}

function LinkSection({
  scope,
  icon,
  title,
  hint,
  links,
  isLoading,
  error,
  canManage,
}: LinkSectionProps) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const createLink = useCreateSureLcLink();
  const updateLink = useUpdateSureLcLink();
  const deleteLink = useDeleteSureLcLink();

  const handleCreate = async (draft: DraftState) => {
    try {
      await createLink.mutateAsync({
        scope,
        label: draft.label,
        url: draft.url,
        description: draft.description || null,
      });
      toast.success("Link added");
      setAdding(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add link");
    }
  };

  const handleUpdate = async (id: string, draft: DraftState) => {
    try {
      await updateLink.mutateAsync({
        id,
        data: {
          label: draft.label,
          url: draft.url,
          description: draft.description || null,
        },
      });
      toast.success("Link updated");
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update link");
    }
  };

  const handleDelete = async (link: SureLcLink) => {
    if (!confirm(`Delete "${link.label}"?`)) return;
    try {
      await deleteLink.mutateAsync(link.id);
      toast.success("Link deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete link");
    }
  };

  return (
    <Board pad={14}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{ color: T.blue, marginTop: 1 }}>{icon}</span>
          <div>
            <Cap>{title}</Cap>
            <p
              style={{
                font: `500 11px ${T.data}`,
                color: T.mut,
                margin: "4px 0 0",
              }}
            >
              {hint}
            </p>
          </div>
        </div>
        {canManage && !adding && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
            onClick={() => {
              setAdding(true);
              setEditingId(null);
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add link
          </Button>
        )}
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {adding && (
          <LinkForm
            busy={createLink.isPending}
            onCancel={() => setAdding(false)}
            onSubmit={handleCreate}
          />
        )}

        {isLoading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              font: `500 11px ${T.data}`,
              color: T.mut,
              padding: "8px 0",
            }}
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </div>
        ) : error ? (
          <EmptyState
            icon={<Link2 size={18} />}
            title="Failed to load links"
            hint={error.message}
            pad={20}
          />
        ) : links.length === 0 && !adding ? (
          <EmptyState
            icon={<Link2 size={18} />}
            title="No links yet"
            hint={
              canManage
                ? 'Use "Add link" to create one.'
                : "None have been added."
            }
            pad={20}
          />
        ) : (
          links.map((link) =>
            editingId === link.id ? (
              <LinkForm
                key={link.id}
                busy={updateLink.isPending}
                initial={{
                  label: link.label,
                  url: link.url,
                  description: link.description ?? "",
                }}
                onCancel={() => setEditingId(null)}
                onSubmit={(draft) => handleUpdate(link.id, draft)}
              />
            ) : (
              <LinkRow
                key={link.id}
                link={link}
                canManage={canManage}
                onEdit={() => {
                  setEditingId(link.id);
                  setAdding(false);
                }}
                onDelete={() => handleDelete(link)}
              />
            ),
          )
        )}
      </div>
    </Board>
  );
}

interface LinkRowProps {
  link: SureLcLink;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function LinkRow({ link, canManage, onEdit, onDelete }: LinkRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 8,
        background: T.tile,
        border: `1px solid ${T.line}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            font: `700 12px ${T.data}`,
            color: T.ink,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {link.label}
        </div>
        <div
          style={{
            font: `500 10px ${T.mono}`,
            color: T.mut,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {link.description || link.url}
        </div>
      </div>
      <a href={link.url} target="_blank" rel="noopener noreferrer">
        <Button type="button" size="sm" className="h-7 px-2 text-[11px]">
          Open <ExternalLink className="h-3.5 w-3.5 ml-1" />
        </Button>
      </a>
      {canManage && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onEdit}
            aria-label="Edit link"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive"
            onClick={onDelete}
            aria-label="Delete link"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
    </div>
  );
}

interface LinkFormProps {
  initial?: DraftState;
  busy: boolean;
  onSubmit: (draft: DraftState) => void;
  onCancel: () => void;
}

function LinkForm({ initial, busy, onSubmit, onCancel }: LinkFormProps) {
  const [draft, setDraft] = useState<DraftState>(initial ?? EMPTY_DRAFT);
  const canSave = draft.label.trim().length > 0 && draft.url.trim().length > 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: 10,
        borderRadius: 8,
        background: T.panel2,
        border: `1px solid ${T.line2}`,
      }}
    >
      <Input
        value={draft.label}
        onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
        placeholder="Label (e.g. SureLC Producer Portal)"
        className="h-7 text-[11px]"
        disabled={busy}
        autoFocus
      />
      <Input
        value={draft.url}
        onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
        placeholder="https://surelc.surancebay.com/…"
        className="h-7 text-[11px]"
        disabled={busy}
      />
      <Input
        value={draft.description}
        onChange={(e) =>
          setDraft((d) => ({ ...d, description: e.target.value }))
        }
        placeholder="Description (optional)"
        className="h-7 text-[11px]"
        disabled={busy}
      />
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={onCancel}
          disabled={busy}
        >
          <X className="h-3.5 w-3.5 mr-1" /> Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={() => onSubmit(draft)}
          disabled={!canSave || busy}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5 mr-1" />
          )}
          Save
        </Button>
      </div>
    </div>
  );
}
