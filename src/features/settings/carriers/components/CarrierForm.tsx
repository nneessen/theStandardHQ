// src/features/settings/carriers/components/CarrierForm.tsx
// Redesigned with zinc palette and compact design patterns

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Carrier } from "../hooks/useCarriers";
import { useImo } from "@/contexts/ImoContext";
import {
  CARRIER_CONTRACTING_METHOD_LABEL,
  parseCarrierContractingInstructions,
  type CarrierContractingInstructions,
  type CarrierContractingMethod,
  type NewCarrierForm,
} from "@/types/carrier.types";

const CONTRACTING_METHODS: CarrierContractingMethod[] = [
  "surelc",
  "email",
  "portal",
  "paper",
  "other",
];
const METHOD_NONE = "__none__";

const carrierFormSchema = z.object({
  name: z
    .string()
    .min(1, "Carrier name is required")
    .max(100, "Name is too long"),
  code: z.string().max(50, "Code is too long").optional().or(z.literal("")),
  is_active: z.boolean(),
  imo_id: z.string().optional(),
  advance_cap: z
    .number()
    .positive("Must be a positive number")
    .optional()
    .nullable(),
  contracting_metadata: z
    .object({
      method: z.string().optional(),
      instructions: z.string().max(4000).optional(),
      portal_url: z.string().max(500).optional(),
      contact_email: z.string().max(200).optional(),
      processing_time_days: z
        .number()
        .int()
        .positive()
        .max(365)
        .optional()
        .nullable(),
    })
    .optional(),
});

type CarrierFormValues = z.infer<typeof carrierFormSchema>;

interface CarrierFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carrier?: Carrier | null;
  onSubmit: (data: NewCarrierForm) => void;
  isSubmitting?: boolean;
  defaultImoId?: string;
}

