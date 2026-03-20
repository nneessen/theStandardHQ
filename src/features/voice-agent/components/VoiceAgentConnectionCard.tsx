import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  KeyRound,
  Link2,
  Loader2,
  PhoneCall,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ChatBotRetellConnection } from "@/features/chat-bot";
import {
  useDisconnectRetellConnection,
  useSaveRetellConnection,
} from "@/features/chat-bot";
import { cn } from "@/lib/utils";
// eslint-disable-next-line no-restricted-imports
import { isValidPhoneNumber } from "@/services/sms";

interface VoiceAgentConnectionCardProps {
  connection: ChatBotRetellConnection | undefined;
  closeConnected: boolean;
  isSuperAdmin?: boolean;
}

export function VoiceAgentConnectionCard({
  connection,
  closeConnected,
  isSuperAdmin = false,
}: VoiceAgentConnectionCardProps) {
  const saveRetellConnection = useSaveRetellConnection();
  const disconnectRetellConnection = useDisconnectRetellConnection();

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [retellAgentId, setRetellAgentId] = useState("");
  const [fromNumberSource, setFromNumberSource] = useState<"retell" | "close">(
    "retell",
  );
  const [fromNumber, setFromNumber] = useState("");
  const [closePhoneNumber, setClosePhoneNumber] = useState("");

  // Use a stable primitive key to avoid resetting form on every query refetch
  // (new object reference, same data).
  const connectionKey = connection?.retellAgentId ?? "";
  useEffect(() => {
    setApiKey("");
    setRetellAgentId(connection?.retellAgentId ?? "");
    setFromNumberSource(connection?.fromNumberSource ?? "retell");
    setFromNumber(connection?.fromNumber ?? "");
    setClosePhoneNumber(connection?.closePhoneNumber ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionKey]);

  const numberValidationError = useMemo(() => {
    if (fromNumberSource === "retell") {
      const trimmed = fromNumber.trim();
      if (trimmed && !isValidPhoneNumber(trimmed)) {
        return "Managed voice number must be a valid phone number.";
      }
      return null;
    }

    const trimmed = closePhoneNumber.trim();
    if (trimmed && !isValidPhoneNumber(trimmed)) {
      return "Close / Twilio caller ID must be a valid phone number.";
    }

    return null;
  }, [closePhoneNumber, fromNumber, fromNumberSource]);

  const canSave = useMemo(() => {
    if (!apiKey.trim()) return false;
    if (!retellAgentId.trim()) return false;
    if (numberValidationError) return false;
    if (fromNumberSource === "close") {
      return closeConnected && Boolean(closePhoneNumber.trim());
    }
    return true;
  }, [
    apiKey,
    closeConnected,
    closePhoneNumber,
    fromNumberSource,
    numberValidationError,
    retellAgentId,
  ]);

  const mutationError =
    saveRetellConnection.error || disconnectRetellConnection.error;

  const handleSave = () => {
    if (!canSave) return;

    saveRetellConnection.mutate({
      apiKey: apiKey.trim(),
      retellAgentId: retellAgentId.trim(),
      fromNumberSource,
      ...(fromNumberSource === "retell" && fromNumber.trim()
        ? { fromNumber: fromNumber.trim() }
        : {}),
      ...(fromNumberSource === "close" && closePhoneNumber.trim()
        ? { closePhoneNumber: closePhoneNumber.trim() }
        : {}),
    });
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-100">
            Launch Readiness
          </p>
          <p className="mt-1 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
            Confirm that your voice agent and caller ID are ready before you
            publish the AI Voice Agent live.
          </p>
        </div>

        <Badge
          className={
            connection?.connected
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          }
        >
          {connection?.connected ? "Ready to Launch" : "Not Linked Yet"}
        </Badge>
      </div>

      <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
        {connection?.connected ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                  Your voice agent is ready
                </p>
                <p className="mt-1 text-[11px] leading-5 text-zinc-600 dark:text-zinc-400">
                  You can focus on setup. Inbound calls can route against this
                  agent, and the AI Voice Agent can work against the live lead
                  records coming from Close CRM.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Close CRM
                </p>
                <p className="mt-1 text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                  {closeConnected ? "Connected" : "Not connected"}
                </p>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Outgoing number
                </p>
                <p className="mt-1 text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                  {connection.fromNumber ||
                    connection.closePhoneNumber ||
                    "Not set"}
                </p>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Caller ID
                </p>
                <p className="mt-1 text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                  {connection.fromNumberSource === "close"
                    ? "Close / Twilio"
                    : "Managed by The Standard HQ"}
                </p>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {isSuperAdmin ? "Runtime Agent ID" : "Voice Agent"}
                </p>
                <p className="mt-1 truncate text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                  {isSuperAdmin
                    ? connection.retellAgentId || "Ready"
                    : "Linked"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                <PhoneCall className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                  No voice agent is set up for this workspace yet
                </p>
                <p className="mt-1 text-[11px] leading-5 text-zinc-600 dark:text-zinc-400">
                  Voice, greeting, prompt, and publish controls appear after you
                  create the voice agent. Standard users should never need to
                  enter technical credentials here.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-3 text-[11px] leading-5 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
              Inbound calls and lead records come from Close CRM. You can still
              review your plan, usage, and call settings now, but live voice
              drafting only becomes available after the voice agent is created
              and linked.
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-zinc-200 px-3 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Link2 className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
          <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
            What to do in this step
          </p>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-zinc-600 dark:text-zinc-400">
          Review readiness here, then move to publish once the voice agent is
          ready. Voice choice, greeting, prompt, and call behavior belong in the
          setup tabs.
        </p>
      </div>

      {isSuperAdmin && (
        <Collapsible
          open={advancedOpen}
          onOpenChange={setAdvancedOpen}
          className="mt-4 rounded-lg border border-zinc-200 dark:border-zinc-800"
        >
          <div className="flex items-center justify-between gap-3 px-3 py-3">
            <div>
              <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                Admin: Manual workspace link
              </p>
              <p className="mt-1 text-[10px] leading-5 text-zinc-500 dark:text-zinc-400">
                Internal voice runtime setup for super-admin use only.
              </p>
            </div>

            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    advancedOpen ? "rotate-180" : "rotate-0",
                  )}
                />
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="border-t border-zinc-200 px-3 py-3 dark:border-zinc-800">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="voice-retell-api-key">
                    Voice runtime API key
                  </Label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                    <Input
                      id="voice-retell-api-key"
                      type="password"
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      className="pl-9 font-mono text-xs"
                      placeholder={
                        connection?.connected
                          ? "Enter API key again to replace the connection"
                          : "rtk_..."
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="voice-retell-agent-id">
                    Voice runtime agent ID
                  </Label>
                  <Input
                    id="voice-retell-agent-id"
                    value={retellAgentId}
                    onChange={(event) => setRetellAgentId(event.target.value)}
                    className="font-mono text-xs"
                    placeholder="agent_..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Caller ID source</Label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setFromNumberSource("retell")}
                    className={`rounded-lg border px-3 py-3 text-left transition ${
                      fromNumberSource === "retell"
                        ? "border-sky-400 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/20"
                        : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/40"
                    }`}
                  >
                    <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                      Managed number
                    </p>
                    <p className="mt-1 text-[10px] leading-5 text-zinc-500 dark:text-zinc-400">
                      Use the platform-managed line as the caller ID.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFromNumberSource("close")}
                    disabled={!closeConnected}
                    className={`rounded-lg border px-3 py-3 text-left transition ${
                      fromNumberSource === "close"
                        ? "border-sky-400 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/20"
                        : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/40"
                    } ${!closeConnected ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100">
                      Close / Twilio caller ID
                    </p>
                    <p className="mt-1 text-[10px] leading-5 text-zinc-500 dark:text-zinc-400">
                      Use a Close-backed number for caller ID.
                    </p>
                  </button>
                </div>
              </div>

              {fromNumberSource === "retell" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="voice-retell-number">
                    Managed voice number
                  </Label>
                  <Input
                    id="voice-retell-number"
                    value={fromNumber}
                    onChange={(event) => setFromNumber(event.target.value)}
                    className="font-mono text-xs"
                    placeholder="+15551234567"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="voice-close-number">
                    Close / Twilio caller ID
                  </Label>
                  <Input
                    id="voice-close-number"
                    value={closePhoneNumber}
                    onChange={(event) =>
                      setClosePhoneNumber(event.target.value)
                    }
                    className="font-mono text-xs"
                    placeholder="+15551234567"
                    disabled={!closeConnected}
                  />
                </div>
              )}

              {mutationError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-950/60 dark:bg-red-950/20">
                  <p className="text-[11px] font-semibold text-red-700 dark:text-red-300">
                    {disconnectRetellConnection.error
                      ? "Failed to disconnect"
                      : "Failed to save connection"}
                  </p>
                  <p className="mt-1 text-[10px] text-red-600 dark:text-red-400">
                    {mutationError.message || "An unexpected error occurred."}
                  </p>
                </div>
              )}

              {numberValidationError && (
                <p className="text-[10px] text-red-600 dark:text-red-400">
                  {numberValidationError}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleSave}
                  disabled={saveRetellConnection.isPending || !canSave}
                >
                  {saveRetellConnection.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Saving
                    </>
                  ) : connection?.connected ? (
                    "Save Internal Setup"
                  ) : (
                    "Link Workspace"
                  )}
                </Button>

                {connection?.connected && (
                  <Button
                    variant="outline"
                    onClick={() => disconnectRetellConnection.mutate()}
                    disabled={disconnectRetellConnection.isPending}
                  >
                    {disconnectRetellConnection.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        Disconnecting
                      </>
                    ) : (
                      <>
                        <Unplug className="mr-2 h-3.5 w-3.5" />
                        Disconnect
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
