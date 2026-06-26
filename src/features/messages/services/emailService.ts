// src/features/messages/services/emailService.ts
// Service for sending and managing emails
// Supports dual provider: Gmail (if connected) or Mailgun (fallback)

import { supabase } from "@/services/base/supabase";
import { getTodayString, formatDateForDB } from "@/lib/date";

import { gmailService } from "@/services/gmail";

// Email source types for domain selection
// - personal: System emails from compose (mail.thestandardhq.com)
// - workflow: Automated system emails (notifications.thestandardhq.com)
// - bulk: Newsletters/campaigns (updates.thestandardhq.com)
// - owner: Personal emails from owner's actual address (thestandardhq.com root)
export type EmailSource = "personal" | "workflow" | "bulk" | "owner";

// Training document attachment info
export interface TrainingDocumentAttachment {
  id: string;
  name: string;
  fileName: string;
  fileType: string | null;
  fileSize: number | null;
  storagePath: string;
}

export interface SendEmailParams {
  userId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  replyToMessageId?: string;
  threadId?: string;
  attachments?: File[];
  trainingDocuments?: TrainingDocumentAttachment[]; // Training documents to attach
  scheduledFor?: Date;
  signatureId?: string;
  source?: EmailSource; // Determines which domain to use
  fromOverride?: string; // Override from address (for admins)
}

export interface EmailQuota {
  dailyLimit: number;
  dailyUsed: number;
  monthlyLimit: number;
  monthlyUsed: number;
  resetAt: string;
}

export interface EmailDraft {
  id: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  updatedAt: string;
}

// Mailgun domain configuration
// All emails go through the same Mailgun domain for simplicity
// Different email sources are tracked via the 'source' column
const MAILGUN_DOMAIN = "updates.thestandardhq.com";

export const EMAIL_DOMAINS: Record<EmailSource, string> = {
  personal: MAILGUN_DOMAIN,
  workflow: MAILGUN_DOMAIN,
  bulk: MAILGUN_DOMAIN,
  owner: MAILGUN_DOMAIN,
} as const;

// Helper to get domain based on email source
function getEmailDomain(source: EmailSource = "personal"): string {
  return EMAIL_DOMAINS[source];
}

// Cost per email in cents for Mailgun
const MAILGUN_COST_PER_EMAIL_CENTS = 1;

/**
 * Get a system setting value by key
 */
async function getSystemSetting(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    console.error(`[getSystemSetting] Error fetching ${key}:`, error);
    return null;
  }

  return data?.value || null;
}

/**
 * Get the monthly Mailgun spend in cents for a user
 */
async function getMonthlyMailgunSpend(userId: string): Promise<number> {
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  const monthStart = formatDateForDB(firstOfMonth);

  const { data, error } = await supabase
    .from("email_quota_tracking")
    .select("emails_sent, cost_cents")
    .eq("user_id", userId)
    .eq("provider", "mailgun")
    .gte("date", monthStart);

  if (error) {
    console.error("[getMonthlyMailgunSpend] Error:", error);
    return 0;
  }

  // Sum up the total cost (emails_sent * cost_cents for each day)
  return (data || []).reduce(
    (sum, d) =>
      sum +
      (d.emails_sent || 0) * (d.cost_cents || MAILGUN_COST_PER_EMAIL_CENTS),
    0,
  );
}

