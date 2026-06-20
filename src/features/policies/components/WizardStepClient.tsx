// src/features/policies/components/WizardStepClient.tsx

import React from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateOfBirthInput } from "@/components/ui/date-of-birth-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { US_STATES } from "@/constants/states";
import { NewPolicyForm } from "../../../types/policy.types";
import { WizardStepIntro } from "./WizardStepIntro";
import { FIELD, LABEL, ERROR_TEXT, fieldClass } from "./policyFormStyles";

interface WizardStepClientProps {
  formData: NewPolicyForm;
  displayErrors: Record<string, string>;
  showContactDetails: boolean;
  onShowContactDetailsChange: (show: boolean) => void;
  onInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  onSelectChange: (name: string, value: string) => void;
  onPhoneChange: (value: string) => void;
  onDOBChange: (value: string) => void;
}

/** Step 1 of the wizard — who the policy is for. */
export const WizardStepClient: React.FC<WizardStepClientProps> = ({
  formData,
  displayErrors,
  showContactDetails,
  onShowContactDetailsChange,
  onInputChange,
  onSelectChange,
  onPhoneChange,
  onDOBChange,
}) => {
  return (
    <div className="space-y-5">
      <WizardStepIntro title="Who's the policy for?">
        Start with the client's name and a couple of identifying details.
      </WizardStepIntro>

      <div className="space-y-1.5">
        <Label htmlFor="clientName" className={LABEL}>
          Client name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="clientName"
          type="text"
          name="clientName"
          value={formData.clientName}
          onChange={onInputChange}
          className={fieldClass(!!displayErrors.clientName)}
          placeholder="John Smith"
        />
        {displayErrors.clientName && (
          <span className={ERROR_TEXT}>{displayErrors.clientName}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="clientState" className={LABEL}>
            State <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formData.clientState}
            onValueChange={(value) => onSelectChange("clientState", value)}
          >
            <SelectTrigger
              id="clientState"
              className={fieldClass(!!displayErrors.clientState)}
            >
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map((state) => (
                <SelectItem key={state.value} value={state.value}>
                  {state.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {displayErrors.clientState && (
            <span className={ERROR_TEXT}>{displayErrors.clientState}</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="clientDOB" className={LABEL}>
            Date of birth <span className="text-destructive">*</span>
          </Label>
          <DateOfBirthInput
            id="clientDOB"
            name="clientDOB"
            value={formData.clientDOB}
            onChange={onDOBChange}
            error={!!displayErrors.clientDOB}
            className={FIELD}
          />
          {displayErrors.clientDOB && (
            <span className={ERROR_TEXT}>{displayErrors.clientDOB}</span>
          )}
        </div>
      </div>

      <Collapsible
        open={showContactDetails}
        onOpenChange={onShowContactDetailsChange}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs font-medium text-accent transition-colors hover:text-accent/80"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${showContactDetails ? "rotate-180" : ""}`}
            />
            Additional client details
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="clientEmail" className={LABEL}>
                Email
              </Label>
              <Input
                id="clientEmail"
                type="email"
                name="clientEmail"
                value={formData.clientEmail || ""}
                onChange={onInputChange}
                className={FIELD}
                placeholder="client@email.com"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="clientPhone" className={LABEL}>
                Phone
              </Label>
              <Input
                id="clientPhone"
                type="tel"
                inputMode="tel"
                name="clientPhone"
                value={formData.clientPhone || ""}
                onChange={(e) => onPhoneChange(e.target.value)}
                className={FIELD}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="clientStreet" className={LABEL}>
              Street address
            </Label>
            <Input
              id="clientStreet"
              type="text"
              name="clientStreet"
              value={formData.clientStreet || ""}
              onChange={onInputChange}
              className={FIELD}
              placeholder="123 Main St"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="clientCity" className={LABEL}>
                City
              </Label>
              <Input
                id="clientCity"
                type="text"
                name="clientCity"
                value={formData.clientCity || ""}
                onChange={onInputChange}
                className={FIELD}
                placeholder="Anytown"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="clientZipCode" className={LABEL}>
                Zip code
              </Label>
              <Input
                id="clientZipCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                name="clientZipCode"
                value={formData.clientZipCode || ""}
                onChange={onInputChange}
                className={FIELD}
                placeholder="12345"
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
