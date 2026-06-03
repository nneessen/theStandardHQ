# Continuation — ADA Accessibility Audit + Pre-Sunset Protection Audit

**Created:** 2026-05-31  •  **Priority:** HIGH (precedes the Founders/Self Made platform sunset)

## Why this exists (read first)
Nick is preparing to **revoke platform access for Founders Financial / Self Made Financial users**
while keeping **Epic Life** live (the "RED BUTTON" platform sunset). This is an **adversarial**
action that "will make a lot of noise." Named parties who may litigate: **Cary Glass**, **Bowen
Sweeney**, and **Founders** generally. Nick wants to be maximally protected before pulling the trigger.

**The hard truth to keep front-and-center:** the engineering audits below *reduce* exposure but are
NOT the actual shield. The shield is (1) an **attorney** reviewing Nick's **agent agreement with
Founders** + the sunset's legality BEFORE the trigger, and (2) an **LLC + cyber/E&O insurance**
(Nick currently owns the platform *personally* → direct personal liability). Do not let the code
work create false confidence that the legal exposure is handled.

Related prior work: `docs/business/application-sunset-plan-2026-05-20.md`,
`plans/active/continue-20260527-platform-sunset-phase2-edge-fns-frontend.md`,
`docs/business/ip-independence-declaration.md`, memory `project_platform_sunset_ffg_revocation.md`,
`docs/security/SECURITY_AUDIT_2026-05-31.md`, `docs/business/compliance-gap-assessment-2026-05-31.md`.

## State at handoff (done this session — 2026-05-31)
- Security audit Critical/High: DEPLOYED to prod (anon RPC holes closed, impersonation closed, rate
  limiting live). H4 sync_webhook_secret Vault-wired. C3 close-webhook-handler deployed + signing
  (pending Nick's positive 200 check).
- DocuSeal fully removed (code + 3 tables + 2 edge fns).
- TCPA/CAN-SPAM suppression schema live; functions built (NOT deployed — need env vars).
- Everything UNCOMMITTED; database.types.ts not regenerated.

---

## TASK 1 — ADA / WCAG 2.1 AA accessibility audit (public pages)
**Why:** web-accessibility "drive-by" lawsuits hit public US sites with no customer relationship
required; the **public recruiting/landing funnel** is the exposed surface (authed app = lower risk).

**Scope:** PUBLIC pages only — landing `/`, the recruiting funnel, recruiter landing pages,
privacy/terms, any public lead/apply forms. NOTE a concurrent session reworked `src/features/landing/hq/`
(scoped `.theme-hq`) — coordinate; don't clobber it.

**How:**
1. Use the `webapp-testing` skill (Playwright) or run axe-core / Lighthouse against each public page.
   `npx @axe-core/cli <url>` or inject axe via Playwright and collect violations.
2. Check: color contrast (4.5:1 text), alt text on images, form labels + error association,
   full keyboard nav + visible focus states, heading hierarchy, ARIA landmarks, skip-to-content link,
   reduced-motion (the landing uses motion — already has a reduced-motion fallback per memory).
**Deliverables:** violation report by severity → fix them → add a public **accessibility statement**
page. Re-run to confirm clean. Write findings to `docs/business/accessibility-audit-<date>.md`.

---

## TASK 2 — Pre-sunset protection audit (the "very serious" part)

### 2A. ENGINEERING (can be done in this repo)
1. **Data-export integrity = the #1 anti-litigation control.** Every Founders/Self Made user MUST be
   able to export ALL their data BEFORE wipe, so no one can claim "you destroyed my business records."
   Verify the export bundle (`generate-user-export-bundle`) covers every table the wipe touches —
   the **export ⊆ wipe parity unit test** is an OPEN TODO in `project_platform_sunset_ffg_revocation.md`.
   Build it. Confirm the export actually delivers (memory flags a local signed-URL `kong:8000` gap —
   test on REMOTE).
2. **Audit logging / evidence:** ensure the revocation + export + wipe each write a tamper-evident,
   timestamped record (who, what, when, why) — this is Nick's defensive evidence trail. Verify it exists;
   add it if not.
3. **No collateral to Epic Life:** re-verify the sentinel-imo_id path, RLS gating, and the 7 anon
   public RPCs all respect `access_revoked_at` so revoked users are cut off but Epic Life is untouched
   and no cross-tenant leak occurs either direction. (Most of this shipped; re-verify on prod.)
4. **Reversibility before wipe:** confirm the two-switch design (reversible `access_revoked_at` flag
   vs. irreversible wipe) works and the reversible step is genuinely reversible.
5. **Security posture (done 2026-05-31)** undercuts any "you mishandled our data" claim — keep it green;
   finish deploying the TCPA/CAN-SPAM + committing.

### 2B. LEGAL — ATTORNEY REQUIRED (cannot be solved in code; do BEFORE the trigger)
- **Read Nick's agent agreement(s) with Founders** — IP/work-product ownership, non-compete,
  non-solicit, data ownership, platform/tooling clauses. This is the single biggest open risk
  (per `project_platform_ip_ownership.md`) and determines whether Founders has ANY claim to the platform.
- **Platform Terms adequacy:** explicit right to discontinue service, no availability/uptime guarantee,
  no warranty, limitation of liability, Colorado governing law, anti-IMO clauses (some already hardened
  in `TermsPage.tsx` — counsel should confirm they cover an adversarial shutoff).
- **Data-wipe legality:** does Nick have the right to delete Founders agents' business data? Insurance
  record-retention obligations? (Export-first flow mitigates — counsel should bless the sequence.)
- **Tortious interference / business disruption:** cutting agents off mid-business can draw interference
  claims. Notice period? Wind-down terms? A documented legitimate business rationale (not retaliation).
- **Entity shield + insurance:** is there an LLC with the IP assigned to it? Cyber + tech E&O + general
  liability coverage confirmed? (Nick owns it personally today = full personal exposure.)

### 2C. EVIDENCE / OPSEC (before pulling the trigger)
- Preserve IP-independence declaration + Terms-acceptance records.
- Document the legitimate business reason for the sunset (defends against retaliation framing).
- Full DB + storage backup snapshot immediately before any wipe.

---

## Open questions for Nick (answer to scope Task 2)
1. Who are Cary Glass / Bowen Sweeney (roles at Founders/Self Made)? Owners? Upline? Counsel?
2. Target timeline for the sunset?
3. Does an LLC exist that owns/operates the platform? Insurance in place?
4. Has the agent agreement been reviewed by an attorney yet?

## Suggested order
ADA audit (Task 1) → engineering protection audit (2A, esp. export⊆wipe parity) → hand the 2B legal
checklist to Nick's attorney. Do NOT execute the sunset until 2B is cleared by counsel.
