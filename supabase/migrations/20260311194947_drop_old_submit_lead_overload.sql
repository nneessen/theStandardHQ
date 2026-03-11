-- Drop the old 17-param overload of submit_recruiting_lead.
-- The 20-param version (with is_licensed, current_imo_name, specialties) is the
-- current one. Having two overloads is an unnecessary PostgREST ambiguity risk.
DROP FUNCTION IF EXISTS public.submit_recruiting_lead(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, inet, text
);
