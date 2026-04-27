import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  RefreshCw,
  Trash2,
  Users,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  useAudience,
  useAudienceMembers,
  useUpdateAudience,
  useRemoveAudienceMember,
} from "../../hooks/useAudiences";
import {
  resolveAudienceContacts,
  addAudienceMembers,
} from "../../services/audienceService";
import type { SourcePool, ContactType } from "../../types/marketing.types";

const SOURCE_POOL_COLORS: Record<SourcePool, string> = {
  agents: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  clients: "bg-green-500/10 text-green-600 border-green-500/20",
  leads: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  external: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  mixed: "bg-zinc-500/10 text-v2-ink-muted border-zinc-500/20",
};

const CONTACT_TYPE_COLORS: Record<ContactType, string> = {
  agent: "bg-blue-50 text-blue-600 border-blue-200",
  client: "bg-green-50 text-green-600 border-green-200",
  lead: "bg-amber-50 text-amber-600 border-amber-200",
  external: "bg-violet-50 text-violet-600 border-violet-200",
};

interface AudienceDetailSheetProps {
  audienceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AudienceDetailSheet({
  audienceId,
  open,
  onOpenChange,
}: AudienceDetailSheetProps) {
  const { data: audience, isLoading } = useAudience(audienceId);
  const { data: members, isLoading: membersLoading } =
    useAudienceMembers(audienceId);
  const updateAudience = useUpdateAudience();
  const removeMember = useRemoveAudienceMember();

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  function startEditName() {
    if (!audience) return;
    setNameValue(audience.name);
    setEditingName(true);
  }

  function saveName() {
    if (!audienceId || !nameValue.trim()) return;
    updateAudience.mutate(
      { id: audienceId, updates: { name: nameValue.trim() } },
      {
        onSuccess: () => {
          setEditingName(false);
          toast.success("Name updated.");
        },
        onError: () => toast.error("Failed to update name."),
      },
    );
  }

  function startEditDesc() {
    if (!audience) return;
    setDescValue(audience.description || "");
    setEditingDesc(true);
  }

  function saveDesc() {
    if (!audienceId) return;
    updateAudience.mutate(
      { id: audienceId, updates: { description: descValue.trim() || null } },
      {
        onSuccess: () => {
          setEditingDesc(false);
          toast.success("Description updated.");
        },
        onError: () => toast.error("Failed to update description."),
      },
    );
  }

  async function handleRefreshContacts() {
    if (!audience || !audienceId) return;
    setRefreshing(true);
    try {
      const contacts = await resolveAudienceContacts(
        audience.source_pool,
        audience.filters,
      );
      const memberRows = contacts.map((c) => ({
        contact_id: null,
        contact_type: c.contact_type as ContactType,
        email: c.email,
        phone: null,
        first_name: c.first_name || null,
        last_name: c.last_name || null,
        metadata: {},
      }));
      await addAudienceMembers(audienceId, memberRows);
      toast.success(`Refreshed — ${contacts.length} contacts.`);
    } catch {
      toast.error("Failed to refresh contacts.");
    } finally {
      setRefreshing(false);
    }
  }

  function handleRemoveMember(memberId: string) {
    removeMember.mutate(memberId, {
      onSuccess: () => toast.success("Member removed."),
      onError: () => toast.error("Failed to remove member."),
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="lg" className="flex flex-col p-0">
        {isLoading || !audience ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Header */}
            <SheetHeader className="px-4 py-3 border-b shrink-0">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                {editingName ? (
                  <div className="flex items-center gap-1 flex-1">
                    <Input
                      className="h-6 text-sm font-semibold flex-1"
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveName();
                        if (e.key === "Escape") setEditingName(false);
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={saveName}
                    >
                      <Check className="h-3 w-3 text-green-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={() => setEditingName(false)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <SheetTitle
                    className="text-sm font-semibold truncate flex-1 cursor-pointer hover:text-primary"
                    onClick={startEditName}
                  >
                    {audience.name}
                    <Pencil className="h-2.5 w-2.5 inline ml-1 text-muted-foreground" />
                  </SheetTitle>
                )}
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] px-1.5 h-4 capitalize border shrink-0",
                    SOURCE_POOL_COLORS[audience.source_pool] ??
                      SOURCE_POOL_COLORS.mixed,
                  )}
                >
                  {audience.source_pool}
                </Badge>
              </div>

              {/* Description */}
              <div className="mt-1">
                {editingDesc ? (
                  <div className="flex items-start gap-1">
                    <textarea
                      className="flex-1 rounded border border-input bg-background px-2 py-1 text-[11px] resize-none h-12 focus:outline-none focus:ring-1 focus:ring-ring"
                      value={descValue}
                      onChange={(e) => setDescValue(e.target.value)}
                      autoFocus
                    />
                    <div className="flex flex-col gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={saveDesc}
                      >
                        <Check className="h-3 w-3 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => setEditingDesc(false)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p
                    className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={startEditDesc}
                  >
                    {audience.description || "No description — click to add"}
                    <Pencil className="h-2 w-2 inline ml-1" />
                  </p>
                )}
              </div>

              <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
                <span>
                  {(audience.contact_count ?? 0).toLocaleString()} contacts
                </span>
                <span>
                  Created {format(new Date(audience.created_at), "MMM d, yyyy")}
                </span>
              </div>
            </SheetHeader>

            {/* Actions */}
            <div className="flex items-center gap-1.5 px-4 py-2 border-b shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2 gap-1"
                onClick={handleRefreshContacts}
                disabled={refreshing}
              >
                {refreshing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Refresh Contacts
              </Button>
            </div>

            {/* Members Table */}
            <div className="flex-1 overflow-auto min-h-0">
              {membersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="text-[10px] font-medium text-muted-foreground h-7 py-0 px-3">
                        Email
                      </TableHead>
                      <TableHead className="text-[10px] font-medium text-muted-foreground h-7 py-0 px-3">
                        Name
                      </TableHead>
                      <TableHead className="text-[10px] font-medium text-muted-foreground h-7 py-0 px-3">
                        Type
                      </TableHead>
                      <TableHead className="text-[10px] font-medium text-muted-foreground h-7 py-0 px-3">
                        Added
                      </TableHead>
                      <TableHead className="text-[10px] font-medium text-muted-foreground h-7 py-0 px-3 w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!members?.length ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-8 text-center text-[11px] text-muted-foreground"
                        >
                          No members yet. Click "Refresh Contacts" to populate.
                        </TableCell>
                      </TableRow>
                    ) : (
                      members.map((m) => (
                        <TableRow key={m.id} className="hover:bg-muted/30">
                          <TableCell className="py-1 px-3 text-[11px] truncate max-w-[180px]">
                            {m.email}
                          </TableCell>
                          <TableCell className="py-1 px-3 text-[11px] text-muted-foreground">
                            {[m.first_name, m.last_name]
                              .filter(Boolean)
                              .join(" ") || "—"}
                          </TableCell>
                          <TableCell className="py-1 px-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] h-3.5 px-1 capitalize border",
                                CONTACT_TYPE_COLORS[m.contact_type] ?? "",
                              )}
                            >
                              {m.contact_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-1 px-3 text-[10px] text-muted-foreground whitespace-nowrap">
                            {format(new Date(m.created_at), "MMM d")}
                          </TableCell>
                          <TableCell className="py-1 px-3">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 text-muted-foreground hover:text-red-500"
                              onClick={() => handleRemoveMember(m.id)}
                              disabled={removeMember.isPending}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
