import { describe, expect, it } from "vitest";
import {
  filterUserSelectableTemplates,
  selectDefaultRecruitTemplate,
} from "../template-filters";

const templates = [
  { id: "legacy", name: "The Standard Non-Licensed Recruit Pipeline" },
  { id: "default-unlicensed", name: "DEFAULT Non-Licensed Recruit Pipeline" },
  { id: "default-licensed", name: "DEFAULT Licensed Agent Pipeline" },
  { id: "test", name: "TEST Pipeline" },
];

describe("template filters", () => {
  it("keeps only DEFAULT-prefixed templates for user selection", () => {
    expect(filterUserSelectableTemplates(templates).map((t) => t.id)).toEqual([
      "default-unlicensed",
      "default-licensed",
    ]);
  });

  it("selects the non-licensed default for unlicensed recruits", () => {
    const selectable = filterUserSelectableTemplates(templates);

    expect(selectDefaultRecruitTemplate(selectable, false)?.id).toBe(
      "default-unlicensed",
    );
  });

  it("selects the licensed default for licensed recruits", () => {
    const selectable = filterUserSelectableTemplates(templates);

    expect(selectDefaultRecruitTemplate(selectable, true)?.id).toBe(
      "default-licensed",
    );
  });
});
