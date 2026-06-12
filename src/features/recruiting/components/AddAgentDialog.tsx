// src/features/recruiting/components/AddAgentDialog.tsx
// "Add Agent" — for someone who is ALREADY a licensed agent and just needs to
// exist in the app on the adding user's team (upline = the adder), skipping all
// onboarding pipelines. Distinct from "Add Recruit" (runs a pipeline) and "Add
// Prospect" (a lightweight contact with no account). Available to ordinary Epic
// Life agents; the create-auth-user edge function enforces the safe envelope
// (role=agent, no pipeline, no self-set compensation, immediately active).

import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PillButton } from "@/components/v2";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon, Loader2 } from "lucide-react";
import {
  useCreateRecruit,
  useCheckEmailExists,
} from "../hooks/useRecruitMutations";
import { useAuth } from "@/contexts/AuthContext";
import { US_STATES } from "@/constants/states";

const addAgentSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  resident_state: z.string().optional(),
});

const getErrorMessage = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- form error shape
  errors: any[],
): string => {
  if (!errors || errors.length === 0) return "";
  return errors
    .map((err) => (typeof err === "string" ? err : err?.message || String(err)))
    .join(", ");
};

interface AddAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the newly created agent's user id on success. */
  onSuccess?: (agentId: string) => void;
}

export function AddAgentDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddAgentDialogProps) {
  const { user } = useAuth();
  const createRecruitMutation = useCreateRecruit();
  const checkEmailMutation = useCheckEmailExists();

  const form = useForm({
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      resident_state: "",
    },
    onSubmit: async ({ value }) => {
      if (!user?.id) return;

      const emailCheck = await checkEmailMutation.mutateAsync(value.email);
      if (emailCheck.exists) {
        toast.error(`A user with email ${value.email} already exists.`);
        return;
      }

      // No assignment fields are sent: the create-auth-user edge function
      // authoritatively derives imo/agency and forces upline = the caller for
      // the Add-Agent shape, so the client must not supply them.
      const created = await createRecruitMutation.mutateAsync({
        first_name: value.first_name,
        last_name: value.last_name,
        email: value.email,
        phone: value.phone || undefined,
        resident_state: value.resident_state || undefined,
        state: value.resident_state || undefined,
        agent_status: "licensed",
        skip_pipeline: true,
        roles: ["agent"],
        is_admin: false,
      });

      if (created) {
        onOpenChange(false);
        form.reset();
        onSuccess?.(created.id);
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add agent</DialogTitle>
          <DialogDescription>
            Add someone who is already a licensed agent directly onto your team.
            They skip the onboarding pipelines and get a welcome email to set
            their password.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
          className="space-y-4"
        >
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription className="text-xs">
              You&apos;ll be set as this agent&apos;s upline. Contract/comp
              level is set later by an admin.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-3">
            <form.Field
              name="first_name"
              validators={{ onChange: addAgentSchema.shape.first_name }}
            >
              {(field) => (
                <div className="space-y-1.5">
                  <Label htmlFor="agent-first-name">First name *</Label>
                  <Input
                    id="agent-first-name"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="Jane"
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-xs text-destructive">
                      {getErrorMessage(field.state.meta.errors)}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field
              name="last_name"
              validators={{ onChange: addAgentSchema.shape.last_name }}
            >
              {(field) => (
                <div className="space-y-1.5">
                  <Label htmlFor="agent-last-name">Last name *</Label>
                  <Input
                    id="agent-last-name"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="Doe"
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-xs text-destructive">
                      {getErrorMessage(field.state.meta.errors)}
                    </p>
                  )}
                </div>
              )}
            </form.Field>
          </div>

          <form.Field
            name="email"
            validators={{ onChange: addAgentSchema.shape.email }}
          >
            {(field) => (
              <div className="space-y-1.5">
                <Label htmlFor="agent-email">Email *</Label>
                <Input
                  id="agent-email"
                  type="email"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="jane.doe@example.com"
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-xs text-destructive">
                    {getErrorMessage(field.state.meta.errors)}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <div className="grid grid-cols-2 gap-3">
            <form.Field name="phone">
              {(field) => (
                <div className="space-y-1.5">
                  <Label htmlFor="agent-phone">Phone</Label>
                  <Input
                    id="agent-phone"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="(555) 123-4567"
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="resident_state">
              {(field) => (
                <div className="space-y-1.5">
                  <Label htmlFor="agent-state">Resident state</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange(v)}
                  >
                    <SelectTrigger id="agent-state">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>
          </div>

          <DialogFooter>
            <PillButton
              type="button"
              tone="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </PillButton>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <PillButton
                  type="submit"
                  tone="black"
                  size="sm"
                  disabled={isSubmitting}
                >
                  {isSubmitting && (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  )}
                  Add agent
                </PillButton>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
