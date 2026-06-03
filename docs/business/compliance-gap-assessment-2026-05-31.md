# Legal / Compliance Gap Assessment — The Standard HQ — 2026-05-31

> **Not legal advice.** This is an engineering-side risk scan to hand to an attorney, ordered by
> how often this *specific* kind of platform (US, sends SMS + email, public recruiting funnel,
> handles agent/lead PII) actually gets sued. Confirm everything with licensed counsel.

You already have: ✅ Privacy Policy (`TermsPage`/privacy RPC), ✅ Terms of Service,
✅ internal IP-independence declaration. Those are necessary but they are **not** the surfaces
plaintiffs actually file on. The four below are.

---

## TIER 1 — Highest litigation frequency (statutory damages = no harm required)

### 1. TCPA — SMS/texting consent (you have a `send-sms` edge function) ⚠️ BIGGEST RISK
- **Why it matters:** Texting leads/contacts without **prior express written consent** is the
  single most-sued consumer statute. Statutory damages are **$500–$1,500 per text** — class
  actions stack fast. Serial plaintiffs and law firms troll for this.
- **What's needed (engineering-visible):**
  - Recorded, timestamped **opt-in/consent** per recipient before any SMS (store the consent
    artifact — who, when, what language they agreed to).
  - **STOP/opt-out** handling that is immediate and durable (suppress list), plus HELP.
  - Quiet-hours enforcement (no texts 9pm–8am recipient local time).
  - Don't text numbers you scraped/bought without consent (Close leads count).
- **STATUS — CONFIRMED GAP (2026-05-31):** `send-sms/index.ts` (377 lines) contains **zero**
  consent/opt-in/opt-out/STOP/suppression/quiet-hour checks, and the database has **no**
  consent/suppression/unsubscribe tables at all. Texts can be sent with no consent gate. This is
  unmitigated TCPA exposure. Remediation requires: (1) a `sms_consent` + `sms_suppression` schema,
  (2) a consent check + suppression-list check in `send-sms` before send, (3) inbound STOP/HELP
  handling, (4) quiet-hours guard. Consent *language* + retention policy need counsel input.

### 2. CAN-SPAM — marketing email (you have `send-email`, `process-bulk-campaign`, campaigns)
- **Why it matters:** $51,744 per violating email (FTC). Less plaintiff-driven than TCPA but FTC-enforced.
- **What's needed:** working **unsubscribe** link in every marketing email, honored within 10
  business days; a valid **physical postal address** in the footer; accurate From/Subject lines;
  no harvested recipients.
- **STATUS — CONFIRMED GAP (2026-05-31):** No unsubscribe link, `List-Unsubscribe` header, or
  physical postal address found in `send-email`, `process-bulk-campaign`, `send-automated-email`,
  or `templateVariables.ts`. Marketing/automated email currently ships without CAN-SPAM footer
  requirements. Remediation: inject unsubscribe link + physical address into the email footer for
  marketing/bulk sends, honor unsubscribe via a suppression list (shared with the SMS one above).

### 3. ADA / WCAG 2.1 AA — web accessibility (public recruiting site)
- **Why it matters:** Web-accessibility "drive-by" lawsuits and demand letters are extremely common
  against public-facing US sites; plaintiffs need no actual customer relationship. The **public
  landing/recruiting funnel** is the exposed surface (your in-app authed pages are lower risk).
- **What's needed:** WCAG 2.1 AA on public pages — alt text, color contrast, keyboard nav, form
  labels, focus states, semantic headings, screen-reader landmarks. An accessibility statement page.
- **Status to verify:** No accessibility audit found. Recommend running axe/Lighthouse on the
  public marketing surface. (Note: there's a new `docs/todo/landing/` + a landing HTML in the repo —
  bake accessibility in before it ships.)

---

## TIER 2 — Applicable, lower frequency

### 4. CCPA / CPRA — California residents' data
- If you have California users/leads (very likely), you owe: a "Do Not Sell or Share My Personal
  Information" mechanism (relevant since you ingest **purchased leads** — "sale/share" is broad),
  disclosure of categories collected, and rights to access/delete. Your privacy policy must contain
  the CCPA-specific disclosures.
- **Status:** verify the privacy policy has the CCPA section + a rights-request intake.

### 5. Cookie consent / tracking
- If the public site loads analytics/marketing pixels/3rd-party trackers, you need a consent banner
  (and for any EU visitors, GDPR/ePrivacy prior-consent). If it's first-party only, lighter.
- **Status:** verify what trackers the public bundle loads.

### 6. State data-breach notification + a written incident-response plan
- Nearly every US state requires breach notification on PII exposure. Have a documented IR plan and
  know your notification timelines. (The security findings in `SECURITY_AUDIT_2026-05-31.md` are the
  prevention side of this.)

---

## TIER 3 — Structural / risk-transfer (talk to attorney + insurance broker, not code)

