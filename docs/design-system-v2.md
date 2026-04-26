# Design System v2 — Migration Guide

Soft, rounded, warm yellow/cream aesthetic ("Crextio-inspired"). Use this
guide to roll the new look out one page at a time. The foundation, sidebar,
login, and dashboard hero are already on v2 — everything else is opt-in.

## Why v2

The old surfaces are editorial / data-dense with hard borders. v2 leans into
generous whitespace, large radii, soft shadows, a single warm accent, and
display-weight typography. The result reads as "modern HR tool" instead of
"trading terminal". Density still wins inside data tables — see the Don'ts.

## How v2 is layered

- All v2 styles live under the `.theme-v2` class — they do not affect any
  page that is not explicitly opted in.
- Existing shadcn tokens, dark mode, and the recruiting amber theme are
  untouched.
- Migration is per-page: wrap the page root in `<SectionShell>` and swap
  shadcn primitives for v2 primitives where the visual matters.

## Tokens

CSS variables defined in `src/index.css`:

| Token                    | Light             | Purpose                                    |
| ------------------------ | ----------------- | ------------------------------------------ |
| `--v2-bg-canvas`         | `#f4f1ea`         | Warm gray page background                  |
| `--v2-bg-card`           | `#ffffff`         | Default card surface                       |
| `--v2-bg-card-tinted`    | `#fefcf3`         | Cream card variant (sidebar rail)          |
| `--v2-bg-card-dark`      | `#0e0e0c`         | Dark "task list" card                      |
| `--v2-accent`            | `#ffd23b`         | Primary yellow                             |
| `--v2-accent-strong`     | `#f5b800`         | Hover / pressed yellow                     |
| `--v2-accent-soft`       | `#fff4c2`         | Hover background, chips                    |
| `--v2-ink`               | `#0f0f0f`         | Near-black text & active controls          |
| `--v2-ink-muted`         | `#5e5d56`         | Body copy                                  |
| `--v2-ink-subtle`        | `#918e85`         | Eyebrow / metadata                         |
| `--v2-ring`              | `#ece9df`         | Soft beige border                          |
| `--v2-ring-strong`       | `#d9d5c7`         | Stronger divider                           |
| `--v2-radius-{sm,md,lg}` | 14 / 20 / 28 px   | Card radii                                 |
| `--v2-radius-pill`       | `9999px`          | Pill shape                                 |
| `--v2-shadow-soft`       | layered           | Default card shadow                        |
| `--v2-shadow-lift`       | layered           | Hero / elevated card                       |
| `--v2-font-display`      | Plus Jakarta Sans | Default sans inside `.theme-v2`            |

Dark-mode equivalents are defined under `.theme-v2.dark` / `.dark .theme-v2`.

### Tailwind aliases

`tailwind.config.js` exposes these as utilities:

- `bg-v2-canvas`, `bg-v2-card`, `bg-v2-card-tinted`, `bg-v2-card-dark`,
  `bg-v2-accent`, `bg-v2-accent-soft`
- `text-v2-ink`, `text-v2-ink-muted`, `text-v2-ink-subtle`
- `border-v2-ring`, `border-v2-ring-strong`
- `rounded-v2-sm`, `rounded-v2-md`, `rounded-v2-lg`, `rounded-v2-pill`
- `shadow-v2-soft`, `shadow-v2-lift`
- `font-display`

## Primitives

All exported from `@/components/v2`.

### `SectionShell`

Wraps a page or page region in `theme-v2 v2-canvas`. Apply once, at the
outermost element of a migrated page.

```tsx
import { SectionShell } from "@/components/v2";

export const MyPage = () => (
  <SectionShell>
    <div className="mx-auto max-w-[1400px] px-8 py-6">…</div>
  </SectionShell>
);
```

### `SoftCard`

The workhorse surface. Variants: `default` (white), `tinted` (cream),
`dark` (black), `accent` (yellow), `ghost`. Radius `md` or `lg`.

```tsx
<SoftCard padding="lg" lift>
  <h2 className="font-display text-2xl">…</h2>
</SoftCard>
```

### `PillButton`

Pill-shaped CTA. Tones: `black` (primary), `yellow`, `ghost`, `white`.

```tsx
<PillButton tone="black" size="lg" fullWidth>
  Sign in
</PillButton>
```

### `PillNav`

Centered pill cluster — used for period switchers and public top nav.

```tsx
<PillNav
  items={[{ label: "MTD", value: "MTD" }, { label: "Year", value: "yearly" }]}
  activeValue={timePeriod}
  onChange={(v) => setTimePeriod(v as TimePeriod)}
/>
```

### `MetricBar`

Labelled horizontal progress bar (the "Interviews 15%" rows). Tones:
`yellow`, `ink`, `muted`.

```tsx
<MetricBar label="Pace" value={0.62} tone="ink" />
```

### `StatTile`

Big-number tile with icon and caption.

```tsx
<StatTile
  icon={<Users className="h-4 w-4" />}
  value={203}
  caption="Projects"
/>
```

### `RingProgress`

Pure-SVG donut for circular metrics with a slot for center content.

