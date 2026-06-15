// src/features/messages/components/instagram/templates/TemplateForm.tsx
// Sheet form for creating and editing Instagram message templates

import { useEffect, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
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
import { T } from "@/components/board/tokens";

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

const LABEL_STYLE: React.CSSProperties = {
  font: `700 10px ${T.mono}`,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: T.mut2,
  display: "block",
  marginBottom: 6,
};

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  background: T.surface2,
  border: `1px solid ${T.line2}`,
  borderRadius: 8,
  padding: "0 12px",
  height: 36,
  font: `500 13px ${T.data}`,
  color: T.ink,
  outline: "none",
  boxSizing: "border-box",
};

const SELECT_TRIGGER_STYLE: React.CSSProperties = {
  width: "100%",
  background: T.surface2,
  border: `1px solid ${T.line2}`,
  borderRadius: 8,
  padding: "0 12px",
  height: 36,
  font: `500 13px ${T.data}`,
  color: T.ink,
};

const MUT3 = "rgba(255,255,255,0.28)";

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
    const resolveCategoryValue = (category: string | null): string => {
      if (!category) return "";

      if (
        isCustomCategory(category) ||
        BUILT_IN_PROSPECT_TYPES.includes(category as never)
      ) {
        return category;
      }

      const legacyMatch = customCategories.find((c) => c.name === category);
      if (legacyMatch) {
        return createCustomCategoryValue(legacyMatch.id);
      }

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
      <SheetContent
        className="w-[400px] sm:w-[540px]"
        style={{
          background: T.surface7,
          border: `1px solid ${T.line2}`,
          borderLeft: `1px solid ${T.line2}`,
          fontFamily: T.data,
          color: T.ink,
          padding: "24px 24px 20px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <SheetHeader style={{ marginBottom: 0 }}>
          <SheetTitle
            style={{
              font: `800 16px ${T.disp}`,
              color: T.cream,
              letterSpacing: "0.01em",
            }}
          >
            {isEditing ? "Edit Template" : "New Template"}
          </SheetTitle>
          <SheetDescription
            style={{
              font: `500 12px/1.4 ${T.data}`,
              color: T.mut2,
              marginTop: 4,
            }}
          >
            {isEditing
              ? "Update your message template"
              : "Create a new message template for quick responses"}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            style={{
              marginTop: 24,
              display: "flex",
              flexDirection: "column",
              gap: 18,
              flex: 1,
            }}
          >
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <label style={LABEL_STYLE}>Name</label>
                  <FormControl>
                    <input
                      {...field}
                      placeholder="e.g., Licensed Agent Opener"
                      style={INPUT_STYLE}
                    />
                  </FormControl>
                  <FormMessage
                    style={{
                      font: `500 11px ${T.data}`,
                      color: T.red,
                      marginTop: 4,
                    }}
                  />
                </FormItem>
              )}
            />

            {/* Content */}
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}
                  >
                    <label style={{ ...LABEL_STYLE, marginBottom: 0 }}>
                      Content
                    </label>
                    <span
                      style={{
                        font: `700 10px ${T.mono}`,
                        color:
                          contentLength > MAX_CONTENT_LENGTH
                            ? T.red
                            : contentLength > MAX_CONTENT_LENGTH * 0.9
                              ? T.amber
                              : T.mut2,
                        letterSpacing: "0.06em",
                      }}
                    >
                      {contentLength}/{MAX_CONTENT_LENGTH}
                    </span>
                  </div>
                  <FormControl>
                    <textarea
                      {...field}
                      placeholder="Enter your message template..."
                      rows={6}
                      style={{
                        ...INPUT_STYLE,
                        height: "auto",
                        padding: "10px 12px",
                        resize: "none",
                        lineHeight: "1.55",
                      }}
                    />
                  </FormControl>
                  <FormMessage
                    style={{
                      font: `500 11px ${T.data}`,
                      color: T.red,
                      marginTop: 4,
                    }}
                  />
                </FormItem>
              )}
            />

            {/* Prospect Type */}
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <label style={LABEL_STYLE}>Prospect Type</label>
                  <Select
                    value={field.value || ""}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger style={SELECT_TRIGGER_STYLE}>
                        <SelectValue placeholder="Select prospect type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent
                      style={{
                        background: T.surface5,
                        border: `1px solid ${T.line2}`,
                        borderRadius: 10,
                      }}
                    >
                      <SelectItem
                        value=""
                        style={{ font: `500 13px ${T.data}`, color: T.mut }}
                      >
                        None
                      </SelectItem>
                      {BUILT_IN_PROSPECT_TYPES.map((type) => (
                        <SelectItem
                          key={type}
                          value={type}
                          style={{ font: `500 13px ${T.data}`, color: T.ink }}
                        >
                          {PROSPECT_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                      {customCategories.length > 0 && (
                        <>
                          <div
                            style={{
                              padding: "8px 10px 4px",
                              font: `700 10px ${T.mono}`,
                              letterSpacing: "0.16em",
                              textTransform: "uppercase",
                              color: MUT3,
                            }}
                          >
                            Custom
                          </div>
                          {customCategories.map((cat) => (
                            <SelectItem
                              key={cat.id}
                              value={createCustomCategoryValue(cat.id)}
                              style={{
                                font: `500 13px ${T.data}`,
                                color: T.ink,
                              }}
                            >
                              {cat.name}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage
                    style={{
                      font: `500 11px ${T.data}`,
                      color: T.red,
                      marginTop: 4,
                    }}
                  />
                </FormItem>
              )}
            />

            {/* Message Stage */}
            <FormField
              control={form.control}
              name="message_stage"
              render={({ field }) => (
                <FormItem>
                  <label style={LABEL_STYLE}>Message Stage</label>
                  <Select
                    value={field.value || "opener"}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger style={SELECT_TRIGGER_STYLE}>
                        <SelectValue placeholder="Select stage" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent
                      style={{
                        background: T.surface5,
                        border: `1px solid ${T.line2}`,
                        borderRadius: 10,
                      }}
                    >
                      {Object.entries(MESSAGE_STAGE_LABELS).map(
                        ([value, label]) => (
                          <SelectItem
                            key={value}
                            value={value}
                            style={{ font: `500 13px ${T.data}`, color: T.ink }}
                          >
                            {label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage
                    style={{
                      font: `500 11px ${T.data}`,
                      color: T.red,
                      marginTop: 4,
                    }}
                  />
                </FormItem>
              )}
            />

            {/* Footer buttons */}
            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                marginTop: "auto",
                paddingTop: 8,
              }}
            >
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                style={{
                  height: 34,
                  padding: "0 16px",
                  borderRadius: 8,
                  background: "transparent",
                  border: `1px solid ${T.line2}`,
                  color: T.mut,
                  font: `600 12px ${T.data}`,
                  cursor: "pointer",
                  opacity: isPending ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                style={{
                  height: 34,
                  padding: "0 18px",
                  borderRadius: 8,
                  background: T.violet,
                  border: "none",
                  color: "#1a0f33",
                  font: `700 12px ${T.data}`,
                  cursor: isPending ? "not-allowed" : "pointer",
                  opacity: isPending ? 0.7 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                {isPending && (
                  <Loader2
                    style={{
                      width: 13,
                      height: 13,
                      animation: "spin 1s linear infinite",
                    }}
                  />
                )}
                {isEditing ? "Save Changes" : "Create Template"}
              </button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
