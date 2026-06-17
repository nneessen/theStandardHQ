/**
 * Generates docs/inbound-lead-feature/INTEGRATION_RESPONSE.docx
 * from the same content as INTEGRATION_RESPONSE.md (the Markdown is the source of truth).
 * Re-run after editing the response: NODE_PATH must point at the global docx install.
 *   NODE_PATH="$(npm root -g)" node scripts/gen-integration-response-docx.cjs
 */
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, Header, Footer,
} = require("docx");

// ---- palette ----
const ACCENT = "1F4E79";       // deep blue
const ACCENT_LT = "2E74B5";    // lighter blue
const INK = "222222";
const MUT = "595959";
const RULE = "BFBFBF";
const YES_FILL = "E2EFDA";     // light green
const HEAD_FILL = "1F4E79";    // table header
const CALLOUT_FILL = "FBF3D9"; // amber callout
const CODE_FILL = "F2F2F2";    // code block
const ZEBRA = "F4F7FB";        // table zebra

const CONTENT_W = 9360;

// ---- helpers ----
const t = (text, opts = {}) => new TextRun({ text, font: opts.font || "Arial", ...opts });

const p = (children, opts = {}) =>
  new Paragraph({
    children: Array.isArray(children) ? children : [typeof children === "string" ? t(children) : children],
    spacing: { after: opts.after ?? 120, before: opts.before ?? 0, line: opts.line ?? 276 },
    alignment: opts.alignment,
    ...opts.extra,
  });

const h1 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [t(text, { bold: true, size: 28, color: ACCENT })],
    spacing: { before: 320, after: 140 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT_LT, space: 2 } },
  });

const h2 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [t(text, { bold: true, size: 23, color: ACCENT_LT })],
    spacing: { before: 200, after: 100 },
  });

const bullet = (children, ref = "bullet", level = 0) =>
  new Paragraph({
    numbering: { reference: ref, level },
    children: Array.isArray(children) ? children : [t(children)],
    spacing: { after: 70, line: 268 },
  });

const numbered = (children, ref) =>
  new Paragraph({
    numbering: { reference: ref, level: 0 },
    children: Array.isArray(children) ? children : [t(children)],
    spacing: { after: 90, line: 268 },
  });

const cell = (children, { w, fill, header = false, valign = VerticalAlign.TOP, align } = {}) =>
  new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
    verticalAlign: valign,
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: RULE },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: RULE },
      left: { style: BorderStyle.SINGLE, size: 1, color: RULE },
      right: { style: BorderStyle.SINGLE, size: 1, color: RULE },
    },
    children: (Array.isArray(children) ? children : [children]).map((c) =>
      typeof c === "string"
        ? new Paragraph({
            children: [t(c, { color: header ? "FFFFFF" : INK, bold: header, size: 20 })],
            alignment: align,
            spacing: { after: 0, line: 252 },
          })
        : c
    ),
  });

const codeLine = (text) =>
  new Paragraph({
    children: [t(text || " ", { font: "Consolas", size: 17, color: INK })],
    spacing: { after: 0, line: 240 },
  });

const callout = (runs, fill = CALLOUT_FILL, accent = "D9A441") =>
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT_W, type: WidthType.DXA },
            shading: { fill, type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              left: { style: BorderStyle.SINGLE, size: 18, color: accent },
            },
            children: [new Paragraph({ children: runs, spacing: { after: 0, line: 268 } })],
          }),
        ],
      }),
    ],
  });

const codeBox = (lines) =>
  new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT_W, type: WidthType.DXA },
            shading: { fill: CODE_FILL, type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: RULE },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: RULE },
              left: { style: BorderStyle.SINGLE, size: 1, color: RULE },
              right: { style: BorderStyle.SINGLE, size: 1, color: RULE },
            },
            children: lines.map(codeLine),
          }),
        ],
      }),
    ],
  });

// header row builder for data tables
const headerRow = (cells, widths) =>
  new TableRow({
    tableHeader: true,
    children: cells.map((c, i) => cell(c, { w: widths[i], fill: HEAD_FILL, header: true, valign: VerticalAlign.CENTER })),
  });