```tsx
<RingProgress
  value={0.72}
  size={160}
  centerLabel={<div className="text-2xl font-semibold">02:35</div>}
/>
```

## Migrating a page — 4-step recipe

1. **Wrap the page root in `<SectionShell>`** to apply the canvas gradient
   and font-display to its subtree.
2. **Swap top-level container `Card` → `SoftCard`** with `padding="lg"` and
   `lift` for hero cards.
3. **Replace shadcn `Button` (rectangular) with `PillButton`** for primary
   CTAs. Keep the rectangular `Button` inside data tables and dialog
   footers — it's denser there.
4. **Replace hard borders (`border-zinc-200`) with `border-v2-ring`** and
   replace `bg-white` with `bg-v2-card`.

Validate: `npm run build` (zero TS errors) → start dev server → eyeball at
1280 / 1440 / 1920 → confirm the dark-mode toggle still works on the page.

## Don'ts

- **Don't retheme data tables** with `rounded-v2-lg`. Keep tables compact —
  per CLAUDE.md the app prizes density. Wrap the table in a `SoftCard`,
  but leave row heights and column padding alone.
- **Don't touch the password-reset flow.** Per CLAUDE.md the recovery URLs
  must stay `/auth/callback` and the early hash capture in `src/index.tsx`
  must stay. Visual changes only.
- **Don't restyle dialogs** (`Dialog`, `AlertDialog`) without testing. They
  use Radix Portal so a SectionShell wrapper around the trigger does NOT
  reach the dialog content. Test in both modes.
- **Don't add v2 classes outside `.theme-v2`.** The `bg-v2-*` utilities
  resolve to CSS vars only set inside `.theme-v2` — outside that scope
  they fall back to `unset` and look broken.
- **Don't replace the shadcn Card primitive everywhere.** Many features
  rely on its `variant="glass"` etc. Migrate per page.

## Page migration checklist

Already on v2:

- [x] Sidebar (`src/components/layout/Sidebar.tsx`)
- [x] Login (`src/features/auth/Login.tsx`) + SignInForm + ResetPasswordForm
- [x] Dashboard home — hero region (`src/features/dashboard/DashboardHome.tsx` +
      `DashboardHeroV2.tsx`); lower sections wrapped in `SoftCard`s

To migrate (estimated effort tag in parens — XS/S/M/L):

- [ ] `src/features/auth/AuthCallback.tsx` (XS)
- [ ] `src/features/auth/EmailVerificationPending.tsx` (XS)
- [ ] `src/features/auth/PendingApproval.tsx` (XS)
- [ ] `src/features/auth/DeniedAccess.tsx` (XS)
- [ ] `src/features/auth/ResetPassword.tsx` (S — confirm screen, not flow)
- [ ] `src/features/landing/PublicLandingPage.tsx` (L — has a database-driven
      theme of its own; coordinate with `landingPageService` before swapping
      tokens, or apply v2 only to the auth-CTA strip)
- [ ] `src/features/dashboard/components/Masthead.tsx` (S — currently unused
      after v2 hero swap; can be deleted once no other route imports it)
- [ ] `src/features/dashboard/components/HeroSummary.tsx` (S — same as above)
- [ ] `src/features/dashboard/components/SecondaryMetricsRow.tsx` (S — same)
- [ ] `src/features/dashboard/components/PaceLines.tsx` (S — restyle bars to
      `MetricBar` aesthetic)
- [ ] `src/features/dashboard/components/EditorialAlertsActions.tsx` (M)
- [ ] `src/features/dashboard/components/DetailsSection.tsx` (M)
- [ ] `src/features/dashboard/components/OrgMetricsSection.tsx` (M)
- [ ] `src/features/dashboard/components/TeamRecruitingSection.tsx` (M)
- [ ] Policies (`src/features/policies/*`) (L — large data tables, use
      SoftCard wrapper only)
- [ ] Commissions (`src/features/commissions/*`) (L)
- [ ] Recruiting pipeline (`src/features/recruiting/*`) (L)
- [ ] Reports (`src/features/reports/*`) (L)
- [ ] Targets (`src/features/targets/*`) (M)
- [ ] Analytics (`src/features/analytics/*`) (L)
- [ ] Hierarchy / Team (`src/features/hierarchy/*`) (M)
- [ ] Expenses (`src/features/expenses/*`) (M)
- [ ] Billing (`src/features/billing/*`) (M)
- [ ] Settings (`src/features/settings/*`) (L — many sub-pages)
- [ ] Admin (`src/features/admin/*`) (L)
- [ ] Training / My Training / Agent Roadmap (M each)
- [ ] Voice Agent (`src/features/voice-agent/*`) (M)
- [ ] Lead Vendors / Lead Drop / Marketing (S each)
- [ ] Workflows / Business Tools / Quick Quote / UW Wizard (M each)
- [ ] Leaderboard (S)
- [ ] Messages (M)

## Reference

The visual target is the "Crextio HR dashboard" mock the team agreed on:
soft cream gradient background, top pill nav, large welcome header,
horizontal metric bars, big rounded cards, single yellow accent. Open
`/login` and `/dashboard` after a fresh build to see the canonical
implementation.
