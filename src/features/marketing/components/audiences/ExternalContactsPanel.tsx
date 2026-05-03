import { useState } from "react";
import { Plus, Trash2, Upload, Loader2, Contact } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import {
  useExternalContacts,
  useCreateExternalContact,
  useDeleteExternalContact,
} from "../../hooks/useAudiences";
import { CsvImportDialog } from "./CsvImportDialog";

interface AddContactForm {
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  tags: string;
  source: string;
}

const EMPTY_FORM: AddContactForm = {
  email: "",
  first_name: "",
  last_name: "",
  company: "",
  tags: "",
  source: "",
};

export function ExternalContactsPanel() {
  const { user } = useAuth();
  const { data: contacts, isLoading } = useExternalContacts();
  const createContact = useCreateExternalContact();
  const deleteContact = useDeleteExternalContact();

  const [addOpen, setAddOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [form, setForm] = useState<AddContactForm>(EMPTY_FORM);

  function handleAdd() {
    if (!form.email.trim()) {
      toast.error("Email is required.");
      return;
    }
    if (!user?.id) return;

    createContact.mutate(
      {
        email: form.email.trim(),
        first_name: form.first_name.trim() || undefined,
        last_name: form.last_name.trim() || undefined,
        company: form.company.trim() || undefined,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        source: form.source.trim() || undefined,
        created_by: user.id,
      },
      {
        onSuccess: () => {
          toast.success("Contact added.");
          setForm(EMPTY_FORM);
          setAddOpen(false);
        },
        onError: () =>
          toast.error("Failed to add contact. Email may already exist."),
      },
    );
  }

  function handleDelete(id: string) {
    deleteContact.mutate(id, {
      onSuccess: () => toast.success("Contact deleted."),
      onError: () => toast.error("Failed to delete contact."),
    });
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {contacts?.length ?? 0} external contact
          {(contacts?.length ?? 0) !== 1 ? "s" : ""}
        </span>
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[11px] gap-1"
            onClick={() => setCsvOpen(true)}
          >
            <Upload className="h-3 w-3" />
            Import CSV
          </Button>
          <Button
            size="sm"
            className="h-6 text-[11px] gap-1"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-3 w-3" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-sm overflow-hidden">
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
                Company
              </TableHead>
              <TableHead className="text-[10px] font-medium text-muted-foreground h-7 py-0 px-3">
                Tags
              </TableHead>
              <TableHead className="text-[10px] font-medium text-muted-foreground h-7 py-0 px-3">
                Source
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
                <TableCell colSpan={7} className="py-8 text-center">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : !contacts?.length ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-10 text-center text-[11px] text-muted-foreground"
                >
                  <Contact className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
                  No external contacts yet. Add one or import from CSV.
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => (
                <TableRow key={contact.id} className="hover:bg-muted/30">
                  <TableCell className="py-1 px-3 text-[11px] truncate max-w-[180px]">
                    {contact.email}
                  </TableCell>
                  <TableCell className="py-1 px-3 text-[11px] text-muted-foreground">
                    {[contact.first_name, contact.last_name]
                      .filter(Boolean)
                      .join(" ") || "—"}
                  </TableCell>
                  <TableCell className="py-1 px-3 text-[11px] text-muted-foreground">
                    {contact.company || "—"}
                  </TableCell>
                  <TableCell className="py-1 px-3">
                    <div className="flex gap-0.5 flex-wrap">
                      {(contact.tags || []).slice(0, 3).map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-[9px] h-3.5 px-1"
                        >
                          {tag}
                        </Badge>
                      ))}
                      {(contact.tags || []).length > 3 && (
                        <span className="text-[9px] text-muted-foreground">
                          +{contact.tags.length - 3}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-1 px-3 text-[10px] text-muted-foreground">
                    {contact.source || "—"}
                  </TableCell>
                  <TableCell className="py-1 px-3 text-[10px] text-muted-foreground whitespace-nowrap">
                    {format(new Date(contact.created_at), "MMM d")}
                  </TableCell>
                  <TableCell className="py-1 px-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(contact.id)}
                      disabled={deleteContact.isPending}
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

      {/* Add Contact Dialog */}
      <Dialog
        open={addOpen}
        onOpenChange={(v) => {
          if (!v) setForm(EMPTY_FORM);
          setAddOpen(v);
        }}
      >
        <DialogContent className="max-w-md p-0">
          <DialogHeader className="px-4 py-3 border-b">
            <DialogTitle className="text-sm font-semibold">
              Add External Contact
            </DialogTitle>
          </DialogHeader>
          <div className="px-4 py-3 space-y-2.5">
            {[
              {
                key: "email" as const,
                label: "Email",
                required: true,
                placeholder: "email@example.com",
              },
              {
                key: "first_name" as const,
                label: "First Name",
                required: false,
                placeholder: "John",
              },
              {
                key: "last_name" as const,
                label: "Last Name",
                required: false,
                placeholder: "Doe",
              },
              {
                key: "company" as const,
                label: "Company",
                required: false,
                placeholder: "Acme Inc.",
              },
              {
                key: "tags" as const,
                label: "Tags",
                required: false,
                placeholder: "tag1, tag2",
              },
              {
                key: "source" as const,
                label: "Source",
                required: false,
                placeholder: "e.g. LinkedIn, Referral",
              },
            ].map(({ key, label, required, placeholder }) => (
              <div key={key} className="space-y-0.5">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  {label}{" "}
                  {required ? (
                    <span className="text-destructive">*</span>
                  ) : (
                    <span className="text-muted-foreground/60">(optional)</span>
                  )}
                </label>
                <Input
                  className="h-7 text-[11px]"
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <DialogFooter className="px-4 py-3 border-t gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[11px]"
              onClick={() => {
                setForm(EMPTY_FORM);
                setAddOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-6 text-[11px]"
              onClick={handleAdd}
              disabled={createContact.isPending || !form.email.trim()}
            >
              {createContact.isPending && (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              )}
              Add Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import */}
      <CsvImportDialog open={csvOpen} onOpenChange={setCsvOpen} />
    </div>
  );
}
