// src/types/chat-bot-monitoring.ts
// Types for the standard-chat-bot monitoring API responses

export interface ActivityWindow {
  period: string; // "24h" | "7d"
  newConversations: number;
  inboundMessages: number;
  outboundMessages: number;
  responseRate: number; // 0-1
  avgResponseTimeMin: number;
}

export interface AgentMonitoringResponse {
  agentId: string;
  timestamp: string; // ISO-8601
  botStatus: {
    isActive: boolean;
    botEnabled: boolean;
    closeConnected: boolean;
    calendlyConnected: boolean;
    googleConnected: boolean;
    calendarProvider: "google" | "calendly" | null;
    followUpEnabled: boolean;
    remindersEnabled: boolean;
  };
  activity24h: ActivityWindow;
  activity7d: ActivityWindow;
  jobHealth: {
    pendingJobs: number;
    activeJobs: number;
    failedJobs24h: number;
  };
  conversion: {
    totalConversations7d: number;
    totalAppointments7d: number;
    bookingRate7d: number; // 0-1
  };
  errorIndicators: {
    newStale24h: number;
    newSuppressed24h: number;
    hardNoRate7d: number; // 0-1
  };
  followUp: {
    followUpsSent7d: number;
    followUpsConverted7d: number;
    followUpEffectiveness7d: number; // 0-1
  };
}

export interface SystemMonitoringResponse {
  timestamp: string; // ISO-8601
  status: "healthy" | "degraded" | "unhealthy";
  database: {
    connected: boolean;
    latencyMs: number;
  };
  jobQueue: {
    running: boolean;
    totalPending: number;
    totalActive: number;
    totalFailed24h: number;
    queueBreakdown: {
      queue: string;
      pending: number;
      active: number;
      failed24h: number;
    }[];
  };
  process: {
    uptimeSeconds: number;
    memoryUsageMb: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
    };
    nodeVersion: string;
  };
  throughput: {
    messagesLastHour: number;
    messagesLast24h: number;
    conversationsLast24h: number;
  };
  agents: {
    totalAgents: number;
    activeAgents: number;
    botEnabledAgents: number;
  };
}
