// src/features/settings/commission-rates/components/RateBulkImport.tsx
// Redesigned with zinc palette and compact design patterns

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Download } from "lucide-react";

interface RateBulkImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (csvText: string) => void;
  isImporting?: boolean;
}

export function RateBulkImport({
  open,
  onOpenChange,
  onImport,
  isImporting = false,
}: RateBulkImportProps) {
  const [csvText, setCsvText] = useState("");

  const downloadTemplate = () => {
    const template = `Product Name,Contract Level,Commission %
Whole Life 0-75,80,95.0
Whole Life 0-75,85,97.5
Whole Life 0-75,90,100.0
Term Life 20yr,80,90.0
Term Life 20yr,85,92.5`;

    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "commission-rates-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    if (!csvText.trim()) {
      alert("Please paste CSV data");
      return;
    }

    onImport(csvText);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-3 bg-v2-card border-v2-ring">
        <DialogHeader className="space-y-1 pb-3 border-b border-v2-ring/60">
          <DialogTitle className="text-sm font-semibold text-v2-ink">
            Bulk Import Commission Rates
          </DialogTitle>
          <DialogDescription className="text-[10px] text-v2-ink-muted">
            Import commission rates for multiple products and contract levels at
            once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-v2-ink-muted">
              Format: Product Name, Contract Level, Commission %
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
              className="h-6 px-2 text-[10px] border-v2-ring"
            >
              <Download className="h-3 w-3 mr-1" />
              Template
            </Button>
          </div>

          <div>
            <label className="text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide mb-1 block">
              Paste CSV Data
            </label>
            <Textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Whole Life 0-75,80,95.0&#10;Whole Life 0-75,85,97.5&#10;Term Life 20yr,80,90.0"
              className="h-40 font-mono text-[11px] bg-v2-card border-v2-ring"
            />
          </div>

          <div className="rounded p-2 bg-v2-canvas border border-v2-ring space-y-1.5">
            <p className="text-[10px] font-medium text-v2-ink-muted">
              Requirements:
            </p>
            <ul className="text-[10px] text-v2-ink-muted space-y-0.5 list-disc list-inside">
              <li>Products must already exist in the system</li>
              <li>
                Contract levels: 80, 85, 90, 95, 100, 105, 110, 115, 120, 125,
                130, 135, 140, 145
              </li>
              <li>Commission percentages: 0-100</li>
              <li>CSV will update existing rates or create new ones</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-1 pt-3 border-t border-v2-ring/60">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              setCsvText("");
            }}
            disabled={isImporting}
            className="h-7 px-2 text-[10px] border-v2-ring"
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            size="sm"
            disabled={isImporting || !csvText.trim()}
            className="h-7 px-2 text-[10px]"
          >
            {isImporting ? "Importing..." : "Import Rates"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
