// src/features/recruiting/admin/SignatureRequiredConfig.tsx

import { useState, useRef, useCallback, useEffect } from "react";
import {
  PenTool,
  AlertCircle,
  Users,
  Clock,
  Settings,
  Plus,
  ExternalLink,
  Info,
  Loader2,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type {
  SignatureRequiredMetadata,
  SignerRole,
  SigningOrder,
  SignatureTemplate,
  SignatureTemplateType,
} from "@/types/signature.types";
import {
  SIGNER_ROLE_LABELS,
  SIGNING_ORDER_LABELS,
  TEMPLATE_TYPE_LABELS,
} from "@/types/signature.types";
import { createSignatureRequiredMetadata } from "@/types/checklist-metadata.types";
import {
  useAgencySignatureTemplates,
  useCreateSignatureTemplate,
} from "@/hooks/signatures";
import { useImo } from "@/contexts/ImoContext";
import { useAuth } from "@/contexts/AuthContext";

interface SignatureRequiredConfigProps {
  metadata: SignatureRequiredMetadata | null;
  onChange: (
    metadata: SignatureRequiredMetadata & { _type: "signature_required" },
  ) => void;
}

const AVAILABLE_SIGNER_ROLES: SignerRole[] = [
  "recruit",
  "recruiter",
  "agency_owner",
];

const TEMPLATE_TYPES: SignatureTemplateType[] = [
  "agent_contract",
  "independent_agreement",
  "custom",
];

export function SignatureRequiredConfig({
  metadata,
  onChange,
}: SignatureRequiredConfigProps) {
  const { agency } = useImo();
  const { user } = useAuth();
  const agencyId = agency?.id;
  const {
    data: templates,
    isLoading: templatesLoading,
    refetch: refetchTemplates,
  } = useAgencySignatureTemplates(agencyId ?? undefined);
  const createTemplate = useCreateSignatureTemplate();

  const [templateId, setTemplateId] = useState(metadata?.template_id ?? "");
  const [requiredSignerRoles, setRequiredSignerRoles] = useState<SignerRole[]>(
    metadata?.required_signer_roles ?? ["recruit"],
  );
  const [signingOrder, setSigningOrder] = useState<SigningOrder>(
    metadata?.signing_order ?? "any",
  );
  const [customMessage, setCustomMessage] = useState(
    metadata?.custom_message ?? "",
  );
  const [autoSend, setAutoSend] = useState(metadata?.auto_send ?? true);
  const [expiresInDays, setExpiresInDays] = useState(
    metadata?.expires_in_days ?? 30,
  );

  // Add Template Dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [newTemplateType, setNewTemplateType] =
    useState<SignatureTemplateType>("custom");
  const [docusealTemplateId, setDocusealTemplateId] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const prevMetadataRef = useRef<string>("");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const notifyChange = useCallback(() => {
    if (!templateId) {
      return;
    }

    const data: SignatureRequiredMetadata = {
      template_id: templateId,
      required_signer_roles: requiredSignerRoles,
      signing_order: signingOrder,
      custom_message: customMessage || undefined,
      auto_send: autoSend,
      expires_in_days: expiresInDays,
    };

    const newMetadata = createSignatureRequiredMetadata(data);
    const metadataString = JSON.stringify(newMetadata);

    if (metadataString !== prevMetadataRef.current) {
      prevMetadataRef.current = metadataString;
      onChangeRef.current(newMetadata);
    }
  }, [
    templateId,
    requiredSignerRoles,
    signingOrder,
    customMessage,
    autoSend,
    expiresInDays,
  ]);

  useEffect(() => {
    notifyChange();
  }, [notifyChange]);

  const handleRoleToggle = (role: SignerRole, checked: boolean) => {
    if (checked) {
      setRequiredSignerRoles((prev) => [...prev, role]);
    } else {
      // Ensure at least one role is always selected
      if (requiredSignerRoles.length > 1) {
        setRequiredSignerRoles((prev) => prev.filter((r) => r !== role));
      }
    }
  };

  const handleCreateTemplate = async () => {
    if (!agencyId || !newTemplateName.trim()) {
      toast.error("Template name is required");
      return;
    }

    setIsCreating(true);
    try {
      const docusealId = docusealTemplateId.trim()
        ? parseInt(docusealTemplateId, 10)
        : undefined;

      if (docusealTemplateId.trim() && isNaN(docusealId as number)) {
        toast.error("DocuSeal Template ID must be a number");
        setIsCreating(false);
        return;
      }

      const result = await createTemplate.mutateAsync({
        agencyId,
        name: newTemplateName.trim(),
        description: newTemplateDescription.trim() || undefined,
        templateType: newTemplateType,
        docusealTemplateId: docusealId,
        requiredSignerRoles: ["recruit"], // Default
        signingOrder: "any",
        createdBy: user?.id,
      });

      toast.success("Template created successfully");
      setShowAddDialog(false);
      setNewTemplateName("");
      setNewTemplateDescription("");
      setNewTemplateType("custom");
      setDocusealTemplateId("");

      // Auto-select the newly created template
      setTemplateId(result.id);

      // Refetch templates list
      refetchTemplates();
    } catch (error) {
      console.error("Failed to create template:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create template",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const selectedTemplate = templates?.find(
    (t: SignatureTemplate) => t.id === templateId,
  );

  const hasTemplates = templates && templates.length > 0;

  return (
    <div className="space-y-3 p-2.5 bg-v2-canvas rounded-md shadow-sm">
      <div className="flex items-center gap-2">
        <PenTool className="h-3.5 w-3.5 text-v2-ink-muted" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-v2-ink-muted">
          E-Signature Configuration
        </span>
      </div>

      {/* Template Selection */}
      <div className="space-y-1">
        <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
          Signature Template <span className="text-red-500">*</span>
        </Label>

        {!hasTemplates && !templatesLoading ? (
          // No templates - show setup guidance
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md space-y-2">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                  No signature templates configured
                </p>
                <p className="text-[10px] text-blue-600 dark:text-blue-400">
                  To use e-signatures, first create a template in DocuSeal, then
                  link it here. Templates define the document layout and
                  signature fields.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={() => setShowAddDialog(true)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Template
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px]"
                asChild
              >
                <a
                  href="https://docuseal.com/console"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Open DocuSeal
                </a>
              </Button>
            </div>
          </div>
        ) : (
          // Templates exist - show select
          <div className="flex gap-2">
            <div className="flex-1">
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger className="h-7 text-[11px]">
                  <SelectValue
                    placeholder={
                      templatesLoading
                        ? "Loading templates..."
                        : "Select a template"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {templates?.map((template: SignatureTemplate) => (
                    <SelectItem
                      key={template.id}
                      value={template.id}
                      className="text-[11px]"
                    >
                      {template.name}
                      {template.templateType !== "custom" && (
                        <span className="ml-1 text-v2-ink-subtle">
                          ({TEMPLATE_TYPE_LABELS[template.templateType]})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2"
              onClick={() => setShowAddDialog(true)}
              title="Add new template"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        )}

        {!templateId && hasTemplates && (
          <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-3 w-3" />
            Template is required
          </div>
        )}
        {selectedTemplate && (
          <p className="text-[9px] text-v2-ink-muted">
            {selectedTemplate.description || "No description"}
            {selectedTemplate.docusealTemplateId && (
              <span className="ml-1 text-v2-ink-subtle">
                (DocuSeal ID: {selectedTemplate.docusealTemplateId})
              </span>
            )}
          </p>
        )}
      </div>

      {/* Required Signers */}
      <div className="space-y-1.5">
        <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle flex items-center gap-1">
          <Users className="h-3 w-3" />
          Required Signers
        </Label>
        <div className="space-y-1.5 pl-1">
          {AVAILABLE_SIGNER_ROLES.map((role) => (
            <div key={role} className="flex items-center gap-2">
              <Checkbox
                id={`role-${role}`}
                checked={requiredSignerRoles.includes(role)}
                onCheckedChange={(checked) =>
                  handleRoleToggle(role, checked === true)
                }
                disabled={
                  requiredSignerRoles.length === 1 &&
                  requiredSignerRoles.includes(role)
                }
                className="h-3 w-3"
              />
              <label
                htmlFor={`role-${role}`}
                className="text-[11px] text-v2-ink-muted cursor-pointer"
              >
                {SIGNER_ROLE_LABELS[role]}
              </label>
            </div>
          ))}
        </div>
        <p className="text-[9px] text-v2-ink-muted">
          Select all roles that must sign this document
        </p>
      </div>

      {/* Signing Order (only if multiple signers) */}
      {requiredSignerRoles.length > 1 && (
        <div className="space-y-1">
          <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle flex items-center gap-1">
            <Settings className="h-3 w-3" />
            Signing Order
          </Label>
          <Select
            value={signingOrder}
            onValueChange={(value: SigningOrder) => setSigningOrder(value)}
          >
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SIGNING_ORDER_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value} className="text-[11px]">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[9px] text-v2-ink-muted">
            {signingOrder === "sequential"
              ? "Signers will sign in order: recruit → recruiter → agency owner"
              : "All signers can sign simultaneously"}
          </p>
        </div>
      )}

      {/* Custom Message */}
      <div className="space-y-1">
        <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
          Custom Message (Optional)
        </Label>
        <Textarea
          value={customMessage}
          onChange={(e) => setCustomMessage(e.target.value)}
          placeholder="Add a custom message to include in the signing invitation..."
          className="min-h-[60px] text-[11px]"
        />
        <p className="text-[9px] text-v2-ink-muted">
          This message will be shown to signers when they view the document
        </p>
      </div>

      {/* Expiration */}
      <div className="space-y-1">
        <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Expires In (Days)
        </Label>
        <Input
          type="number"
          value={expiresInDays}
          onChange={(e) =>
            setExpiresInDays(Math.max(1, parseInt(e.target.value) || 30))
          }
          min={1}
          max={365}
          className="h-7 text-[11px] w-24"
        />
        <p className="text-[9px] text-v2-ink-muted">
          Signature request will expire after this many days
        </p>
      </div>

      {/* Auto-send */}
      <div className="flex items-center justify-between py-1">
        <div className="space-y-0.5">
          <Label className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
            Auto-send on Phase Start
          </Label>
          <p className="text-[9px] text-v2-ink-muted">
            Automatically send signature request when phase begins
          </p>
        </div>
        <Switch
          checked={autoSend}
          onCheckedChange={setAutoSend}
          className="scale-75"
        />
      </div>

      {/* Info */}
      <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
        <p className="text-[9px] text-blue-700 dark:text-blue-400">
          <strong>Note:</strong> This item will be marked complete when all
          required signers have signed the document. Signers will receive an
          email notification and can sign directly within the application.
        </p>
      </div>

      {/* Add Template Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Add Signature Template
            </DialogTitle>
            <DialogDescription className="text-xs">
              Link a DocuSeal template to use for e-signatures. First create
              your template in DocuSeal with signature fields, then enter the
              details below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1">
              <Label className="text-xs">Template Name *</Label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g., Agent Contract"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
                placeholder="Brief description of this template..."
                className="min-h-[60px] text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Template Type</Label>
              <Select
                value={newTemplateType}
                onValueChange={(v: SignatureTemplateType) =>
                  setNewTemplateType(v)
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_TYPES.map((type) => (
                    <SelectItem key={type} value={type} className="text-sm">
                      {TEMPLATE_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                DocuSeal Template ID{" "}
                <span className="text-v2-ink-subtle">(Optional)</span>
              </Label>
              <Input
                value={docusealTemplateId}
                onChange={(e) => setDocusealTemplateId(e.target.value)}
                placeholder="e.g., 12345"
                className="h-8 text-sm"
              />
              <p className="text-[10px] text-v2-ink-muted">
                Find this ID in your DocuSeal dashboard under Templates. Leave
                empty to add later.
              </p>
            </div>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded border border-amber-200 dark:border-amber-800">
              <p className="text-[10px] text-amber-700 dark:text-amber-400">
                <strong>Important:</strong> Make sure your DocuSeal template has
                signature fields configured. Without them, signers won't be able
                to sign the document.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddDialog(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateTemplate}
              disabled={isCreating || !newTemplateName.trim()}
            >
              {isCreating && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
