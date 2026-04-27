import { useState } from "react";
import { Loader2, Phone, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  useVoicePhoneNumbers,
  usePurchasePhoneNumber,
  useReleasePhoneNumber,
  useUpdateVoicePhoneNumber,
  type VoicePhoneNumber,
} from "@/features/chat-bot";
import {
  VOICE_PHONE_MAX_PER_AGENT,
  VOICE_PHONE_LOCAL_PRICE_CENTS,
  VOICE_PHONE_TOLLFREE_PRICE_CENTS,
} from "@/lib/subscription/voice-addon";

interface VoicePhoneNumbersCardProps {
  voiceAgentCreated: boolean;
  voiceAccessActive: boolean;
}

function formatE164(phone: string) {
  // +12125551234 → (212) 555-1234
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const area = digits.slice(1, 4);
    const mid = digits.slice(4, 7);
    const last = digits.slice(7);
    return `(${area}) ${mid}-${last}`;
  }
  return phone;
}

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}/mo`;
}

export function VoicePhoneNumbersCard({
  voiceAgentCreated,
  voiceAccessActive,
}: VoicePhoneNumbersCardProps) {
  const { data: phoneNumbers = [], isLoading } = useVoicePhoneNumbers(
    voiceAgentCreated && voiceAccessActive,
  );
  const purchase = usePurchasePhoneNumber();
  const release = useReleasePhoneNumber();
  const update = useUpdateVoicePhoneNumber();

  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [tollFree, setTollFree] = useState(false);
  const [areaCode, setAreaCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [releaseConfirmId, setReleaseConfirmId] = useState<string | null>(null);
  const [editingNicknameId, setEditingNicknameId] = useState<string | null>(
    null,
  );
  const [editNicknameValue, setEditNicknameValue] = useState("");

  const activeNumbers = phoneNumbers.filter((n) => n.status !== "released");
  const atLimit = activeNumbers.length >= VOICE_PHONE_MAX_PER_AGENT;
  const anyPending = purchase.isPending || release.isPending;

  function handlePurchase() {
    purchase.mutate(
      {
        tollFree,
        areaCode: !tollFree && areaCode ? Number(areaCode) : undefined,
        nickname: nickname.trim() || undefined,
      },
      {
        onSuccess: () => {
          setShowPurchaseForm(false);
          setTollFree(false);
          setAreaCode("");
          setNickname("");
        },
      },
    );
  }

  function handleRelease(number: VoicePhoneNumber) {
    release.mutate(
      {
        phoneNumberId: number.id,
        externalSubscriptionItemId: number.externalSubscriptionItemId,
      },
      { onSuccess: () => setReleaseConfirmId(null) },
    );
  }

  function handleSetPrimary(id: string) {
    update.mutate({ phoneNumberId: id, isPrimary: true });
  }

  function handleNicknameSave(id: string) {
    const trimmed = editNicknameValue.trim();
    update.mutate(
      { phoneNumberId: id, nickname: trimmed || undefined },
      { onSuccess: () => setEditingNicknameId(null) },
    );
  }

  if (!voiceAgentCreated || !voiceAccessActive) {
    return (
      <div className="rounded-xl border border-v2-ring bg-white p-4 dark:border-v2-ring dark:bg-v2-card">
        <div className="flex items-start gap-3">
          <Phone className="mt-0.5 h-4 w-4 shrink-0 text-v2-ink-subtle" />
          <div>
            <p className="text-[12px] font-semibold text-v2-ink dark:text-v2-ink">
              Phone Numbers
            </p>
            <p className="mt-1 text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
              {!voiceAgentCreated
                ? "Create a voice agent first to manage phone numbers."
                : "Voice addon required to purchase phone numbers."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-v2-ring bg-white p-4 dark:border-v2-ring dark:bg-v2-card">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3">
          <Phone className="mt-0.5 h-4 w-4 shrink-0 text-v2-ink-muted dark:text-v2-ink-subtle" />
          <div>
            <p className="text-[12px] font-semibold text-v2-ink dark:text-v2-ink">
              Phone Numbers
            </p>
            <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
              Purchase and manage dedicated numbers for voice calls.
            </p>
          </div>
        </div>
        <span className="text-[10px] tabular-nums text-v2-ink-subtle">
          {activeNumbers.length} / {VOICE_PHONE_MAX_PER_AGENT}
        </span>
      </div>

      {/* Number Table */}
      {isLoading ? (
        <div className="mt-3 flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-v2-ink-subtle" />
        </div>
      ) : activeNumbers.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-v2-ring text-left text-[10px] font-medium text-v2-ink-subtle dark:border-v2-ring">
                <th className="pb-1.5 pr-3">Number</th>
                <th className="pb-1.5 pr-3">Type</th>
                <th className="pb-1.5 pr-3">Nickname</th>
                <th className="pb-1.5 pr-3 text-center">Primary</th>
                <th className="pb-1.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeNumbers.map((num) => (
                <tr
                  key={num.id}
                  className="border-b border-v2-ring last:border-0 dark:border-v2-ring/50"
                >
                  {/* Number */}
                  <td className="py-1.5 pr-3 font-mono text-v2-ink dark:text-v2-ink">
                    {formatE164(num.phoneNumber)}
                  </td>

                  {/* Type Badge */}
                  <td className="py-1.5 pr-3">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-medium ${
                        num.tollFree
                          ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-v2-card-tinted text-v2-ink-muted dark:bg-v2-card-tinted dark:text-v2-ink-subtle"
                      }`}
                    >
                      {num.tollFree ? "Toll-Free" : "Local"}
                    </span>
                    {num.status === "releasing" && (
                      <span className="ml-1 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                        Releasing
                      </span>
                    )}
                  </td>

                  {/* Nickname (inline-editable) */}
                  <td className="py-1.5 pr-3">
                    {editingNicknameId === num.id ? (
                      <Input
                        className="h-6 w-32 text-[11px]"
                        value={editNicknameValue}
                        onChange={(e) => setEditNicknameValue(e.target.value)}
                        onBlur={() => handleNicknameSave(num.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleNicknameSave(num.id);
                          if (e.key === "Escape") setEditingNicknameId(null);
                        }}
                        autoFocus
                        maxLength={255}
                      />
                    ) : (
                      <button
                        type="button"
                        className="text-v2-ink-muted hover:text-v2-ink dark:text-v2-ink-subtle dark:hover:text-v2-canvas"
                        onClick={() => {
                          setEditingNicknameId(num.id);
                          setEditNicknameValue(num.nickname || "");
                        }}
                      >
                        {num.nickname || (
                          <span className="italic text-v2-ink-subtle dark:text-v2-ink-muted">
                            Add label
                          </span>
                        )}
                      </button>
                    )}
                  </td>

                  {/* Primary */}
                  <td className="py-1.5 pr-3 text-center">
                    {num.isPrimary ? (
                      <Star className="mx-auto h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    ) : (
                      <button
                        type="button"
                        className="mx-auto block text-v2-ink-subtle hover:text-amber-400 disabled:opacity-50 dark:text-v2-ink-muted"
                        onClick={() => handleSetPrimary(num.id)}
                        disabled={
                          update.isPending || num.status === "releasing"
                        }
                        title="Set as primary"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-1.5 text-right">
                    {releaseConfirmId === num.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-6 px-2 text-[10px]"
                          disabled={release.isPending}
                          onClick={() => handleRelease(num)}
                        >
                          {release.isPending ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : null}
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => setReleaseConfirmId(null)}
                          disabled={release.isPending}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                        onClick={() => setReleaseConfirmId(num.id)}
                        disabled={anyPending || num.status === "releasing"}
                        title="Release number"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-v2-ink-subtle">
          No managed phone numbers yet. Purchase a dedicated number for your
          voice agent.
        </p>
      )}

      {/* Purchase Form */}
      {showPurchaseForm ? (
        <div className="mt-3 space-y-2.5 rounded-lg border border-v2-ring bg-v2-canvas/50 p-3 dark:border-v2-ring dark:bg-v2-card-tinted/30">
          <div className="flex items-center gap-3">
            <Label className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
              Toll-Free
            </Label>
            <Switch
              checked={tollFree}
              onCheckedChange={setTollFree}
              disabled={purchase.isPending}
            />
          </div>

          {!tollFree && (
            <div>
              <Label className="text-[10px] text-v2-ink-muted">
                Area Code (optional)
              </Label>
              <Input
                className="mt-1 h-7 w-24 text-[11px]"
                placeholder="e.g. 212"
                value={areaCode}
                onChange={(e) =>
                  setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))
                }
                disabled={purchase.isPending}
                maxLength={3}
              />
            </div>
          )}

          <div>
            <Label className="text-[10px] text-v2-ink-muted">
              Nickname (optional)
            </Label>
            <Input
              className="mt-1 h-7 w-48 text-[11px]"
              placeholder="e.g. Main Office"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              disabled={purchase.isPending}
              maxLength={255}
            />
          </div>

          <div className="flex items-center gap-2 border-t border-v2-ring pt-2.5 dark:border-v2-ring-strong">
            <Button
              size="sm"
              className="h-7 text-[10px]"
              disabled={
                purchase.isPending ||
                (!tollFree && areaCode.length > 0 && areaCode.length < 3)
              }
              onClick={handlePurchase}
            >
              {purchase.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Plus className="mr-1 h-3 w-3" />
              )}
              Buy{" "}
              {tollFree
                ? `Toll-Free ${formatPrice(VOICE_PHONE_TOLLFREE_PRICE_CENTS)}`
                : `Local ${formatPrice(VOICE_PHONE_LOCAL_PRICE_CENTS)}`}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[10px]"
              onClick={() => setShowPurchaseForm(false)}
              disabled={purchase.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px]"
            disabled={atLimit || anyPending}
            onClick={() => setShowPurchaseForm(true)}
          >
            <Plus className="mr-1 h-3 w-3" />
            Buy Number
          </Button>
          {atLimit && (
            <span className="ml-2 text-[10px] text-v2-ink-subtle">
              Maximum {VOICE_PHONE_MAX_PER_AGENT} numbers reached
            </span>
          )}
        </div>
      )}
    </div>
  );
}
