import { assertEquals } from "jsr:@std/assert@1";
import { classifyIntent, routeToAgent } from "../routing.ts";

const ALL_WIRED = [
  "executive-briefing",
  "production-analyst",
  "policy-risk",
  "lead-priority",
  "crm",
  "close",
  "sms-email-copy",
  "compliance",
  "recruiting",
  "coaching",
  "calendar",
  "slack",
  "workflow",
  "data-quality",
  "underwriting",
] as const;

Deno.test("classifyIntent maps explicit intents", () => {
  assertEquals(
    classifyIntent("Brief me on what needs my attention today"),
    "executive-briefing",
  );
  assertEquals(
    classifyIntent("what's our AP pace this month"),
    "production-analyst",
  );
  assertEquals(
    classifyIntent("which policies are at risk of chargeback?"),
    "policy-risk",
  );
  assertEquals(
    classifyIntent("who should I call first today?"),
    "lead-priority",
  );
  assertEquals(classifyIntent("show me my hottest leads"), "lead-priority");
  assertEquals(classifyIntent("hello there"), null);
});

Deno.test("classifyIntent maps the remaining specialists", () => {
  assertEquals(classifyIntent("how is my recruiting pipeline?"), "recruiting");
  assertEquals(classifyIntent("summarize my book of business"), "crm");
  assertEquals(
    classifyIntent("is this email ok to send for TCPA?"),
    "compliance",
  );
  assertEquals(classifyIntent("schedule a call with this client"), "calendar");
  assertEquals(
    classifyIntent("draft a scoreboard announcement for the team"),
    "slack",
  );
  assertEquals(
    classifyIntent("build a drip sequence for aged leads"),
    "workflow",
  );
  assertEquals(classifyIntent("who needs coaching on my team?"), "coaching");
  assertEquals(classifyIntent("why is my report incomplete?"), "data-quality");
  assertEquals(
    classifyIntent("write an email to a prospect"),
    "sms-email-copy",
  );
});

Deno.test("classifyIntent routes Close and guards keyword collisions", () => {
  // Close-CRM intents.
  assertEquals(classifyIntent("what's in my pipeline?"), "close");
  assertEquals(classifyIntent("show me my open opportunities"), "close");
  assertEquals(classifyIntent("pull up the lead Sherlett Jones"), "close");
  assertEquals(classifyIntent("look up the contact David Lee"), "close");
  assertEquals(classifyIntent("what's stalled in my sales pipeline"), "close");
  // Guards: Close must NOT steal these.
  assertEquals(classifyIntent("how is my recruiting pipeline?"), "recruiting");
  assertEquals(classifyIntent("agent pipeline status"), "recruiting");
  assertEquals(classifyIntent("show me my hottest leads"), "lead-priority");
  assertEquals(
    classifyIntent("which leads should I call first?"),
    "lead-priority",
  );
});

Deno.test("classifyIntent: a general check-in beats domain keywords", () => {
  // Mentions production but is a general briefing request.
  assertEquals(classifyIntent("brief me on production"), "executive-briefing");
});

Deno.test("routes a briefing request to executive-briefing", () => {
  assertEquals(
    routeToAgent("Brief me on what needs my attention today", [...ALL_WIRED]),
    "executive-briefing",
  );
});

Deno.test("routes to the matched specialist when it is enabled", () => {
  assertEquals(
    routeToAgent("how is team production pacing?", [...ALL_WIRED]),
    "production-analyst",
  );
  assertEquals(
    routeToAgent("show me chargeback exposure", [...ALL_WIRED]),
    "policy-risk",
  );
  assertEquals(
    routeToAgent("which leads should I call first?", [...ALL_WIRED]),
    "lead-priority",
  );
});

Deno.test(
  "falls back to briefing when the matched specialist is NOT enabled",
  () => {
    assertEquals(
      routeToAgent("show me chargeback exposure", ["executive-briefing"]),
      "executive-briefing",
    );
  },
);

Deno.test("unmatched input goes to executive-briefing when enabled", () => {
  assertEquals(routeToAgent("show me the team"), "executive-briefing");
});

Deno.test("falls back to first enabled agent when default not enabled", () => {
  assertEquals(routeToAgent("hi", ["policy-risk"]), "policy-risk");
});

Deno.test(
  "classifyIntent routes underwriting and guards the crm collision",
  () => {
    assertEquals(
      classifyIntent("which carrier would approve a client with diabetes?"),
      "underwriting",
    );
    assertEquals(
      classifyIntent("who would approve this client?"),
      "underwriting",
    );
    assertEquals(
      classifyIntent("best carrier for high blood pressure"),
      "underwriting",
    );
    assertEquals(classifyIntent("is this client insurable?"), "underwriting");
    assertEquals(
      classifyIntent("what health class can this applicant get?"),
      "underwriting",
    );
    assertEquals(classifyIntent("is she uninsurable?"), "underwriting");
    assertEquals(
      classifyIntent("what rate class does he qualify for?"),
      "underwriting",
    );
    // "client" alone (no underwriting signal) still goes to crm.
    assertEquals(classifyIntent("summarize my book of business"), "crm");
    // NON-underwriting "approve" asks must NOT be hijacked — the trigger requires
    // an applicant/client/case/prospect object, not a bare "approve".
    assertEquals(
      classifyIntent("who would approve my expense report?") === "underwriting",
      false,
    );
    assertEquals(
      classifyIntent("who needs to approve this contract?") === "underwriting",
      false,
    );
    // A "carrier" question with NO underwriting context must NOT be hijacked —
    // commission/performance carrier asks belong elsewhere.
    assertEquals(
      classifyIntent("which carrier pays the best overrides?") ===
        "underwriting",
      false,
    );
    assertEquals(
      classifyIntent("carrier performance this quarter"),
      "production-analyst",
    );
  },
);

Deno.test(
  "routeToAgent falls back to briefing when underwriting is matched but not enabled",
  () => {
    assertEquals(
      routeToAgent("which carrier would approve a diabetic client?", [
        "executive-briefing",
      ]),
      "executive-briefing",
    );
  },
);
