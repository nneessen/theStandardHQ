// src/features/underwriting/components/WizardSteps/ClientInfoStep.tsx

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ClientInfo } from "../../../types/underwriting.types";
import { US_STATES } from "@/constants/states";
import {
  calculateBMI,
  getBMICategory,
  calculateAge,
} from "../../../utils/shared/bmiCalculator";

interface ClientInfoStepProps {
  data: ClientInfo;
  onChange: (updates: Partial<ClientInfo>) => void;
  errors: Record<string, string>;
}

export default function ClientInfoStep({
  data,
  onChange,
  errors,
}: ClientInfoStepProps) {
  const bmi = useMemo(
    () => calculateBMI(data.heightFeet, data.heightInches, data.weight),
    [data.heightFeet, data.heightInches, data.weight],
  );

  const bmiCategory = useMemo(() => getBMICategory(bmi), [bmi]);

  const bmiColorClass = useMemo(() => {
    if (bmi < 18.5 || bmi >= 35) return "text-destructive";
    if (bmi >= 30) return "text-warning";
    if (bmi >= 25) return "text-warning";
    return "text-success";
  }, [bmi]);

  const handleDobChange = (value: string) => {
    onChange({ dob: value });
    if (value) {
      const age = calculateAge(value);
      onChange({ dob: value, age });
    }
  };

  return (
    <div className="space-y-4 p-1">
      <div className="text-xs text-muted-foreground dark:text-muted-foreground mb-3">
        Enter client demographic information. Only age, gender, and state are
        required for underwriting analysis.
      </div>

      {/* Optional: Client Name */}
      <div className="space-y-1">
        <Label
          htmlFor="name"
          className="text-[11px] text-muted-foreground dark:text-muted-foreground"
        >
          Client Name (optional)
        </Label>
        <Input
          id="name"
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="For your reference only"
          className="h-8 text-sm"
        />
      </div>

      {/* DOB and Age */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label
            htmlFor="dob"
            className="text-[11px] text-muted-foreground dark:text-muted-foreground"
          >
            Date of Birth
          </Label>
          <Input
            id="dob"
            type="date"
            value={data.dob || ""}
            onChange={(e) => handleDobChange(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label
            htmlFor="age"
            className="text-[11px] text-muted-foreground dark:text-muted-foreground"
          >
            Age <span className="text-destructive">*</span>
          </Label>
          <Input
            id="age"
            type="number"
            min={18}
            max={100}
            value={data.age || ""}
            onChange={(e) => onChange({ age: parseInt(e.target.value) || 0 })}
            className={cn("h-8 text-sm", errors.age && "border-destructive")}
          />
          {errors.age && (
            <p className="text-[10px] text-destructive mt-0.5">{errors.age}</p>
          )}
        </div>
      </div>

      {/* Gender and State */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground dark:text-muted-foreground">
            Gender <span className="text-destructive">*</span>
          </Label>
          <Select
            value={data.gender}
            onValueChange={(value) =>
              onChange({ gender: value as ClientInfo["gender"] })
            }
          >
            <SelectTrigger
              className={cn(
                "h-8 text-sm",
                errors.gender && "border-destructive",
              )}
            >
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          {errors.gender && (
            <p className="text-[10px] text-destructive mt-0.5">
              {errors.gender}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground dark:text-muted-foreground">
            State <span className="text-destructive">*</span>
          </Label>
          <Select
            value={data.state}
            onValueChange={(value) => onChange({ state: value })}
          >
            <SelectTrigger
              className={cn(
                "h-8 text-sm",
                errors.state && "border-destructive",
              )}
            >
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent className="max-h-[200px]">
              {US_STATES.map((state) => (
                <SelectItem key={state.value} value={state.value}>
                  {state.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.state && (
            <p className="text-[10px] text-destructive mt-0.5">
              {errors.state}
            </p>
          )}
        </div>
      </div>

      {/* Height and Weight - BMI section */}
      <div className="pt-2 border-t border-border dark:border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-foreground dark:text-muted-foreground">
            Build Information
          </span>
          {bmi > 0 && (
            <span className={cn("text-[11px] font-medium", bmiColorClass)}>
              BMI: {bmi} ({bmiCategory})
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground dark:text-muted-foreground">
              Height (ft)
            </Label>
            <Select
              value={data.heightFeet.toString()}
              onValueChange={(value) =>
                onChange({ heightFeet: parseInt(value) })
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[3, 4, 5, 6, 7].map((ft) => (
                  <SelectItem key={ft} value={ft.toString()}>
                    {ft} ft
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground dark:text-muted-foreground">
              Height (in)
            </Label>
            <Select
              value={data.heightInches.toString()}
              onValueChange={(value) =>
                onChange({ heightInches: parseInt(value) })
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((inch) => (
                  <SelectItem key={inch} value={inch.toString()}>
                    {inch} in
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label
              htmlFor="weight"
              className="text-[11px] text-muted-foreground dark:text-muted-foreground"
            >
              Weight (lbs)
            </Label>
            <Input
              id="weight"
              type="number"
              min={50}
              max={600}
              value={data.weight || ""}
              onChange={(e) =>
                onChange({ weight: parseInt(e.target.value) || 0 })
              }
              className={cn(
                "h-8 text-sm",
                errors.weight && "border-destructive",
              )}
            />
            {errors.weight && (
              <p className="text-[10px] text-destructive mt-0.5">
                {errors.weight}
              </p>
            )}
          </div>
        </div>

        {errors.height && (
          <p className="text-[10px] text-destructive mt-1">{errors.height}</p>
        )}
      </div>
    </div>
  );
}
