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

- All v2 styles live under the `.theme-v2` class.
- **Every authenticated route is already wrapped in `theme-v2 v2-canvas`
  by `src/App.tsx`** (both the sidebar variant and the free-user-header
  variant). New pages do not need to wrap themselves — they inherit the
  cream canvas, Plus Jakarta Sans, and ink palette automatically.
- Three global overrides are scoped to `.theme-v2` in `src/index.css`:
  1. shadcn `<Card>` (rounded-xl + bg-card) → v2-md radius, soft shadow,
     soft ring border, hover lift
  2. Page `<h1>` / `<h2>` default to `font-display` (Plus Jakarta Sans)
  3. shadcn primary buttons (`rounded-md`) become pill-shaped
- Per-page migration is now **only about layout polish** — replacing
  list/table chrome with `SoftCard`, adding hero strips, swapping
  buttons for `PillButton`. Visual baseline is already there.
- Existing shadcn tokens, dark mode, and the recruiting amber theme are
  untouched. Public landing & recruiting funnels keep their custom themes.

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

## Migrating a page — what's automatic vs. manual

### Automatic (already done for every authenticated page)

The `App.tsx` content wrapper applies `theme-v2 v2-canvas font-display
text-v2-ink` around the routed `<Outlet>`, and `index.css` has scoped
overrides under `.theme-v2`:

- shadcn `<Card>` picks up v2 radius + soft shadow + ring border
- `<h1>` / `<h2>` default to Plus Jakarta Sans display font
- shadcn primary buttons (`rounded-md`) become pill-shaped

So a brand-new page that just uses `Card` + `Button` + `h1` already looks
v2 with no code changes.

### Manual (per-page polish)

Reach for these primitives when the default chrome isn't enough:

1. **`<SectionShell>`** — only needed on **unauthenticated** pages
   (auth screens, landing). Auth routes inherit it from `App.tsx`.
2. **`<SoftCard>` over `<Card>`** when you want the bigger rounded-lg
   look (28px radius), the dark variant for "today" / task lists,
   or photo-bg cards.
3. **`<PillButton>` over `<Button>`** for primary page CTAs — same
   pill shape but with explicit yellow / black tones.
4. **`<MetricBar>` / `<StatTile>` / `<RingProgress>`** for KPI hero
   strips (see `DashboardHeroV2.tsx`).
5. **`border-v2-ring`** instead of `border-zinc-200` if you ever
   author a hard border manually.

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

### Baseline v2 (automatic — applies to every authenticated page)

- [x] Global `theme-v2 v2-canvas font-display` wrapper in `App.tsx`
- [x] Global Card / heading / button overrides in `index.css`
- [x] Sidebar (`src/components/layout/Sidebar.tsx`) — pill nav items, black active state, yellow dot
- [x] Login (`src/features/auth/Login.tsx`) + SignInForm + ResetPasswordForm
- [x] Dashboard home — hero region + all lower sections in `SoftCard`s
- [x] Auxiliary auth pages (AuthCallback, EmailVerificationPending, PendingApproval, DeniedAccess, ResetPassword) — themed wrappers
- [x] Public landing fallback themed (recruiter-customized sections retain their own theme)

### Optional polish (manual — opt in when a page deserves a hero strip)

These pages already look v2 thanks to the global overrides. Only return
to polish them when product wants them to feel more like the dashboard
(metric bars, hero photo card, ring progress, etc.):

- [ ] Policies (`src/features/policies/*`) — list-heavy; consider
      `SoftCard` wrap on the toolbar/filter chrome
- [ ] Commissions / Comp Guide
- [ ] Recruiting pipeline (already partially card-based)
- [ ] Reports — wrap report blocks in `SoftCard`
- [ ] Targets — natural fit for `MetricBar` hero
- [ ] Analytics — natural fit for `StatTile` row + `RingProgress`
- [ ] Hierarchy / Team
- [ ] Expenses
- [ ] Billing
- [ ] Settings (multi-tab; one tab at a time)
- [ ] Admin (`src/features/admin/*`)
- [ ] Training / My Training / Agent Roadmap
- [ ] Voice Agent / Chat Bot
- [ ] Lead Vendors / Lead Drop / Marketing / Messages
- [ ] Workflows / Business Tools / Quick Quote / UW Wizard
- [ ] Close KPI / Close AI Builder / Channel Orchestration
- [ ] Leaderboard

### Out of band

- Public landing (`src/features/landing/PublicLandingPage.tsx`) — owned
  by `landingPageService` (recruiter customization). Don't override its
  theme unless you also update the service contract.
- Recruit pipeline (`src/features/recruiting/...` recruit-side flows) —
  has its own brand stack via `RecruitHeader` + amber recruiting tokens.
  Leave alone or pair-migrate with the recruiting team.
- Legacy editorial dashboard subcomponents (`Masthead`, `HeroSummary`,
  `SecondaryMetricsRow`) — superseded by `DashboardHeroV2`. Can be
  deleted once no other route imports them.

## Reference

The visual target is the "Crextio HR dashboard" mock the team agreed on:
soft cream gradient background, top pill nav, large welcome header,
horizontal metric bars, big rounded cards, single yellow accent. Open
`/login` and `/dashboard` after a fresh build to see the canonical
implementation.
