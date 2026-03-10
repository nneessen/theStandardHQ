import type {
  ConditionResponse,
  FollowUpQuestion,
  HealthCondition,
} from "../../types/underwriting.types";

export interface MissingFollowUpField {
  conditionCode: string;
  conditionName: string;
  questionId: string;
  questionLabel: string;
}

function parseConditionQuestions(
  condition: HealthCondition,
): FollowUpQuestion[] {
  const schema = condition.follow_up_schema as unknown;
  if (
    typeof schema === "object" &&
    schema !== null &&
    "questions" in schema &&
    Array.isArray((schema as { questions: unknown[] }).questions)
  ) {
    return (schema as { questions: FollowUpQuestion[] }).questions;
  }

  return [];
}

export function isFollowUpValueAnswered(
  question: Pick<FollowUpQuestion, "type" | "min" | "max">,
  value: unknown,
): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return false;
    }
    if (typeof question.min === "number" && value < question.min) {
      return false;
    }
    if (typeof question.max === "number" && value > question.max) {
      return false;
    }
    return true;
  }

  if (typeof value === "boolean") {
    return true;
  }

  return question.type === "multiselect" ? false : Boolean(value);
}

export function getMissingRequiredFollowUps(
  selectedConditions: ConditionResponse[],
  availableConditions: HealthCondition[],
): MissingFollowUpField[] {
  const conditionsByCode = new Map(
    availableConditions.map(
      (condition) => [condition.code, condition] as const,
    ),
  );

  const missing: MissingFollowUpField[] = [];

  for (const selectedCondition of selectedConditions) {
    const condition = conditionsByCode.get(selectedCondition.conditionCode);
    if (!condition) {
      continue;
    }

    const requiredQuestions = parseConditionQuestions(condition).filter(
      (question) => question.required,
    );

    for (const question of requiredQuestions) {
      if (
        !isFollowUpValueAnswered(
          question,
          selectedCondition.responses[question.id],
        )
      ) {
        missing.push({
          conditionCode: selectedCondition.conditionCode,
          conditionName: selectedCondition.conditionName,
          questionId: question.id,
          questionLabel: question.label,
        });
      }
    }
  }

  return missing;
}
