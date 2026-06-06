// src/lib/constants.ts
// Centralized constants for the application

export const VALID_CONTRACT_LEVELS = [
  80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145,
] as const;

export type ContractLevel = (typeof VALID_CONTRACT_LEVELS)[number];

export function isValidContractLevel(level: number): level is ContractLevel {
  return VALID_CONTRACT_LEVELS.includes(level as ContractLevel);
}
