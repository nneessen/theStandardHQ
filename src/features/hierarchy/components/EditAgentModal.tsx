// src/features/hierarchy/components/EditAgentModal.tsx

import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { hierarchyKeys, invalidateHierarchyForNode } from "@/hooks";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// eslint-disable-next-line no-restricted-imports
import { supabase } from "@/services/base/supabase";
import { toast } from "sonner";
import type { UserProfile } from "@/types/hierarchy.types";

interface EditAgentModalProps {
  agent: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EditAgentModal({
  agent,
  isOpen,
  onClose,
}: EditAgentModalProps) {
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: {
      first_name: agent?.first_name || "",
      last_name: agent?.last_name || "",
      phone: agent?.phone || "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- agent data type
      state: (agent as any)?.state || "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- agent data type
      license_number: (agent as any)?.license_number || "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- agent data type
      contract_level: (agent as any)?.contract_level || 100,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- agent data type
      npn: (agent as any)?.npn || "",
    },
    onSubmit: async ({ value }) => {
      if (!agent) return;

      try {
        const { error } = await supabase
          .from("user_profiles")
          .update({
            first_name: value.first_name,
            last_name: value.last_name,
            phone: value.phone,
            state: value.state,
            license_number: value.license_number,
            contract_level: value.contract_level,
            npn: value.npn,
            updated_at: new Date().toISOString(),
          })
          .eq("id", agent.id);

        if (error) throw error;

        toast.success("Agent profile updated successfully");
        queryClient.invalidateQueries({
          queryKey: hierarchyKeys.rollup(agent.id, undefined, "agent-details"),
        });
        invalidateHierarchyForNode(queryClient, agent.id);
        // useMyDownlines is keyed by "me", not the downline's id, so the
        // node-scoped helper above won't match it. Invalidate the whole
        // hierarchy family so the parent table reflects the saved values.
        queryClient.invalidateQueries({ queryKey: ["hierarchy"] });
        onClose();
      } catch (error) {
        console.error("Error updating agent:", error);
        toast.error("Failed to update agent profile");
      }
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Edit Agent Profile</DialogTitle>
          <DialogDescription className="text-xs">
            Update agent information and contract details
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="first_name" className="text-xs">
                First Name
              </Label>
              <form.Field name="first_name">
                {(field) => (
                  <Input
                    id="first_name"
                    className="h-8 text-xs"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
              </form.Field>
            </div>

            <div className="space-y-1">
              <Label htmlFor="last_name" className="text-xs">
                Last Name
              </Label>
              <form.Field name="last_name">
                {(field) => (
                  <Input
                    id="last_name"
                    className="h-8 text-xs"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
              </form.Field>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="phone" className="text-xs">
                Phone
              </Label>
              <form.Field name="phone">
                {(field) => (
                  <Input
                    id="phone"
                    type="tel"
                    className="h-8 text-xs"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
              </form.Field>
            </div>

            <div className="space-y-1">
              <Label htmlFor="state" className="text-xs">
                State
              </Label>
              <form.Field name="state">
                {(field) => (
                  <Input
                    id="state"
                    className="h-8 text-xs"
                    maxLength={2}
                    value={field.state.value}
                    onChange={(e) =>
                      field.handleChange(e.target.value.toUpperCase())
                    }
                  />
                )}
              </form.Field>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="license_number" className="text-xs">
                License Number
              </Label>
              <form.Field name="license_number">
                {(field) => (
                  <Input
                    id="license_number"
                    className="h-8 text-xs"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
              </form.Field>
            </div>

            <div className="space-y-1">
              <Label htmlFor="npn" className="text-xs">
                NPN
              </Label>
              <form.Field name="npn">
                {(field) => (
                  <Input
                    id="npn"
                    className="h-8 text-xs"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
              </form.Field>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="contract_level" className="text-xs">
              Contract Level (%)
            </Label>
            <form.Field name="contract_level">
              {(field) => (
                <Select
                  value={String(field.state.value)}
                  onValueChange={(value) => field.handleChange(Number(value))}
                >
                  <SelectTrigger id="contract_level" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100" className="text-xs">
                      100%
                    </SelectItem>
                    <SelectItem value="105" className="text-xs">
                      105%
                    </SelectItem>
                    <SelectItem value="110" className="text-xs">
                      110%
                    </SelectItem>
                    <SelectItem value="115" className="text-xs">
                      115%
                    </SelectItem>
                    <SelectItem value="120" className="text-xs">
                      120%
                    </SelectItem>
                    <SelectItem value="125" className="text-xs">
                      125%
                    </SelectItem>
                    <SelectItem value="130" className="text-xs">
                      130%
                    </SelectItem>
                    <SelectItem value="135" className="text-xs">
                      135%
                    </SelectItem>
                    <SelectItem value="140" className="text-xs">
                      140%
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </form.Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
