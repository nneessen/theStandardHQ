# New-session kickoff prompt — paste this into a fresh Claude Code session

> Copy everything in the code block below into a new session to resume this work.

```
Continue the commissionTracker security / compliance / platform-sunset protection work
from the 2026-05-31 session.

FIRST, read these in full before doing anything:
- plans/active/continue-20260531-ada-audit-and-presunset-protection.md   ← PRIMARY plan (ADA audit + pre-sunset protection audit)
- docs/security/SECURITY_AUDIT_2026-05-31.md                              ← what's done / deployed to prod / still pending
- docs/business/compliance-gap-assessment-2026-05-31.md                   ← TCPA / CAN-SPAM / ADA / CCPA status + runbooks

THEN scan plans/active/ for any other related plans, especially:
- plans/active/continue-20260527-platform-sunset-phase2-edge-fns-frontend.md  ← the platform sunset / FFG revocation work

ALSO read the MEMORY.md entries dated "May 31, 2026" for full context (security audit, TCPA/CAN-SPAM,
edge-deploy verify_jwt gotcha, H4 vault wiring, pre-sunset protection handoff).

START WITH: Task 1 in the primary plan — the ADA / WCAG 2.1 AA accessibility audit on the PUBLIC
pages (landing, recruiting funnel, public forms; NOT the authed app). Use the webapp-testing skill /
axe-core / Lighthouse, report violations by severity, fix them, add an accessibility statement page.

THEN: Task 2A engineering pre-sunset hardening (export⊆wipe parity test, audit-log evidence trail,
Epic Life isolation re-verify).

DO NOT execute the platform sunset / access revocation — the Task 2B legal items (agent-agreement
review, data-wipe legality, LLC + insurance) must be cleared by my attorney first.

Open questions I still owe you: who Cary Glass / Bowen Sweeney are, sunset timeline, whether an LLC
owns the platform, and whether an attorney has reviewed my Founders agent agreement.
```
