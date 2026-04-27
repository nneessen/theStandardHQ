// src/features/settings/imo/ImoManagement.tsx
// IMO Management tab for super admins

import React, { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  Edit,
  Building,
  Users,
  FileText,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useAllActiveImos,
  useCreateImo,
  useUpdateImo,
  useDeactivateImo,
  useImoMetrics,
} from "@/hooks/imo";
import { ImoForm } from "./components/ImoForm";
import type { Imo, CreateImoData, UpdateImoData } from "@/types/imo.types";

export function ImoManagement() {
  const { data: imos, isLoading } = useAllActiveImos();
  const createImo = useCreateImo();
  const updateImo = useUpdateImo();
  const deactivateImo = useDeactivateImo();

  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedImo, setSelectedImo] = useState<Imo | null>(null);

  // Filter IMOs based on search
  const filteredImos = React.useMemo(() => {
    if (!imos) return [];
    if (!searchTerm) return imos;

    const search = searchTerm.toLowerCase();
    return imos.filter(
      (imo) =>
        imo.name.toLowerCase().includes(search) ||
        imo.code.toLowerCase().includes(search),
    );
  }, [imos, searchTerm]);

  const handleAddImo = () => {
    setSelectedImo(null);
    setIsFormOpen(true);
  };

  const handleEditImo = (imo: Imo) => {
    setSelectedImo(imo);
    setIsFormOpen(true);
  };

  const handleDeactivateImo = async (imo: Imo) => {
    if (
      window.confirm(
        `Are you sure you want to deactivate "${imo.name}"? This will affect all agencies and users under this IMO.`,
      )
    ) {
      await deactivateImo.mutateAsync(imo.id);
    }
  };

  const handleFormSubmit = async (data: CreateImoData | UpdateImoData) => {
    try {
      if (selectedImo) {
        await updateImo.mutateAsync({
          id: selectedImo.id,
          data: data as UpdateImoData,
        });
        toast.success("IMO updated successfully");
      } else {
        await createImo.mutateAsync(data as CreateImoData);
        toast.success("IMO created successfully");
      }
      setIsFormOpen(false);
      setSelectedImo(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "An error occurred";
      toast.error(message);
      console.error("IMO form submit error:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-v2-card rounded-lg border border-v2-ring p-6">
        <div className="flex items-center justify-center text-[11px] text-v2-ink-muted">
          Loading IMOs...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-v2-card rounded-lg border border-v2-ring">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-v2-ring/60">
          <div className="flex items-center gap-2">
            <Building className="h-3.5 w-3.5 text-v2-ink-subtle" />
            <div>
              <h3 className="text-[11px] font-semibold text-v2-ink uppercase tracking-wide">
                IMO Management
              </h3>
              <p className="text-[10px] text-v2-ink-muted">
                Manage Independent Marketing Organizations
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={handleAddImo}
          >
            <Plus className="h-3 w-3 mr-1" />
            New IMO
          </Button>
        </div>

        <div className="p-3 space-y-2">
          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-v2-ink-subtle" />
            <Input
              type="text"
              placeholder="Search IMOs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 h-7 text-[11px] bg-v2-card border-v2-ring"
            />
          </div>

          {/* Table */}
          <div className="rounded-lg overflow-hidden border border-v2-ring">
            <Table>
              <TableHeader className="sticky top-0 bg-v2-canvas z-10">
                <TableRow className="border-b border-v2-ring hover:bg-transparent">
                  <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted">
                    IMO Name
                  </TableHead>
                  <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted w-[100px]">
                    Code
                  </TableHead>
                  <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted w-[100px]">
                    Agencies
                  </TableHead>
                  <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted w-[100px]">
                    Agents
                  </TableHead>
                  <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted w-[80px]">
                    Status
                  </TableHead>
                  <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted w-[80px] text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredImos.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-[11px] text-v2-ink-muted py-6"
                    >
                      {searchTerm
                        ? "No IMOs found matching your search."
                        : 'No IMOs yet. Click "New IMO" to add one.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredImos.map((imo) => (
                    <ImoTableRow
                      key={imo.id}
                      imo={imo}
                      onEdit={handleEditImo}
                      onDeactivate={handleDeactivateImo}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Form Sheet */}
      <ImoForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        imo={selectedImo}
        onSubmit={handleFormSubmit}
        isSubmitting={createImo.isPending || updateImo.isPending}
      />
    </>
  );
}

// Separate row component to use hooks per-row for metrics
function ImoTableRow({
  imo,
  onEdit,
  onDeactivate,
}: {
  imo: Imo;
  onEdit: (imo: Imo) => void;
  onDeactivate: (imo: Imo) => void;
}) {
  const { data: metrics } = useImoMetrics(imo.id);

  return (
    <TableRow className="hover:bg-v2-canvas border-b border-v2-ring/60">
      <TableCell className="py-1.5">
        <div className="flex flex-col">
          <span className="font-medium text-[11px] text-v2-ink">
            {imo.name}
          </span>
          {imo.contact_email && (
            <span className="text-[10px] text-v2-ink-muted">
              {imo.contact_email}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="py-1.5">
        <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-mono">
          {imo.code}
        </Badge>
      </TableCell>
      <TableCell className="py-1.5">
        <div className="flex items-center gap-1 text-[11px] text-v2-ink-muted">
          <Building className="h-3 w-3" />
          {metrics?.total_agencies ?? "—"}
        </div>
      </TableCell>
      <TableCell className="py-1.5">
        <div className="flex items-center gap-1 text-[11px] text-v2-ink-muted">
          <Users className="h-3 w-3" />
          {metrics?.total_agents ?? "—"}
        </div>
      </TableCell>
      <TableCell className="py-1.5">
        <Badge
          variant={imo.is_active ? "default" : "secondary"}
          className="text-[10px] h-4 px-1"
        >
          {imo.is_active ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      <TableCell className="py-1.5 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-v2-ink-muted dark:text-v2-ink-subtle"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem
              onClick={() => onEdit(imo)}
              className="text-[11px]"
            >
              <Edit className="h-3 w-3 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDeactivate(imo)}
              className="text-[11px] text-red-600"
            >
              <FileText className="h-3 w-3 mr-2" />
              Deactivate
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