export function CarrierForm({
  open,
  onOpenChange,
  carrier,
  onSubmit,
  isSubmitting = false,
  defaultImoId,
}: CarrierFormProps) {
  // The carrier is always created in the currently-selected (effective) IMO —
  // there is a single IMO selector (the sidebar switcher), so no per-form IMO
  // picker. RLS WITH CHECK enforces imo_id = the acting IMO anyway.
  const { isSuperAdmin, imo } = useImo();

  const form = useForm<CarrierFormValues>({
    resolver: zodResolver(carrierFormSchema),
    defaultValues: {
      name: "",
      code: undefined,
      is_active: true,
      imo_id: undefined,
      advance_cap: undefined,
      contracting_metadata: {
        method: undefined,
        instructions: "",
        portal_url: "",
        contact_email: "",
        processing_time_days: undefined,
      },
    },
  });

  // Reset form when carrier changes or sheet opens/closes
  useEffect(() => {
    if (carrier) {
      const ci =
        parseCarrierContractingInstructions(carrier.contracting_metadata) ?? {};
      form.reset({
        name: carrier.name || "",
        code: carrier.code || undefined,
        is_active: carrier.is_active ?? true,
        imo_id: carrier.imo_id || undefined,
        advance_cap: carrier.advance_cap ?? undefined,
        contracting_metadata: {
          method: ci.method,
          instructions: ci.instructions ?? "",
          portal_url: ci.portal_url ?? "",
          contact_email: ci.contact_email ?? "",
          processing_time_days: ci.processing_time_days ?? undefined,
        },
      });
    } else {
      form.reset({
        name: "",
        code: undefined,
        is_active: true,
        // Default to the selected Settings IMO first, then user's IMO.
        imo_id: defaultImoId || imo?.id || undefined,
        advance_cap: undefined,
        contracting_metadata: {
          method: undefined,
          instructions: "",
          portal_url: "",
          contact_email: "",
          processing_time_days: undefined,
        },
      });
    }
  }, [carrier, open, form, defaultImoId, imo?.id]);

  const handleSubmit = (data: CarrierFormValues) => {
    if (isSuperAdmin && !data.imo_id) {
      form.setError("imo_id", {
        type: "required",
        message: "IMO is required",
      });
      return;
    }

    // Normalize contracting instructions: drop empties, validate method, null if all empty.
    const cm = data.contracting_metadata;
    const normalized: CarrierContractingInstructions = {};
    if (cm) {
      if (
        cm.method &&
        CONTRACTING_METHODS.includes(cm.method as CarrierContractingMethod)
      ) {
        normalized.method = cm.method as CarrierContractingMethod;
      }
      if (cm.instructions?.trim())
        normalized.instructions = cm.instructions.trim();
      if (cm.portal_url?.trim()) normalized.portal_url = cm.portal_url.trim();
      if (cm.contact_email?.trim())
        normalized.contact_email = cm.contact_email.trim();
      if (
        typeof cm.processing_time_days === "number" &&
        cm.processing_time_days > 0
      ) {
        normalized.processing_time_days = cm.processing_time_days;
      }
    }

    onSubmit({
      name: data.name,
      code: data.code || undefined,
      is_active: data.is_active,
      imo_id: data.imo_id || undefined,
      advance_cap: data.advance_cap ?? null,
      contracting_metadata:
        Object.keys(normalized).length > 0 ? normalized : null,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md p-3 bg-card border-border">
        <SheetHeader className="space-y-1 pb-3 border-b border-border/60">
          <SheetTitle className="text-sm font-semibold text-foreground">
            {carrier ? "Edit Carrier" : "Add New Carrier"}
          </SheetTitle>
          <SheetDescription className="text-[10px] text-muted-foreground">
            {carrier
              ? "Update carrier information. Changes will affect all associated products."
              : "Create a new insurance carrier. You can add products to this carrier later."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-3 py-3"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    Carrier Name *
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Foresters Financial"
                      {...field}
                      value={field.value || ""}
                      className="h-7 text-[11px] bg-card border-border"
                    />
                  </FormControl>
                  <FormDescription className="text-[10px] text-muted-foreground">
                    The official name of the insurance carrier
                  </FormDescription>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    Code (Optional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., FRST"
                      {...field}
                      value={field.value || ""}
                      className="h-7 text-[11px] bg-card border-border"
                    />
                  </FormControl>
                  <FormDescription className="text-[10px] text-muted-foreground">
                    A short code or acronym for display purposes
                  </FormDescription>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="advance_cap"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    Advance Cap (Optional)
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[11px]">
                        $
                      </span>
                      <Input
                        type="number"
                        placeholder="No cap"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          field.onChange(
                            value === "" ? null : parseFloat(value),
                          );
                        }}
                        className="h-7 pl-5 text-[11px] bg-card border-border"
                      />
                    </div>
                  </FormControl>
                  <FormDescription className="text-[10px] text-muted-foreground">
                    Maximum advance per policy. Leave empty for no cap.
                  </FormDescription>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-2">
                  <div className="space-y-0.5">
                    <FormLabel className="text-[11px] font-medium text-foreground">
                      Active Status
                    </FormLabel>
                    <FormDescription className="text-[10px] text-muted-foreground">
                      Inactive carriers won't appear in dropdowns
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="h-4 w-4"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Per-carrier contracting instructions ("what to expect") */}
            <div className="space-y-2.5 rounded-lg border border-border p-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Contracting instructions
              </div>
              <p className="-mt-1 text-[10px] text-muted-foreground">
                Shown to agents on the Contracting page so they know how to
                contract this carrier (e.g. via SureLC vs. emailed
                instructions).
              </p>

              <FormField
                control={form.control}
                name="contracting_metadata.method"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      How to contract
                    </FormLabel>
                    <Select
                      value={field.value || METHOD_NONE}
                      onValueChange={(v) =>
                        field.onChange(v === METHOD_NONE ? undefined : v)
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="h-7 text-[11px] bg-card border-border">
                          <SelectValue placeholder="Not specified" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={METHOD_NONE} className="text-[11px]">
                          Not specified
                        </SelectItem>
                        {CONTRACTING_METHODS.map((m) => (
                          <SelectItem key={m} value={m} className="text-[11px]">
                            {CARRIER_CONTRACTING_METHOD_LABEL[m]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contracting_metadata.instructions"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      Instructions
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Submit through SureLC; the carrier emails your writing number in 3–5 business days."
                        {...field}
                        value={field.value || ""}
                        className="min-h-[56px] resize-none text-[11px] bg-card border-border"
                      />
                    </FormControl>
                    <FormDescription className="text-[10px] text-muted-foreground">
                      What the agent should expect or do. Agents are also
                      reminded to ask their upline if unsure before submitting.
                    </FormDescription>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contracting_metadata.portal_url"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      Portal URL (Optional)
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://…"
                        {...field}
                        value={field.value || ""}
                        className="h-7 text-[11px] bg-card border-border"
                      />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contracting_metadata.contact_email"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      Contracting Contact Email (Optional)
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="contracting@carrier.com"
                        {...field}
                        value={field.value || ""}
                        className="h-7 text-[11px] bg-card border-border"
                      />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contracting_metadata.processing_time_days"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      Typical Processing Time (Days, Optional)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="e.g., 5"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          field.onChange(v === "" ? null : parseInt(v, 10));
                        }}
                        className="h-7 w-24 text-[11px] bg-card border-border"
                      />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )}
              />
            </div>

            <SheetFooter className="gap-1 pt-3 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="h-7 px-2 text-[10px] border-border"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="h-7 px-2 text-[10px]"
              >
                {isSubmitting
                  ? "Saving..."
                  : carrier
                    ? "Update Carrier"
                    : "Create Carrier"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
