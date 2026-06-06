// src/services/sms/smsService.ts
// Service for sending SMS messages via Twilio Edge Function

import { supabase } from "../base/supabase";

export interface SendSmsRequest {
  to: string;
  message: string;
  recruitId?: string;
  automationId?: string;
  trigger?: string;
}

export interface SendSmsResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SendSmsBulkResult {
  successCount: number;
  failureCount: number;
  results: Array<{
    to: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
}

function normalizePhoneForValidation(phone: string): string | null {
  if (!phone) return null;

  const cleaned = phone.replace(/[^\d+]/g, "");

  const digitsOnly = cleaned.replace(/\+/g, "");
  if (digitsOnly.length < 10) return null;

  return cleaned;
}

export function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false;
  const normalized = normalizePhoneForValidation(phone);
  if (!normalized) return false;

  const digitsOnly = normalized.replace(/\+/g, "");
  return digitsOnly.length >= 10 && digitsOnly.length <= 15;
}

class SmsService {
  async sendSms(request: SendSmsRequest): Promise<SendSmsResponse> {
    if (!isValidPhoneNumber(request.to)) {
      return {
        success: false,
        error: `Invalid phone number format: ${request.to}`,
      };
    }

    if (!request.message || request.message.trim().length === 0) {
      return {
        success: false,
        error: "Message content cannot be empty",
      };
    }

    try {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: request,
      });

      if (error) {
        console.error("[smsService] Edge function error:", error);
        return {
          success: false,
          error: error.message || "Failed to send SMS",
        };
      }

      // The Edge Function returns { success, messageId?, error? }
      return data as SendSmsResponse;
    } catch (err) {
      console.error("[smsService] Unexpected error:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error sending SMS",
      };
    }
  }

  async sendSmsBulk(
    phoneNumbers: string[],
    message: string,
    metadata?: {
      recruitId?: string;
      automationId?: string;
      trigger?: string;
    },
  ): Promise<SendSmsBulkResult> {
    const results: SendSmsBulkResult["results"] = [];
    let successCount = 0;
    let failureCount = 0;

    // Filter to only valid phone numbers
    const validPhones = phoneNumbers.filter((phone) => {
      const isValid = isValidPhoneNumber(phone);
      if (!isValid) {
        console.warn(`[smsService] Skipping invalid phone: ${phone}`);
        results.push({
          to: phone,
          success: false,
          error: "Invalid phone number format",
        });
        failureCount++;
      }
      return isValid;
    });

    // Send to each valid recipient
    // Note: Could be parallelized with Promise.all, but sequential is safer for rate limits
    for (const phone of validPhones) {
      const result = await this.sendSms({
        to: phone,
        message,
        ...metadata,
      });

      results.push({
        to: phone,
        success: result.success,
        messageId: result.messageId,
        error: result.error,
      });

      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    return {
      successCount,
      failureCount,
      results,
    };
  }
}

// Singleton instance
export const smsService = new SmsService();
export { SmsService };
