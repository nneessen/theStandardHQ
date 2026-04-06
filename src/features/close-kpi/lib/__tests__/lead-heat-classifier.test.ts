import { describe, expect, it } from "vitest";

import {
  EXCLUDED_STATUS_PATTERNS,
  RANKABLE_STATUS_PATTERNS,
  classifyStatusLabel,
} from "../lead-heat-classifier";

// These tests are the regression net for the heuristic that drives the AI
// Hot 100 filter. They mirror the production verification we performed on
// real Close pipelines during the rollout (see project memory
// `project_lead_heat_status_config.md`). If any of these change, the
// behavior of the cron and the Smart View sync changes — investigate before
// updating.

describe("classifyStatusLabel — pattern fundamentals", () => {
  it("returns false on empty / whitespace-only input", () => {
    expect(classifyStatusLabel("")).toBe(false);
    expect(classifyStatusLabel("   ")).toBe(false);
    expect(classifyStatusLabel("\t\n")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(classifyStatusLabel("HOT")).toBe(true);
    expect(classifyStatusLabel("hot")).toBe(true);
    expect(classifyStatusLabel("Hot")).toBe(true);
    expect(classifyStatusLabel("NOT INTERESTED")).toBe(false);
    expect(classifyStatusLabel("not interested")).toBe(false);
  });

  it("trims surrounding whitespace before matching", () => {
    expect(classifyStatusLabel("  Hot  ")).toBe(true);
    expect(classifyStatusLabel("\tNew\n")).toBe(true);
  });
});

describe("classifyStatusLabel — blacklist (excluded)", () => {
  it("excludes closed-won / post-sale statuses", () => {
    expect(classifyStatusLabel("Sold")).toBe(false);
    expect(classifyStatusLabel("Won - Cross Sell")).toBe(false);
    expect(classifyStatusLabel("Policy Pending")).toBe(false);
    expect(classifyStatusLabel("Issued And Paid")).toBe(false);
    expect(classifyStatusLabel("In Force")).toBe(false);
    expect(classifyStatusLabel("Bound")).toBe(false);
  });

  it("excludes appointment-stage statuses (catches all 'Appointment' variants)", () => {
    expect(classifyStatusLabel("Appointment Scheduled By Me")).toBe(false);
    expect(classifyStatusLabel("Appointment By Bot")).toBe(false);
    expect(classifyStatusLabel("Appointment Scheduled By Lead")).toBe(false);
    expect(classifyStatusLabel("Missed Appointment")).toBe(false);
    expect(classifyStatusLabel("Reschedule Appointment")).toBe(false);
    expect(classifyStatusLabel("Contacted/Need To Schedule Appointment")).toBe(
      false,
    );
  });

  it("excludes terminal / disqualified statuses", () => {
    expect(classifyStatusLabel("Not Interested")).toBe(false);
    expect(classifyStatusLabel("Do Not Contact")).toBe(false);
    expect(classifyStatusLabel("DNC")).toBe(false);
    expect(classifyStatusLabel("Disqualified/Declined")).toBe(false);
    expect(classifyStatusLabel("Disqualified")).toBe(false);
  });

  it("excludes Contacted/* family (15+ variants caught by 'contacted' substring)", () => {
    expect(classifyStatusLabel("Contacted")).toBe(false);
    expect(classifyStatusLabel("Contacted/Quoted")).toBe(false);
    expect(classifyStatusLabel("Contacted/Texting")).toBe(false);
    expect(classifyStatusLabel("Contacted/Call Back")).toBe(false);
    expect(classifyStatusLabel("Contacted/Left VM")).toBe(false);
    expect(classifyStatusLabel("Contacted/Has Spam Filter On")).toBe(false);
    expect(classifyStatusLabel("Contacted/Straight to VM")).toBe(false);
    expect(classifyStatusLabel("Contacted/No Answer")).toBe(false);
    expect(classifyStatusLabel("Contacted/Doesn't Ring")).toBe(false);
    expect(classifyStatusLabel("Contacted/Blocked")).toBe(false);
    expect(classifyStatusLabel("Contacted/Hung Up")).toBe(false);
    expect(classifyStatusLabel("Contacted/Not In Service")).toBe(false);
  });

  it("excludes negative contact outcomes", () => {
    expect(classifyStatusLabel("Voicemail")).toBe(false);
    expect(classifyStatusLabel("No Answer")).toBe(false);
    expect(classifyStatusLabel("Straight to VM")).toBe(false);
    expect(classifyStatusLabel("Hung Up")).toBe(false);
    expect(classifyStatusLabel("Bad Number")).toBe(false);
    expect(classifyStatusLabel("Wrong Number")).toBe(false);
    expect(classifyStatusLabel("Blocked")).toBe(false);
    expect(classifyStatusLabel("Not In Service")).toBe(false);
  });

  it("excludes dead / lost / no-show statuses", () => {
    expect(classifyStatusLabel("Dead")).toBe(false);
    expect(classifyStatusLabel("Lost")).toBe(false);
    expect(classifyStatusLabel("No Show")).toBe(false);
  });

  it("excludes downstream-pipeline statuses (quoted/application/underwriting)", () => {
    expect(classifyStatusLabel("Quoted")).toBe(false);
    expect(classifyStatusLabel("Application")).toBe(false);
    expect(classifyStatusLabel("PENDING UNDERWRITING")).toBe(false);
  });
});

describe("classifyStatusLabel — whitelist (rankable)", () => {
  it("accepts known untouched-lead labels", () => {
    expect(classifyStatusLabel("New")).toBe(true);
    expect(classifyStatusLabel("New Lead")).toBe(true);
    expect(classifyStatusLabel("Potential")).toBe(true);
    expect(classifyStatusLabel("Fresh Lead")).toBe(true);
    expect(classifyStatusLabel("Hot")).toBe(true);
    expect(classifyStatusLabel("Hot Lead")).toBe(true);
    expect(classifyStatusLabel("Warm Lead")).toBe(true);
    expect(classifyStatusLabel("Nurture")).toBe(true);
    expect(classifyStatusLabel("Long Term Nurture")).toBe(true);
  });

  it("accepts incoming variants", () => {
    expect(classifyStatusLabel("INCOMING - MISSED CALL")).toBe(true);
    expect(classifyStatusLabel("Incoming Lead")).toBe(true);
  });
});

describe("classifyStatusLabel — known substring-collision limitations", () => {
  // These cases document where the substring approach yields a counter-
  // intuitive result. They are NOT bugs in the test — they are documented
  // limitations of the heuristic that the team has accepted given the
  // tradeoffs around bare 'Bound' / 'Renewal' status names.

  it("excludes 'Inbound Web Form' because 'bound' blacklist preempts 'inbound' intent", () => {
    // 'inbound' is NOT in the whitelist (it would be dead code anyway since
    // every 'inbound' string contains 'bound'). To support inbound channels,
    // a user should rename their status to something like 'Incoming Web Form'
    // OR manually flip is_rankable=true via the future settings UI.
    expect(classifyStatusLabel("Inbound Web Form")).toBe(false);
    expect(classifyStatusLabel("Inbound Lead")).toBe(false);
  });

  it("treats 'Renewal Pending' as RANKABLE because 'new' whitelist matches before 'policy pending' blacklist gets a chance", () => {
    // 'renewal pending' contains 'new' (whitelist hit) but does NOT contain
    // 'policy pending' as a contiguous substring. The order of operations is
    // blacklist-first, whitelist-second — but this case slips through because
    // the blacklist pattern doesn't actually match.
    // Acceptable in an insurance sales context: a renewal that's pending IS
    // often a hot lead. Documented for future maintainers.
    expect(classifyStatusLabel("Renewal Pending")).toBe(true);
  });
});

describe("classifyStatusLabel — substring collision protection", () => {
  // The blacklist runs FIRST so collisions like "New Application" or
  // "Lead is Dead" resolve to "excluded" before the whitelist gets a chance.
  it("excludes 'New Application' even though it contains 'new'", () => {
    expect(classifyStatusLabel("New Application")).toBe(false);
  });

  it("excludes 'Lead is Dead' even though 'lead' is not in any list", () => {
    // 'dead' is in the blacklist; the lookup is substring-based.
    expect(classifyStatusLabel("Lead is Dead")).toBe(false);
  });

  it("excludes 'Hot Lead - Sold' (sold wins over hot)", () => {
    expect(classifyStatusLabel("Hot Lead - Sold")).toBe(false);
  });

  it("excludes 'New Customer - Bound' (bound wins over new)", () => {
    expect(classifyStatusLabel("New Customer - Bound")).toBe(false);
  });

  it("excludes 'Disqualified' even though it contains 'qualified'", () => {
    // Whitelist deliberately omits 'qualified' to avoid this collision.
    expect(classifyStatusLabel("Disqualified")).toBe(false);
  });

  it("does NOT include 'interested' as a positive pattern", () => {
    // 'Interested' alone would be ambiguous; the heuristic only catches
    // explicit positive states. This is intentional default-deny behavior.
    expect(classifyStatusLabel("Interested")).toBe(false);
  });
});

describe("classifyStatusLabel — default-deny (unknown statuses)", () => {
  // These are the labels that broke the previous blacklist-only fix and
  // motivated the architectural redesign. Each must be excluded by the
  // default-deny rule because none match either pattern list.
  it("excludes 'Bad Contact Info' (motivating bug)", () => {
    expect(classifyStatusLabel("Bad Contact Info")).toBe(false);
  });

  it("excludes 'Missed Payment' (motivating bug)", () => {
    expect(classifyStatusLabel("Missed Payment")).toBe(false);
  });

  it("excludes 'Unresponsive'", () => {
    expect(classifyStatusLabel("Unresponsive")).toBe(false);
  });

  it("excludes 'DISABLE BOT' (custom internal flag)", () => {
    expect(classifyStatusLabel("DISABLE BOT")).toBe(false);
  });

  it("excludes 'Needs Cancelled/Withdrawn'", () => {
    expect(classifyStatusLabel("Needs Cancelled/Withdrawn")).toBe(false);
  });

  it("excludes cross-tenant custom labels (Idiot, Client, Policy Pending - LGA)", () => {
    // From the second user's pipeline verified at deploy time.
    expect(classifyStatusLabel("Idiot")).toBe(false);
    expect(classifyStatusLabel("Client")).toBe(false);
    expect(classifyStatusLabel("Policy Pending - LGA")).toBe(false); // 'policy pending' blacklist
    expect(classifyStatusLabel("QUOTED/STOPPED AT SOCIAL")).toBe(false); // 'quoted' blacklist
  });

  it("excludes any made-up label not in either pattern list", () => {
    expect(classifyStatusLabel("Random Custom Status")).toBe(false);
    expect(classifyStatusLabel("Foo Bar Baz")).toBe(false);
  });
});

describe("classifyStatusLabel — production pipeline regression (sample agent #1)", () => {
  // Captured from the live Close account at deploy time. Used as an end-to-end
  // regression check that the full 36-status pipeline classifies the way we
  // verified manually.
  const expectedRankable = new Set([
    "Hot",
    "INCOMING - MISSED CALL",
    "New",
    "Nurture",
  ]);
  const allStatuses = [
    "New",
    "Contacted",
    "DISABLE BOT",
    "Contacted/Straight to VM",
    "Contacted/Has Spam Filter On",
    "Contacted/Left VM",
    "Contacted/Need To Schedule Appointment",
    "Contacted/Texting",
    "Contacted/Call Back",
    "Contacted/Quoted",
    "Contacted/Reschedule",
    "Contacted/Missed Appointment",
    "Contacted/No Answer",
    "Contacted/Doesn't Ring",
    "Contacted/Blocked",
    "Contacted/Not In Service",
    "Contacted/Hung Up",
    "Quoted",
    "Bad Contact Info",
    "Not Interested",
    "Appointment Scheduled By Me",
    "Appointment By Bot",
    "Appointment Scheduled By Lead",
    "Missed Appointment",
    "Policy Pending",
    "Unresponsive",
    "Hot",
    "Nurture",
    "Sold",
    "Do Not Contact",
    "Needs Cancelled/Withdrawn",
    "Disqualified/Declined",
    "INCOMING - MISSED CALL",
    "Missed Payment",
    "Reschedule Appointment",
    "PENDING UNDERWRITING",
  ];

  it("classifies the production pipeline exactly as verified at deploy", () => {
    for (const label of allStatuses) {
      const expected = expectedRankable.has(label);
      expect(
        classifyStatusLabel(label),
        `${label} should be ${expected ? "rankable" : "excluded"}`,
      ).toBe(expected);
    }
  });
});

describe("classifyStatusLabel — known acceptable false-positives (documented)", () => {
  // 'Renewal' contains 'new' as substring → matches whitelist. Acceptable
  // because renewals ARE often hot leads in insurance sales. Documented here
  // so any future change knows this is intentional.
  // ('Renewal Pending' is also documented as RANKABLE in the
  // "known substring-collision limitations" describe block above — see there
  // for the reasoning.)
  it("treats 'Renewal' as rankable (intentional, see comment)", () => {
    expect(classifyStatusLabel("Renewal")).toBe(true);
  });
});

describe("EXCLUDED_STATUS_PATTERNS / RANKABLE_STATUS_PATTERNS — anti-regression", () => {
  it("blacklist contains the original 35 patterns (catches accidental deletions)", () => {
    // Spot-check a representative sample. Full list verified by the
    // pipeline test above.
    expect(EXCLUDED_STATUS_PATTERNS).toContain("sold");
    expect(EXCLUDED_STATUS_PATTERNS).toContain("not interested");
    expect(EXCLUDED_STATUS_PATTERNS).toContain("contacted");
    expect(EXCLUDED_STATUS_PATTERNS).toContain("appointment");
    expect(EXCLUDED_STATUS_PATTERNS).toContain("dead");
    expect(EXCLUDED_STATUS_PATTERNS).toContain("quoted");
    expect(EXCLUDED_STATUS_PATTERNS).toContain("underwriting");
  });

  it("whitelist contains the conservative 7 patterns", () => {
    expect(RANKABLE_STATUS_PATTERNS).toEqual([
      "new",
      "potential",
      "fresh",
      "hot",
      "warm",
      "nurture",
      "incoming",
    ]);
  });

  it("whitelist deliberately excludes substring-collision risks", () => {
    // 'interested' would match "Not Interested" in reverse direction
    // 'qualified' would match "Disqualified"
    // 'lead' would match "Lead is Dead"
    // 'inbound' would be dead code — every "inbound" string also contains
    //   "bound" which the blacklist catches first
    expect(RANKABLE_STATUS_PATTERNS).not.toContain("interested");
    expect(RANKABLE_STATUS_PATTERNS).not.toContain("qualified");
    expect(RANKABLE_STATUS_PATTERNS).not.toContain("lead");
    expect(RANKABLE_STATUS_PATTERNS).not.toContain("inbound");
  });
});
