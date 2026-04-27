// src/features/billing/components/admin/TemporaryAccessSettings.tsx
// Admin panel for managing temporary access settings

import { useState, useEffect } from "react";
import {
  Clock,
  CalendarDays,
  Users,
  Lock,
  Loader2,
  Save,
  RotateCcw,
  AlertTriangle,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useSubscriptionSettings,
  useUpdateTemporaryAccessSettings,
} from "@/hooks/subscription";
import { ALL_FEATURE_KEYS, FEATURE_REGISTRY } from "@/constants/features";
import { cn } from "@/lib/utils";

export function TemporaryAccessSettings() {
  const { data: settings, isLoading } = useSubscriptionSettings();
  const updateSettings = useUpdateTemporaryAccessSettings();

  // Form state
  const [enabled, setEnabled] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [excludedFeatures, setExcludedFeatures] = useState<string[]>([]);
  const [testEmails, setTestEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Confirmation dialog
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [pendingEnableState, setPendingEnableState] = useState<boolean | null>(
    null,
  );

  // Initialize form with settings
  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      // Format date for input (YYYY-MM-DD)
      const date = new Date(settings.endDate);
      setEndDate(date.toISOString().split("T")[0]);
      setExcludedFeatures(settings.excludedFeatures);
      setTestEmails(settings.testEmails);
      setHasChanges(false);
    }
  }, [settings]);

  // Track changes
  useEffect(() => {
    if (!settings) return;

    const endDateChanged =
      endDate !== new Date(settings.endDate).toISOString().split("T")[0];
    const enabledChanged = enabled !== settings.enabled;
    const featuresChanged =
      JSON.stringify([...excludedFeatures].sort()) !==
      JSON.stringify([...settings.excludedFeatures].sort());
    const emailsChanged =
      JSON.stringify([...testEmails].sort()) !==
      JSON.stringify([...settings.testEmails].sort());

    setHasChanges(
      enabledChanged || endDateChanged || featuresChanged || emailsChanged,
    );
  }, [enabled, endDate, excludedFeatures, testEmails, settings]);

  const handleToggleEnabled = async (newState: boolean) => {
    if (!newState && enabled) {
      // Disabling - show confirmation first
      setPendingEnableState(false);
      setShowDisableConfirm(true);
    } else {
      // Enabling - auto-save immediately
      setEnabled(newState);
      await updateSettings.mutateAsync({ enabled: newState });
    }
  };

  const confirmDisable = async () => {
    if (pendingEnableState !== null) {
      setEnabled(pendingEnableState);
      // Auto-save the disabled state immediately
      await updateSettings.mutateAsync({ enabled: pendingEnableState });
    }
    setShowDisableConfirm(false);
    setPendingEnableState(null);
  };

  const handleFeatureToggle = (feature: string) => {
    setExcludedFeatures((prev) =>
      prev.includes(feature)
        ? prev.filter((f) => f !== feature)
        : [...prev, feature],
    );
  };

  const handleAddEmail = async () => {
    const email = newEmail.trim().toLowerCase();
    if (email && !testEmails.includes(email)) {
      // Basic validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(email)) {
        const updatedEmails = [...testEmails, email];
        setTestEmails(updatedEmails);
        setNewEmail("");
        // Auto-save immediately
        await updateSettings.mutateAsync({
          testEmails: updatedEmails,
        });
      }
    }
  };

  const handleRemoveEmail = async (email: string) => {
    const updatedEmails = testEmails.filter((e) => e !== email);
    setTestEmails(updatedEmails);
    // Auto-save immediately
    await updateSettings.mutateAsync({
      testEmails: updatedEmails,
    });
  };

  const handleSave = async () => {
    // Convert date to ISO string with time
    const endDateISO = new Date(endDate + "T00:00:00Z").toISOString();

    await updateSettings.mutateAsync({
      enabled,
      endDate: endDateISO,
      excludedFeatures,
      testEmails,
    });
  };

  const handleReset = () => {
    if (settings) {
      setEnabled(settings.enabled);
      const date = new Date(settings.endDate);
      setEndDate(date.toISOString().split("T")[0]);
      setExcludedFeatures(settings.excludedFeatures);
      setTestEmails(settings.testEmails);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-8 text-v2-ink-muted">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
        <p>Failed to load settings</p>
      </div>
    );
  }

  // Calculate days remaining until end date
  const endDateMs = new Date(settings.endDate).getTime();
  const nowMs = Date.now();
  const daysRemaining =
    endDateMs > nowMs
      ? Math.ceil((endDateMs - nowMs) / (1000 * 60 * 60 * 24))
      : 0;
  const isExpired = daysRemaining === 0;

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card
        className={cn(
          "border-2",
          enabled && !isExpired
            ? "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20"
            : "border-v2-ring",
        )}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-v2-ink-muted" />
              <CardTitle className="text-sm">Temporary Free Access</CardTitle>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                variant={enabled && !isExpired ? "default" : "secondary"}
                className={cn(
                  "text-[10px]",
                  enabled && !isExpired && "bg-emerald-500",
                )}
              >
                {enabled ? (isExpired ? "Expired" : "Active") : "Disabled"}
              </Badge>
              <Switch
                checked={enabled}
                onCheckedChange={handleToggleEnabled}
                disabled={updateSettings.isPending}
              />
            </div>
          </div>
          <CardDescription className="text-xs">
            When enabled, all users get access to all features (except excluded
            ones) until the end date. Test emails bypass this to see real tier
            gating.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {enabled && !isExpired && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
              <CalendarDays className="h-3.5 w-3.5" />
              <span className="font-medium">
                {daysRemaining} days remaining
              </span>
              <span className="text-v2-ink-subtle">
                (ends {new Date(settings.endDate).toLocaleDateString()})
              </span>
            </div>
          )}
          {isExpired && enabled && (
            <div className="flex items-center gap-2 text-xs text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>
                Access period has expired. Users now see tier-based gating.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* End Date & Excluded Features */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* End Date */}
            <div className="space-y-1.5">
              <Label className="text-xs">End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 text-xs"
                disabled={updateSettings.isPending}
              />
              <p className="text-[10px] text-v2-ink-muted">
                Temporary access ends at midnight UTC on this date
              </p>
            </div>

            {/* Excluded Features */}
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1.5">
                <Lock className="h-3 w-3" />
                Excluded Features
              </Label>
              <p className="text-[10px] text-v2-ink-muted mb-2">
                These features still require a paid subscription during the
                temporary access period
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {ALL_FEATURE_KEYS.map((key) => {
                  const feature = FEATURE_REGISTRY[key];
                  const isExcluded = excludedFeatures.includes(key);
                  return (
                    <label
                      key={key}
                      className={cn(
                        "flex items-center gap-2 p-1.5 rounded text-xs cursor-pointer hover:bg-v2-ring dark:hover:bg-v2-ring",
                        isExcluded && "bg-amber-50 dark:bg-amber-950/30",
                      )}
                    >
                      <Checkbox
                        checked={isExcluded}
                        onCheckedChange={() => handleFeatureToggle(key)}
                        disabled={updateSettings.isPending}
                      />
                      <span
                        className={cn(
                          isExcluded && "text-amber-700 dark:text-amber-400",
                        )}
                      >
                        {feature.displayName}
                      </span>
                      {isExcluded && (
                        <Lock className="h-3 w-3 ml-auto text-amber-500" />
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Emails */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Test Accounts
            </CardTitle>
            <CardDescription className="text-xs">
              These email addresses bypass temporary access and see real
              subscription-based feature gating. Use for testing tier behavior.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Add Email */}
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="email@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddEmail()}
                className="h-8 text-xs flex-1"
                disabled={updateSettings.isPending}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddEmail}
                disabled={!newEmail.trim() || updateSettings.isPending}
                className="h-8"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            {/* Email List */}
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {testEmails.length === 0 ? (
                <p className="text-xs text-v2-ink-subtle text-center py-4">
                  No test accounts configured
                </p>
              ) : (
                testEmails.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between p-2 bg-v2-canvas rounded text-xs"
                  >
                    <span className="font-mono">{email}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveEmail(email)}
                      disabled={updateSettings.isPending}
                      className="h-6 w-6 p-0 text-v2-ink-subtle hover:text-red-500"
                    >
                      {updateSettings.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                ))
              )}
            </div>

            <p className="text-[10px] text-v2-ink-muted">
              {testEmails.length} test account{testEmails.length !== 1 && "s"}{" "}
              configured
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      {hasChanges && (
        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                <span>You have unsaved changes</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={updateSettings.isPending}
                  className="h-7 text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={updateSettings.isPending}
                  className="h-7 text-xs"
                >
                  {updateSettings.isPending ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3 mr-1" />
                  )}
                  Save Changes
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disable Confirmation Dialog */}
      <AlertDialog
        open={showDisableConfirm}
        onOpenChange={setShowDisableConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Temporary Access?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately remove free access for all users (except
              test accounts). Users will only see features included in their
              subscription tier.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingEnableState(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDisable}
              className="bg-red-500 hover:bg-red-600"
            >
              Disable Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
