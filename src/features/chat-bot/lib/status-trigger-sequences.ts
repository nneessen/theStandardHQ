// Types, constants, and validation for status-triggered SMS outreach sequences.
// Mirrors the backend Zod schema in standard-chat-bot packages/shared/src/schemas/agent.ts

export interface StatusTriggerStep {
  delayMinutes: number; // 0-10080 (0 = immediate, 10080 = 7 days)
  aiInstructions: string; // 1-2000 chars — guides AI tone/content, NOT the literal message
}

export interface StatusTriggerSequence {
  statusLabel: string; // 1-255 chars, case-insensitive unique across sequences
  enabled: boolean;
  steps: StatusTriggerStep[]; // 1-3 items
}

export const MAX_SEQUENCES = 20;
export const MAX_STEPS_PER_SEQUENCE = 3;
export const MAX_DELAY_MINUTES = 10080; // 7 days
export const MAX_AI_INSTRUCTIONS_LENGTH = 2000;
export const MAX_STATUS_LABEL_LENGTH = 255;

export function createEmptyStep(): StatusTriggerStep {
  return { delayMinutes: 5, aiInstructions: "" };
}

export function createEmptySequence(statusLabel = ""): StatusTriggerSequence {
  return { statusLabel, enabled: true, steps: [createEmptyStep()] };
}

export function minutesToDelayParts(totalMinutes: number) {
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return { days, hours, minutes };
}

export function delayPartsToMinutes(
  days: number,
  hours: number,
  minutes: number,
) {
  return days * 1440 + hours * 60 + minutes;
}

export function validateSequences(
  sequences: StatusTriggerSequence[],
): string[] {
  const errors: string[] = [];

  if (sequences.length > MAX_SEQUENCES) {
    errors.push(`Maximum ${MAX_SEQUENCES} sequences allowed.`);
  }

  const seenLabels = new Set<string>();
  for (let i = 0; i < sequences.length; i++) {
    const seq = sequences[i];
    const label = seq.statusLabel.trim();

    if (!label) {
      errors.push(`Sequence ${i + 1}: status label is required.`);
    } else if (label.length > MAX_STATUS_LABEL_LENGTH) {
      errors.push(
        `Sequence ${i + 1}: status label too long (max ${MAX_STATUS_LABEL_LENGTH}).`,
      );
    } else {
      const lower = label.toLowerCase();
      if (seenLabels.has(lower)) {
        errors.push(`Duplicate status: "${label}".`);
      }
      seenLabels.add(lower);
    }

    if (seq.steps.length === 0) {
      errors.push(`Sequence ${i + 1}: at least one step is required.`);
    } else if (seq.steps.length > MAX_STEPS_PER_SEQUENCE) {
      errors.push(
        `Sequence ${i + 1}: maximum ${MAX_STEPS_PER_SEQUENCE} steps.`,
      );
    }

    for (let j = 0; j < seq.steps.length; j++) {
      const step = seq.steps[j];
      if (
        !Number.isInteger(step.delayMinutes) ||
        step.delayMinutes < 0 ||
        step.delayMinutes > MAX_DELAY_MINUTES
      ) {
        errors.push(
          `Sequence ${i + 1}, step ${j + 1}: delay must be 0–${MAX_DELAY_MINUTES} minutes.`,
        );
      }
      if (!step.aiInstructions.trim()) {
        errors.push(
          `Sequence ${i + 1}, step ${j + 1}: AI instructions required.`,
        );
      } else if (step.aiInstructions.length > MAX_AI_INSTRUCTIONS_LENGTH) {
        errors.push(
          `Sequence ${i + 1}, step ${j + 1}: AI instructions too long (max ${MAX_AI_INSTRUCTIONS_LENGTH}).`,
        );
      }
    }
  }

  return errors;
}