export async function sendEmail(
  params: SendEmailParams,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const {
    userId,
    to,
    cc,
    bcc,
    subject,
    bodyHtml,
    bodyText,
    replyToMessageId,
    threadId,
    trainingDocuments,
    scheduledFor,
    signatureId,
    source = "personal",
    fromOverride,
  } = params;

  try {
    // Check if user has Gmail connected - route through Gmail API if so
    console.log(
      "[sendEmail] Provider check - userId:",
      userId,
      "fromOverride:",
      fromOverride,
    );
    const hasGmail = await gmailService.hasActiveIntegration(userId);
    console.log("[sendEmail] hasGmailIntegration:", hasGmail);

    // Bulk email restriction for non-Gmail users
    // Users without connected Gmail can only send to 5 recipients max via Mailgun
    const BULK_THRESHOLD = 5;
    const recipientCount = to.length + (cc?.length || 0) + (bcc?.length || 0);

    if (!hasGmail && !fromOverride && recipientCount > BULK_THRESHOLD) {
      console.log(
        `[sendEmail] Bulk send blocked - ${recipientCount} recipients exceeds threshold of ${BULK_THRESHOLD}`,
      );
      return {
        success: false,
        error: `Sending to more than ${BULK_THRESHOLD} recipients requires a connected Gmail account. Please connect your Gmail in Settings → Integrations, or reduce the number of recipients.`,
      };
    }

    if (hasGmail && !fromOverride) {
      // Gmail integration is active - use Gmail API
      // Note: fromOverride bypasses Gmail to use system addresses
      console.log(
        "[sendEmail] User has Gmail connected, routing through Gmail API",
      );
      return sendViaGmail(params);
    }

    // No Gmail or explicit fromOverride - use Mailgun
    console.log("[sendEmail] Using Mailgun provider");

    // Check quota first (daily and monthly limits)
    const quota = await getEmailQuota(userId);
    if (quota.dailyUsed >= quota.dailyLimit) {
      return {
        success: false,
        error: "Daily email limit reached. Limit resets at midnight.",
      };
    }
    if (quota.monthlyUsed >= quota.monthlyLimit) {
      return {
        success: false,
        error:
          "Monthly email limit reached. Limit resets on the 1st of next month.",
      };
    }

    // Check Mailgun cost budget (if configured)
    const budgetSetting = await getSystemSetting(
      "mailgun_monthly_budget_cents",
    );
    const budgetCents = budgetSetting ? parseInt(budgetSetting, 10) : 0;

    if (budgetCents > 0) {
      const monthlySpend = await getMonthlyMailgunSpend(userId);
      if (monthlySpend >= budgetCents) {
        const budgetDollars = (budgetCents / 100).toFixed(2);
        console.log(
          `[sendEmail] Budget cap reached - spend: ${monthlySpend} cents, budget: ${budgetCents} cents`,
        );
        return {
          success: false,
          error: `Monthly email budget exceeded ($${budgetDollars}). Connect your Gmail account in Settings → Integrations to continue sending emails.`,
        };
      }
    }

    // Get user's email address for from field
    const { data: userData } = await supabase
      .from("user_profiles")
      .select("email, first_name, last_name")
      .eq("id", userId)
      .single();

    if (!userData?.email) {
      return { success: false, error: "User email not found" };
    }

    // Get signature if specified
    let finalBodyHtml = bodyHtml;
    if (signatureId) {
      const { data: signature } = await supabase
        .from("email_signatures")
        .select("content_html")
        .eq("id", signatureId)
        .eq("user_id", userId)
        .single();

      if (signature?.content_html) {
        finalBodyHtml = `${bodyHtml}<br/><br/>${signature.content_html}`;
      }
    }

    // Generate tracking ID and Message-ID for threading
    const trackingId = crypto.randomUUID();
    const messageId = `<${crypto.randomUUID()}@${MAILGUN_DOMAIN}>`;

    // Get threading headers if this is a reply
    let inReplyToHeader: string | null = null;
    let referencesArray: string[] = [];

    if (replyToMessageId) {
      // Fetch the parent message to get its Message-ID and References
      const { data: parentMessage } = await supabase
        .from("user_emails")
        .select("message_id_header, references_header")
        .eq("id", replyToMessageId)
        .single();

      if (parentMessage?.message_id_header) {
        inReplyToHeader = parentMessage.message_id_header;
        // Build References chain: parent's references + parent's Message-ID
        referencesArray = [
          ...(parentMessage.references_header || []),
          parentMessage.message_id_header,
        ];
      }
    }

    const fromName =
      `${userData.first_name || ""} ${userData.last_name || ""}`.trim() ||
      "The Standard HQ";
    const emailDomain = getEmailDomain(source);
    // Priority: fromOverride (admin) > owner source (user's email) > noreply@domain
    const fromAddress = fromOverride
      ? fromOverride
      : source === "owner"
        ? userData.email
        : `noreply@${emailDomain}`;
    const replyTo = fromOverride || userData.email;

    // If scheduled, save email to user_emails first, then create schedule entry
    if (scheduledFor && scheduledFor > new Date()) {
      // Step 1: Create email record in user_emails with scheduled status
      const { data: emailRecord, error: emailError } = await supabase
        .from("user_emails")
        .insert({
          user_id: userId,
          sender_id: userId, // Required for RLS policy
          to_addresses: to,
          cc_addresses: cc || [],
          subject,
          body_html: finalBodyHtml,
          body_text: bodyText || stripHtml(bodyHtml),
          from_address: fromAddress,
          status: "scheduled",
          scheduled_for: scheduledFor.toISOString(),
          tracking_id: trackingId,
          thread_id: threadId,
          is_incoming: false,
          source: source, // Track email source
        })
        .select()
        .single();

      if (emailError) {
        console.error("Error creating scheduled email:", emailError);
        return { success: false, error: "Failed to schedule email" };
      }

      // Step 2: Create schedule queue entry referencing the email
      const { error: scheduleError } = await supabase
        .from("email_scheduled")
        .insert({
          user_id: userId,
          email_id: emailRecord.id,
          scheduled_for: scheduledFor.toISOString(),
          status: "pending",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });

      if (scheduleError) {
        console.error("Error queuing scheduled email:", scheduleError);
        // Rollback the email record
        await supabase.from("user_emails").delete().eq("id", emailRecord.id);
        return { success: false, error: "Failed to schedule email" };
      }

      return { success: true, messageId: emailRecord.id };
    }

    // Determine or create thread
    let finalThreadId = threadId;
    if (!finalThreadId) {
      // Generate subject hash for thread grouping
      const subjectHash = subject
        .toLowerCase()
        .replace(/^(re:|fwd:|fw:)\s*/gi, "")
        .trim()
        .slice(0, 255);

      // Create new thread for this email
      const { data: newThread, error: threadError } = await supabase
        .from("email_threads")
        .insert({
          user_id: userId,
          subject,
          subject_hash: subjectHash,
          snippet: stripHtml(bodyHtml).slice(0, 200),
          message_count: 1,
          unread_count: 0,
          last_message_at: new Date().toISOString(),
          participant_emails: [...to, ...(cc || [])],
          is_starred: false,
          is_archived: false,
          labels: [],
        })
        .select()
        .single();

      if (threadError) {
        console.error("Error creating thread:", threadError);
        return {
          success: false,
          error: "Failed to create conversation thread",
        };
      }

      finalThreadId = newThread.id;
    } else {
      // Update existing thread - get current count first
      const { data: existingThread } = await supabase
        .from("email_threads")
        .select("message_count")
        .eq("id", threadId)
        .single();

      await supabase
        .from("email_threads")
        .update({
          snippet: stripHtml(bodyHtml).slice(0, 200),
          last_message_at: new Date().toISOString(),
          message_count: (existingThread?.message_count || 0) + 1,
        })
        .eq("id", threadId);
    }

    // Send via edge function
    console.log("[sendEmail] Invoking send-email function with:", {
      to,
      subject,
      from: `${fromName} <${fromAddress}>`,
      threadId: finalThreadId,
    });

    const { data, error } = await supabase.functions.invoke("send-email", {
      body: {
        to,
        cc,
        bcc,
        subject,
        html: finalBodyHtml,
        text: bodyText || stripHtml(bodyHtml),
        from: `${fromName} <${fromAddress}>`,
        replyTo,
        trackingId,
        userId,
        threadId: finalThreadId,
        // Threading headers for Mailgun
        messageId,
        inReplyTo: inReplyToHeader,
        references: referencesArray.length > 0 ? referencesArray : undefined,
        // Training document attachments
        trainingDocuments:
          trainingDocuments && trainingDocuments.length > 0
            ? trainingDocuments
            : undefined,
      },
    });

    console.log("[sendEmail] Edge function response:", { data, error });

    if (error) {
      console.error("[sendEmail] Edge function error:", error);
      // Delete thread if we just created it and sending failed
      if (!threadId && finalThreadId) {
        await supabase.from("email_threads").delete().eq("id", finalThreadId);
      }
      return { success: false, error: error.message };
    }

    // Also check if the data indicates failure
    if (data && !data.success) {
      console.error("[sendEmail] Edge function returned failure:", data);
      if (!threadId && finalThreadId) {
        await supabase.from("email_threads").delete().eq("id", finalThreadId);
      }
      return { success: false, error: data.error || "Failed to send email" };
    }

    // Create the sent email record in user_emails
    console.log("[sendEmail] Inserting email record into user_emails...");
    const { data: emailRecord, error: emailRecordError } = await supabase
      .from("user_emails")
      .insert({
        user_id: userId,
        sender_id: userId, // Required for RLS policy
        thread_id: finalThreadId,
        from_address: fromAddress,
        to_addresses: to,
        cc_addresses: cc || [],
        subject,
        body_html: finalBodyHtml,
        body_text: bodyText || stripHtml(bodyHtml),
        is_incoming: false,
        is_read: true,
        status: "sent",
        tracking_id: trackingId,
        source: source, // Track email source for domain selection
        // Threading headers for proper thread reconstruction
        message_id_header: messageId,
        in_reply_to_header: inReplyToHeader,
        references_header: referencesArray.length > 0 ? referencesArray : null,
        provider: "mailgun",
        provider_message_id: data?.mailgunId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (emailRecordError) {
      // Email was sent successfully but record wasn't saved
      // This is a critical error - the email won't appear in the sent folder
      console.error(
        "[sendEmail] CRITICAL: Email sent but record failed to save:",
        emailRecordError,
      );
      console.error("[sendEmail] Insert payload was:", {
        user_id: userId,
        sender_id: userId,
        thread_id: finalThreadId,
        from_address: fromAddress,
        to_addresses: to,
        subject,
        is_incoming: false,
        status: "sent",
      });
      // Return partial success with warning
      return {
        success: true,
        messageId: data?.messageId || trackingId,
        error:
          "Email sent but failed to save record. It may not appear in Sent folder.",
      };
    }

    console.log(
      "[sendEmail] Email record saved successfully:",
      emailRecord?.id,
    );

    // Update quota — Mailgun path
    await incrementQuota(userId, "mailgun");

    return { success: true, messageId: data?.messageId || trackingId };
  } catch (err) {
    console.error("Error in sendEmail:", err);
    return { success: false, error: "Failed to send email" };
  }
}

export async function getEmailQuota(userId: string): Promise<EmailQuota> {
  const today = getTodayString();

  // Default limits (conservative for single-user app)
  const defaultDailyLimit = 50;
  const defaultMonthlyLimit = 500;

  // Get today's quota record
  const { data: dailyData, error: dailyError } = await supabase
    .from("email_quota_tracking")
    .select("emails_sent")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();

  if (dailyError) {
    console.error("[getEmailQuota] Error fetching daily quota:", dailyError);
  }

  // Calculate monthly usage by aggregating all days in current month
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  const monthStart = formatDateForDB(firstOfMonth);

  const { data: monthlyData, error: monthlyError } = await supabase
    .from("email_quota_tracking")
    .select("emails_sent")
    .eq("user_id", userId)
    .gte("date", monthStart);

  if (monthlyError) {
    console.error(
      "[getEmailQuota] Error fetching monthly quota:",
      monthlyError,
    );
  }

  const dailyUsed = dailyData?.emails_sent || 0;
  const monthlyUsed = (monthlyData || []).reduce(
    (sum, d) => sum + (d.emails_sent || 0),
    0,
  );

  return {
    dailyLimit: defaultDailyLimit,
    dailyUsed,
    monthlyLimit: defaultMonthlyLimit,
    monthlyUsed,
    resetAt: new Date(new Date().setHours(24, 0, 0, 0)).toISOString(),
  };
}

async function incrementQuota(
  userId: string,
  provider: "mailgun" | "gmail",
): Promise<void> {
  const today = getTodayString();

  // Increment usage_tracking (source of truth for billing UI + plan limit enforcement)
  const { error: rpcError } = await supabase.rpc("increment_usage", {
    p_user_id: userId,
    p_metric: "emails_sent",
    p_increment: 1,
  });
  if (rpcError) {
    console.error(
      "[incrementQuota] Error incrementing usage_tracking:",
      rpcError,
    );
  }

  // Increment email_quota_tracking for all providers — this table drives getEmailQuota()
  // which enforces pre-send limits on both paths. The provider column is stored accurately
  // so getMonthlyMailgunSpend() (which filters eq("provider", "mailgun")) is not affected
  // by Gmail sends. Writing with the correct provider value is all that's needed.
  const { data: existing, error: selectError } = await supabase
    .from("email_quota_tracking")
    .select("id, emails_sent")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();

  if (selectError) {
    console.error(
      "[incrementQuota] Error checking existing quota:",
      selectError,
    );
  }

  if (existing) {
    const newCount = (existing.emails_sent || 0) + 1;
    const { error: updateError } = await supabase
      .from("email_quota_tracking")
      .update({ emails_sent: newCount })
      .eq("id", existing.id);

    if (updateError) {
      console.error("[incrementQuota] Error updating quota:", updateError);
    }
  } else {
    const { error: insertError } = await supabase
      .from("email_quota_tracking")
      .insert({ user_id: userId, date: today, emails_sent: 1, provider });

    if (insertError) {
      console.error("[incrementQuota] Error inserting quota:", insertError);
    }
  }
}

export async function saveDraft(params: {
  userId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  draftId?: string;
}): Promise<{ success: boolean; draftId?: string }> {
  const { userId, to, cc, bcc, subject, bodyHtml, draftId } = params;

  if (draftId) {
    // Update existing draft
    const { error } = await supabase
      .from("user_emails")
      .update({
        to_addresses: to,
        cc_addresses: cc,
        bcc_addresses: bcc,
        subject,
        body_html: bodyHtml,
        body_text: stripHtml(bodyHtml),
        updated_at: new Date().toISOString(),
      })
      .eq("id", draftId)
      .eq("user_id", userId)
      .eq("status", "draft");

    if (error) {
      console.error("Error updating draft:", error);
      return { success: false };
    }

    return { success: true, draftId };
  }

  // Create new draft
  const { data, error } = await supabase
    .from("user_emails")
    .insert({
      user_id: userId,
      sender_id: userId, // Required for RLS policy
      to_addresses: to,
      cc_addresses: cc,
      bcc_addresses: bcc,
      subject,
      body_html: bodyHtml,
      body_text: stripHtml(bodyHtml),
      status: "draft",
      is_incoming: false,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating draft:", error);
    return { success: false };
  }

  return { success: true, draftId: data?.id };
}

export async function deleteDraft(
  draftId: string,
  userId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("user_emails")
    .delete()
    .eq("id", draftId)
    .eq("user_id", userId)
    .eq("status", "draft");

  if (error) {
    console.error("Error deleting draft:", error);
    return false;
  }

  return true;
}

export async function getDrafts(userId: string): Promise<EmailDraft[]> {
  const { data, error } = await supabase
    .from("user_emails")
    .select(
      "id, to_addresses, cc_addresses, bcc_addresses, subject, body_html, updated_at",
    )
    .eq("user_id", userId)
    .eq("status", "draft")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching drafts:", error);
    return [];
  }

  return (data || []).map((d: Record<string, unknown>) => ({
    id: d.id as string,
    to: (d.to_addresses as string[]) || [],
    cc: d.cc_addresses as string[] | undefined,
    bcc: d.bcc_addresses as string[] | undefined,
    subject: (d.subject as string) || "",
    bodyHtml: (d.body_html as string) || "",
    updatedAt: d.updated_at as string,
  }));
}

// Helper functions
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// =========================================================================
// Gmail Provider: Send email via Gmail API
// =========================================================================
async function sendViaGmail(
  params: SendEmailParams,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const {
    userId,
    to,
    cc,
    bcc,
    subject,
    bodyHtml,
    bodyText,
    replyToMessageId,
    threadId,
    signatureId,
    scheduledFor,
  } = params;

  try {
    // Check quota first (Gmail also has quotas)
    const quota = await getEmailQuota(userId);
    if (quota.dailyUsed >= quota.dailyLimit) {
      return { success: false, error: "Daily email limit reached" };
    }

    // Get user's profile for name
    const { data: userData } = await supabase
      .from("user_profiles")
      .select("email, first_name, last_name")
      .eq("id", userId)
      .single();

    if (!userData?.email) {
      return { success: false, error: "User profile not found" };
    }

    // Get signature if specified
    let finalBodyHtml = bodyHtml;
    if (signatureId) {
      const { data: signature } = await supabase
        .from("email_signatures")
        .select("content_html")
        .eq("id", signatureId)
        .eq("user_id", userId)
        .single();

      if (signature?.content_html) {
        finalBodyHtml = `${bodyHtml}<br/><br/>${signature.content_html}`;
      }
    }

    // Generate tracking ID and Message-ID
    const trackingId = crypto.randomUUID();
    const messageId = `<${crypto.randomUUID()}@gmail.com>`;

    // Get threading headers if this is a reply
    let inReplyToHeader: string | null = null;
    let referencesArray: string[] = [];
    let gmailThreadId: string | null = null;

    if (replyToMessageId) {
      const { data: parentMessage } = await supabase
        .from("user_emails")
        .select("message_id_header, references_header, gmail_thread_id")
        .eq("id", replyToMessageId)
        .single();

      if (parentMessage) {
        if (parentMessage.message_id_header) {
          inReplyToHeader = parentMessage.message_id_header;
          referencesArray = [
            ...(parentMessage.references_header || []),
            parentMessage.message_id_header,
          ];
        }
        // Use Gmail thread ID for threading in Gmail
        gmailThreadId = parentMessage.gmail_thread_id;
      }
    }

    // Handle scheduled emails (Gmail doesn't support scheduling natively, so we use our system)
    if (scheduledFor && scheduledFor > new Date()) {
      // Create email record with scheduled status
      const { data: emailRecord, error: emailError } = await supabase
        .from("user_emails")
        .insert({
          user_id: userId,
          sender_id: userId,
          to_addresses: to,
          cc_addresses: cc || [],
          subject,
          body_html: finalBodyHtml,
          body_text: bodyText || stripHtml(bodyHtml),
          status: "scheduled",
          scheduled_for: scheduledFor.toISOString(),
          tracking_id: trackingId,
          thread_id: threadId,
          is_incoming: false,
          email_provider: "gmail", // Will be sent via Gmail when triggered
        })
        .select()
        .single();

      if (emailError) {
        console.error(
          "[sendViaGmail] Error creating scheduled email:",
          emailError,
        );
        return { success: false, error: "Failed to schedule email" };
      }

      // Create schedule queue entry
      const { error: scheduleError } = await supabase
        .from("email_scheduled")
        .insert({
          user_id: userId,
          email_id: emailRecord.id,
          scheduled_for: scheduledFor.toISOString(),
          status: "pending",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });

      if (scheduleError) {
        await supabase.from("user_emails").delete().eq("id", emailRecord.id);
        return { success: false, error: "Failed to schedule email" };
      }

      return { success: true, messageId: emailRecord.id };
    }

    // Determine or create thread
    let finalThreadId = threadId;
    if (!finalThreadId) {
      const subjectHash = subject
        .toLowerCase()
        .replace(/^(re:|fwd:|fw:)\s*/gi, "")
        .trim()
        .slice(0, 255);

      const { data: newThread, error: threadError } = await supabase
        .from("email_threads")
        .insert({
          user_id: userId,
          subject,
          subject_hash: subjectHash,
          snippet: stripHtml(bodyHtml).slice(0, 200),
          message_count: 1,
          unread_count: 0,
          last_message_at: new Date().toISOString(),
          participant_emails: [...to, ...(cc || [])],
          is_starred: false,
          is_archived: false,
          labels: [],
        })
        .select()
        .single();

      if (threadError) {
        console.error("[sendViaGmail] Error creating thread:", threadError);
        return {
          success: false,
          error: "Failed to create conversation thread",
        };
      }

      finalThreadId = newThread.id;
    } else {
      // Update existing thread
      const { data: existingThread } = await supabase
        .from("email_threads")
        .select("message_count")
        .eq("id", threadId)
        .single();

      await supabase
        .from("email_threads")
        .update({
          snippet: stripHtml(bodyHtml).slice(0, 200),
          last_message_at: new Date().toISOString(),
          message_count: (existingThread?.message_count || 0) + 1,
        })
        .eq("id", threadId);
    }

    // Send via Gmail edge function
    console.log("[sendViaGmail] Invoking gmail-send-email function");

    const { data, error } = await supabase.functions.invoke(
      "gmail-send-email",
      {
        body: {
          userId,
          to,
          cc,
          bcc,
          subject,
          html: finalBodyHtml,
          text: bodyText || stripHtml(bodyHtml),
          threadId: finalThreadId,
          gmailThreadId,
          messageIdHeader: messageId,
          inReplyTo: inReplyToHeader,
          references: referencesArray.length > 0 ? referencesArray : undefined,
        },
      },
    );

    console.log("[sendViaGmail] Edge function response:", { data, error });

    if (error) {
      console.error("[sendViaGmail] Edge function error:", error);
      // Delete thread if we just created it
      if (!threadId && finalThreadId) {
        await supabase.from("email_threads").delete().eq("id", finalThreadId);
      }
      return { success: false, error: error.message };
    }

    // Check for specific error codes from the edge function
    if (data && !data.success) {
      console.error("[sendViaGmail] Edge function returned failure:", data);
      if (!threadId && finalThreadId) {
        await supabase.from("email_threads").delete().eq("id", finalThreadId);
      }

      // If Gmail not connected or auth failed, provide helpful message
      if (
        data.code === "NOT_CONNECTED" ||
        data.code === "TOKEN_EXPIRED" ||
        data.code === "AUTH_FAILED"
      ) {
        return {
          success: false,
          error:
            "Gmail connection issue. Please reconnect your Gmail account in Settings.",
        };
      }

      return {
        success: false,
        error: data.error || "Failed to send via Gmail",
      };
    }

    // Get Gmail integration info for the from address
    const gmailIntegration = await gmailService.getIntegration(userId);
    const fromAddress = gmailIntegration?.gmail_address || userData.email;

    // Create email record in user_emails
    const { data: emailRecord, error: emailRecordError } = await supabase
      .from("user_emails")
      .insert({
        user_id: userId,
        sender_id: userId,
        thread_id: finalThreadId,
        from_address: fromAddress,
        to_addresses: to,
        cc_addresses: cc || [],
        subject,
        body_html: finalBodyHtml,
        body_text: bodyText || stripHtml(bodyHtml),
        is_incoming: false,
        is_read: true,
        status: "sent",
        tracking_id: trackingId,
        email_provider: "gmail",
        // Gmail-specific fields
        gmail_message_id: data?.gmailMessageId,
        gmail_thread_id: data?.gmailThreadId,
        // Threading headers
        message_id_header: messageId,
        in_reply_to_header: inReplyToHeader,
        references_header: referencesArray.length > 0 ? referencesArray : null,
        provider: "gmail",
        provider_message_id: data?.gmailMessageId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (emailRecordError) {
      console.error(
        "[sendViaGmail] CRITICAL: Email sent but record failed to save:",
        emailRecordError,
      );
      return {
        success: true,
        messageId: data?.messageId || trackingId,
        error:
          "Email sent but failed to save record. It may not appear in Sent folder.",
      };
    }

    console.log("[sendViaGmail] Email record saved:", emailRecord?.id);

    // Update quota — Gmail path (no Mailgun cost tracking)
    await incrementQuota(userId, "gmail");

    return { success: true, messageId: data?.messageId || trackingId };
  } catch (err) {
    console.error("[sendViaGmail] Error:", err);
    return { success: false, error: "Failed to send email via Gmail" };
  }
}
