# Radix Popover: Scroll Inside a Popover

## The Problem

Any scrollable container placed inside a Radix `<Popover>` (or `<DropdownMenu>`, `<Select>`, etc.)
**will not respond to mouse wheel / trackpad scroll** — even with `overflow-y-auto` applied.

## Root Cause

Radix's internal `DismissableLayer` component attaches **document-level wheel event listeners** so
it can detect "outside" interactions and close the popover. These listeners see the wheel event
first and stop it from reaching the scroll container inside the portal.

Additionally, shadcn's `<ScrollArea>` replaces the native scrollbar with a JS-driven overlay
whose pointer-event handling conflicts with the Popover layer, making both custom AND native
scrolling fail.

## The Fix (Two Parts)

### 1. Use a native div, NOT `<ScrollArea>`

```tsx
// ❌ BROKEN inside Popover
<ScrollArea className="h-[280px]">…</ScrollArea>

// ✅ WORKS
<div
  className="h-[280px] overflow-y-auto overscroll-contain"
  onWheel={(e) => e.stopPropagation()}
>
  …
</div>
```

### 2. Both attributes are required

| Attribute | Why |
|---|---|
| `h-[280px]` | **Fixed** height (not `max-h`). Without a fixed height the container never needs to scroll. |
| `overflow-y-auto` | Shows native scrollbar when content overflows. |
| `overscroll-contain` | Prevents scroll chaining up to the document. |
| `onWheel={(e) => e.stopPropagation()}` | Stops wheel events from reaching the Radix `DismissableLayer` before the div handles them. **This is the key fix.** |

## Where This Pattern is Used

- `src/features/email/components/TemplatePicker.tsx` — template list inside `<Popover>`

## Applies To

Any Radix primitive that uses `DismissableLayer` internally:

- `@radix-ui/react-popover` → `<Popover>`
- `@radix-ui/react-dropdown-menu` → `<DropdownMenu>`
- `@radix-ui/react-select` → `<Select>` (uses its own scroll, but same cause)
- `@radix-ui/react-tooltip` → `<Tooltip>` (less common)
- `@radix-ui/react-dialog` → `<Dialog>` (portal-based, usually fine without the fix)

## Quick Checklist

When a scroll container inside a Radix popover-like component doesn't work:

- [ ] Replace `<ScrollArea>` with a plain `<div>`
- [ ] Use `h-[Npx]` (fixed), not `max-h-[Npx]`
- [ ] Add `overflow-y-auto`
- [ ] Add `overscroll-contain`
- [ ] Add `onWheel={(e) => e.stopPropagation()}`
