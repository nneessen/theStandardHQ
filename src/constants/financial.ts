// src/constants/financial.ts

// Risk Score Weights for Chargeback Risk Calculation
export const RISK_SCORE_WEIGHTS = {
  RECENT_PAYMENT: 3, // Paid within last 6 months
  FIRST_YEAR_PAYMENT: 2, // Paid within 6-12 months
  HIGH_COMMISSION_AMOUNT: 2, // Commission amount > $5000
  ACTIVE_CHARGEBACK: 3, // Has pending or disputed chargebacks
  MANUAL_CALCULATION: 1, // Manually calculated commission
} as const;

// Chargeback Risk Thresholds
export const CHARGEBACK_THRESHOLDS = {
  GRACE_PERIOD_MONTHS: 24, // Standard chargeback grace period
  RECENT_PAYMENT_MONTHS: 6, // Considered recent payment
  FIRST_YEAR_MONTHS: 12, // First year payment threshold
  HIGH_COMMISSION_AMOUNT: 3500, // Threshold for high commission amount
  CRITICAL_RATE: 20, // Critical chargeback rate %
  HIGH_RATE: 15, // High chargeback rate %
  MODERATE_RATE: 10, // Moderate chargeback rate %
} as const;

// Financial Calculation Constants
export const FINANCIAL_CONSTANTS = {
  DEFAULT_ANALYSIS_MONTHS: 12, // Default analysis period
  DAYS_PER_MONTH: 30, // Approximate days per month for calculations
  HOURS_PER_DAY: 24,
  MINUTES_PER_HOUR: 60,
  SECONDS_PER_MINUTE: 60,
  MILLISECONDS_PER_SECOND: 1000,
} as const;

// Breakeven Analysis Rates
export const BREAKEVEN_RATES = {
  OPTIMISTIC_CHARGEBACK_RATE: 0.05, // 5% optimistic scenario
  PESSIMISTIC_CHARGEBACK_RATE: 0.25, // 25% pessimistic scenario
  MINIMUM_REALISTIC_RATE: 0.1, // Minimum 10% for realistic scenario
} as const;

// Emergency Fund Scenarios
export const EMERGENCY_FUND = {
  CONSERVATIVE_MONTHS: 3, // Conservative scenario coverage
  MODERATE_MONTHS: 6, // Moderate scenario coverage
  AGGRESSIVE_MONTHS: 12, // Aggressive scenario coverage
  PROJECTION_MONTHS: 12, // Standard projection period
} as const;

// Risk Level Thresholds
export const RISK_LEVELS = {
  LOW_THRESHOLD: 1, // Risk score <= 1 is low
  MEDIUM_THRESHOLD: 4, // Risk score <= 4 is medium, > 4 is high
} as const;

// Analytics Constants
export const ANALYTICS_CONSTANTS = {
  RENEWAL_RATE_MULTIPLIER: 0.025, // 2.5% of first year commission for renewals
  DEFAULT_AVG_COMMISSION_FALLBACK: 1000, // $1500 avg premium × 75% commission rate
  DEFAULT_ADVANCE_MONTHS: 9,
  MAX_GROWTH_RATE: 1.0, // Cap annual growth at 100%
  MIN_GROWTH_RATE: -0.5, // Cap decline at -50%
} as const;
