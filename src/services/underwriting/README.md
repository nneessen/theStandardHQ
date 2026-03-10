# Underwriting Services

`src/services/underwriting` is organized by layer:

- `core/`: pure underwriting logic and shared engine primitives
- `workflows/`: orchestration that coordinates multiple core/repository modules
- `repositories/`: Supabase-backed data access and RPC wrappers

Placement rules:

- Put pure evaluation, transforms, scoring, and DSL code in `core/`.
- Put browser/edge orchestration in `workflows/`.
- Put Supabase CRUD/RPC modules in `repositories/`.
- Keep Deno-shared imports explicit for the modules used by `supabase/functions/_shared/underwriting`.
