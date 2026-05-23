# Standard HQ — Executive Brief

**One-page valuation & pricing summary**
*Prepared: May 8, 2026*

---

## What it is

A vertically-integrated agency operating system for life-insurance agencies. Replaces the agency-management system, sales CRM, recruiting CRM, LMS, voice AI, document AI, and workflow engine that an agency would otherwise stitch together from 7-10 separate vendors.

## What's been built

| Surface area | Scale |
|---|---|
| Codebase | 1,888 TypeScript files · **457,677 LOC** |
| Feature modules | 37 |
| Backend services | **92 edge functions** · 106 database tables · 507 migrations |
| Custom React hooks | 181 |
| Test files | 110 |
| Build duration | ~7.5 months (Sept 2025 → May 2026) · 1,486 commits |

## Defensible IP (the moat)

- **3-tier AI lead heat scoring** — deterministic + Claude Haiku batch + Claude Sonnet on-demand
- **Underwriting rule engine** with custom DSL and AI-driven extraction from carrier guides
- **Carrier acceptance dual-system** powering both quote engine and coverage builder
- **Voice cloning + automated phone-number provisioning** (Retell + ElevenLabs)
- **Self-healing Slack integration** (auto-rejoin, error surfacing, daily leaderboards)
- **Multi-tenant feature gating** with tier-aware Stripe webhooks
- **Recruiting pipeline** with single-transaction phase-advancement RPCs
- **Document extraction gateway** — pluggable adapter pattern across PaddleOCR, Railway, AI

## Subscription pricing — recommended

| Tier | Price/mo | Agents | Target |
|---|---|---|---|
| Starter | **$499** | 1-5 | Solo / 1099 producers |
| Growth (anchor) | **$1,499** | up to 25 | Mainstream agencies |
| Professional | **$3,999** | up to 75 | Large agencies, small IMOs |
| Enterprise | **$9,999+** | 75+ | IMOs, call centers, custom domain |

**Add-ons (high-margin):** AI Lead Heat +$29/seat · Voice Clone Agent +$149/seat · Custom Domain +$99/mo · Standalone LMS +$199/mo

**Anchor logic:** equivalent third-party stack (AgencyBloc + HubSpot + Lessonly + Apollo + Retell + Zapier) costs an agency **$1,000-$1,500/seat/month**. Growth tier = ~90% discount on stack cost.

## Sale valuation — three frames

| Frame | Methodology | Range |
|---|---|---|
| **Replacement cost** | 3-4 senior engineers × 12-18 months | **$1.2M – $2.5M** |
| **Asset/IP sale** *(pre-revenue)* | Codebase + domain logic + integrations | **$750k – $1.5M** |
| **Going-concern at $500k ARR** | 5-7x revenue multiple | **$2.5M – $3.5M** |
| **Going-concern at $1M ARR** | 6-8x revenue multiple | **$6M – $8M** |
| **Strategic acquirer at $1M ARR** | 8-12x (Vertafore, Applied, AgencyBloc) | **$8M – $12M** |

*Comparable transactions:* Vertafore acquired AgencyZoom at ~8x ARR; Applied Systems acquired Indio at reported ~10x ARR.

## Highest-leverage move before sale conversations

Land **one paying agency on Growth tier**. Converts the conversation from "speculative IP worth $1M" to "validated SaaS — multiple my ARR." Single signed contract is worth ~$2-3M of incremental valuation.

## The ask

1. Agreement on pricing tiers (above) for go-to-market
2. Authority to onboard 3 design-partner agencies at Growth tier with 6-month commits
3. Decision on positioning: **build to $2M ARR and exit at $15M+** OR **operate as recurring revenue engine for the parent agency**
