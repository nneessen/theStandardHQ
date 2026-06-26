import React, { useState, useEffect } from "react";
import { Save, User, Percent, AlertCircle, CheckCircle } from "lucide-react";
import { logger } from "../../services/base/logger";
import { Button } from "@/components/ui/button";
import { getTodayString } from "@/lib/date";

interface UserContractData {
  contractLevel: number;
  contractPercentage: number;
  effectiveDate: string;
  notes?: string;
}

export function UserContractSettings() {
  const [contractData, setContractData] = useState<UserContractData>({
    contractLevel: 100,
    contractPercentage: 100,
    effectiveDate: getTodayString(),
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    loadUserContractData();
  }, []);

  const loadUserContractData = async () => {
    try {
      const saved = localStorage.getItem("userContractSettings");
      if (saved) {
        setContractData(JSON.parse(saved));
      }
    } catch (error) {
      logger.error(
        "Failed to load contract settings",
        error instanceof Error ? error : String(error),
        "UserContractSettings",
      );
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      // Validate data
      if (contractData.contractLevel < 50 || contractData.contractLevel > 200) {
        setMessage({
          type: "error",
          text: "Contract level must be between 50 and 200",
        });
        return;
      }

      if (
        contractData.contractPercentage < 50 ||
        contractData.contractPercentage > 100
      ) {
        setMessage({
          type: "error",
          text: "Contract percentage must be between 50% and 100%",
        });
        return;
      }

      // For now, save to localStorage. In production, this would be saved to the database
      localStorage.setItem(
        "userContractSettings",
        JSON.stringify(contractData),
      );

      setMessage({
        type: "success",
        text: "Contract settings saved successfully!",
      });
    } catch (error) {
      logger.error(
        "Failed to save contract settings",
        error instanceof Error ? error : String(error),
        "UserContractSettings",
      );
      setMessage({
        type: "error",
        text: "Failed to save settings. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (
    field: keyof UserContractData,
    value: string | number,
  ) => {
    setContractData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setMessage(null); // Clear any existing messages
  };

  const getContractLevelDescription = (level: number) => {
    if (level >= 140) return "Premium Level";
    if (level >= 120) return "Enhanced Level";
    if (level >= 100) return "Release Level";
    return "Street Level";
  };

  const calculateEffectiveRate = (baseRate: number) => {
    return ((baseRate * contractData.contractPercentage) / 100).toFixed(2);
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center mb-4">
          <User className="h-6 w-6 text-primary mr-3" />
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Your Contract Settings
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure your contract commission percentage to calculate
              accurate commission amounts
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Contract Level */}
        <div>
          <label
            htmlFor="contractLevel"
            className="block text-sm font-medium text-muted-foreground mb-2"
          >
            Contract Level
          </label>
          <div className="relative">
            <input
              type="number"
              id="contractLevel"
              min="50"
              max="200"
              step="5"
              value={contractData.contractLevel}
              onChange={(e) =>
                handleInputChange(
                  "contractLevel",
                  parseInt(e.target.value) || 100,
                )
              }
              className="block w-full pr-20 rounded-md shadow-sm bg-card text-foreground focus:ring-2 focus:ring-primary sm:text-sm"
              placeholder="100"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <span className="text-sm text-muted-foreground">
                {getContractLevelDescription(contractData.contractLevel)}
              </span>
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Your contract level determines which commission rates apply to your
            policies
          </p>
        </div>

        {/* Contract Percentage */}
        <div>
          <label
            htmlFor="contractPercentage"
            className="block text-sm font-medium text-muted-foreground mb-2"
          >
            Contract Commission Percentage
          </label>
          <div className="relative">
            <input
              type="number"
              id="contractPercentage"
              min="50"
              max="100"
              step="0.1"
              value={contractData.contractPercentage}
              onChange={(e) =>
                handleInputChange(
                  "contractPercentage",
                  parseFloat(e.target.value) || 100,
                )
              }
              className="block w-full pr-10 rounded-md shadow-sm bg-card text-foreground focus:ring-2 focus:ring-primary sm:text-sm"
              placeholder="100"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <Percent className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            The percentage of the base commission rate you receive (typically
            80-100%)
          </p>
        </div>

        {/* Effective Date */}
        <div>
          <label
            htmlFor="effectiveDate"
            className="block text-sm font-medium text-muted-foreground mb-2"
          >
            Effective Date
          </label>
          <input
            type="date"
            id="effectiveDate"
            value={contractData.effectiveDate}
            onChange={(e) => handleInputChange("effectiveDate", e.target.value)}
            className="block w-full rounded-md shadow-sm bg-card text-foreground focus:ring-2 focus:ring-primary sm:text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            When these contract terms became effective
          </p>
        </div>

        {/* Notes */}
        <div>
          <label
            htmlFor="notes"
            className="block text-sm font-medium text-muted-foreground mb-2"
          >
            Notes (Optional)
          </label>
          <textarea
            id="notes"
            rows={3}
            value={contractData.notes || ""}
            onChange={(e) => handleInputChange("notes", e.target.value)}
            className="block w-full rounded-md shadow-sm bg-card text-foreground focus:ring-2 focus:ring-primary sm:text-sm"
            placeholder="Any additional notes about your contract..."
          />
        </div>

        {/* Example Calculation */}
        <div className="bg-gradient-to-r from-muted/30 to-card rounded-lg p-4 shadow-sm">
          <h3 className="text-sm font-medium text-foreground mb-3">
            Example Commission Calculation
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Base Rate (Example: 85%):
              </span>
              <span className="font-medium text-foreground">85.00%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Your Contract %:</span>
              <span className="font-medium text-foreground">
                {contractData.contractPercentage}%
              </span>
            </div>
            <div className="pt-2 flex justify-between">
              <span className="text-foreground font-medium">
                Your Effective Rate:
              </span>
              <span className="font-semibold text-primary">
                {calculateEffectiveRate(85)}%
              </span>
            </div>
          </div>
        </div>

        {/* Messages */}
        {message && (
          <div
            className={`flex items-center p-3 rounded-md shadow-md ${
              message.type === "success"
                ? "bg-gradient-to-r from-success/20 via-status-active/10 to-card text-success"
                : "bg-gradient-to-r from-destructive/20 via-error/10 to-card text-destructive"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="h-5 w-5 mr-2" />
            ) : (
              <AlertCircle className="h-5 w-5 mr-2" />
            )}
            <span className="text-sm">{message.text}</span>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="sm">
            {!saving && <Save className="h-4 w-4 mr-2" />}
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default UserContractSettings;
