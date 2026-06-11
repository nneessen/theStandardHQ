// src/features/recruiting/components/ProspectListTable.tsx
// Compact table of the agent's prospects with always-on inline status editing.

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Pencil, Trash2, UserPlus } from "lucide-react";
import { formatDate } from "@/lib/format";
import {
  SELECTABLE_PROSPECT_STATUSES,
  PROSPECT_STATUS_COLORS,
  PROSPECT_STATUS_LABELS,
  type Prospect,
  type ProspectStatus,
} from "@/types/prospect.types";

interface ProspectListTableProps {
  prospects: Prospect[];
  onEdit: (prospect: Prospect) => void;
  onConvert: (prospect: Prospect) => void;
  onDelete: (prospect: Prospect) => void;
  onStatusChange: (prospect: Prospect, status: ProspectStatus) => void;
}

function isOverdue(p: Prospect): boolean {
  const status = (p.status as ProspectStatus) ?? "new";
  if (status === "converted" || status === "not_interested") return false;
  return !!p.next_follow_up_at && new Date(p.next_follow_up_at) < new Date();
}

export function ProspectListTable({
  prospects,
  onEdit,
  onConvert,
  onDelete,
  onStatusChange,
}: ProspectListTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[11px]">Name</TableHead>
            <TableHead className="text-[11px]">Contact</TableHead>
            <TableHead className="text-[11px]">Status</TableHead>
            <TableHead className="text-[11px]">Last contacted</TableHead>
            <TableHead className="text-[11px]">Next follow-up</TableHead>
            <TableHead className="text-[11px]">Notes</TableHead>
            <TableHead className="text-[11px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {prospects.map((p) => {
            const status = (p.status as ProspectStatus) ?? "new";
            const colors =
              PROSPECT_STATUS_COLORS[status] ?? PROSPECT_STATUS_COLORS.new;
            const overdue = isOverdue(p);
            const converted = status === "converted";
            return (
              <TableRow key={p.id}>
                <TableCell className="text-[11px] font-medium">
                  {p.first_name} {p.last_name}
                  {p.state && (
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      · {p.state}
                    </span>
                  )}
                  {p.source && (
                    <div className="text-[10px] text-muted-foreground">
                      {p.source}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-[11px]">
                  <div className="flex flex-col gap-0.5">
                    {p.email && (
                      <a
                        href={`mailto:${p.email}`}
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <Mail className="h-3 w-3" />
                        {p.email}
                      </a>
                    )}
                    {p.phone && (
                      <a
                        href={`tel:${p.phone}`}
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <Phone className="h-3 w-3" />
                        {p.phone}
                      </a>
                    )}
                    {!p.email && !p.phone && (
                      <span className="text-muted-foreground italic">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {converted ? (
                    // Terminal, system-set status — show a read-only badge, not
                    // an editable Select (only the Convert flow sets it).
                    <span
                      className={`inline-flex items-center h-7 px-2 rounded-md text-[11px] border ${colors.bg} ${colors.text} ${colors.border}`}
                    >
                      {PROSPECT_STATUS_LABELS.converted}
                    </span>
                  ) : (
                    <Select
                      value={status}
                      onValueChange={(v) =>
                        onStatusChange(p, v as ProspectStatus)
                      }
                    >
                      <SelectTrigger
                        className={`h-7 text-[11px] w-[130px] border ${colors.bg} ${colors.text} ${colors.border}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SELECTABLE_PROSPECT_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {PROSPECT_STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell className="text-[11px] text-muted-foreground">
                  {p.last_contacted_at ? formatDate(p.last_contacted_at) : "—"}
                </TableCell>
                <TableCell className="text-[11px]">
                  {p.next_follow_up_at ? (
                    <span
                      className={
                        overdue
                          ? "text-destructive font-medium"
                          : "text-muted-foreground"
                      }
                    >
                      {formatDate(p.next_follow_up_at)}
                      {overdue && " · overdue"}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-[11px] text-muted-foreground max-w-[220px]">
                  <span className="line-clamp-2">{p.notes || "—"}</span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => onEdit(p)}
                      title="Edit"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => onConvert(p)}
                      disabled={converted}
                      title={
                        converted
                          ? "Already converted to a recruit"
                          : "Convert to recruit"
                      }
                    >
                      <UserPlus className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[11px] text-destructive hover:text-destructive"
                      onClick={() => onDelete(p)}
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
