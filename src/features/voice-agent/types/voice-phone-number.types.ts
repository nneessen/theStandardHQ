export interface VoicePhoneNumber {
  id: string;
  agentId: string;
  phoneNumber: string; // E.164 format
  areaCode: number | null;
  countryCode: "US" | "CA";
  tollFree: boolean;
  numberProvider: "twilio" | "telnyx";
  nickname: string | null;
  isPrimary: boolean;
  status: "active" | "releasing" | "released";
  externalSubscriptionItemId: string | null;
  purchasedAt: string;
  releasedAt: string | null;
}

export interface PurchasePhoneNumberParams {
  tollFree: boolean;
  areaCode?: number;
  nickname?: string;
}

export interface UpdatePhoneNumberParams {
  phoneNumberId: string;
  nickname?: string;
  isPrimary?: boolean;
}
