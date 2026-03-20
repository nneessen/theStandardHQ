# Plan: Voice Agent Guided Prompt Editor

## Problem
The current prompt editor is a single large textarea. Users don't know
how to structure an effective voice agent prompt, leading to either:
- Copy-pasting generic templates that don't fit their business
- Writing unstructured free-text that the LLM misinterprets
- Missing critical sections (guardrails, pricing handling, workflows)

## Goal
Replace the single textarea with a guided, section-based editor that
produces a well-structured Markdown prompt behind the scenes.

## Design

### Section-Based Form

Each section maps to a Markdown heading in the final prompt. Sections
have labels, helper text, and appropriate input types.

| Section | Input Type | Helper Text |
|---------|-----------|-------------|
| **Identity** | Short textarea (2-3 lines) | "Who is this agent? e.g., 'You are the voice assistant for Sarah at ABC Insurance.'" |
| **Style** | Checklist + custom textarea | Pre-checked defaults (concise, one question at a time, warm tone) with option to add custom rules |
| **Product Knowledge** | Tag selector + textarea | Select products the agent can discuss (mortgage protection, term life, IUL, final expense, etc.) + custom knowledge |
| **Pricing Handling** | Radio group + custom textarea | "When callers ask about pricing:" → Bridge to appointment (recommended) / Provide ranges / Decline to discuss. Custom bridge script. |
| **Hard Limits** | Checklist | Pre-checked compliance defaults + custom "never do" items |
| **Workflows** | Per-workflow textareas | One section per enabled workflow type (missed_appointment, reschedule, after_hours_inbound, quoted_followup) with opening guidance |
| **Advanced / Raw** | Full textarea | Shows the assembled Markdown prompt. Power users can edit directly. Changes sync back to sections. |

### Data Flow

```
Section Inputs → assemblePrompt() → Markdown string → general_prompt field → Retell LLM
```

The assembled prompt is stored as `general_prompt` (plain Markdown string),
same as today. The section-based form is a UI layer — no schema changes needed.

### Section State Storage

Store the structured form data in a JSON field alongside `general_prompt`
so the section editor can be repopulated when the user returns:

```typescript
interface VoicePromptSections {
  identity: string;
  styleDefaults: string[];  // checked style rules
  styleCustom: string;
  products: string[];        // selected product tags
  productKnowledge: string;  // custom knowledge textarea
  pricingStrategy: "bridge" | "ranges" | "decline";
  pricingCustom: string;
  hardLimits: string[];      // checked limits
  hardLimitsCustom: string;
  workflows: Record<string, string>;  // workflow_type → guidance
}
```

This can be stored as a Retell LLM `default_dynamic_variables` entry
or as a local `localStorage` cache (since the assembled Markdown is
the canonical source).

### Migration Path

1. Existing users with a raw `general_prompt` → show in "Advanced / Raw"
   tab, sections are empty until they populate them
2. New users → sections pre-filled with defaults, raw tab shows the
   assembled output
3. Both modes always available — toggle between guided and raw

## Files to Create/Modify

| File | Change |
|------|--------|
| `src/features/voice-agent/components/VoicePromptEditor.tsx` | NEW — section-based editor component |
| `src/features/voice-agent/lib/prompt-assembler.ts` | NEW — assembles sections into Markdown prompt |
| `src/features/voice-agent/components/VoiceAgentRetellStudioCard.tsx` | Replace single textarea with VoicePromptEditor in "instructions" view |
| `src/features/voice-agent/lib/retell-studio.ts` | Add VoicePromptSections type |

## Implementation Order

1. `prompt-assembler.ts` — pure function, testable
2. `VoicePromptEditor.tsx` — section UI
3. Wire into RetellStudioCard — replace textarea
4. Add "Advanced / Raw" toggle
5. Product tag selector with insurance product presets

## Scope

This is a UI-only change. No migrations, no edge function changes,
no API changes. The output is still a plain `general_prompt` string
sent to Retell via the existing `update_retell_llm` mutation.
