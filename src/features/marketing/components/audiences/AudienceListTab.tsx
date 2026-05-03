import { useState } from "react";
import { Plus, Trash2, Users, Loader2, Contact } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  useAudiences,
  useCreateAudience,
  useDeleteAudience,
  useResolveAudienceContacts,
} from "../../hooks/useAudiences";
import { resolveAudienceContacts } from "../../services/audienceService";
import type { SourcePool } from "../../types/marketing.types";
import { format } from "date-fns";
import { AudienceDetailSheet } from "./AudienceDetailSheet";
import { ExternalContactsPanel } from "./ExternalContactsPanel";

const SOURCE_POOL_OPTIONS: { value: SourcePool; label: string }[] = [
  { value: "agents", label: "Agents" },
  { value: "clients", label: "Clients" },
  { value: "leads", label: "Leads" },
  { value: "external", label: "External" },
  { value: "mixed", label: "Mixed" },
];

const SOURCE_POOL_COLORS: Record<SourcePool, string> = {
  agents: "bg-info/10 text-info border-info/20",
  clients: "bg-success/10 text-success border-success/20",
  leads: "bg-warning/10 text-warning border-warning/20",
  external: "bg-info/10 text-info border-info/20",
  mixed: "bg-muted text-muted-foreground border-input/20",
};

type ViewMode = "audiences" | "external";

interface NewAudienceForm {
  name: string;
  source_pool: SourcePool | "";
  description: string;
}

function ContactCountPreview({ sourcePool }: { sourcePool: SourcePool | "" }) {
  const { data, isFetching } = useResolveAudienceContacts(
    sourcePool || null,
    {},
  );

  if (!sourcePool) return null;

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1">
      {isFetching ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Counting contacts...</span>
        </>
      ) : (
        <>
          <Users className="h-3 w-3" />
          <span>
            <span className="font-medium text-foreground">
              {data?.length ?? 0}
            </span>{" "}
            contacts found
          </span>
        </>
      )}
    </div>
  );
}