const qa = (q, a) => [
  new Paragraph({ children: [t("Q. ", { bold: true, color: ACCENT }), t(q, { bold: true, color: INK })], spacing: { before: 120, after: 40, line: 268 } }),
  new Paragraph({ children: [t("A. ", { bold: true, color: ACCENT_LT }), t(a, { color: INK })], spacing: { after: 60, line: 268 } }),
];

// =====================================================================
//  Section 11 table
// =====================================================================
const s11W = [430, 3150, 1180, 4600];
const s11Rows = [
  ["1", "OAuth 2.0 Client-Credentials authentication with 24-hour cached bearer tokens", "Yes", "We stand up a token endpoint issuing a signed 24-hour bearer. Response shaped exactly to your spec (access_token, instance_url, id, token_type, scope, plus expires_in)."],
  ["2", "Token-authenticated GET lookup of Agent of Record by ANI (200 with agent ID / 204 if none)", "Yes", "We already model an Agent of Record on every client record. We add an indexed phone lookup so this responds well under your routing timeout. We return the caller’s Agent of Record for continuity; whether to route the call to them is your platform’s call (it knows the agent’s NetTrio availability)."],
  ["3", "Token-authenticated POST that finds/creates a lead and triggers an agent screen-pop", "Yes", "Find-or-create is idempotent (keyed on your requestTag). The screen-pop reuses the same real-time channel that already powers our in-app notifications."],
  ["4", "Token-authenticated PATCH that updates the billable status on the existing lead record", "Yes", "Locates the record from the original POST and updates only billable. Tolerant of out-of-order delivery."],
  ["5", "Accepts the shared lead data structure (Section 7) as JSON", "Yes", "We validate the structured fields (ani, state, billable, duration) and store classification fields (recordType, callProgram, subId) as provided."],
  ["6", "Returns standard HTTP status codes (200 / 204 / 401) as described", "Yes", "In particular we return 401 (not 403) on an invalid/expired token, so your refresh-and-retry-once logic fires as designed."],
  ["7", "HTTPS (TLS 1.2+) for all traffic", "Yes", "Our platform terminates TLS 1.2/1.3 by default on every endpoint; there is no plaintext path."],
  ["8", "Prompt response time on the pre-call GET lookup to avoid routing timeouts", "Yes", "Engineered as the fast path: stateless token verification plus a single indexed query. We can point your platform directly at our endpoint to shave a hop if needed."],
];
const section11Table = new Table({
  width: { size: CONTENT_W, type: WidthType.DXA },
  columnWidths: s11W,
  rows: [
    headerRow(["#", "Requirement", "Supported?", "Notes"], s11W),
    ...s11Rows.map((r, idx) =>
      new TableRow({
        children: [
          cell(r[0], { w: s11W[0], align: AlignmentType.CENTER, valign: VerticalAlign.CENTER, fill: idx % 2 ? ZEBRA : undefined }),
          cell(r[1], { w: s11W[1], fill: idx % 2 ? ZEBRA : undefined }),
          cell([new Paragraph({ children: [t(r[2], { bold: true, color: "375623", size: 20 })], alignment: AlignmentType.CENTER, spacing: { after: 0 } })], { w: s11W[2], fill: YES_FILL, valign: VerticalAlign.CENTER }),
          cell(r[3], { w: s11W[3], fill: idx % 2 ? ZEBRA : undefined }),
        ],
      })
    ),
  ],
});

// =====================================================================
//  Edge-case table
// =====================================================================
const ecW = [4160, 5200];
const ecRows = [
  ["Billing PATCH arrives before the POST (out-of-order)", "Upsert on requestTag — billing is recorded, never dropped; no phantom pop."],
  ["Duplicate POST (your retry-once, or a network retry)", "Idempotent on requestTag — one lead, one call record, one pop."],
  ["Agent has inbound calls turned off in NetTrio", "Your platform doesn’t route them a call, so we never pop for them. We don’t track or override NetTrio status — it’s your source of truth."],
  ["Caller number formatting (leading “1”, dashes, spaces)", "Normalized identically on both sides so the lookup matches."],
  ["Brand-new caller (no client record yet)", "Lookup returns 204; the POST creates the client and routes the call."],
  ["Unfamiliar recordType value", "Stored as provided — onboarding workflow changes won’t break us."],
  ["Token expires mid-call (POST near hour 24, PATCH after)", "We return 401; your refresh-and-retry-once succeeds."],
  ["Call-record PII and retention", "Defined retention window; numbers masked and secrets/tokens redacted in logs."],
];
const edgeTable = new Table({
  width: { size: CONTENT_W, type: WidthType.DXA },
  columnWidths: ecW,
  rows: [
    headerRow(["Scenario", "How we handle it"], ecW),
    ...ecRows.map((r, idx) =>
      new TableRow({
        children: [
          cell(r[0], { w: ecW[0], fill: idx % 2 ? ZEBRA : undefined }),
          cell(r[1], { w: ecW[1], fill: idx % 2 ? ZEBRA : undefined }),
        ],
      })
    ),
  ],
});

