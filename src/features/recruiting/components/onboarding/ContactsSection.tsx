import { useState } from "react";
import { Mail, Phone, MessageSquare, Loader2, Send, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// eslint-disable-next-line no-restricted-imports -- Service needed for SMS functionality
import { smsService } from "@/services/sms";
import { toast } from "sonner";
import type { UserProfile } from "@/types/hierarchy.types";
import { EditorialSection } from "../editorial";

const RECRUITER_SMS_NUMBER = "859-433-5907";

interface KeyContact {
  id: string;
  role: string;
  label: string;
  profile: UserProfile | null;
}

interface ContactsSectionProps {
  upline?: UserProfile | null;
  keyContacts?: KeyContact[];
  recruitName?: string;
}

export function ContactsSection({
  upline,
  keyContacts,
  recruitName,
}: ContactsSectionProps) {
  const [smsMessage, setSmsMessage] = useState("");
  const [sendingSms, setSendingSms] = useState(false);
  const [showSmsForm, setShowSmsForm] = useState(false);

  const handleSendSms = async () => {
    if (!smsMessage.trim()) return;
    setSendingSms(true);
    try {
      const result = await smsService.sendSms({
        to: RECRUITER_SMS_NUMBER,
        message: `[From ${recruitName || "Recruit"}] ${smsMessage}`,
        trigger: "recruit_contact_form",
      });
      if (result.success) {
        toast.success("Message sent to your recruiter");
        setSmsMessage("");
        setShowSmsForm(false);
      } else {
        toast.error(result.error || "Failed to send message");
      }
    } catch (error) {
      toast.error("Failed to send message");
      console.error("SMS error:", error);
    } finally {
      setSendingSms(false);
    }
  };

  const hasContacts =
    !!upline || (Array.isArray(keyContacts) && keyContacts.length > 0);

  const rightSlot = (
    <button
      type="button"
      onClick={() => setShowSmsForm((s) => !s)}
      className="inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.18em] font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 underline underline-offset-4 decoration-2 transition-colors"
    >
      <MessageSquare className="h-3 w-3" />
      {showSmsForm ? "Close" : "Text recruiter"}
    </button>
  );

  return (
    <EditorialSection
      icon={Users}
      iconTone="success"
      eyebrow="Your Team"
      title="Who to talk to"
      caption="Stuck on a step or need a clarification? Reach out — your recruiter would rather hear from you than have you guess."
      rightSlot={rightSlot}
    >
      {showSmsForm && (
        <div className="mb-5 rounded-xl bg-v2-canvas dark:bg-v2-ring/40 ring-1 ring-v2-ring  p-4">
          <textarea
            value={smsMessage}
            onChange={(e) => setSmsMessage(e.target.value)}
            placeholder="Type a quick message to your recruiter..."
            className="w-full bg-white dark:bg-v2-card rounded-lg ring-1 ring-v2-ring  p-3 text-sm text-v2-ink  placeholder:text-v2-ink-subtle dark:placeholder:text-v2-ink-muted resize-none focus:outline-none focus:ring-amber-500 dark:focus:ring-amber-400"
            rows={3}
            disabled={sendingSms}
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-[11px] font-mono text-v2-ink-muted dark:text-v2-ink-subtle">
              To: {RECRUITER_SMS_NUMBER}
            </span>
            <button
              type="button"
              onClick={handleSendSms}
              disabled={sendingSms || !smsMessage.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-v2-ink px-3.5 py-2 text-[12px] font-semibold transition-all hover:-translate-y-px hover:shadow-md active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              {sendingSms ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              Send
            </button>
          </div>
        </div>
      )}

      {hasContacts ? (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          {upline && (
            <ContactRow
              name={fullName(upline)}
              role="Recruiter"
              email={upline.email}
              phone={upline.phone}
              photoUrl={upline.profile_photo_url}
              isPrimary
            />
          )}
          {keyContacts?.map((c) => {
            if (!c.profile) return null;
            return (
              <ContactRow
                key={c.id}
                name={fullName(c.profile)}
                role={c.label}
                email={c.profile.email}
                phone={c.profile.phone}
                photoUrl={c.profile.profile_photo_url}
              />
            );
          })}
        </ul>
      ) : (
        <p className="text-[13px] italic text-v2-ink-muted dark:text-v2-ink-subtle">
          No contacts available yet — they will appear here once your recruiter
          assigns them.
        </p>
      )}
    </EditorialSection>
  );
}

function fullName(p: UserProfile): string {
  return `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email;
}

interface ContactRowProps {
  name: string;
  role: string;
  email?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  isPrimary?: boolean;
}

function ContactRow({
  name,
  role,
  email,
  phone,
  photoUrl,
  isPrimary,
}: ContactRowProps) {
  return (
    <li className="flex items-start gap-3 py-1">
      <Avatar className="h-9 w-9 ring-1 ring-v2-ring  flex-shrink-0">
        <AvatarImage src={photoUrl || undefined} />
        <AvatarFallback className="text-[11px] font-mono bg-v2-ring dark:bg-v2-ring text-v2-ink dark:text-v2-ink-subtle">
          {name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[14px] font-semibold tracking-tight text-v2-ink  truncate">
            {name}
          </span>
          <span
            className={
              isPrimary
                ? "text-[10px] uppercase tracking-[0.18em] font-bold text-amber-700 dark:text-amber-400"
                : "text-[10px] uppercase tracking-[0.18em] font-bold text-v2-ink-muted dark:text-v2-ink-subtle"
            }
          >
            {role}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-4 flex-wrap">
          {email && (
            <a
              href={`mailto:${email}`}
              className="inline-flex items-center gap-1 text-[12px] text-v2-ink-muted dark:text-v2-ink-subtle hover:text-v2-ink dark:hover:text-v2-canvas transition-colors"
            >
              <Mail className="h-3 w-3" />
              <span className="font-mono">Email</span>
            </a>
          )}
          {phone && (
            <a
              href={`tel:${phone}`}
              className="inline-flex items-center gap-1 text-[12px] text-v2-ink-muted dark:text-v2-ink-subtle hover:text-v2-ink dark:hover:text-v2-canvas transition-colors"
            >
              <Phone className="h-3 w-3" />
              <span className="font-mono">Call</span>
            </a>
          )}
        </div>
      </div>
    </li>
  );
}
