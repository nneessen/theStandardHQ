# Component Styling Guide

Use this guide when customizing shadcn/ui components to maintain consistency across the codebase.

## Core Principles

1. **Use theme CSS variables** - Never hardcode colors like `blue-500`, `slate-800`. Always use `--foreground`, `--background`, `--muted`, `--border`, etc.
2. **Black/white preference** - Default states should be monochrome. Color is used sparingly for semantic meaning.
3. **Consistent variants** - All interactive components should use the same variant names with matching behaviors.
4. **Subtle depth** - Use `shadow-sm` for resting state, `shadow-md` on hover for elevation effect.

---

## Standard Variant Names

Use these variant names consistently across Button, Badge, Card, Alert, and other components:

| Variant       | Purpose               | Resting State                                | Hover                       | Active/Click            |
| ------------- | --------------------- | -------------------------------------------- | --------------------------- | ----------------------- |
| `default`     | Primary action        | `bg-foreground text-background`              | Slight opacity reduction    | Darker + shadow removed |
| `secondary`   | Secondary action      | `bg-secondary text-secondary-foreground`     | Slight opacity reduction    | Darker                  |
| `destructive` | Dangerous action      | `bg-destructive text-destructive-foreground` | Slight opacity reduction    | Darker                  |
| `success`     | Positive/confirm      | `bg-[hsl(var(--success))]`                   | Slight opacity reduction    | Darker                  |
| `warning`     | Caution               | `bg-[hsl(var(--warning))]`                   | Slight opacity reduction    | Darker                  |
| `outline`     | Bordered, transparent | `border border-input bg-background`          | `bg-accent`                 | Darker accent           |
| `ghost`       | Minimal/toolbar       | `text-muted-foreground`                      | `bg-accent text-foreground` | Darker accent           |
| `muted`       | Subtle background     | `bg-muted text-muted-foreground`             | Lighter + text-foreground   | Darker                  |
| `link`        | Text link             | `text-foreground underline-offset-4`         | Underline                   | —                       |

---

## Hover & Active Effects

Every interactive element needs three states:

### Hover Effects

```css
/* Solid backgrounds - reduce opacity */
hover:bg-foreground/90
hover:opacity-90

/* Ghost/transparent - add accent background */
hover:bg-accent
hover:text-foreground

/* Add depth on hover */
hover:shadow-md
```

### Active/Click Effects

```css
/* Solid backgrounds - darken more, remove shadow */
active:bg-foreground/80
active:shadow-none

/* Ghost/transparent - darken accent */
active:bg-accent/80
```

### Focus Effects

```css
/* Always use ring for focus */
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-ring/50
```

---

## CSS Variable Reference

From `index.css` - always use these:

```css
/* Core */
--background    /* Page/app background */
--foreground    /* Primary text, default button bg */
--card          /* Card backgrounds */
--card-foreground

/* Interactive */
--primary       /* Same as foreground in our theme */
--secondary     /* Muted interactive elements */
--muted         /* Subtle backgrounds */
--muted-foreground  /* Secondary text */
--accent        /* Hover backgrounds */

/* Semantic */
--destructive   /* Red - errors, delete */
--success       /* Green - confirmations */
--warning       /* Amber - cautions */
--error         /* Red - same as destructive */
--info          /* Blue - informational */

/* Borders */
--border        /* Default borders */
--input         /* Input borders */
--ring          /* Focus rings */
```

---

## Size Variants

Consistent sizing across components:

| Size      | Height    | Padding | Text      | Icon          |
| --------- | --------- | ------- | --------- | ------------- |
| `xs`      | `h-6`     | `px-2`  | `text-xs` | `h-3 w-3`     |
| `sm`      | `h-8`     | `px-3`  | `text-xs` | `h-3.5 w-3.5` |
| `default` | `h-9`     | `px-4`  | `text-sm` | `h-4 w-4`     |
| `lg`      | `h-10`    | `px-8`  | `text-sm` | `h-4 w-4`     |
| `icon`    | `h-9 w-9` | —       | —         | `h-4 w-4`     |

---

## Component Checklist

When styling a shadcn component:

- [ ] Replace hardcoded colors with CSS variables
- [ ] Add all standard variants (default, secondary, destructive, success, warning, outline, ghost, muted)
- [ ] Add hover effects (opacity or bg-accent)
- [ ] Add active/click effects (darker + shadow removal)
- [ ] Add focus-visible ring
- [ ] Add size variants (xs, sm, default, lg)
- [ ] Test in both light and dark mode
- [ ] Remove any borders except on `outline` variant

---

## Example: Button Variant Template

```tsx
variant: {
  default:
    "bg-foreground text-background shadow-sm hover:bg-foreground/90 hover:shadow-md active:bg-foreground/80 active:shadow-none",

  secondary:
    "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 active:bg-secondary/70",

  destructive:
    "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 active:bg-destructive/80",

  success:
    "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] shadow-sm hover:opacity-90 active:opacity-80",

  warning:
    "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] shadow-sm hover:opacity-90 active:opacity-80",

  outline:
    "border border-input bg-background text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground active:bg-accent/80",

  ghost:
    "text-muted-foreground hover:text-foreground hover:bg-accent active:bg-accent/80",

  muted:
    "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground active:bg-muted/70",

  link:
    "text-foreground underline-offset-4 hover:underline",
}
```

---

## Components to Update

Priority order for applying this guide:

1. ✅ Button - Done
2. Badge
3. Card (add interactive variants)
4. Alert
5. Input/Select (focus states)
6. Tabs
7. Dialog/Sheet
8. Table (row hover states)
