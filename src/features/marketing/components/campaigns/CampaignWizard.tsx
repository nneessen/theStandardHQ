import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Mail,
  MessageSquare,
  Users,
  ChevronRight,
  ChevronLeft,
  Send,
  Loader2,
  Check,
  Paintbrush,
  LayoutTemplate,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { EmailBlockBuilder, blocksToHtml } from "@/features/email";
import type { EmailBlock, ColumnsBlockContent } from "@/types/email.types";
import { STARTER_TEMPLATES } from "../../services/starterTemplateService";
import { useAudiences } from "../../hooks/useAudiences";
import {
  useCampaign,
  useCampaignRecipients,
  useCreateCampaign,
  useUpdateDraftCampaign,
  useAddCampaignRecipients,
} from "../../hooks/useCampaigns";
import {
  resolveAudienceContacts,
  getAudienceMembers,
} from "../../services/audienceService";
import { processBulkCampaign } from "../../services/campaignService";
import type { CampaignType } from "../../types/marketing.types";

// Deep-clone blocks with fresh UUIDs, including nested column sub-blocks
function cloneBlocksWithNewIds(blocks: EmailBlock[]): EmailBlock[] {
  return blocks.map((b): EmailBlock => {
    const newId = crypto.randomUUID();
    if (
      b.type === "columns" &&
      b.content.type === "columns" &&
      "columns" in b.content
    ) {
      const src = b.content;
      return {
        ...b,
        id: newId,
        content: {
          ...src,
          columns: (src as ColumnsBlockContent).columns.map(
            (col: { blocks: EmailBlock[] }) => ({
              blocks: cloneBlocksWithNewIds(col.blocks),
            }),
          ),
        },
      };
    }
    return { ...b, id: newId };
  });
}

interface CampaignWizardProps {
  onClose: () => void;
  editCampaignId?: string | null;
  initialBlocks?: EmailBlock[];
  initialSubject?: string;
}

type PresetPool = "agents" | "clients" | "leads";

interface WizardState {
  step: number;
  name: string;
  campaignType: CampaignType;
  // Audience
  audienceMode: "saved" | "preset";
  audienceId: string | null;
  presetPool: PresetPool | null;
  resolvedContacts: { email: string; first_name: string; last_name: string }[];
  contactsLoading: boolean;
  // Content
  subject: string;
  blocks: EmailBlock[];
  // Send
  sending: boolean;
}

const INITIAL_STATE: WizardState = {
  step: 0,
  name: "",
  campaignType: "email",
  audienceMode: "preset",
  audienceId: null,
  presetPool: null,
  resolvedContacts: [],
  contactsLoading: false,
  subject: "",
  blocks: [],
  sending: false,
};

const STEPS = ["Setup", "Audience", "Content", "Review"];

const PRESET_POOLS: { value: PresetPool; label: string; desc: string }[] = [
  { value: "agents", label: "All Agents", desc: "Active user profiles" },
  { value: "clients", label: "All Clients", desc: "Client records with email" },
  { value: "leads", label: "All Leads", desc: "Recruiting leads with email" },
];

