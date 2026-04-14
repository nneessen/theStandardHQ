# Continuation Mode — Context Handoff Prompt

You are responsible for generating a **complete, lossless continuation prompt** so work can resume in a new conversation **without architectural drift, security regressions, or schema hallucination**.

This prompt is not a summary.  
It is a **handoff contract** for continuing the same implementation or review safely.

Follow **all instructions below exactly**.

---

## Primary Objective

When context is nearing limits:

1. **Extract and preserve all critical state**
2. **Reconstruct the working environment**
3. **Prevent loss of design intent**
4. **Prevent guessing of schema, APIs, or policies**
5. **Enable the next conversation to continue as if no context was lost**

You must output a **single continuation prompt** that the user can paste into a new conversation.

---

## What Must Be Preserved

The continuation prompt must explicitly include:

### 1. Project Context

- Application purpose and domain (e.g., underwriting, commissions, multi-tenant agency system)
- Tech stack (React 19+, TanStack Query/Router, Supabase, PostgreSQL, strict TypeScript)
- Architectural principles (feature-based modules, RLS-first security, migrations required)

---

### 2. Active Mode

Specify which mode is in effect:

- **Builder Mode** (designing/implementing)
- **Code Review Mode** (auditing existing code)

Include the full role definition at a high level:

- security-first
- correctness-first
- no frontend-only auth
- no guessing undocumented schema

---

### 3. Current Goal / Task

- Exact feature, subsystem, or file currently being worked on
- What is already decided
- What is still open or unresolved

Example:

- “We are implementing the Underwriting Wizard rebuild with tri-state eligibility and provenance-based acceptance rules. Phase 2 (review workflow) is in progress. RLS and migration design have not yet been written.”

---

### 4. Data Model & Schema State

- All relevant tables, columns, and enums discussed
- Tenancy model (imo_id, agency_id, exceptions)
- Any schema changes already proposed
- What must **not** be invented

If full schema is not available, explicitly state:

> “Schema details must be requested before implementation. Do not guess.”

---

### 5. Security & RLS Constraints

- Tenant isolation model
- Required RLS helper functions
- Any “gold standard” policy patterns
- What operations are restricted to admins or reviewers

---

### 6. Architectural Decisions Already Made

- Decisions that must not be reversed silently
  - e.g., “AI-extracted rules are always draft-only”
  - “Eligibility is tri-state per product, not per session”
  - “Only approved rules affect recommendations”

---

### 7. Pending Questions / Next Steps

- Open design questions
- Missing inputs needed from the user
- Next concrete action

---

## Output Requirements

You must output **only** the continuation prompt.

The continuation prompt must:

- Be written in **direct instructions to the next assistant**
- Contain no meta commentary
- Contain no chain-of-thought
- Contain no placeholders like “as discussed above”
- Be **self-contained and executable**

---

## Continuation Prompt Structure

Your output must follow this exact structure:

---

### CONTINUATION PROMPT

#### Role & Operating Mode

[Restate Builder Mode or Code Review Mode rules]

#### Project Context

[Domain, stack, architectural principles]

#### Current Objective

[What we are actively building or reviewing]

#### Established Design Decisions

[Non-negotiable architectural and domain rules]

#### Data Model / Schema State

[Tables, columns, enums, tenancy model, what must not be guessed]

#### Security & RLS Model

[Authorization rules, helper functions, cross-tenant constraints]

#### Work Completed So Far

[What has already been designed or implemented]

#### Work Remaining

[What must be done next]

#### Constraints & Non-Negotiables

[No RLS bypass, no frontend auth, no schema invention, migrations required, etc.]

#### Required Next Output

[Exactly what the assistant should produce next]

---

## Critical Rules

- Do **not** summarize loosely — preserve technical precision.
- Do **not** invent schema, APIs, files, or RLS policies.
- If any critical information is missing, explicitly state what must be provided before continuing.
- Assume production data exists.
- Maintain all security, migration, and testing requirements.

---

## Purpose

This prompt exists to ensure:

- No loss of architectural intent
- No silent security regressions
- No hallucinated database or authorization logic
- Seamless continuation across context boundaries

Your job is to create a **handoff artifact** that makes the next conversation indistinguishable from the current one.

---

**Output only the continuation prompt. Do not include explanations.**
