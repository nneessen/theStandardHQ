BEGIN;

SET LOCAL search_path = public;

ALTER TABLE public.carriers
  DROP CONSTRAINT IF EXISTS carriers_name_key,
  DROP CONSTRAINT IF EXISTS carriers_code_key;

DROP INDEX IF EXISTS public.idx_carriers_code_unique;

CREATE UNIQUE INDEX IF NOT EXISTS ux_carriers_imo_lower_name
  ON public.carriers (imo_id, lower(name));

CREATE UNIQUE INDEX IF NOT EXISTS ux_carriers_imo_lower_code
  ON public.carriers (imo_id, lower(code))
  WHERE code IS NOT NULL;

COMMIT;
