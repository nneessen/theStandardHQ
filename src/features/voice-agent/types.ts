export interface VoiceAgentFeatureFlags {
  missedAppointment: boolean;
  reschedule: boolean;
  quotedFollowup: boolean;
  afterHoursInbound: boolean;
}

export interface VoiceEntitlementSnapshotView {
  agentId?: string;
  status?: string;
  planCode?: string;
  includedMinutes?: number;
  hardLimitMinutes?: number;
  cycleStartAt?: string | null;
  cycleEndAt?: string | null;
  cancelAt?: string | null;
  canceledAt?: string | null;
  features?: VoiceAgentFeatureFlags;
  usage?: {
    outboundCalls: number;
    inboundCalls: number;
    answeredCalls: number;
    usedMinutes: number;
    remainingMinutes: number;
  };
}
