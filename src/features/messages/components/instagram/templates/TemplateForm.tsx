// src/features/messages/components/instagram/templates/TemplateForm.tsx
// Sheet form for creating and editing Instagram message templates

import { useEffect, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  useCreateInstagramTemplate,
  useUpdateInstagramTemplate,
  useInstagramTemplateCategories,
} from "@/hooks";
import {
  PROSPECT_TYPE_LABELS,
  MESSAGE_STAGE_LABELS,
  BUILT_IN_PROSPECT_TYPES,
  createCustomCategoryValue,
  isCustomCategory,
  type InstagramMessageTemplate,
} from "@/types/instagram.types";

const MAX_CONTENT_LENGTH = 1000;

const templateFormSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less"),
  content: z
    .string()
    .min(1, "Content is required")
    .max(
      MAX_CONTENT_LENGTH,
      `Content must be ${MAX_CONTENT_LENGTH} characters or less`,
    ),
  category: z.string().optional(),
  message_stage: z.string().optional(),
});

type TemplateFormValues = z.infer<typeof templateFormSchema>;

interface TemplateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: InstagramMessageTemplate | null;
}

export function TemplateForm({
  open,
  onOpenChange,
  template,
}: TemplateFormProps): ReactNode {
  const createMutation = useCreateInstagramTemplate();
  const updateMutation = useUpdateInstagramTemplate();
  const { data: customCategories = [] } = useInstagramTemplateCategories();

  const isEditing = !!template;

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: "",
      content: "",
      category: "",
      message_stage: "opener",
    },
  });

  // Reset form when template changes
  useEffect(() => {
    // Helper to resolve legacy category names to new format
    const resolveCategoryValue = (category: string | null): string => {
      if (!category) return "";

      // Already in new format or built-in type
      if (
        isCustomCategory(category) ||
        BUILT_IN_PROSPECT_TYPES.includes(category as never)
      ) {
        return category;
      }

      // Legacy format: stored by name - find matching custom category
      const legacyMatch = customCategories.find((c) => c.name === category);
      if (legacyMatch) {
        return createCustomCategoryValue(legacyMatch.id);
      }

      // Unknown category, return as-is
      return category;
    };

    if (open) {
      if (template) {
        form.reset({
          name: template.name,
          content: template.content,
          category: resolveCategoryValue(template.category),
          message_stage: template.message_stage || "opener",
        });
      } else {
        form.reset({
          name: "",
          content: "",
          category: "",
          message_stage: "opener",
        });
      }
    }
  }, [template, open, form, customCategories]);

  const handleSubmit = async (data: TemplateFormValues) => {
    try {
      if (isEditing && template) {
        await updateMutation.mutateAsync({
          templateId: template.id,
          updates: {
            name: data.name,
            content: data.content,
            category: data.category || undefined,
            message_stage: data.message_stage || "opener",
          },
        });
        toast.success("Template updated");
      } else {
        await createMutation.mutateAsync({
          name: data.name,
          content: data.content,
          category: data.category || undefined,
          message_stage: data.message_stage || "opener",
        });
        toast.success("Template created");
      }
      onOpenChange(false);
    } catch (error) {
      console.error("[IG template] save failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(
        isEditing
          ? `Couldn't update template: ${message}`
          : `Couldn't create template: ${message}`,
      );
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const contentLength = form.watch("content")?.length || 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="text-[13px]">
            {isEditing ? "Edit Template" : "New Template"}
          </SheetTitle>
          <SheetDescription className="text-[11px]">
            {isEditing
              ? "Update your message template"
              : "Create a new message template for quick responses"}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="mt-4 space-y-4"
          >
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px]">Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., Licensed Agent Opener"
                      className="h-8 text-[11px]"
                    />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )}
            />

            {/* Content */}
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-[11px]">Content</FormLabel>
                    <span
                      className={`text-[10px] ${
                        contentLength > MAX_CONTENT_LENGTH
                          ? "text-destructive"
                          : contentLength > MAX_CONTENT_LENGTH * 0.9
                            ? "text-warning"
                            : "text-muted-foreground"
                      }`}
                    >
                      {contentLength}/{MAX_CONTENT_LENGTH}
                    </span>
                  </div>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Enter your message template..."
                      className="h-32 text-[11px] resize-none"
                    />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )}
            />

            {/* Prospect Type */}
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px]">Prospect Type</FormLabel>
                  <Select
                    value={field.value || ""}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className="h-8 text-[11px]">
                        <SelectValue placeholder="Select prospect type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="" className="text-[11px]">
                        None
                      </SelectItem>
                      {/* Built-in types */}
                      {BUILT_IN_PROSPECT_TYPES.map((type) => (
                        <SelectItem
                          key={type}
                          value={type}
                          className="text-[11px]"
                        >
                          {PROSPECT_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                      {/* Custom categories */}
                      {customCategories.length > 0 && (
                        <>
                          <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                            Custom
                          </div>
                          {customCategories.map((cat) => (
                            <SelectItem
                              key={cat.id}
                              value={createCustomCategoryValue(cat.id)}
                              className="text-[11px]"
                            >
                              {cat.name}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )}
            />

            {/* Message Stage */}
            <FormField
              control={form.control}
              name="message_stage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px]">Message Stage</FormLabel>
                  <Select
                    value={field.value || "opener"}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className="h-8 text-[11px]">
                        <SelectValue placeholder="Select stage" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(MESSAGE_STAGE_LABELS).map(
                        ([value, label]) => (
                          <SelectItem
                            key={value}
                            value={value}
                            className="text-[11px]"
                          >
                            {label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )}
            />

            <SheetFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                className="h-8 text-[11px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="h-8 text-[11px]"
              >
                {isPending && (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                )}
                {isEditing ? "Save Changes" : "Create Template"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
