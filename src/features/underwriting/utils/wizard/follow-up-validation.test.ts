import { describe, expect, it } from "vitest";
import {
  getMissingRequiredFollowUps,
  isFollowUpValueAnswered,
} from "./follow-up-validation";
import type {
  ConditionResponse,
  FollowUpQuestion,
  HealthCondition,
} from "../../types/underwriting.types";

describe("follow-up validation", () => {
  describe("isFollowUpValueAnswered", () => {
    it("treats zero as answered for numeric questions", () => {
      const question: Pick<FollowUpQuestion, "type"> = { type: "number" };
      expect(isFollowUpValueAnswered(question, 0)).toBe(true);
    });

    it("treats out-of-range numeric values as unanswered", () => {
      const question: Pick<FollowUpQuestion, "type" | "min" | "max"> = {
        type: "number",
        min: 1,
        max: 10,
      };
      expect(isFollowUpValueAnswered(question, 0)).toBe(false);
      expect(isFollowUpValueAnswered(question, 11)).toBe(false);
    });

    it("treats false as answered for boolean-like values", () => {
      const question: Pick<FollowUpQuestion, "type"> = { type: "select" };
      expect(isFollowUpValueAnswered(question, false)).toBe(true);
    });

    it("treats empty strings as unanswered", () => {
      const question: Pick<FollowUpQuestion, "type"> = { type: "text" };
      expect(isFollowUpValueAnswered(question, "")).toBe(false);
    });

    it("treats empty arrays as unanswered", () => {
      const question: Pick<FollowUpQuestion, "type"> = { type: "multiselect" };
      expect(isFollowUpValueAnswered(question, [])).toBe(false);
    });
  });

  describe("getMissingRequiredFollowUps", () => {
    it("finds only the required missing questions", () => {
      const selectedConditions: ConditionResponse[] = [
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          responses: {
            a1c: 7.1,
            complications: [],
          },
        },
      ];

      const availableConditions: HealthCondition[] = [
        {
          id: "condition-1",
          code: "diabetes",
          name: "Diabetes",
          category: "metabolic",
          follow_up_schema: {
            questions: [
              {
                id: "a1c",
                type: "number",
                label: "A1C",
                required: true,
              },
              {
                id: "diagnosis_date",
                type: "date",
                label: "Diagnosis date",
                required: true,
              },
              {
                id: "complications",
                type: "multiselect",
                label: "Complications",
                required: false,
              },
            ],
          },
          follow_up_schema_version: 1,
          acceptance_key_fields: [],
          is_active: true,
          knockout_category: "standard",
          risk_weight: 1,
          sort_order: 1,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ];

      expect(
        getMissingRequiredFollowUps(selectedConditions, availableConditions),
      ).toEqual([
        {
          conditionCode: "diabetes",
          conditionName: "Diabetes",
          questionId: "diagnosis_date",
          questionLabel: "Diagnosis date",
        },
      ]);
    });
  });
});
