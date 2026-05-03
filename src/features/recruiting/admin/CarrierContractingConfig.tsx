// src/features/recruiting/admin/CarrierContractingConfig.tsx

import { useState, useRef, useCallback, useEffect } from "react";
import { Building2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CarrierContractingMetadata } from "@/types/recruiting.types";
import { createCarrierContractingMetadata } from "@/types/checklist-metadata.types";

interface CarrierContractingConfigProps {
  metadata: CarrierContractingMetadata | null;
  onChange: (
    metadata: CarrierContractingMetadata & { _type: "carrier_contracting" },
  ) => void;
}

export function CarrierContractingConfig({
  metadata,
  onChange,
}: CarrierContractingConfigProps) {
  const [allowRecruitEdit, setAllowRecruitEdit] = useState(
    metadata?.allow_recruit_edit_writing_number ?? false,
  );
  const [completionCriteria, setCompletionCriteria] = useState<"all" | "count">(
    metadata?.completion_criteria ?? "all",
  );
  const [requiredCount, setRequiredCount] = useState(
    metadata?.required_count?.toString() ?? "",
  );
  const [generalInstructions, setGeneralInstructions] = useState(
    metadata?.general_instructions ?? "",
  );

  const prevMetadataRef = useRef<string>("");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const notifyChange = useCallback(() => {
    const data: CarrierContractingMetadata = {
      allow_recruit_edit_writing_number: allowRecruitEdit,
      completion_criteria: completionCriteria,
      ...(completionCriteria === "count" && requiredCount
        ? { required_count: parseInt(requiredCount, 10) || undefined }
        : {}),
      ...(generalInstructions.trim()
        ? { general_instructions: generalInstructions.trim() }
        : {}),
    };

    const newMetadata = createCarrierContractingMetadata(data);
    const metadataString = JSON.stringify(newMetadata);

    if (metadataString !== prevMetadataRef.current) {
      prevMetadataRef.current = metadataString;
      onChangeRef.current(newMetadata);
    }
  }, [
    allowRecruitEdit,
    completionCriteria,
    requiredCount,
    generalInstructions,
  ]);

  useEffect(() => {
    notifyChange();
  }, [notifyChange]);

  return (
    <div className="space-y-3 p-2.5 bg-background rounded-md shadow-sm">
      <div className="flex items-center gap-2">
        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Carrier Contracting Configuration
        </span>
      </div>

      {/* Allow Recruit to Edit Writing Numbers */}
      <div className="flex items-center justify-between py-1">
        <div className="space-y-0.5">
          <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
            Allow Recruit to Edit Writing Numbers
          </Label>
          <p className="text-[9px] text-muted-foreground">
            Recruit can enter their own writing numbers from the checklist
          </p>
        </div>
        <Switch
          checked={allowRecruitEdit}
          onCheckedChange={setAllowRecruitEdit}
          className="scale-75"
        />
      </div>

      {/* Completion Criteria */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
          Completion Criteria
        </Label>
        <Select
          value={completionCriteria}
          onValueChange={(value: "all" | "count") =>
            setCompletionCriteria(value)
          }
        >
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-[11px]">
              All carriers must have writing numbers
            </SelectItem>
            <SelectItem value="count" className="text-[11px]">
              Specific number of carriers
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Required Count (only for count criteria) */}
      {completionCriteria === "count" && (
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
            Required Number of Carriers
          </Label>
          <Input
            type="number"
            min="1"
            value={requiredCount}
            onChange={(e) => setRequiredCount(e.target.value)}
            placeholder="e.g., 3"
            className="h-7 text-[11px] w-24"
          />
        </div>
      )}

      {/* General Instructions */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">
          Instructions (Optional)
        </Label>
        <Textarea
          value={generalInstructions}
          onChange={(e) => setGeneralInstructions(e.target.value)}
          placeholder="e.g., Enter your writing number for each carrier once you receive it..."
          className="min-h-[50px] text-[11px] resize-none"
        />
      </div>

      {/* Preview */}
      <div className="p-2 bg-info/10 rounded border border-info/30">
        <p className="text-[9px] text-info">
          <strong>How it works:</strong> Carriers are added via the Contracting
          tab. This checklist item dynamically shows those carriers and tracks
          writing numbers. Completes when{" "}
          {completionCriteria === "all"
            ? "all carriers have writing numbers"
            : `${requiredCount || "N"} carriers have writing numbers`}
          .
        </p>
      </div>
    </div>
  );
}