// =====================================================================
//  Document
// =====================================================================
const doc = new Document({
  creator: "The Standard HQ",
  title: "Inbound-Call CRM Integration — Vendor Response",
  styles: {
    default: { document: { run: { font: "Arial", size: 21, color: INK } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: ACCENT }, paragraph: { spacing: { before: 320, after: 140 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 23, bold: true, font: "Arial", color: ACCENT_LT }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullet", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 260 } } } }] },
      { reference: "numFlow", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 260 } } } }] },
      { reference: "numQ", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 260 } } } }] },
    ],
  },
  sections: [{
    properties: {
      page: { size: { width: 12240, height: 15840 }, margin: { top: 1260, right: 1440, bottom: 1260, left: 1440 } },
    },
    headers: {
      default: new Header({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 4 } },
        children: [t("Inbound-Call CRM Integration  —  Vendor Response", { size: 16, color: MUT })],
      })] }),
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 4 } },
        children: [t("The Standard HQ  ·  Confidential  ·  Page ", { size: 16, color: MUT }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MUT, font: "Arial" }), t(" of ", { size: 16, color: MUT }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: MUT, font: "Arial" })],
      })] }),
    },
    children: [
      // ---- Title block ----
      new Paragraph({ spacing: { after: 40 }, children: [t("Inbound-Call CRM Integration", { bold: true, size: 40, color: ACCENT })] }),
      new Paragraph({ spacing: { after: 160 }, border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: ACCENT_LT, space: 4 } }, children: [t("Vendor Response", { size: 26, color: ACCENT_LT })] }),
      p([t("Prepared in response to:  ", { bold: true }), t("CRM Integration Requirements — Inbound Call / Lead Capture APIs (2026-06-16)")], { after: 40 }),
      p([t("Our role in this integration:  ", { bold: true }), t("the CRM (system of record). Your Integration Platform originates every call; our platform receives, authenticates, stores, and reacts — agent screen-pop + billing.")], { after: 40 }),
      p([t("Date:  ", { bold: true }), t("June 2026")], { after: 60 }),

      // ---- 1 Executive summary ----
      h1("1.  Executive summary"),
      p("Your specification describes a Salesforce-style inbound-call integration: an OAuth 2.0 Client-Credentials handshake followed by three REST touchpoints per call (Agent-of-Record lookup → lead post + agent screen-pop → billing update). The token-response fields you specified (access_token, instance_url, id, token_type, scope) and the Client-Credentials grant are the exact contract Salesforce exposes — so this is a pattern your platform already speaks, not a bespoke one-off."),
      callout([t("Bottom line: we can support all eight of your Section 11 acceptance criteria — every one is a ", { bold: true }), t("“Yes.”", { bold: true, color: "375623" }), t(" It is a net-new build, but it sits on capabilities our platform already runs in production: a data model with a built-in Agent-of-Record concept, a sub-second real-time push channel, an established secret-authenticated machine-to-machine API pattern, and encryption/secrets infrastructure. No existing authentication, commission, or policy logic is touched — the change is additive and low-risk.")], "EAF1FB", ACCENT_LT),
      p("This document gives you (a) a point-by-point response to your Section 11 criteria, (b) an honest map of what already exists versus what we build, (c) how the end-to-end flow works including the live agent screen-pop, (d) our security and scalability approach, and (e) the short list of questions we’d want to settle at onboarding."),

      // ---- 2 Vendor response ----
      h1("2.  Vendor response — Section 11 acceptance criteria"),
      section11Table,
      new Paragraph({ spacing: { before: 120 }, children: [] }),
      callout([t("Honest framing: ", { bold: true }), t("every item is “Yes,” but each is a net-new build on existing primitives — not something already running and exposed to you today. The engineering is well-understood and low-risk because the foundations are in place.")]),

      // ---- 3 Have vs build ----
      h1("3.  What we already have vs. what we build"),
      p("A large share of this integration is reuse, which is why we’re confident on timeline and risk."),
      h2("Already in production (reused)"),
      bullet([t("A client/lead data model with an Agent of Record. ", { bold: true }), t("Every client record already carries its owning agent — exactly what your pcId maps to. Policies already link to clients.")]),
      bullet([t("A real-time push channel. ", { bold: true }), t("Our notification system pushes events to a specific signed-in user in roughly a tenth of a second over a live connection. The agent screen-pop is this same mechanism with a dialog instead of a bell badge.")]),
      bullet([t("An established machine-to-machine API pattern. ", { bold: true }), t("We already run inbound endpoints that authenticate external callers with a shared secret and constant-time comparison, then scope every database operation to Epic Life’s data explicitly.")]),
      bullet([t("Encryption, secrets, and rate-limiting infrastructure ", { bold: true }), t("used across the platform today; every request is automatically scoped to Epic Life’s data at the database level.")]),
      h2("Net-new (built for this integration)"),
      bullet([t("An OAuth token issuer ", { bold: true }), t("(we currently consume OAuth elsewhere; here we issue it) plus an API credential store.")]),
      bullet([t("The three data endpoints ", { bold: true }), t("(lookup / lead-post / billing) and a small call-event table recording each inbound call and its billing status.")]),
      bullet([t("A fast, indexed phone-number lookup ", { bold: true }), t("(client numbers are stored today but not optimized for exact-match lookup at call speed), and a stable pcId ⇄ agent registry so your identifiers round-trip safely and always resolve to the right agent.")]),
      bullet([t("A new Clients page ", { bold: true }), t("to view and work these lead records, and the screen-pop dialog itself.")]),
      h2("What we are not changing"),
      p("No existing authentication, commission, or policy logic is modified. This is purely additive, which keeps the blast radius — and the risk to the rest of the system — low."),

      // ---- 4 How it works ----
      new Paragraph({ children: [], pageBreakBefore: true }),
      h1("4.  How it works, end to end"),
      p("The flow mirrors your Section 8 process exactly: a once-daily authentication step, then three per-call touchpoints."),
      codeBox([
        "  Integration Platform                       Our CRM",
        "  --------------------                       -------",
        "  (once / 24h)  POST /oauth/token  ........>  validate client_id + secret",
        "                                   <........  24h bearer token",
        "",
        "  PRE-CALL      GET /api/v1/leads?ani=  ...>  indexed phone lookup (Epic Life)",
        "                                   <........  200 {pcId}   or   204 (caller not on file)",
        "",
        "  ON ANSWER     POST /api/v1/leads  .......>  find-or-create lead; resolve agent",
        "                                              by pcId  -->  SCREEN-POP to that agent",
        "                                   <........  200 OK         (live, in-browser)",
        "",
        "  ON CALL END   PATCH /api/v1/leads  ......>  locate by requestTag, set billable",
        "                                   <........  200 OK   (pop reflects call end)",
      ]),
      new Paragraph({ spacing: { before: 120 }, children: [] }),
      numbered([t("Authentication (once per 24h). ", { bold: true }), t("Your platform exchanges client_id + client_secret for a bearer token. You cache it for 24 hours per your spec, and refresh-and-retry once if you ever get a 401.")], "numFlow"),
      numbered([t("Pre-call lookup. ", { bold: true }), t("We look the caller’s number up against Epic Life’s clients and return the Agent of Record’s identifier (pcId), or 204 if the caller isn’t on file. We don’t decide availability — your call system (NetTrio) does; an agent who’s turned calls off simply isn’t routed one.")], "numFlow"),
      numbered([t("Lead post + screen-pop. ", { bold: true }), t("We find-or-create the client (idempotently, keyed on your requestTag), write a call event, resolve which agent the call is routed to, and fire a live screen-pop into that agent’s browser.")], "numFlow"),
      numbered([t("Billing update. ", { bold: true }), t("At call end, your PATCH locates the same call event and records the final billable value. The open screen-pop reflects the call ending.")], "numFlow"),

      // ---- 5 Product surfaces ----
      h1("5.  The two product surfaces you asked for"),
      h2("a)  The Clients page"),
      p("A new in-app page to view and work the lead/client records — searchable and sortable, showing each client’s Agent of Record, status, linked policies, and a history of inbound calls (who called, when, billable status). It reuses our existing client data services and role-aware visibility (an agent sees their own book; an admin sees the whole team’s)."),
      h2("b)  The real-time agent screen-pop"),
      p("When your platform routes a call to an agent, a dialog pops on that agent’s screen within a fraction of a second, showing the caller and what we know about them, so the agent is oriented before they pick up. It updates live as the call ends."),
      p([t("We don’t decide who’s available or route calls — your call system (NetTrio) does. ", { bold: true }), t("An agent turns inbound calls on or off in NetTrio; when they’re off, your platform never routes them a call, so we never pop for them. We simply react to the call your platform sends and show the screen-pop to the agent you routed it to.")]),
      callout([t("One honest note: ", { bold: true }), t("the screen-pop appears in our app, in the agent’s browser, alongside NetTrio — the agent works with both open (NetTrio for the call, our app for the caller’s history and context). If our app isn’t open, the agent still takes the call in NetTrio; they just don’t get the visual pop.")]),

      // ---- 6 Security ----
      h1("6.  Security & data isolation"),
      p("Your Section 10 requirements (TLS 1.2+, secrets stored/transmitted securely, never logged in clear text) are met, and we go further because a machine-to-machine integration has a specific risk profile:"),
      bullet([t("TLS 1.2+ everywhere", { bold: true }), t(", no plaintext path.")]),
      bullet([t("Client secrets are stored one-way hashed ", { bold: true }), t("(not reversibly encrypted) and shown to you once at creation, compared with a constant-time check. A database snapshot alone never yields a usable secret.")]),
      bullet([t("Bearer tokens are signed, time-boxed, and explicitly expiry-checked ", { bold: true }), t("with a dedicated signing key. An invalid or expired token gets a clean 401.")]),
      bullet([t("Every request is scoped to your data in code. ", { bold: true }), t("Because these calls carry no signed-in user, we don’t rely on the usual database guards — each request is authenticated by its own token, and every read, write, and screen-pop is scoped to Epic Life’s data and validated to resolve to a real Epic Life agent before anything happens.")]),
      bullet([t("Secrets and PII are never logged ", { bold: true }), t("— Authorization headers, tokens, and secrets are redacted; caller numbers are masked.")]),
      bullet([t("Per-credential rate limiting ", { bold: true }), t("guards against abuse and number-enumeration.")]),

      // ---- 7 Scalability ----
      h1("7.  Scalability (built for thousands of users)"),
      bullet([t("The pre-call lookup is the fast path ", { bold: true }), t("and is isolated as such: stateless token verification (no database hit just to authenticate) plus a single indexed phone lookup, on its own dedicated function so heavier traffic can never slow it down. Internal target: well under your routing timeout.")]),
      bullet([t("Idempotent, atomic writes ", { bold: true }), t("— your retry-once behavior and rapid repeat calls from the same number never create duplicates.")]),
      bullet([t("The real-time channel reuses our proven notification transport ", { bold: true }), t("for launch, with a clear path to a higher-throughput broadcast mechanism once concurrent call volume warrants it (a number we’d size with you).")]),
      bullet([t("Call records have a retention/archival plan from day one, ", { bold: true }), t("reusing the same approach we already run for call-recording storage.")]),
      bullet([t("On “do you have too many backend functions?” — no. ", { bold: true }), t("Each function is an independently deployed, scale-to-zero unit; the count of functions does not affect scalability, only actual traffic does.")]),

      // ---- 8 Open questions ----
      h1("8.  Questions to confirm at onboarding"),
      p("A few decisions are genuinely contract-level, and we’d rather settle them with you than assume:"),
      numbered([t("The subId field. ", { bold: true }), t("Your payload includes subId (sub-account / sub-publisher). Confirm what you’d like it to represent on our side — most likely a lead-source tag for reporting.")], "numQ"),
      numbered([t("Availability & routing stay with NetTrio. ", { bold: true }), t("We’re assuming your platform (with NetTrio) decides who’s available and routes the call, and we just receive it and pop the screen. Confirm that’s right — and tell us if you’d ever want our app to reflect an agent’s NetTrio on/off state (by default we don’t need to).")], "numQ"),
      numbered([t("Your routing-timeout budget and expected concurrent-call volume ", { bold: true }), t("— these set our latency target and tell us when to move the screen-pop to the higher-throughput transport.")], "numQ"),
      numbered([t("Billing source of truth. ", { bold: true }), t("We treat the closing PATCH as authoritative for billable (the POST value is provisional). Please confirm that matches your model.")], "numQ"),

      // ---- 9 Q&A ----
      new Paragraph({ children: [], pageBreakBefore: true }),
      h1("9.  Anticipated questions (and our answers)"),
      ...qa("What exactly is pcId, and who controls its format?", "It’s our identifier for the agent (the Agent of Record). We mint it and return it on the lookup; your platform echoes the same value back on the POST/PATCH so we know which agent to pop. We’ll format it to match your existing convention (e.g. agent-00123)."),
      ...qa("Can your pre-call lookup beat our routing timeout?", "Yes, by design. We verify the token without a database round-trip and resolve the caller against a single indexed column. If we ever see margin risk, we point your platform straight at our endpoint to remove a network hop — your spec allows finalizing the base URL at onboarding."),
      ...qa("With no login on these machine calls, how is the data kept safe and correct?", "Each request authenticates with its own token and is scoped to Epic Life’s data; every call is validated to resolve to a real Epic Life agent before we record it or pop a screen. This is the same machine-to-machine discipline our existing inbound endpoints already use."),
      ...qa("What if your billing PATCH arrives but you never saw our POST (or they arrive out of order)?", "We record the billing update anyway (an upsert keyed on requestTag), so a billable status is never silently dropped. Such a record is flagged so it doesn’t fire a phantom screen-pop for a call that never posted."),
      ...qa("Where does the agent actually see the call?", "A live screen-pop in our app, alongside NetTrio. Your platform routes the call (only to agents who have NetTrio on) and we pop the caller’s details for that agent. If their app isn’t open they still take the call in NetTrio — they just miss the visual pop."),
      ...qa("How big is this build and how risky is it?", "Net-new but on proven foundations: a token endpoint, the three data endpoints, a small call-events table and credential store, an indexed phone lookup, a Clients page, and the screen-pop. No existing authentication, commission, or policy logic changes, so risk to the rest of the platform is low. The only genuine design choices are credential scope and no-Agent-of-Record routing."),
      ...qa("Are the client secret and tokens handled to your Section 10 standard?", "Yes — secrets are hashed at rest with constant-time comparison, tokens are signed and expiry-checked, all traffic is TLS 1.2+, and secrets/tokens/PII are redacted from every log, including the error logging your spec calls for."),

      // ---- 10 Edge cases ----
      h1("10.  Edge cases we’ve already accounted for"),
      edgeTable,

      // ---- 11 Summary ----
      h1("11.  Summary"),
      p("This integration is a strong fit for our platform. We already run the hard parts — an Agent-of-Record data model, a sub-second real-time push channel, a secure machine-to-machine API pattern, and the encryption/secrets infrastructure to back it. The work is to expose them through the Salesforce-style contract your platform already uses, add a fast phone lookup, and build the Clients page and screen-pop on top. Every Section 11 criterion is a “Yes,” the change is additive and low-risk, and the only open items are a couple of details to confirm at onboarding (the subId mapping and billing authority)."),
      new Paragraph({ spacing: { before: 120 }, children: [t("Sample values throughout your specification (domains, IDs, secrets) are understood to be illustrative; production values will be issued during onboarding.", { italics: true, size: 18, color: MUT })] }),
    ],
  }],
});

const outPath = path.join(__dirname, "..", "docs", "inbound-lead-feature", "INTEGRATION_RESPONSE.docx");
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(outPath, buf);
  console.log("Wrote " + outPath + " (" + buf.length + " bytes)");
});
