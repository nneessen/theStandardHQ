// src/types/leaderboard.types.ts
// Type definitions for the Leaderboard feature

/**
 * Time period filter options for the leaderboard
 */
export type LeaderboardTimePeriod =
  | "daily"
  | "weekly"
  | "mtd"
  | "ytd"
  | "custom";

/**
 * Scope/mode filter options for the leaderboard
 * - all: Individual agent rankings
 * - agency: Agency rankings (combined metrics for all agents in agency)
 * - team: Team rankings (combined metrics for leader + downlines)
 * - submit: Submit leaderboard (rankings by AP for submitted policies)
 */
export type LeaderboardScope = "all" | "agency" | "team" | "submit";

/**
 * Configurable team threshold values (minimum downlines to qualify as team)
 */
export type TeamThreshold = 3 | 5 | 10;

/**
 * Filter configuration for leaderboard queries
 */
export interface LeaderboardFilters {
  timePeriod: LeaderboardTimePeriod;
  startDate?: string; // ISO date string, required when timePeriod is 'custom'
  endDate?: string; // ISO date string, required when timePeriod is 'custom'
  scope: LeaderboardScope;
  teamThreshold?: TeamThreshold; // minimum downlines to qualify as team (for team mode)
}

/**
 * Single entry in the individual agent leaderboard
 */
export interface AgentLeaderboardEntry {
  agentId: string;
  agentName: string;
  agentEmail: string;
  profilePhotoUrl: string | null;
  agencyId: string | null;
  agencyName: string | null;
  directDownlineCount: number;
  ipTotal: number; // Issued Premium - active policies with paid commissions based off effective date
  apTotal: number; // Annual Premium - pending policies based off submit date
  policyCount: number; // Number of issued policies
  pendingPolicyCount: number; // Number of pending policies
  prospectCount: number; // Agent's own prospects (not yet in pipeline)
  pipelineCount: number; // Agent's own recruits in active pipeline
  rankOverall: number; // Position in the leaderboard
}

/**
 * Single entry in the agency leaderboard
 * Represents combined metrics for all agents in an agency
 */
export interface AgencyLeaderboardEntry {
  agencyId: string;
  agencyName: string;
  ownerId: string;
  ownerName: string;
  agentCount: number;
  ipTotal: number;
  apTotal: number;
  policyCount: number;
  pendingPolicyCount: number;
  prospectCount: number;
  pipelineCount: number;
  rankOverall: number;
}

/**
 * Single entry in the team leaderboard
 * Represents combined metrics for a team leader + their direct downlines
 */
export interface TeamLeaderboardEntry {
  leaderId: string;
  leaderName: string;
  leaderEmail: string;
  leaderProfilePhotoUrl: string | null;
  agencyId: string | null;
  agencyName: string | null;
  teamSize: number;
  ipTotal: number;
  apTotal: number;
  policyCount: number;
  pendingPolicyCount: number;
  prospectCount: number;
  pipelineCount: number;
  rankOverall: number;
}

/**
 * Single entry in the submit leaderboard
 * Simplified metrics: only AP and policy count for submitted policies
 */
export interface SubmitLeaderboardEntry {
  agentId: string;
  agentName: string;
  agentEmail: string;
  profilePhotoUrl: string | null;
  agencyId: string | null;
  agencyName: string | null;
  apTotal: number;
  policyCount: number;
  rankOverall: number;
}

/**
 * Union type for any leaderboard entry
 */
export type LeaderboardEntry =
  | AgentLeaderboardEntry
  | AgencyLeaderboardEntry
  | TeamLeaderboardEntry
  | SubmitLeaderboardEntry;

/**
 * Team leader option for the filter dropdown (unchanged)
 */
export interface TeamLeader {
  id: string;
  name: string;
  downlineCount: number;
}

/**
 * Aggregate totals for the current leaderboard view
 */
export interface LeaderboardTotals {
  totalEntries: number; // agents, agencies, or teams depending on mode
  totalIp: number;
  totalAp: number;
  totalPolicies: number;
  totalPendingPolicies: number;
  avgIpPerEntry: number;
  totalProspects: number;
  totalPipeline: number;
}

/**
 * Response from the agent leaderboard service
 */
export interface AgentLeaderboardResponse {
  entries: AgentLeaderboardEntry[];
  totals: LeaderboardTotals;
}

/**
 * Response from the agency leaderboard service
 */
export interface AgencyLeaderboardResponse {
  entries: AgencyLeaderboardEntry[];
  totals: LeaderboardTotals;
}

/**
 * Response from the team leaderboard service
 */
export interface TeamLeaderboardResponse {
  entries: TeamLeaderboardEntry[];
  totals: LeaderboardTotals;
}

/**
 * Simplified totals for submit leaderboard (no IP/prospects/pipeline)
 */
export interface SubmitLeaderboardTotals {
  totalEntries: number;
  totalAp: number;
  totalPolicies: number;
  avgApPerEntry: number;
}

/**
 * Response from the submit leaderboard service
 */
export interface SubmitLeaderboardResponse {
  entries: SubmitLeaderboardEntry[];
  totals: SubmitLeaderboardTotals;
}

/**
 * Union type for any leaderboard response
 */
export type LeaderboardResponse =
  | AgentLeaderboardResponse
  | AgencyLeaderboardResponse
  | TeamLeaderboardResponse
  | SubmitLeaderboardResponse;

/**
 * Date range calculated from a time period filter
 */
export interface DateRange {
  start: string; // ISO date string (YYYY-MM-DD)
  end: string; // ISO date string (YYYY-MM-DD)
}

/**
 * Type guard to check if entry is an agent entry
 */
export function isAgentEntry(
  entry: LeaderboardEntry,
): entry is AgentLeaderboardEntry {
  return "agentId" in entry;
}

/**
 * Type guard to check if entry is an agency entry
 */
export function isAgencyEntry(
  entry: LeaderboardEntry,
): entry is AgencyLeaderboardEntry {
  return "agencyId" in entry && "ownerName" in entry;
}

/**
 * Type guard to check if entry is a team entry
 */
export function isTeamEntry(
  entry: LeaderboardEntry,
): entry is TeamLeaderboardEntry {
  return "leaderId" in entry;
}

/**
 * Type guard to check if entry is a submit leaderboard entry
 */
export function isSubmitEntry(
  entry: LeaderboardEntry,
): entry is SubmitLeaderboardEntry {
  // SubmitEntry has agentId but NOT ipTotal (which AgentLeaderboardEntry has)
  return "agentId" in entry && !("ipTotal" in entry);
}
