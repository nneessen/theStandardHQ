// src/features/inbound-crm/types.ts
// Local row type for public.inbound_calls. The generated src/types/database.types.ts has NOT
// been regenerated since the Phase 0 migration (deliberately, to avoid 34k lines of churn), so the
// row shape is modelled here. Mirrors supabase/migrations/20260617150349_inbound_crm_phase0_schema.sql.
// When types are regenerated, this can be replaced with Database["public"]["Tables"]["inbound_calls"]["Row"].
export interface InboundCallRow {
  id: string;
  imo_id: string;
  request_tag: string;
  agent_id: string | null;
  client_id: string | null;
  ani: string;
  phone_e164: string | null;
  state: string | null;
  record_type: string | null;
  pc_id: string | null;
  offer_id: string | null;
  call_program: string | null;
  sub_id: string | null;
  call_start: string | null; // timestamptz -> ISO string
  duration: number | null;
  billable: number | null; // smallint: 0 = not billable, 1 = billable
  status: string; // 'ringing' | 'ended' | ...
  fired_pop: boolean;
  patch_only: boolean;
  // Phase 3 disposition (agent-captured during the call via crm_set_call_disposition).
  call_type_id: string | null;
  inquiry_carrier_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
