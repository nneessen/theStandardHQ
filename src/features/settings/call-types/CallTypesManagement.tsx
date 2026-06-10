// src/features/settings/call-types/CallTypesManagement.tsx
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Plus, Edit, Trash2, PhoneCall } from "lucide-react";
import {
  useCallTypes,
  useKpiIdentity,
  type CallType,
  type CallTypeCreateForm,
  type CallTypeUpdateForm,
} from "@/features/kpi";

// ─── Form schema ─────────────────────────────────────────────────────────────

const callTypeFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  description: z
    .string()
    .max(500, "Description is too long")
    .optional()
    .or(z.literal("")),
  sort_order: z
    .number()
    .int("Must be an integer")
    .min(0, "Must be 0 or greater"),
  is_active: z.boolean(),
});

type CallTypeFormValues = z.infer<typeof callTypeFormSchema>;

// ─── Form Sheet ───────────────────────────────────────────────────────────────

interface CallTypeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callType: CallType | null;
  onSubmit: (data: CallTypeFormValues) => Promise<void>;
  isSubmitting: boolean;
}

function CallTypeFormSheet({
  open,
  onOpenChange,
  callType,
  onSubmit,
  isSubmitting,
}: CallTypeFormProps) {
  const form = useForm<CallTypeFormValues>({
    resolver: zodResolver(callTypeFormSchema),
    defaultValues: {
      name: "",
      description: "",
      sort_order: 0,
      is_active: true,
    },
  });

  useEffect(() => {
    if (callType) {
      form.reset({
        name: callType.name,
        description: callType.description ?? "",
        sort_order: callType.sort_order,
        is_active: callType.is_active,
      });
    } else {
      form.reset({ name: "", description: "", sort_order: 0, is_active: true });
    }
  }, [callType, open, form]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md p-3 bg-card border-border">
        <SheetHeader className="space-y-1 pb-3 border-b border-border/60">
          <SheetTitle className="text-sm font-semibold text-foreground">
            {callType ? "Edit Call Type" : "Add Call Type"}
          </SheetTitle>
          <SheetDescription className="text-[10px] text-muted-foreground">
            {callType
              ? "Update call type details."
              : "Create a new call type for categorizing recordings."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-3 py-3"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    Name *
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., New Lead Call"
                      {...field}
                      className="h-7 text-[11px] bg-card border-border"
                    />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    Description (Optional)
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe when to use this call type..."
                      {...field}
                      value={field.value ?? ""}
                      rows={2}
                      className="text-[11px] bg-card border-border resize-none"
                    />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sort_order"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    Sort Order
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      value={field.value}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value) || 0)
                      }
                      className="h-7 w-24 text-[11px] bg-card border-border"
                    />
                  </FormControl>
                  <FormDescription className="text-[10px] text-muted-foreground">
                    Lower numbers appear first in dropdowns.
                  </FormDescription>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-2">
                  <div className="space-y-0.5">
                    <FormLabel className="text-[11px] font-medium text-foreground">
                      Active
                    </FormLabel>
                    <FormDescription className="text-[10px] text-muted-foreground">
                      Inactive types won't appear in recording upload dropdowns.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="h-4 w-4"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <SheetFooter className="gap-1 pt-3 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="h-7 px-2 text-[10px] border-border"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="h-7 px-2 text-[10px]"
              >
                {isSubmitting ? "Saving..." : callType ? "Update" : "Create"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Delete Dialog ────────────────────────────────────────────────────────────

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callType: CallType | null;
  onConfirm: () => void;
  isDeleting: boolean;
}

