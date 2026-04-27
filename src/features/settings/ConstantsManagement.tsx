// src/features/settings/ConstantsManagement.tsx
// Redesigned with zinc palette and compact design patterns

import React, { useState } from "react";
import {
  useConstants,
  useUpdateConstant,
} from "../../hooks/expenses/useConstants";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { AlertCircle, CheckCircle, Settings, DollarSign } from "lucide-react";

export const ConstantsManagement: React.FC = () => {
  const { data: constants, isLoading } = useConstants();
  const updateConstant = useUpdateConstant();

  const [formData, setFormData] = useState({
    avgAP: constants?.avgAP || 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState("");

  // Update form when constants load
  React.useEffect(() => {
    if (constants) {
      setFormData({
        avgAP: constants.avgAP,
      });
    }
  }, [constants]);

  const handleInputChange = (
    field: keyof typeof formData,
    value: string | number,
  ) => {
    const numValue = typeof value === "number" ? value : parseFloat(value) || 0;
    setFormData((prev) => ({ ...prev, [field]: numValue }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
    setSuccessMessage("");
  };

  const validateAndSave = async (field: "avgAP") => {
    const value = formData[field];

    // Validation
    if (value < 0) {
      setErrors((prev) => ({ ...prev, [field]: "Value cannot be negative" }));
      return;
    }

    try {
      await updateConstant.mutateAsync({ field, value });
      setSuccessMessage(`${getFieldLabel(field)} updated successfully!`);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        [field]: error instanceof Error ? error.message : "Failed to update",
      }));
    }
  };

  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      avgAP: "Average Annual Premium Override",
    };
    return labels[field] || field;
  };

  const getFieldDescription = (field: string): string => {
    const descriptions: Record<string, string> = {
      avgAP:
        "Optional: Override the calculated average annual premium. This value will be used in targets calculations instead of your historical average. Leave at 0 to use automatic calculations.",
    };
    return descriptions[field] || "";
  };

  if (isLoading) {
    return (
      <div className="bg-v2-card rounded-lg border border-v2-ring p-6">
        <div className="flex items-center justify-center text-[11px] text-v2-ink-muted">
          Loading constants...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="bg-v2-card rounded-lg border border-v2-ring">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-v2-ring/60">
          <Settings className="h-3.5 w-3.5 text-v2-ink-subtle" />
          <div>
            <h3 className="text-[11px] font-semibold text-v2-ink uppercase tracking-wide">
              System Constants
            </h3>
            <p className="text-[10px] text-v2-ink-muted">
              Configure default values used throughout the application for
              calculations and comparisons
            </p>
          </div>
        </div>

        <div className="p-3">
          {/* Success Message */}
          {successMessage && (
            <div className="flex items-center gap-2 p-2 mb-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded text-[10px] text-emerald-700 dark:text-emerald-300">
              <CheckCircle className="h-3 w-3 flex-shrink-0" />
              {successMessage}
            </div>
          )}

          {/* Average Annual Premium */}
          <div className="flex items-start gap-2">
            <DollarSign className="h-3.5 w-3.5 text-v2-ink-subtle mt-0.5" />
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide mb-0.5">
                {getFieldLabel("avgAP")}
              </label>
              <p className="text-[10px] text-v2-ink-subtle mb-2">
                {getFieldDescription("avgAP")}
              </p>

              <div className="flex gap-2 items-start max-w-sm">
                <div className="flex-1">
                  <Input
                    type="number"
                    value={formData.avgAP}
                    onChange={(e) => handleInputChange("avgAP", e.target.value)}
                    onBlur={() => validateAndSave("avgAP")}
                    min={0}
                    step={100}
                    className={`h-7 text-[11px] bg-v2-card border-v2-ring ${errors.avgAP ? "border-red-500" : ""}`}
                  />
                  {errors.avgAP && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-red-600 dark:text-red-400">
                      <AlertCircle className="h-3 w-3" />
                      {errors.avgAP}
                    </div>
                  )}
                </div>
                <Button
                  onClick={() => validateAndSave("avgAP")}
                  disabled={updateConstant.isPending}
                  size="sm"
                  className="h-7 px-2 text-[10px]"
                >
                  {updateConstant.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="text-[10px]">
            <p className="font-medium text-amber-700 dark:text-amber-300 mb-0.5">
              About Premium Override
            </p>
            <p className="text-amber-600 dark:text-amber-400">
              By default, your targets are calculated using your actual
              historical average policy premium. Set a value here only if you
              want to override the automatic calculation. This is useful if
              you're planning to focus on different policy types or expect your
              average premium to change significantly.
            </p>
            <p className="text-amber-600 dark:text-amber-400 mt-1">
              Leave at 0 to use your actual historical average from your policy
              data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
