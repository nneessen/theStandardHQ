/**
 * Notification Preferences Section
 *
 * UI for managing notification delivery preferences.
 */

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Save, Bell, Mail, Clock } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";

import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/hooks/alerts";
import {
  TIMEZONE_OPTIONS,
  DIGEST_FREQUENCY_OPTIONS,
} from "@/types/alert-rules.types";

const preferencesSchema = z.object({
  in_app_enabled: z.boolean(),
  browser_push_enabled: z.boolean(),
  email_digest_enabled: z.boolean(),
  email_digest_frequency: z.string(),
  email_digest_time: z.string(),
  email_digest_timezone: z.string(),
  quiet_hours_enabled: z.boolean(),
  quiet_hours_start: z.string(),
  quiet_hours_end: z.string(),
});

type PreferencesFormData = z.infer<typeof preferencesSchema>;

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

export function NotificationPreferencesSection() {
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();

  const form = useForm<PreferencesFormData>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      in_app_enabled: true,
      browser_push_enabled: false,
      email_digest_enabled: false,
      email_digest_frequency: "daily",
      email_digest_time: "09:00:00",
      email_digest_timezone: "America/New_York",
      quiet_hours_enabled: false,
      quiet_hours_start: "22:00:00",
      quiet_hours_end: "08:00:00",
    },
  });

  // Update form when preferences load
  useEffect(() => {
    if (preferences) {
      form.reset({
        in_app_enabled: preferences.in_app_enabled ?? true,
        browser_push_enabled: preferences.browser_push_enabled ?? false,
        email_digest_enabled: preferences.email_digest_enabled ?? false,
        email_digest_frequency: preferences.email_digest_frequency ?? "daily",
        email_digest_time: preferences.email_digest_time ?? "09:00:00",
        email_digest_timezone:
          preferences.email_digest_timezone ?? "America/New_York",
        quiet_hours_enabled: preferences.quiet_hours_enabled ?? false,
        quiet_hours_start: preferences.quiet_hours_start ?? "22:00:00",
        quiet_hours_end: preferences.quiet_hours_end ?? "08:00:00",
      });
    }
  }, [preferences, form]);

  const onSubmit = async (data: PreferencesFormData) => {
    try {
      await updatePreferences.mutateAsync({
        in_app_enabled: data.in_app_enabled,
        browser_push_enabled: data.browser_push_enabled,
        email_digest_enabled: data.email_digest_enabled,
        email_digest_frequency: data.email_digest_frequency,
        email_digest_time: data.email_digest_time,
        email_digest_timezone: data.email_digest_timezone,
        quiet_hours_enabled: data.quiet_hours_enabled,
        quiet_hours_start: data.quiet_hours_start,
        quiet_hours_end: data.quiet_hours_end,
      });
      toast.success("Preferences saved successfully");
    } catch (error) {
      toast.error("Failed to save preferences");
      console.error("Failed to save preferences:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        {/* In-App Notifications */}
        <div className="border border-v2-ring rounded-lg p-3">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-3.5 w-3.5 text-v2-ink-subtle" />
            <div>
              <h4 className="text-[11px] font-semibold text-v2-ink">
                In-App Notifications
              </h4>
              <p className="text-[10px] text-v2-ink-muted">
                Notifications shown in the app
              </p>
            </div>
          </div>

          <FormField
            control={form.control}
            name="in_app_enabled"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border border-v2-ring p-2.5">
                <div className="space-y-0.5">
                  <FormLabel className="text-[11px] text-v2-ink">
                    Enable in-app notifications
                  </FormLabel>
                  <FormDescription className="text-[10px] text-v2-ink-muted">
                    Show notification bell and dropdown
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
        </div>

        {/* Email Digest */}
        <div className="border border-v2-ring rounded-lg p-3">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="h-3.5 w-3.5 text-v2-ink-subtle" />
            <div>
              <h4 className="text-[11px] font-semibold text-v2-ink">
                Email Digest
              </h4>
              <p className="text-[10px] text-v2-ink-muted">
                Receive a summary of notifications via email
              </p>
            </div>
          </div>

          <FormField
            control={form.control}
            name="email_digest_enabled"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border border-v2-ring p-2.5">
                <div className="space-y-0.5">
                  <FormLabel className="text-[11px] text-v2-ink">
                    Enable email digest
                  </FormLabel>
                  <FormDescription className="text-[10px] text-v2-ink-muted">
                    Get unread notifications sent to your email
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

          {form.watch("email_digest_enabled") && (
            <>
              <Separator className="my-3" />
              <div className="grid gap-3 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="email_digest_frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] text-v2-ink-muted">
                        Frequency
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="h-7 text-[11px]">
                            <SelectValue />
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

                <FormField
                  control={form.control}
                  name="email_digest_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] text-v2-ink-muted">
                        Delivery Time
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="h-7 text-[11px]">
                            <SelectValue />
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

                <FormField
                  control={form.control}
                  name="email_digest_timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] text-v2-ink-muted">
                        Timezone
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="h-7 text-[11px]">
                            <SelectValue />
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
              </div>
            </>
          )}
        </div>

        {/* Quiet Hours */}
        <div className="border border-v2-ring rounded-lg p-3">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-3.5 w-3.5 text-v2-ink-subtle" />
            <div>
              <h4 className="text-[11px] font-semibold text-v2-ink">
                Quiet Hours
              </h4>
              <p className="text-[10px] text-v2-ink-muted">
                Pause notifications during specified hours
              </p>
            </div>
          </div>

          <FormField
            control={form.control}
            name="quiet_hours_enabled"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border border-v2-ring p-2.5">
                <div className="space-y-0.5">
                  <FormLabel className="text-[11px] text-v2-ink">
                    Enable quiet hours
                  </FormLabel>
                  <FormDescription className="text-[10px] text-v2-ink-muted">
                    Suppress notifications during these hours
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

          {form.watch("quiet_hours_enabled") && (
            <>
              <Separator className="my-3" />
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="quiet_hours_start"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] text-v2-ink-muted">
                        Start Time
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="h-7 text-[11px]">
                            <SelectValue />
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

                <FormField
                  control={form.control}
                  name="quiet_hours_end"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] text-v2-ink-muted">
                        End Time
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="h-7 text-[11px]">
                            <SelectValue />
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
              </div>
            </>
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            size="sm"
            disabled={updatePreferences.isPending || !form.formState.isDirty}
            className="h-7 text-[10px] gap-1"
          >
            {updatePreferences.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            Save Preferences
          </Button>
        </div>
      </form>
    </Form>
  );
}
