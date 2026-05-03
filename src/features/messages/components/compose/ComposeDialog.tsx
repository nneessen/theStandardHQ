// src/features/messages/components/compose/ComposeDialog.tsx
// Email compose dialog with Sheet-based contact browser
// Uses zinc palette and compact design patterns

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Send,
  Paperclip,
  Clock,
  ChevronDown,
  ChevronUp,
  Trash2,
  Save,
  X,
  Users,
  Globe,
  Loader2,
  Check,
  LayoutTemplate,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useSendEmail, useEmailQuota } from "../../hooks/useSendEmail";
import { useCurrentUserProfile } from "@/hooks/admin";
import { ContactBrowser } from "./ContactBrowser";
import {
  DocumentBrowserSheet,
  formatFileSize,
  type TrainingDocument,
} from "@/features/training-hub";
import {
  getAllUsersContacts,
  type Contact,
} from "../../services/contactService";
import {
  TemplatePicker,
  TipTapEditor,
  blocksToHtml,
  convertHtmlToText,
} from "@/features/email";
import { replaceTemplateVariables } from "@/lib/templateVariables";
import type { EmailTemplate } from "@/types/email.types";

// Extract body innerHTML from a full HTML document so TipTap receives a fragment
function extractBodyContent(html: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    return doc.body?.innerHTML?.trim() || html;
  } catch {
    return html;
  }
}

interface ComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  replyTo?: {
    threadId: string;
    messageId: string;
    to: string;
    subject: string;
  };
  forward?: {
    subject: string;
    body: string;
  };
}

