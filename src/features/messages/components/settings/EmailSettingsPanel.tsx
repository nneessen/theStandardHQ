// src/features/messages/components/settings/EmailSettingsPanel.tsx
// Email messaging settings - digest preferences

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Save, Mail, Clock } from "lucide-react";
import { toast } from "sonner";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/hooks/alerts";
import {
  TIMEZONE_OPTIONS,
  DIGEST_FREQUENCY_OPTIONS,
} from "@/types/alert-rules.types";

const emailSettingsSchema = z.object({
  email_digest_enabled: z.boolean(),
  email_digest_frequency: z.string(),
  email_digest_time: z.string(),
  email_digest_timezone: z.string(),
});

type EmailSettingsFormData = z.infer<typeof emailSettingsSchema>;

// Time options for digest delivery
const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, "0");
  const label =
    i === 0
      ? "12:00 AM"
      : i < 12
        ? `${i}:00 AM`
        : i === 12
          ? "12:00 PM"
          : `${i - 12}:00 PM`;
  return { value: `${hour}:00:00`, label };
});

export function EmailSettingsPanel() {
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();

  const form = useForm<EmailSettingsFormData>({
    resolver: zodResolver(emailSettingsSchema),
    defaultValues: {
      email_digest_enabled: false,
      email_digest_frequency: "daily",
      email_digest_time: "09:00:00",
      email_digest_timezone: "America/New_York",
    },
  });

  // Update form when preferences load
  useEffect(() => {
    if (preferences) {
      form.reset({
        email_digest_enabled: preferences.email_digest_enabled ?? false,
        email_digest_frequency: preferences.email_digest_frequency ?? "daily",
        email_digest_time: preferences.email_digest_time ?? "09:00:00",
        email_digest_timezone:
          preferences.email_digest_timezone ?? "America/New_York",
      });
    }
  }, [preferences, form]);

  const onSubmit = async (data: EmailSettingsFormData) => {
    try {
      await updatePreferences.mutateAsync({
        email_digest_enabled: data.email_digest_enabled,
        email_digest_frequency: data.email_digest_frequency,
        email_digest_time: data.email_digest_time,
        email_digest_timezone: data.email_digest_timezone,
      });
      toast.success("Email settings saved");
    } catch {
      toast.error("Failed to save email settings");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const digestEnabled = form.watch("email_digest_enabled");

  return (
    <div className="space-y-4 max-w-2xl">
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            Email Digest Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Enable Digest */}
              <FormField
                control={form.control}
                name="email_digest_enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <FormLabel className="text-[11px] font-medium">
                        Email Digest
                      </FormLabel>
                      <FormDescription className="text-[10px]">
                        Receive a summary of your messages and activity
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {digestEnabled && (
                <>
                  {/* Frequency */}
                  <FormField
                    control={form.control}
                    name="email_digest_frequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px]">Frequency</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-8 text-[11px]">
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DIGEST_FREQUENCY_OPTIONS.map((opt) => (
                              <SelectItem
                                key={opt.value}
                                value={opt.value}
                                className="text-[11px]"
                              >
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  {/* Delivery Time */}
                  <FormField
                    control={form.control}
                    name="email_digest_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Delivery Time
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-8 text-[11px]">
                              <SelectValue placeholder="Select time" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TIME_OPTIONS.map((opt) => (
                              <SelectItem
                                key={opt.value}
                                value={opt.value}
                                className="text-[11px]"
                              >
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  {/* Timezone */}
                  <FormField
                    control={form.control}
                    name="email_digest_timezone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px]">Timezone</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-8 text-[11px]">
                              <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TIMEZONE_OPTIONS.map((opt) => (
                              <SelectItem
                                key={opt.value}
                                value={opt.value}
                                className="text-[11px]"
                              >
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </>
              )}

              {/* Save Button */}
              <Button
                type="submit"
                size="sm"
                className="h-7 text-[11px]"
                disabled={updatePreferences.isPending}
              >
                {updatePreferences.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Save className="h-3 w-3 mr-1" />
                )}
                Save Changes
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
