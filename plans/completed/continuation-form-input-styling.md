# Continuation Prompt: Fix Form Input Styling

## Problem
Form inputs (text inputs, selects, textareas, etc.) use the same background color as the surrounding UI, making them hard to distinguish. Need to add visual contrast so users can clearly identify interactive form elements.

## Context
The UW Wizard and other forms have inputs that blend into the background. The inputs need:
- Distinct background color (slightly lighter/darker than container)
- Subtle border to define boundaries
- Clear focus states
- Consistent styling across all form controls

## Files to Update

### Primary Components
- `src/components/ui/input.tsx` - Base input component
- `src/components/ui/select.tsx` - Select dropdown component
- `src/components/ui/textarea.tsx` - Textarea component

### Feature-Specific Forms (check for inline styling overrides)
- `src/features/underwriting/components/WizardSteps/ClientInfoStep.tsx`
- `src/features/underwriting/components/WizardSteps/CoverageRequestStep.tsx`
- `src/features/underwriting/components/WizardSteps/HealthConditionsStep.tsx`
- `src/features/underwriting/components/WizardSteps/MedicationsStep.tsx`

## Styling Requirements

Follow the Component Styling Guide:
- Use theme CSS variables (`--background`, `--input`, `--border`, `--ring`)
- Light mode: inputs should be white (`bg-background`) with `border-input`
- Dark mode: inputs should be slightly lighter than container (`bg-zinc-800` or `bg-zinc-900`)
- Add subtle border: `border border-input`
- Focus state: `focus-visible:ring-2 focus-visible:ring-ring/50`
- Consistent height: `h-9` for default, `h-8` for compact

## Example Fix Pattern

```tsx
// Before (blends in):
<Input className="h-8 text-sm" />

// After (distinct):
<Input
  className="h-8 text-sm bg-background border border-input
             focus-visible:ring-2 focus-visible:ring-ring/50"
/>
```

## For Select Components
Ensure the trigger has distinct styling:
```tsx
<SelectTrigger className="h-8 bg-background border border-input">
```

## Acceptance Criteria
1. All form inputs clearly distinguishable from background
2. Consistent styling across Input, Select, Textarea
3. Works in both light and dark mode
4. Focus states clearly visible
5. Typecheck passes