- **Entity & liability shield:** Memory notes Nick **personally** owns the platform IP and operates
  it commercially. Operating a data-handling commercial platform as an individual = **personal
  liability exposure**. An LLC/Corp (with the IP assigned to it and proper formalities) is the
  standard shield. **High priority for "fully protected."**
- **Insurance:** Cyber-liability + tech E&O policy. This is the actual financial backstop if a
  breach/claim lands — code hardening reduces probability, insurance caps the loss.
- **Vendor DPAs / subprocessor list:** Supabase, Stripe, Mailgun, Twilio/SMS provider, Anthropic,
  Close, Vercel all process your data — have DPAs on file and list subprocessors in the privacy policy.
- **Email/SMS consent records retention** — keep the proof, not just the switch.
- **Insurance-industry specifics** (NAIC/state DOI rules on agent recruiting, marketing claims) —
  out of engineering scope but flag for counsel since this is an insurance-agent platform.

---

## ENGINEERING-ACTIONABLE SHORTLIST (what we can build/verify in this repo)
1. **TCPA:** consent flag + suppression/STOP list checked in `send-sms` before send. *(verify/likely build)*
2. **CAN-SPAM:** unsubscribe link + physical address + suppression in all marketing email paths. *(verify/build)*
3. **ADA:** axe/Lighthouse pass on public pages; fix contrast/labels/alt/keyboard; add a11y statement. *(audit + fix)*
4. **CCPA:** confirm privacy-policy disclosures + a rights-request intake form.
5. **Cookie/consent banner** if 3rd-party trackers load on public pages.

Everything in Tier 3 is for Nick + attorney/insurance broker, not the codebase.

---

## BUILD STATUS — TCPA/CAN-SPAM suppression infrastructure (2026-05-31)

**Built + verified (deno check 6/6 clean); schema LIVE on local+prod; functions NOT deployed yet.**

Shared suppression/consent system (migration `20260531174017_communication_suppression_consent.sql`,
applied local + remote):
- Tables `communication_suppression` (global do-not-contact, unique on channel+contact) +
  `communication_consent` (opt-in proof). RLS read for authenticated; writes only via RPCs.
- RPCs (SECURITY DEFINER, search_path-pinned, service_role-only): `is_suppressed`, `add_suppression`,
  `remove_suppression`, `record_consent`. Smoke-tested.

Integrations (code done, deno-clean, NOT deployed):
- **SMS pre-send gate** in `send-sms` — blocks send to suppressed numbers (HTTP 200, `suppressed:true`).
- **`sms-inbound-webhook`** (new, verify_jwt=false) — Twilio X-Twilio-Signature (HMAC-SHA1) verified;
  STOP/UNSUBSCRIBE/CANCEL/END/QUIT → add_suppression + TwiML confirm; START → remove; HELP → help.
- **Email CAN-SPAM**: `_shared/email-compliance.ts` (footer w/ unsubscribe link + physical address +
  HMAC token, `List-Unsubscribe` header); per-recipient suppression gate in `process-bulk-campaign`
  (marketing) + `send-automated-email` (gated by new `isMarketing` flag — transactional mail untouched).
- **`email-unsubscribe`** (new, verify_jwt=false) — HMAC-verified unsubscribe link target → add_suppression.

### DEPLOY RUNBOOK (needs you — these require config only you can provide):
1. Set edge env vars on prod:
   - `UNSUBSCRIBE_SECRET` = `openssl rand -hex 32` (signs unsubscribe links).
   - `COMPANY_POSTAL_ADDRESS` = **a real, deliverable physical address** (CAN-SPAM §7704(a)(5) requires it;
     until set, marketing emails render a visible `[COMPANY ADDRESS NOT CONFIGURED]` placeholder).
   - `SMS_WEBHOOK_URL` = `https://pcyaqwodnyrpkaiojnpz.supabase.co/functions/v1/sms-inbound-webhook`.
2. Deploy: `send-sms`, `sms-inbound-webhook`, `email-unsubscribe`, `send-automated-email`, `process-bulk-campaign`.
3. In Twilio: set the Messaging Service inbound webhook → the `sms-inbound-webhook` URL; enable Advanced Opt-Out.
4. (Hold email-function deploys until COMPANY_POSTAL_ADDRESS is set, or marketing mail ships the placeholder.)

### STILL TO BUILD (next increment):
- **Consent capture at point of collection** — call `record_consent('sms'/'email', …)` where recruits/
  leads provide their number/email (application forms, ContactsSection), storing the agreed language.
- A consent/opt-in checkbox + disclosure text on public lead/recruit forms (wording = **attorney**).
- Suppression-status surfacing in the UI (the tables already allow authenticated reads).
- Quiet-hours guard in send-sms (no texts 9pm–8am recipient-local) — **counsel: jurisdiction rules**.
