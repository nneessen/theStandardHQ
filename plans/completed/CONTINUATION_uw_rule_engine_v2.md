# Underwriting Rule Engine V2 - Continuation Prompt

## Status: COMPLETE - Backend Implemented

The v2 rule engine backend is fully implemented and applied to production.

## What Was Done

1. **Migration applied:** All rule engine tables created in production
   - `underwriting_rule_sets` - Groups of ordered rules with approval workflow
   - `underwriting_rules` - Individual rules with compound predicates
   - `underwriting_rule_evaluation_log` - Audit trail with 90-day retention

2. **Types regenerated:** `database.types.ts` includes all new types

3. **Service updated:** `ruleService.ts` uses generated types

4. **Build verified:** Zero TypeScript errors

## Files Involved

- `supabase/migrations/20260111_004_underwriting_rule_engine.sql`
- `src/services/underwriting/ruleEngineDSL.ts`
- `src/services/underwriting/ruleEvaluator.ts`
- `src/services/underwriting/ruleService.ts`
- `src/services/underwriting/decisionEngine.ts`
- `src/types/database.types.ts`

## Optional Next Steps

### 1. Create Initial Rule Sets
Use `ruleService.createRuleSet()` to create rule sets for carriers, then add rules.

### 2. Frontend Rule Editor
Build an admin UI for rule management:
- Rule set CRUD with approval workflow
- Visual predicate builder
- JSON "Advanced" toggle
- Review dashboard

### 3. Enable V2 Evaluation in Wizard
In the underwriting wizard:
1. Check `hasV2RulesForCarrier()` for the selected carrier
2. If v2 rules exist, use `evaluateUnderwritingV2()`
3. Display matched rules and missing fields in recommendations

## Key Design Decisions (Non-Negotiable)

1. **Table rating aggregation:** MAX ordinal units (A=1..P=16), NOT multiplicative
2. **Default fallback:** `unknown` or `refer`, NEVER `decline`
3. **Unknown propagation:** Returns specific missing field paths
4. **Only approved rules affect evaluations**
5. **Self-approval prevented in RPCs**

## Memory File

See `.serena/memories/underwriting_rule_engine_v2.md` for full documentation.
