// src/features/messages/components/instagram/InstagramContactInfoPanel.tsx
// Collapsible panel for viewing/editing contact info in conversation header
// Board token restyle — surfaces/text/borders via T

import { type ReactNode, useState, useEffect, useMemo } from "react";
import {
  ChevronDown,
  ChevronUp,
  Check,
  Save,
  Mail,
  Phone,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { T } from "@/components/board/tokens";
import { useUpdateInstagramContactInfo } from "@/hooks/instagram";
import type { InstagramConversation } from "@/types/instagram.types";

interface InstagramContactInfoPanelProps {
  conversation: InstagramConversation;
}

export function InstagramContactInfoPanel({
  conversation,
}: InstagramContactInfoPanelProps): ReactNode {
  const [isExpanded, setIsExpanded] = useState(false);
  const [email, setEmail] = useState(conversation.participant_email || "");
  const [phone, setPhone] = useState(conversation.participant_phone || "");
  const [notes, setNotes] = useState(conversation.contact_notes || "");
  const [showSaved, setShowSaved] = useState(false);

  const updateContactInfo = useUpdateInstagramContactInfo();

  // Compute hasChanges with useMemo to avoid unnecessary state updates
  const hasChanges = useMemo(() => {
    return (
      email !== (conversation.participant_email || "") ||
      phone !== (conversation.participant_phone || "") ||
      notes !== (conversation.contact_notes || "")
    );
  }, [
    email,
    phone,
    notes,
    conversation.participant_email,
    conversation.participant_phone,
    conversation.contact_notes,
  ]);

  // Reset form when conversation changes (by id and contact field values)
  useEffect(() => {
    setEmail(conversation.participant_email || "");
    setPhone(conversation.participant_phone || "");
    setNotes(conversation.contact_notes || "");
    setShowSaved(false);
  }, [
    conversation.id,
    conversation.participant_email,
    conversation.participant_phone,
    conversation.contact_notes,
  ]);

  const handleSave = async () => {
    try {
      await updateContactInfo.mutateAsync({
        conversationId: conversation.id,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setShowSaved(true);
      toast.success("Contact info saved");

      // Hide saved indicator after 2 seconds
      setTimeout(() => setShowSaved(false), 2000);
    } catch (error) {
      console.error("[InstagramContactInfoPanel] Save failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save contact info",
      );
    }
  };

  // Check if any contact info exists
  const hasContactInfo =
    conversation.participant_email ||
    conversation.participant_phone ||
    conversation.contact_notes;

  const labelStyle: React.CSSProperties = {
    font: `700 9px ${T.mono}`,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: T.mut2,
    display: "flex",
    alignItems: "center",
    gap: 4,
    marginBottom: 3,
  };

  // Collapsed state — show summary
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        type="button"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          background: T.surface2,
          borderBottom: `1px solid ${T.line}`,
          borderTop: "none",
          borderLeft: "none",
          borderRight: "none",
          cursor: "pointer",
          transition: "background .12s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = T.surface3)}
        onMouseLeave={(e) => (e.currentTarget.style.background = T.surface2)}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            font: `500 11px ${T.data}`,
            color: T.mut,
          }}
        >
          {hasContactInfo ? (
            <>
              {conversation.participant_email && (
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Mail style={{ width: 11, height: 11, color: T.mut2 }} />
                  {conversation.participant_email}
                </span>
              )}
              {conversation.participant_phone && (
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Phone style={{ width: 11, height: 11, color: T.mut2 }} />
                  {conversation.participant_phone}
                </span>
              )}
              {conversation.contact_notes &&
                !conversation.participant_email &&
                !conversation.participant_phone && (
                  <span
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <FileText
                      style={{ width: 11, height: 11, color: T.mut2 }}
                    />
                    Has notes
                  </span>
                )}
            </>
          ) : (
            <span style={{ fontStyle: "italic", color: T.mut2 }}>
              Add contact info
            </span>
          )}
        </div>
        <ChevronDown style={{ width: 12, height: 12, color: T.mut2 }} />
      </button>
    );
  }

  // Expanded state — show form
  return (
    <div
      style={{
        padding: "10px 12px",
        background: T.surface2,
        borderBottom: `1px solid ${T.line}`,
      }}
    >
      {/* Header with collapse button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            font: `700 9px ${T.mono}`,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: T.mut2,
          }}
        >
          Contact Info
        </span>
        <button
          onClick={() => setIsExpanded(false)}
          type="button"
          style={{
            background: "none",
            border: "none",
            padding: 3,
            cursor: "pointer",
            borderRadius: 5,
            color: T.mut2,
            display: "flex",
            alignItems: "center",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color = T.ink)
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color = T.mut2)
          }
        >
          <ChevronUp style={{ width: 12, height: 12 }} />
        </button>
      </div>

      {/* Email and Phone row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div>
          <label style={labelStyle}>
            <Mail style={{ width: 10, height: 10 }} />
            Email
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            className="h-6 text-[10px] px-2"
          />
        </div>
        <div>
          <label style={labelStyle}>
            <Phone style={{ width: 10, height: 10 }} />
            Phone
          </label>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 555-5555"
            className="h-6 text-[10px] px-2"
          />
        </div>
      </div>

      {/* Notes row */}
      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle}>
          <FileText style={{ width: 10, height: 10 }} />
          Notes
        </label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes about this contact..."
          className="h-14 text-[10px] px-2 py-1 resize-none"
        />
      </div>

      {/* Save button */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {showSaved ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              font: `600 11px ${T.data}`,
              color: T.green,
            }}
          >
            <Check style={{ width: 12, height: 12 }} />
            Saved
          </div>
        ) : (
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || updateContactInfo.isPending}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              height: 24,
              padding: "0 10px",
              borderRadius: 7,
              background: hasChanges ? T.surface4 : "transparent",
              border: hasChanges ? `1px solid ${T.line2}` : "none",
              color: hasChanges ? T.ink : T.mut2,
              font: `700 11px ${T.data}`,
              cursor:
                hasChanges && !updateContactInfo.isPending
                  ? "pointer"
                  : "not-allowed",
              opacity: !hasChanges || updateContactInfo.isPending ? 0.5 : 1,
              transition: "background .12s",
            }}
          >
            <Save style={{ width: 10, height: 10 }} />
            {updateContactInfo.isPending ? "Saving..." : "Save"}
          </button>
        )}
      </div>
    </div>
  );
}
