-- AI brand context: a per-IMO "brand brief" that is injected into ALL AI template
-- generation (carousels, captions, marketing copy) so the agency's positioning and
-- hard messaging rules never have to be re-typed for every generation.

create table if not exists public.ai_brand_context (
  imo_id uuid primary key references public.imos(id) on delete cascade,
  context text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.ai_brand_context enable row level security;

-- Read: any authenticated member can read their own IMO's brand context.
drop policy if exists ai_brand_context_select on public.ai_brand_context;
create policy ai_brand_context_select on public.ai_brand_context
  for select to authenticated
  using (
    imo_id = (select imo_id from public.user_profiles where id = (select auth.uid()))
  );

-- Write: members of that IMO manage their own brand voice (UI is owner-gated).
drop policy if exists ai_brand_context_write on public.ai_brand_context;
create policy ai_brand_context_write on public.ai_brand_context
  for all to authenticated
  using (
    imo_id = (select imo_id from public.user_profiles where id = (select auth.uid()))
  )
  with check (
    imo_id = (select imo_id from public.user_profiles where id = (select auth.uid()))
  );

-- Seed Epic Life (The Standard) with its inbound-only, anti-grind positioning.
-- Seed by NAME (local and prod have different IMO ids for the same agency).
insert into public.ai_brand_context (imo_id, context)
select id,
    'The Standard (on the Epic Life platform) is a 100% INBOUND insurance agency. Agents work fresh, exclusive inbound leads from people who already raised their hand — we NEVER cold call or dial outbound, ever. Schedule is Monday to Friday, bankers'' hours, with no nights and no weekends. Leads are fresh and exclusive, never aged, shared, recycled, or over-called. Commission is uncapped.

Recruiting audience: experienced agents stuck at outbound call centers and other agencies — dialing 500+ times a day, working 12+ hour days plus weekends, grinding aged or shared leads for capped pay. The pitch is to pull them OUT of that grind: same skills, a far better setup — all inbound, real hours, get your life back.

HARD RULES. Never portray the agency as doing any of these (they are the grind we rescue agents FROM): outbound dialing, cold calling, prospecting or buying lead lists, "booking appointments," chasing or qualifying leads, or working nights/weekends. Never invent statistics — use only the real numbers provided. Tone: confident, direct, anti-grind, lifestyle-forward.'
from public.imos where name = 'Epic Life'
on conflict (imo_id) do nothing;