function DeleteConfirmDialog({
  open,
  audienceName,
  onConfirm,
  onCancel,
  isPending,
}: {
  open: boolean;
  audienceName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-sm p-0">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="text-sm font-semibold">
            Delete Audience
          </DialogTitle>
        </DialogHeader>
        <div className="px-4 py-3 text-[11px] text-muted-foreground">
          Delete{" "}
          <span className="font-medium text-foreground">"{audienceName}"</span>?
          This action cannot be undone.
        </div>
        <DialogFooter className="px-4 py-3 border-t gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[11px]"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-6 text-[11px]"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AudienceListTab() {
  const { user } = useAuth();
  const { data: audiences, isLoading } = useAudiences();
  const createAudience = useCreateAudience();
  const deleteAudience = useDeleteAudience();

  const [viewMode, setViewMode] = useState<ViewMode>("audiences");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const [form, setForm] = useState<NewAudienceForm>({
    name: "",
    source_pool: "",
    description: "",
  });

  function resetForm() {
    setForm({ name: "", source_pool: "", description: "" });
  }

  async function handleCreate() {
    if (!form.name.trim() || !form.source_pool) {
      toast.error("Name and source pool are required.");
      return;
    }
    if (!user?.id) {
      toast.error("Not authenticated.");
      return;
    }

    try {
      const resolved = await resolveAudienceContacts(form.source_pool, {});
      await createAudience.mutateAsync({
        name: form.name.trim(),
        source_pool: form.source_pool,
        audience_type: "dynamic",
        description: form.description.trim() || undefined,
        filters: {},
        contact_count: resolved.length,
        created_by: user.id,
      });
      toast.success(`Audience created with ${resolved.length} contacts.`);
      setCreateOpen(false);
      resetForm();
    } catch {
      toast.error("Failed to create audience.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteAudience.mutateAsync(deleteTarget.id);
      toast.success("Audience deleted.");
    } catch {
      toast.error("Failed to delete audience.");
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* View Toggle */}
      <div className="flex items-center gap-1.5">
        <Button
          variant={viewMode === "audiences" ? "default" : "outline"}
          size="sm"
          className="h-6 text-[10px] px-2 gap-1"
          onClick={() => setViewMode("audiences")}
        >
          <Users className="h-3 w-3" />
          Audiences
        </Button>
        <Button
          variant={viewMode === "external" ? "default" : "outline"}
          size="sm"
          className="h-6 text-[10px] px-2 gap-1"
          onClick={() => setViewMode("external")}
        >
          <Contact className="h-3 w-3" />
          External Contacts
        </Button>
      </div>

      {viewMode === "external" ? (
        <ExternalContactsPanel />
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              {audiences?.length ?? 0} audience
              {(audiences?.length ?? 0) !== 1 ? "s" : ""}
            </span>
            <Button
              size="sm"
              className="h-6 text-[11px] gap-1"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-3 w-3" />
              New Audience
            </Button>
          </div>

          {/* Table */}
          <div className="border border-border rounded-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-[10px] font-medium text-muted-foreground h-7 py-0 px-3">
                    Name
                  </TableHead>
                  <TableHead className="text-[10px] font-medium text-muted-foreground h-7 py-0 px-3">
                    Type
                  </TableHead>
                  <TableHead className="text-[10px] font-medium text-muted-foreground h-7 py-0 px-3">
                    Source
                  </TableHead>
                  <TableHead className="text-[10px] font-medium text-muted-foreground h-7 py-0 px-3 text-right">
                    Contacts
                  </TableHead>
                  <TableHead className="text-[10px] font-medium text-muted-foreground h-7 py-0 px-3">
                    Created
                  </TableHead>
                  <TableHead className="text-[10px] font-medium text-muted-foreground h-7 py-0 px-3 w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : !audiences?.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-[11px] text-muted-foreground"
                    >
                      <Users className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
                      No audiences yet. Create one to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  audiences.map((audience) => (
                    <TableRow
                      key={audience.id}
                      className="hover:bg-muted/30 py-1.5 cursor-pointer"
                      onClick={() => setDetailId(audience.id)}
                    >
                      <TableCell className="py-1.5 px-3 text-[11px] font-medium">
                        {audience.name}
                        {audience.description && (
                          <div className="text-[10px] text-muted-foreground font-normal truncate max-w-[200px]">
                            {audience.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-1.5 px-3">
                        <Badge
                          variant="outline"
                          className="text-[10px] h-4 px-1.5 font-normal capitalize"
                        >
                          {audience.audience_type.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1.5 px-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] h-4 px-1.5 font-normal capitalize border",
                            SOURCE_POOL_COLORS[
                              audience.source_pool as SourcePool
                            ] ?? SOURCE_POOL_COLORS.mixed,
                          )}
                        >
                          {audience.source_pool}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1.5 px-3 text-[11px] text-right tabular-nums">
                        {(audience.contact_count ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="py-1.5 px-3 text-[11px] text-muted-foreground whitespace-nowrap">
                        {audience.created_at
                          ? format(new Date(audience.created_at), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell className="py-1.5 px-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({
                              id: audience.id,
                              name: audience.name,
                            });
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Audience Detail Sheet */}
      <AudienceDetailSheet
        audienceId={detailId}
        open={!!detailId}
        onOpenChange={(v) => {
          if (!v) setDetailId(null);
        }}
      />

      {/* Create Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(v) => {
          if (!v) resetForm();
          setCreateOpen(v);
        }}
      >
        <DialogContent className="max-w-md p-0">
          <DialogHeader className="px-4 py-3 border-b">
            <DialogTitle className="text-sm font-semibold">
              New Audience
            </DialogTitle>
          </DialogHeader>

          <div className="px-4 py-3 space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Name <span className="text-destructive">*</span>
              </label>
              <Input
                className="h-7 text-[11px]"
                placeholder="e.g. Active Agents Q1"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Source Pool <span className="text-destructive">*</span>
              </label>
              <Select
                value={form.source_pool}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, source_pool: v as SourcePool }))
                }
              >
                <SelectTrigger className="h-7 text-[11px]">
                  <SelectValue placeholder="Select source..." />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_POOL_OPTIONS.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      className="text-[11px]"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ContactCountPreview sourcePool={form.source_pool} />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Description{" "}
                <span className="text-muted-foreground/60">(optional)</span>
              </label>
              <textarea
                className="w-full h-16 rounded-md border border-input bg-background px-2.5 py-1.5 text-[11px] resize-none focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                placeholder="Brief description of this audience segment..."
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter className="px-4 py-3 border-t gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[11px]"
              onClick={() => {
                resetForm();
                setCreateOpen(false);
              }}
              disabled={createAudience.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-6 text-[11px]"
              onClick={handleCreate}
              disabled={
                createAudience.isPending ||
                !form.name.trim() ||
                !form.source_pool
              }
            >
              {createAudience.isPending && (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              )}
              Save Audience
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        audienceName={deleteTarget?.name ?? ""}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isPending={deleteAudience.isPending}
      />
    </div>
  );
}
