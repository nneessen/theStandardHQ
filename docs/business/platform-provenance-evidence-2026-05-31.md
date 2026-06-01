# Platform Provenance Evidence — The Standard HQ — 2026-05-31

> **Purpose:** a dated, reproducible engineering record establishing that The Standard HQ platform
> was substantially built **before** the Founders contract dated **May 11, 2026** (signed ~2 weeks
> before this record). This supports a **pre-existing intellectual property** position with respect
> to Clause E of that contract (the IP-assignment clause — see
> `presunset-legal-handoff-2026-05-31.md`).
>
> **Not legal advice.** This states verifiable engineering facts only. Legal conclusions are for
> counsel. Hand this to the attorney alongside the legal handoff packet.

## The question this answers

Founders Clause E assigns to the Company any IP "made, discovered, created, invented, or generated
by Contractor... **in connection with the Services, or the Company**." The defensive position is
that the platform is **pre-existing IP** — created independently, before any relationship or
Services existed — and therefore outside that clause's scope. That position depends on **provable
build dates predating the contract.** The records below establish them.

## Timeline (key dates)

| Date | Event |
| --- | --- |
| **2025-09-24 18:15:31 -0400** | First commit (`2d980362`) of the platform git repository |
| **2025-09-24** | `package.json` present (React app scaffolded at root) |
| **2025-09-26** | Product-domain code begins (`src/features/`, commit `74984ff3`) |
| **2025-09-24 → 2026-05-11** | Continuous development: **1,521 commits** across **199 distinct active days** |
| **2026-05-11** | Founders contract date (signed ~2 weeks before 2026-05-31 per owner) |
| **2026-05-31** | This record; repo now at 1,646 total commits |

→ The platform predates the contract by roughly **7.5 months** of active, finished-product development.

## Git evidence (in-repo, reproducible)

- **First commit:** `2d980362` — 2025-09-24 18:15:31 -0400 — committer `nneessen`.
- **Total commits:** 1,646 (span 2025-09-24 → 2026-05-31).
- **Commits before the contract date (2026-05-11):** **1,521**.
- **Distinct active development days before the contract:** **199**.
- **Monthly commit distribution before the contract** (shows sustained, distributed work — not a
  single back-dated import):

  | Month | Commits |
  | --- | --- |
  | 2025-09 | 30 |
  | 2025-10 | 110 |
  | 2025-11 | 81 |
  | 2025-12 | 365 |
  | 2026-01 | 296 |
  | 2026-02 | 212 |
  | 2026-03 | 179 |
  | 2026-04 | 185 |
  | 2026-05 (to 05-11) | 63 |

**Why this matters evidentially:** development is spread across **199 separate calendar days** over
nine months. A back-dated or fabricated history cannot realistically reproduce that distribution;
this is strong circumstantial proof the work genuinely occurred on those dates.

### Reproduce these figures

```bash
git log --reverse --format="%H %ad" --date=iso | head -1          # first commit
git rev-list --count HEAD                                          # total commits
git log --before="2026-05-11" --oneline | wc -l                    # commits before contract
git log --before="2026-05-11" --format="%ad" --date=short | sort -u | wc -l   # distinct active days
git log --before="2026-05-11" --format="%ad" --date=format:%Y-%m | sort | uniq -c  # per-month
```

## IMPORTANT caveat — corroborate with third-party timestamps

Git commit dates are **set by the committer's machine** and can in principle be back-dated, so on
their own they are rebuttable. Their evidentiary weight is strongest when **corroborated by
independent, third-party-dated records** that cannot be self-edited. Capture and preserve the
following (owner action — dates not derivable from this repo):

- [ ] **Domain registration** — WHOIS creation date for `thestandardhq.com` (and any earlier domain).
- [ ] **Supabase** — project creation date (dashboard → project settings / billing history).
- [ ] **Vercel** — project creation date / first deployment date.
- [ ] **Stripe** — account / first-product creation date (billing was built into the platform).
- [ ] **Hosting / SaaS invoices** — earliest dated invoices from Supabase, Vercel, Mailgun, etc.
- [ ] **GitHub** — repository creation date (if/when the repo was pushed to a remote).
- [ ] **Earliest design docs / emails / notes** — anything dated before 2025-09-24 pushes the
      conception date back further.

If any of these **predate 2025-09-24**, they extend the provenance and should be added to the
timeline above.

## Related documents

- `presunset-legal-handoff-2026-05-31.md` — Clause E verbatim + the counsel questions this evidence feeds.
- `docs/business/ip-independence-declaration.md` — the internal IP-ownership declaration.
- `plans/active/continue-20260531-task2a-2b-presunset-protection.md` — Task 2A/2B plan.
