import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { parseCsv, type CsvRow } from "../../utils/csvParser";
import { useBulkCreateExternalContacts } from "../../hooks/useAudiences";

type Stage = "upload" | "preview" | "importing" | "done";

interface ImportResult {
  imported: number;
  skipped: number;
}

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CsvImportDialog({ open, onOpenChange }: CsvImportDialogProps) {
  const { user } = useAuth();
  const bulkCreate = useBulkCreateExternalContacts();
  const fileRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("upload");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);

  function reset() {
    setStage("upload");
    setRows([]);
    setErrors([]);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Please select a .csv file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      setRows(parsed.rows);
      setErrors(parsed.errors);
      setStage("preview");
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!user?.id || rows.length === 0) return;
    setStage("importing");

    try {
      const res = await bulkCreate.mutateAsync({
        contacts: rows,
        createdBy: user.id,
      });
      setResult(res);
      setStage("done");
      toast.success(`Imported ${res.imported} contacts.`);
    } catch {
      toast.error("Import failed.");
      setStage("preview");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg p-0">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="text-sm font-semibold">
            Import External Contacts from CSV
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 py-3 min-h-[200px]">
          {stage === "upload" && (
            <div className="flex flex-col items-center justify-center gap-3 py-8">
              <Upload className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-[11px] text-muted-foreground text-center">
                Upload a CSV file with columns: email (required), first_name,
                last_name, company, tags, source
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] gap-1"
                onClick={() => fileRef.current?.click()}
              >
                <FileText className="h-3 w-3" />
                Select CSV File
              </Button>
            </div>
          )}

          {stage === "preview" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                  {rows.length} valid rows
                </Badge>
                {errors.length > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] h-5 px-1.5 text-warning border-warning/30 bg-warning/10"
                  >
                    {errors.length} issues
                  </Badge>
                )}
              </div>

              {/* Preview table */}
              <div className="rounded border border-border max-h-[200px] overflow-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left font-medium px-2 py-1 text-muted-foreground">
                        Email
                      </th>
                      <th className="text-left font-medium px-2 py-1 text-muted-foreground">
                        Name
                      </th>
                      <th className="text-left font-medium px-2 py-1 text-muted-foreground">
                        Company
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 10).map((r, i) => (
                      <tr
                        key={i}
                        className="border-b border-border/40 last:border-0"
                      >
                        <td className="px-2 py-0.5 truncate max-w-[160px]">
                          {r.email}
                        </td>
                        <td className="px-2 py-0.5 text-muted-foreground">
                          {[r.first_name, r.last_name]
                            .filter(Boolean)
                            .join(" ") || "—"}
                        </td>
                        <td className="px-2 py-0.5 text-muted-foreground">
                          {r.company || "—"}
                        </td>
                      </tr>
                    ))}
                    {rows.length > 10 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-2 py-1 text-center text-muted-foreground"
                        >
                          ...and {rows.length - 10} more
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Errors */}
              {errors.length > 0 && (
                <div className="rounded border border-warning/30 bg-warning/10 dark:bg-warning/10 dark:border-warning p-2 max-h-[80px] overflow-auto">
                  {errors.slice(0, 5).map((err, i) => (
                    <p key={i} className="text-[10px] text-warning">
                      {err}
                    </p>
                  ))}
                  {errors.length > 5 && (
                    <p className="text-[10px] text-warning">
                      ...and {errors.length - 5} more warnings
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {stage === "importing" && (
            <div className="flex flex-col items-center justify-center gap-3 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-[11px] text-muted-foreground">
                Importing {rows.length} contacts...
              </p>
            </div>
          )}

          {stage === "done" && result && (
            <div className="flex flex-col items-center justify-center gap-3 py-8">
              <CheckCircle className="h-8 w-8 text-success" />
              <div className="text-center">
                <p className="text-sm font-medium">Import Complete</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  <span className="font-medium text-success">
                    {result.imported}
                  </span>{" "}
                  imported
                  {result.skipped > 0 && (
                    <>
                      {" / "}
                      <span className="font-medium text-warning">
                        {result.skipped}
                      </span>{" "}
                      skipped (duplicates)
                    </>
                  )}
                </p>
                {errors.length > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    <AlertCircle className="h-3 w-3 inline mr-0.5 text-warning" />
                    {errors.length} parse warnings
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-4 py-3 border-t gap-2">
          {stage === "preview" && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[11px]"
                onClick={reset}
              >
                Back
              </Button>
              <Button
                size="sm"
                className="h-6 text-[11px]"
                onClick={handleImport}
                disabled={rows.length === 0}
              >
                Import {rows.length} Contacts
              </Button>
            </>
          )}
          {(stage === "upload" || stage === "done") && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[11px]"
              onClick={() => handleClose(false)}
            >
              {stage === "done" ? "Close" : "Cancel"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