export function ComposeDialog({
  open,
  onOpenChange,
  replyTo,
  forward,
}: ComposeDialogProps) {
  const { user: _user } = useAuth();
  const { send, saveDraft, isSending, isSavingDraft } = useSendEmail();
  const { remainingDaily } = useEmailQuota();
  const { data: userProfile } = useCurrentUserProfile();

  // Check if user is admin (super admin always sends from the business email)
  const _isAdmin = userProfile?.is_admin || false;

  // Form state
  const [to, setTo] = useState<string[]>(replyTo ? [replyTo.to] : []);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [subject, setSubject] = useState(
    replyTo
      ? `Re: ${replyTo.subject}`
      : forward
        ? `Fwd: ${forward.subject}`
        : "",
  );
  const [bodyHtml, setBodyHtml] = useState(forward?.body || "");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [showSchedule, setShowSchedule] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Template state
  const [selectedTemplate, setSelectedTemplate] =
    useState<EmailTemplate | null>(null);

  // UI state - Sheet starts closed
  const [showContactBrowser, setShowContactBrowser] = useState(false);
  const [showDocumentBrowser, setShowDocumentBrowser] = useState(false);
  const [activeRecipientField, setActiveRecipientField] = useState<
    "to" | "cc" | "bcc"
  >("to");
  // "Add All Users" uses a two-step inline confirm to avoid nested modals
  const [addAllPending, setAddAllPending] = useState(false);
  const [isAddingAll, setIsAddingAll] = useState(false);

  const isSuperAdmin = userProfile?.is_super_admin === true;

  const handleAddAllUsers = async () => {
    setAddAllPending(false);
    setIsAddingAll(true);
    try {
      const allUsers = await getAllUsersContacts();
      setTo((prev) => {
        const existing = new Set(prev.map((e) => e.toLowerCase()));
        const newEmails = allUsers
          .map((u) => u.email.toLowerCase())
          .filter((e) => !existing.has(e));
        return [...prev, ...newEmails];
      });
      toast.success(`Added ${allUsers.length} users as recipients`);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setIsAddingAll(false);
    }
  };

  // Template selection handler
  const handleTemplateSelect = (template: EmailTemplate) => {
    setSelectedTemplate(template);

    // Populate subject from template
    if (template.subject) {
      setSubject(replaceTemplateVariables(template.subject, {}));
    }

    // Populate body from template
    let html = "";
    if (
      template.blocks &&
      Array.isArray(template.blocks) &&
      template.blocks.length > 0
    ) {
      html = extractBodyContent(blocksToHtml(template.blocks, {}));
    } else if (template.body_html) {
      html = extractBodyContent(
        replaceTemplateVariables(template.body_html, {}),
      );
    }
    setBodyHtml(html);
  };

  const clearTemplate = () => {
    setSelectedTemplate(null);
    setBodyHtml("");
    setSubject("");
  };

  // Attachment state
  const [attachments, setAttachments] = useState<TrainingDocument[]>([]);

  const handleSend = async () => {
    if (to.length === 0) {
      setError("Please add at least one recipient");
      return;
    }

    if (!subject.trim()) {
      setError("Please add a subject");
      return;
    }

    if (remainingDaily <= 0) {
      setError("Daily email limit reached");
      return;
    }

    setError(null);

    try {
      // Wrap TipTap content in a div — the user's edits in bodyHtml are always the source of truth
      const finalHtml = `<div>${bodyHtml}</div>`;

      const result = await send({
        to,
        cc: cc.length > 0 ? cc : undefined,
        bcc: bcc.length > 0 ? bcc : undefined,
        subject,
        bodyHtml: finalHtml,
        bodyText: convertHtmlToText(bodyHtml),
        threadId: replyTo?.threadId,
        replyToMessageId: replyTo?.messageId,
        scheduledFor: scheduledDate,
        // Gmail is primary provider when connected, Mailgun is fallback
        source: "owner",
        fromOverride: undefined,
        // Include attachments from training documents
        trainingDocuments: attachments.length > 0 ? attachments : undefined,
      });

      if (result.success) {
        toast.success(
          scheduledDate ? "Email scheduled" : "Email sent successfully",
        );
        onOpenChange(false);
        resetForm();
      } else {
        setError(result.error || "Failed to send email");
      }
    } catch {
      setError("Failed to send email");
    }
  };

  const handleSaveDraft = async () => {
    try {
      await saveDraft({
        to,
        cc: cc.length > 0 ? cc : undefined,
        bcc: bcc.length > 0 ? bcc : undefined,
        subject,
        bodyHtml: `<div>${bodyHtml}</div>`,
      });
      toast.success("Draft saved");
      onOpenChange(false);
      resetForm();
    } catch {
      setError("Failed to save draft");
    }
  };

  const resetForm = () => {
    setTo([]);
    setCc([]);
    setBcc([]);
    setSubject("");
    setBodyHtml("");
    setSelectedTemplate(null);
    setScheduledDate(undefined);
    setShowSchedule(false);
    setError(null);
    setAttachments([]);
  };

  const handleSelectContact = useCallback(
    (contact: Contact) => {
      const email = contact.email.toLowerCase();
      switch (activeRecipientField) {
        case "to":
          // Use functional update to handle rapid successive calls (e.g., Add Entire Team)
          setTo((prev) => (prev.includes(email) ? prev : [...prev, email]));
          break;
        case "cc":
          setCc((prev) => (prev.includes(email) ? prev : [...prev, email]));
          break;
        case "bcc":
          setBcc((prev) => (prev.includes(email) ? prev : [...prev, email]));
          break;
      }
    },
    [activeRecipientField],
  );

  const removeRecipient = (email: string, field: "to" | "cc" | "bcc") => {
    switch (field) {
      case "to":
        setTo(to.filter((e) => e !== email));
        break;
      case "cc":
        setCc(cc.filter((e) => e !== email));
        break;
      case "bcc":
        setBcc(bcc.filter((e) => e !== email));
        break;
    }
  };

  const allSelectedEmails = [...to, ...cc, ...bcc].map((e) => e.toLowerCase());

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="flex flex-col p-0 gap-0 max-w-2xl bg-background  transition-all duration-200"
          style={{
            maxHeight: "85vh",
            left: showContactBrowser ? "calc(50% - 200px)" : "50%",
          }}
        >
          <DialogHeader className="px-3 py-2 bg-card border-b border-border">
            <DialogTitle className="text-sm font-semibold text-foreground">
              {replyTo ? "Reply" : forward ? "Forward" : "New Message"}
            </DialogTitle>
          </DialogHeader>

          {/* Compose Form */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-card">
              {/* Contacts & Template Buttons */}
              <div className="flex justify-end gap-2">
                {isSuperAdmin && (
                  <TemplatePicker
                    onSelect={handleTemplateSelect}
                    selectedTemplateId={selectedTemplate?.id}
                    className="inline-flex"
                  />
                )}
                {isSuperAdmin &&
                  (addAllPending ? (
                    // Step 2 — inline confirm, no nested modal
                    <div className="flex items-center gap-1 bg-warning/10 dark:bg-warning/30 border border-warning/40 rounded-md px-2 py-1">
                      <span className="text-[11px] text-warning font-medium">
                        Add all users?
                      </span>
                      <button
                        onClick={handleAddAllUsers}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-warning hover:bg-warning text-white transition-colors"
                      >
                        <Check className="h-3 w-3" />
                        Yes
                      </button>
                      <button
                        onClick={() => setAddAllPending(false)}
                        className="flex items-center px-1.5 py-0.5 rounded text-[10px] bg-muted hover:bg-muted  text-muted-foreground dark:text-muted-foreground transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddAllPending(true)}
                      disabled={isAddingAll}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium border transition-colors",
                        isAddingAll
                          ? "bg-muted text-muted-foreground cursor-not-allowed border-border"
                          : "bg-warning/10 dark:bg-warning/30 text-warning hover:bg-warning/20 dark:hover:bg-warning/50 border-warning/40",
                      )}
                    >
                      {isAddingAll ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Globe className="h-3.5 w-3.5" />
                      )}
                      <span>{isAddingAll ? "Adding..." : "Add All Users"}</span>
                    </button>
                  ))}
                <button
                  onClick={() => setShowContactBrowser(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium bg-info/10 dark:bg-info/30 text-info hover:bg-info/20 dark:hover:bg-info/50 border border-info/30 transition-colors"
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Browse Contacts</span>
                </button>
              </div>

              {/* Template Active Indicator */}
              {selectedTemplate && (
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="secondary"
                    className="h-5 text-[10px] gap-1 pr-1 bg-info/10 dark:bg-info/30 text-info border border-info/30"
                  >
                    <LayoutTemplate className="h-3 w-3" />
                    <span className="max-w-[200px] truncate">
                      {selectedTemplate.name}
                    </span>
                    <button
                      type="button"
                      onClick={clearTemplate}
                      className="hover:bg-info dark:hover:bg-info rounded-full p-0.5"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                </div>
              )}

              {/* To Field */}
              <RecipientField
                label="To"
                values={to}
                isActive={activeRecipientField === "to"}
                onActivate={() => setActiveRecipientField("to")}
                onRemove={(email) => removeRecipient(email, "to")}
                onOpenContacts={() => setShowContactBrowser(true)}
                disabled={isSending}
              />

              {/* Cc/Bcc toggle */}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="h-5 px-2 text-[10px] bg-transparent hover:bg-muted dark:hover:bg-muted text-muted-foreground hover:text-foreground border-0 shadow-none"
                  onClick={() => setShowCcBcc(!showCcBcc)}
                >
                  {showCcBcc ? (
                    <ChevronUp className="h-3 w-3 mr-1" />
                  ) : (
                    <ChevronDown className="h-3 w-3 mr-1" />
                  )}
                  Cc/Bcc
                </Button>
              </div>

              {/* CC/BCC Fields */}
              {showCcBcc && (
                <>
                  <RecipientField
                    label="Cc"
                    values={cc}
                    isActive={activeRecipientField === "cc"}
                    onActivate={() => setActiveRecipientField("cc")}
                    onRemove={(email) => removeRecipient(email, "cc")}
                    onOpenContacts={() => setShowContactBrowser(true)}
                    disabled={isSending}
                  />
                  <RecipientField
                    label="Bcc"
                    values={bcc}
                    isActive={activeRecipientField === "bcc"}
                    onActivate={() => setActiveRecipientField("bcc")}
                    onRemove={(email) => removeRecipient(email, "bcc")}
                    onOpenContacts={() => setShowContactBrowser(true)}
                    disabled={isSending}
                  />
                </>
              )}

              {/* Subject */}
              <div className="flex items-center gap-2">
                <Label className="text-[11px] text-muted-foreground w-8">
                  Subj
                </Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject"
                  className="flex-1 h-7 text-[11px] bg-background border-border"
                  disabled={isSending}
                />
              </div>

              {/* Body - TipTapEditor for rich text */}
              <TipTapEditor
                content={bodyHtml}
                onChange={setBodyHtml}
                placeholder="Write your message..."
                showMenuBar={isSuperAdmin}
                minHeight="180px"
                editable={!isSending}
                className="bg-background border border-border rounded-sm"
              />

              {/* Schedule */}
              {showSchedule && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-sm border border-border">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground dark:text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground dark:text-muted-foreground">
                    Scheduled for:
                  </span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        size="sm"
                        className="h-6 text-[10px] bg-muted hover:bg-muted  text-muted-foreground border-0 shadow-none"
                      >
                        {scheduledDate
                          ? format(scheduledDate, "PPp")
                          : "Pick date & time"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 z-[200]"
                      align="start"
                    >
                      <Calendar
                        mode="single"
                        selected={scheduledDate}
                        onSelect={setScheduledDate}
                        disabled={(date) => date < new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                  <Button
                    size="sm"
                    className="h-6 px-1 bg-transparent hover:bg-destructive/20 dark:hover:bg-destructive/30 text-muted-foreground hover:text-destructive dark:hover:text-destructive border-0 shadow-none"
                    onClick={() => {
                      setShowSchedule(false);
                      setScheduledDate(undefined);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {/* Attachments Display */}
              {attachments.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    Attachments ({attachments.length})
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {attachments.map((doc) => (
                      <Badge
                        key={doc.id}
                        variant="secondary"
                        className="h-6 text-[10px] gap-1.5 pr-1 bg-info/10 dark:bg-info/30 text-info border border-info/30"
                      >
                        <Paperclip className="h-3 w-3" />
                        <span className="max-w-[120px] truncate">
                          {doc.name}
                        </span>
                        <span className="text-[9px] text-info">
                          ({formatFileSize(doc.fileSize)})
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setAttachments((prev) =>
                              prev.filter((a) => a.id !== doc.id),
                            )
                          }
                          className="hover:bg-info/30 dark:hover:bg-info rounded-full p-0.5"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="text-[11px] text-destructive bg-destructive/10 px-2 py-1 rounded-sm border border-destructive/30">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-background dark:bg-card-dark">
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSend}
                  disabled={isSending || to.length === 0}
                  size="sm"
                  className="h-6 text-[10px] gap-1.5 bg-card-dark dark:bg-muted hover:bg-muted dark:hover:bg-muted text-white dark:text-foreground border-0 shadow-none"
                >
                  <Send className="h-3 w-3" />
                  {scheduledDate ? "Schedule" : "Send"}
                </Button>

                <Button
                  size="sm"
                  className="h-6 px-2 bg-muted hover:bg-muted dark:hover:bg-card-dark text-muted-foreground dark:text-muted-foreground border-0 shadow-none"
                  onClick={() => setShowSchedule(!showSchedule)}
                >
                  <Clock className="h-3 w-3" />
                </Button>

                <Button
                  size="sm"
                  className={cn(
                    "h-6 px-2 border-0 shadow-none",
                    attachments.length > 0
                      ? "bg-info/15 hover:bg-info/30 dark:hover:bg-info/50 text-info"
                      : "bg-muted hover:bg-muted dark:hover:bg-card-dark text-muted-foreground dark:text-muted-foreground",
                  )}
                  onClick={() => setShowDocumentBrowser(true)}
                >
                  <Paperclip className="h-3 w-3" />
                  {attachments.length > 0 && (
                    <span className="ml-1 text-[10px]">
                      {attachments.length}
                    </span>
                  )}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">
                  {remainingDaily} remaining
                </span>

                <Button
                  size="sm"
                  className="h-6 px-2 bg-transparent hover:bg-muted dark:hover:bg-muted text-muted-foreground hover:text-foreground border-0 shadow-none"
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft}
                >
                  <Save className="h-3 w-3" />
                </Button>

                <Button
                  size="sm"
                  className="h-6 px-2 bg-transparent hover:bg-destructive/10 dark:hover:bg-destructive/20 text-destructive hover:text-destructive dark:hover:text-destructive border-0 shadow-none"
                  onClick={() => {
                    resetForm();
                    onOpenChange(false);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contact Browser Sheet - separate from dialog */}
      <ContactBrowser
        open={showContactBrowser}
        onOpenChange={setShowContactBrowser}
        onSelectContact={handleSelectContact}
        selectedEmails={allSelectedEmails}
      />

      {/* Document Browser Sheet - for attachments */}
      <DocumentBrowserSheet
        open={showDocumentBrowser}
        onOpenChange={setShowDocumentBrowser}
        onSelectDocuments={setAttachments}
        selectedDocuments={attachments}
        maxAttachments={10}
      />
    </>
  );
}

// Recipient field component - Zinc styled
interface RecipientFieldProps {
  label: string;
  values: string[];
  isActive: boolean;
  onActivate: () => void;
  onRemove: (email: string) => void;
  onOpenContacts: () => void;
  disabled?: boolean;
}

function RecipientField({
  label,
  values,
  isActive,
  onActivate,
  onRemove,
  onOpenContacts,
  disabled,
}: RecipientFieldProps) {
  return (
    <div className="flex items-start gap-2">
      <Label className="text-[11px] text-muted-foreground w-8 pt-1.5">
        {label}
      </Label>
      <div
        onClick={onActivate}
        className={cn(
          "flex-1 flex flex-wrap items-center gap-1 min-h-[32px] px-2 py-1 border rounded-sm bg-background cursor-text",
          isActive ? "border-border  ring-1 ring-border " : "border-border",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        {values.map((email) => (
          <Badge
            key={email}
            className="h-5 text-[10px] gap-1 pr-1 shrink-0 bg-muted text-muted-foreground border-0"
          >
            <span className="max-w-[150px] truncate">{email}</span>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(email);
                }}
                className="hover:bg-muted  rounded-full p-0.5"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </Badge>
        ))}
        {values.length === 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenContacts();
            }}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Click to add from contacts →
          </button>
        )}
      </div>
    </div>
  );
}