function CallTypeDeleteDialog({
  open,
  onOpenChange,
  callType,
  onConfirm,
  isDeleting,
}: DeleteDialogProps) {
  if (!callType) return null;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm p-3 bg-card border-border">
        <AlertDialogHeader className="space-y-1">
          <AlertDialogTitle className="text-sm font-semibold text-foreground">
            Delete Call Type?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 text-[11px]">
            <p className="text-muted-foreground">
              Are you sure you want to delete{" "}
              <strong className="text-foreground">{callType.name}</strong>?
            </p>
            <p className="text-[10px] text-muted-foreground">
              Recordings already tagged with this type will retain their
              reference. This action cannot be undone.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-1 pt-3">
          <AlertDialogCancel
            disabled={isDeleting}
            className="h-7 px-2 text-[10px] border-border bg-card"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isDeleting}
            className="h-7 px-2 text-[10px] bg-destructive text-destructive-foreground hover:bg-destructive"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CallTypesManagement() {
  const { imoId } = useKpiIdentity();
  const targetImoId = imoId ?? undefined;
  const {
    callTypes,
    isLoading,
    createCallType,
    updateCallType,
    deleteCallType,
  } = useCallTypes(targetImoId);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<CallType | null>(null);

  const handleAdd = () => {
    setSelected(null);
    setIsFormOpen(true);
  };

  const handleEdit = (ct: CallType) => {
    setSelected(ct);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (ct: CallType) => {
    setSelected(ct);
    setIsDeleteOpen(true);
  };

  const handleFormSubmit = async (data: CallTypeFormValues) => {
    if (selected) {
      const patch: CallTypeUpdateForm = {
        name: data.name,
        description: data.description || null,
        sort_order: data.sort_order,
        is_active: data.is_active,
      };
      await updateCallType.mutateAsync({ id: selected.id, data: patch });
    } else {
      if (!targetImoId) return;
      const form: CallTypeCreateForm = {
        name: data.name,
        description: data.description || null,
        sort_order: data.sort_order,
        is_active: data.is_active,
        imo_id: targetImoId,
      };
      await createCallType.mutateAsync(form);
    }
    setIsFormOpen(false);
    setSelected(null);
  };

  const handleDeleteConfirm = async () => {
    if (!selected) return;
    await deleteCallType.mutateAsync(selected.id);
    setIsDeleteOpen(false);
    setSelected(null);
  };

  if (isLoading) {
    return (
      <div className="bg-v2-card rounded-lg border border-v2-ring p-6">
        <div className="flex items-center justify-center text-[11px] text-v2-ink-muted">
          Loading call types...
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
            <PhoneCall className="h-3.5 w-3.5 text-v2-ink-subtle" />
            <div>
              <h3 className="text-[11px] font-semibold text-v2-ink uppercase tracking-wide">
                Call Types
              </h3>
              <p className="text-[10px] text-v2-ink-muted">
                Categorize call recordings by type for analytics and training
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={handleAdd}
            disabled={!targetImoId}
          >
            <Plus className="h-3 w-3 mr-1" />
            New Type
          </Button>
        </div>

        {!targetImoId ? (
          <div className="p-6 text-center text-[11px] text-v2-ink-muted">
            Select a specific IMO in the sidebar to manage call types.
          </div>
        ) : (
          <div className="p-3">
            <div className="rounded-lg overflow-hidden border border-v2-ring">
              <Table>
                <TableHeader className="sticky top-0 bg-v2-canvas z-10">
                  <TableRow className="border-b border-v2-ring hover:bg-transparent">
                    <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted">
                      Name
                    </TableHead>
                    <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted hidden sm:table-cell">
                      Description
                    </TableHead>
                    <TableHead className="h-8 text-[11px] font-semibold text-v2-ink-muted w-[70px] text-center">
                      Order
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
                  {callTypes.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-[11px] text-v2-ink-muted py-6"
                      >
                        No call types yet. Click "New Type" to add one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    callTypes.map((ct) => (
                      <TableRow
                        key={ct.id}
                        className="hover:bg-v2-canvas border-b border-v2-ring/60"
                      >
                        <TableCell className="py-1.5">
                          <span className="font-medium text-[11px] text-v2-ink">
                            {ct.name}
                          </span>
                        </TableCell>
                        <TableCell className="py-1.5 hidden sm:table-cell max-w-[220px]">
                          <span className="text-[11px] text-v2-ink-muted truncate block">
                            {ct.description || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="py-1.5 text-center">
                          <span className="text-[11px] text-v2-ink-muted">
                            {ct.sort_order}
                          </span>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Badge
                            variant={ct.is_active ? "default" : "secondary"}
                            className="text-[10px] h-4 px-1"
                          >
                            {ct.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1.5 text-v2-ink-muted dark:text-v2-ink-subtle hover:text-v2-ink"
                              onClick={() => handleEdit(ct)}
                            >
                              <Edit className="h-2.5 w-2.5 mr-0.5" />
                              <span className="text-[10px]">Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20"
                              onClick={() => handleDeleteClick(ct)}
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      <CallTypeFormSheet
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        callType={selected}
        onSubmit={handleFormSubmit}
        isSubmitting={createCallType.isPending || updateCallType.isPending}
      />

      <CallTypeDeleteDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        callType={selected}
        onConfirm={handleDeleteConfirm}
        isDeleting={deleteCallType.isPending}
      />
    </>
  );
}