export function CampaignWizard({
  onClose,
  editCampaignId,
  initialBlocks,
  initialSubject,
}: CampaignWizardProps) {
  const { user } = useAuth();
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [confirmSend, setConfirmSend] = useState(false);
  const [starterOpen, setStarterOpen] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const { data: audiences } = useAudiences();
  const { data: editCampaign } = useCampaign(editCampaignId ?? null);
  const { data: editRecipients } = useCampaignRecipients(
    editCampaignId ?? null,
  );
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateDraftCampaign();
  const addRecipients = useAddCampaignRecipients();

  // Load draft campaign data when editing
  useEffect(() => {
    if (editCampaignId && editCampaign?.status === "draft") {
      setState((prev) => ({
        ...prev,
        name: editCampaign.name,
        campaignType: editCampaign.campaign_type,
        subject: editCampaign.subject_override || "",
        audienceId: editCampaign.audience_id,
        audienceMode: editCampaign.audience_id ? "saved" : "preset",
        blocks:
          (editCampaign.brand_settings as { blocks?: EmailBlock[] })?.blocks ||
          [],
        resolvedContacts: (editRecipients || []).map((r) => ({
          email: r.email_address,
          first_name: r.first_name || "",
          last_name: r.last_name || "",
        })),
      }));
    }
  }, [editCampaignId, editCampaign, editRecipients]);

  // Load initial blocks from template flow
  useEffect(() => {
    if (initialBlocks && !editCampaignId) {
      setState((prev) => ({
        ...prev,
        blocks: initialBlocks,
        subject: initialSubject || prev.subject,
        step: 0,
      }));
    }
  }, [initialBlocks, initialSubject, editCampaignId]);

  function reset() {
    setState(INITIAL_STATE);
    setConfirmSend(false);
    setStarterOpen(false);
  }

  function closeWizard() {
    reset();
    onClose();
  }

  function set<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  // Resolve contacts for audience step
  async function resolveContacts() {
    set("contactsLoading", true);
    try {
      let contacts: { email: string; first_name: string; last_name: string }[] =
        [];

      if (state.audienceMode === "saved" && state.audienceId) {
        const members = await getAudienceMembers(state.audienceId);
        contacts = members.map((m) => ({
          email: m.email,
          first_name: m.first_name || "",
          last_name: m.last_name || "",
        }));
      } else if (state.audienceMode === "preset" && state.presetPool) {
        const resolved = await resolveAudienceContacts(state.presetPool);
        contacts = resolved.map((c) => ({
          email: c.email,
          first_name: c.first_name,
          last_name: c.last_name,
        }));
      }

      setState((prev) => ({
        ...prev,
        resolvedContacts: contacts,
        contactsLoading: false,
      }));
    } catch {
      set("contactsLoading", false);
      toast.error("Failed to resolve contacts.");
    }
  }

  // Validate step before advancing
  function canAdvance(): boolean {
    switch (state.step) {
      case 0:
        return state.name.trim().length > 0;
      case 1:
        return state.resolvedContacts.length > 0;
      case 2:
        return state.subject.trim().length > 0 && state.blocks.length > 0;
      default:
        return true;
    }
  }

  function nextStep() {
    if (state.step < STEPS.length - 1) {
      set("step", state.step + 1);
    }
  }

  function prevStep() {
    if (state.step > 0) {
      set("step", state.step - 1);
    }
  }

  // Send campaign
  async function handleSend() {
    if (!user?.id) return;
    set("sending", true);

    try {
      // 1. Create campaign record
      const campaign = await createCampaign.mutateAsync({
        name: state.name,
        subject_override: state.subject,
        campaign_type: state.campaignType,
        audience_id:
          state.audienceMode === "saved"
            ? (state.audienceId ?? undefined)
            : undefined,
        recipient_source:
          state.audienceMode === "saved" ? "audience" : "manual",
        user_id: user.id,
      });

      // 2. Add recipients — email_address, first_name, last_name at row level;
      //    also pass as variables for {{template}} substitution in the edge function
      const recipientRows = state.resolvedContacts.map((c) => ({
        email: c.email,
        first_name: c.first_name,
        last_name: c.last_name,
        variables: {
          first_name: c.first_name,
          last_name: c.last_name,
        },
      }));
      await addRecipients.mutateAsync({
        campaignId: campaign.id,
        recipients: recipientRows,
      });

      // 3. Generate the full HTML from blocks (variables left as {{placeholders}} for edge fn)
      const fullHtml = blocksToHtml(state.blocks);

      // 4. Invoke the bulk campaign processor — loop for batched processing
      let remaining = recipientRows.length;
      while (remaining > 0) {
        const result = await processBulkCampaign(
          campaign.id,
          state.subject,
          fullHtml,
        );
        remaining = result.remaining;
      }

      toast.success(
        `Campaign "${state.name}" sent to ${state.resolvedContacts.length} recipients.`,
      );
      closeWizard();
    } catch (err) {
      console.error("Campaign send error:", err);
      toast.error("Failed to send campaign. Check console for details.");
      set("sending", false);
    }
  }

  // Save as draft
  async function handleSaveDraft() {
    if (!user?.id || !state.name.trim()) return;
    if (editCampaignId && editCampaign?.status !== "draft") {
      toast.error("Only draft campaigns can be edited.");
      return;
    }
    setSavingDraft(true);

    try {
      const blocksData =
        state.blocks.length > 0 ? { blocks: state.blocks } : {};

      if (editCampaignId) {
        // Update existing draft
        await updateCampaign.mutateAsync({
          id: editCampaignId,
          updates: {
            name: state.name,
            subject_override: state.subject || null,
            audience_id:
              state.audienceMode === "saved"
                ? (state.audienceId ?? null)
                : null,
            brand_settings: blocksData,
          },
        });
        toast.success("Draft updated.");
      } else {
        // Create new draft
        const campaign = await createCampaign.mutateAsync({
          name: state.name,
          subject_override: state.subject || undefined,
          campaign_type: state.campaignType,
          audience_id:
            state.audienceMode === "saved"
              ? (state.audienceId ?? undefined)
              : undefined,
          brand_settings: blocksData,
          recipient_source:
            state.audienceMode === "saved" ? "audience" : "manual",
          status: "draft",
          user_id: user.id,
        });

        // Save recipients if any resolved
        if (state.resolvedContacts.length > 0) {
          await addRecipients.mutateAsync({
            campaignId: campaign.id,
            recipients: state.resolvedContacts.map((c) => ({
              email: c.email,
              first_name: c.first_name,
              last_name: c.last_name,
              variables: {
                first_name: c.first_name,
                last_name: c.last_name,
              },
            })),
          });
        }
        toast.success("Draft saved.");
      }

      closeWizard();
    } catch {
      toast.error("Failed to save draft.");
    } finally {
      setSavingDraft(false);
    }
  }

  // ─── Render Steps ──────────────────────────────────────────────────────────

  function renderSetup() {
    return (
      <div className="flex flex-col gap-4 px-4 py-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-medium">Campaign Name</Label>
          <Input
            className="h-8 text-[11px]"
            placeholder="e.g. March Newsletter"
            value={state.name}
            onChange={(e) => set("name", e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] font-medium">Campaign Type</Label>
          <div className="flex gap-2">
            <button
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-[11px] transition-colors flex-1",
                state.campaignType === "email"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40",
              )}
              onClick={() => set("campaignType", "email")}
            >
              <Mail className="h-3.5 w-3.5" />
              <div className="text-left">
                <p className="font-medium">Email</p>
                <p className="text-[10px] text-muted-foreground">
                  HTML email via Mailgun
                </p>
              </div>
            </button>
            <button
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-[11px] text-muted-foreground/50 flex-1 cursor-not-allowed"
              disabled
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <div className="text-left">
                <p className="font-medium">SMS</p>
                <p className="text-[10px]">Coming in Phase 2</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (editCampaignId && editCampaign && editCampaign.status !== "draft") {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-border bg-background p-6">
        <div className="flex max-w-md flex-col items-center gap-3 text-center">
          <p className="text-sm font-medium">
            This campaign can no longer be edited.
          </p>
          <p className="text-xs text-muted-foreground">
            Only campaigns in draft status can be edited.
          </p>
          <Button size="sm" variant="outline" onClick={onClose}>
            Back to Campaigns
          </Button>
        </div>
      </div>
    );
  }

  function renderAudience() {
    return (
      <div className="flex flex-col gap-3 px-4 py-3">
        {/* Toggle: saved vs preset */}
        <div className="flex gap-1.5">
          <Button
            variant={state.audienceMode === "preset" ? "default" : "outline"}
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => {
              setState((prev) => ({
                ...prev,
                audienceMode: "preset",
                audienceId: null,
                resolvedContacts: [],
              }));
            }}
          >
            Quick Pools
          </Button>
          <Button
            variant={state.audienceMode === "saved" ? "default" : "outline"}
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => {
              setState((prev) => ({
                ...prev,
                audienceMode: "saved",
                presetPool: null,
                resolvedContacts: [],
              }));
            }}
          >
            Saved Audiences
          </Button>
        </div>

        {state.audienceMode === "preset" && (
          <div className="flex flex-col gap-1.5">
            {PRESET_POOLS.map((pool) => (
              <button
                key={pool.value}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-[11px] transition-colors text-left",
                  state.presetPool === pool.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40",
                )}
                onClick={() => {
                  setState((prev) => ({
                    ...prev,
                    presetPool: pool.value,
                    resolvedContacts: [],
                  }));
                }}
              >
                <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="font-medium">{pool.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {pool.desc}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {state.audienceMode === "saved" && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-[11px] font-medium">Select Audience</Label>
            <Select
              value={state.audienceId ?? ""}
              onValueChange={(val) => {
                setState((prev) => ({
                  ...prev,
                  audienceId: val || null,
                  resolvedContacts: [],
                }));
              }}
            >
              <SelectTrigger className="h-8 text-[11px]">
                <SelectValue placeholder="Choose an audience..." />
              </SelectTrigger>
              <SelectContent>
                {audiences?.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-[11px]">
                    {a.name}{" "}
                    <span className="text-muted-foreground">
                      ({a.contact_count})
                    </span>
                  </SelectItem>
                ))}
                {(!audiences || audiences.length === 0) && (
                  <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                    No saved audiences yet.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Resolve / preview */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] px-2 gap-1"
            onClick={resolveContacts}
            disabled={
              state.contactsLoading ||
              (state.audienceMode === "preset" && !state.presetPool) ||
              (state.audienceMode === "saved" && !state.audienceId)
            }
          >
            {state.contactsLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Users className="h-3 w-3" />
            )}
            Load Contacts
          </Button>
          {state.resolvedContacts.length > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] h-5 px-1.5 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
            >
              <Check className="h-2.5 w-2.5 mr-0.5" />
              {state.resolvedContacts.length} contacts
            </Badge>
          )}
        </div>

        {state.resolvedContacts.length > 0 && (
          <div className="rounded-md border border-border bg-v2-canvas dark:bg-v2-card max-h-[140px] overflow-y-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-border/60 bg-v2-card-tinted dark:bg-v2-card-tinted">
                  <th className="text-left font-medium text-muted-foreground px-2 py-1">
                    Email
                  </th>
                  <th className="text-left font-medium text-muted-foreground px-2 py-1">
                    Name
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.resolvedContacts.slice(0, 50).map((c, i) => (
                  <tr
                    key={i}
                    className="border-b border-border/40 last:border-0"
                  >
                    <td className="px-2 py-0.5 truncate max-w-[200px]">
                      {c.email}
                    </td>
                    <td className="px-2 py-0.5 text-muted-foreground">
                      {c.first_name} {c.last_name}
                    </td>
                  </tr>
                ))}
                {state.resolvedContacts.length > 50 && (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-2 py-1 text-muted-foreground text-center"
                    >
                      ...and {state.resolvedContacts.length - 50} more
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  function renderContent() {
    return (
      <div className="flex flex-col gap-2 px-4 py-3">
        {/* Starter Template Picker */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px] px-2 gap-1"
            onClick={() => setStarterOpen(!starterOpen)}
          >
            <LayoutTemplate className="h-3 w-3" />
            {starterOpen ? "Hide Templates" : "Start from Template"}
          </Button>
          {state.blocks.length > 0 && (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5">
              <Paintbrush className="h-2.5 w-2.5 mr-0.5" />
              {state.blocks.length} blocks
            </Badge>
          )}
        </div>

        {starterOpen && (
          <div className="grid grid-cols-4 gap-1.5 max-h-[120px] overflow-y-auto rounded-md border border-border p-2 bg-v2-canvas dark:bg-v2-card">
            {STARTER_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                className="flex flex-col items-start gap-0.5 rounded border border-border p-1.5 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
                onClick={() => {
                  setState((prev) => ({
                    ...prev,
                    blocks: cloneBlocksWithNewIds(tpl.blocks),
                  }));
                  setStarterOpen(false);
                }}
              >
                <span className="text-[10px] font-medium truncate w-full">
                  {tpl.name}
                </span>
                <span className="text-[9px] text-muted-foreground line-clamp-2">
                  {tpl.description}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* EmailBlockBuilder */}
        <div
          className="rounded-md border border-border overflow-hidden"
          style={{ height: "calc(100% - 80px)", minHeight: 360 }}
        >
          <EmailBlockBuilder
            blocks={state.blocks}
            onChange={(blocks) => set("blocks", blocks)}
            subject={state.subject}
            onSubjectChange={(subject) => set("subject", subject)}
            previewVariables={{
              first_name: "John",
              last_name: "Doe",
              email: "john@example.com",
              sender_name: "Admin",
              sender_title: "Manager",
            }}
          />
        </div>
      </div>
    );
  }

  function renderReview() {
    const previewHtml = blocksToHtml(state.blocks, {
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
    });

    return (
      <div className="flex flex-col gap-3 px-4 py-3">
        {/* Summary */}
        <div className="rounded-md border border-border bg-v2-canvas dark:bg-v2-card p-3">
          <div className="grid grid-cols-2 gap-y-2 text-[11px]">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Campaign
              </p>
              <p className="font-medium">{state.name}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Type
              </p>
              <p className="font-medium capitalize">{state.campaignType}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Recipients
              </p>
              <p className="font-medium">
                {state.resolvedContacts.length} contacts
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Subject
              </p>
              <p className="font-medium truncate">{state.subject}</p>
            </div>
          </div>
        </div>

        {/* Email Preview */}
        <div className="flex flex-col gap-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium px-0.5">
            Email Preview
          </p>
          <div className="rounded-md border border-border overflow-hidden bg-white">
            <iframe
              srcDoc={previewHtml}
              title="Email Preview"
              className="w-full border-0"
              style={{ height: 320 }}
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full flex-col rounded-md border border-border bg-background">
        <div className="px-4 py-2.5 border-b shrink-0">
          <h1 className="text-sm font-semibold">
            {editCampaignId ? "Edit Draft Campaign" : "Create Campaign"}
          </h1>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-0 px-4 py-2 border-b bg-v2-canvas dark:bg-v2-card shrink-0">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center">
              {i > 0 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/40 mx-1" />
              )}
              <button
                className={cn(
                  "flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors",
                  i === state.step
                    ? "bg-primary text-primary-foreground font-medium"
                    : i < state.step
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      : "text-muted-foreground",
                )}
                onClick={() => {
                  // Only allow going back to completed steps
                  if (i < state.step) set("step", i);
                }}
                disabled={i > state.step}
              >
                {i < state.step ? (
                  <Check className="h-2.5 w-2.5" />
                ) : (
                  <span className="text-[9px] font-mono">{i + 1}</span>
                )}
                {label}
              </button>
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {state.step === 0 && renderSetup()}
          {state.step === 1 && renderAudience()}
          {state.step === 2 && renderContent()}
          {state.step === 3 && renderReview()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t bg-v2-canvas dark:bg-v2-card shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] px-3"
            onClick={prevStep}
            disabled={state.step === 0}
          >
            <ChevronLeft className="h-3 w-3 mr-1" />
            Back
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] px-3"
              onClick={closeWizard}
            >
              Cancel
            </Button>

            {/* Save Draft — visible when there's at least a name */}
            {state.name.trim() && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] px-3 gap-1"
                onClick={handleSaveDraft}
                disabled={savingDraft || state.sending}
              >
                {savingDraft ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                Save Draft
              </Button>
            )}

            {state.step < STEPS.length - 1 ? (
              <Button
                size="sm"
                className="h-7 text-[11px] px-3 gap-1"
                onClick={nextStep}
                disabled={!canAdvance()}
              >
                Next
                <ChevronRight className="h-3 w-3" />
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-7 text-[11px] px-3 gap-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setConfirmSend(true)}
                disabled={state.sending}
              >
                {state.sending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
                Send Campaign
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Send Confirmation */}
      <AlertDialog open={confirmSend} onOpenChange={setConfirmSend}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-semibold">
              Send Campaign?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[11px]">
              This will send &ldquo;{state.name}&rdquo; to{" "}
              <strong>{state.resolvedContacts.length}</strong> recipients. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-7 text-[11px]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-7 text-[11px] bg-green-600 hover:bg-green-700 text-white"
              onClick={handleSend}
              disabled={state.sending}
            >
              {state.sending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Send className="h-3 w-3 mr-1" />
              )}
              Confirm & Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
