// @vitest-environment node

import { randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { Client } from "pg";

const RUN_DB_TESTS = process.env.RUN_DB_TESTS === "1";
const TEST_DB_URL =
  process.env.UNDERWRITING_TEST_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const describeDb = RUN_DB_TESTS ? describe : describe.skip;

type SecurityFixture = {
  imoId: string;
  agencyId: string;
  ownerUserId: string;
  agentUserId: string;
  peerUserId: string;
  agentSessionId: string;
  agentEvalLogId: string;
};

let client: Client | null = null;

function getClient(): Client {
  if (!client) {
    throw new Error("DB client not initialized");
  }

  return client;
}

async function beginTestTransaction() {
  await getClient().query("BEGIN");
}

async function rollbackTestTransaction() {
  const db = getClient();
  await db.query("ROLLBACK");
  await db.query("RESET ROLE");
}

async function setAuthenticatedUser(userId: string) {
  const db = getClient();
  const claims = JSON.stringify({
    sub: userId,
    role: "authenticated",
    aud: "authenticated",
  });

  await db.query("RESET ROLE");
  await db.query(
    `
      SELECT
        set_config('request.jwt.claim.sub', $1, true),
        set_config('request.jwt.claim.role', 'authenticated', true),
        set_config('request.jwt.claims', $2, true)
    `,
    [userId, claims],
  );
  await db.query("SET LOCAL ROLE authenticated");
}

async function ensureSecurityBaselinePolicies() {
  const db = getClient();

  await db.query(
    "ALTER TABLE public.underwriting_sessions ENABLE ROW LEVEL SECURITY",
  );
  await db.query(
    "ALTER TABLE public.underwriting_rule_evaluation_log ENABLE ROW LEVEL SECURITY",
  );

  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'underwriting_sessions'
          AND policyname = 'sessions_select'
      ) THEN
        CREATE POLICY sessions_select
        ON public.underwriting_sessions
        FOR SELECT
        TO authenticated
        USING (
          imo_id = get_my_imo_id()
          AND (
            created_by = (SELECT auth.uid())
            OR is_imo_admin()
            OR is_upline_of(created_by)
          )
        );
      END IF;
    END
    $$;
  `);
}

async function seedSecurityFixtures(): Promise<SecurityFixture> {
  const db = getClient();

  const imoId = randomUUID();
  const agencyId = randomUUID();
  const ownerUserId = randomUUID();
  const agentUserId = randomUUID();
  const peerUserId = randomUUID();
  const agentSessionId = randomUUID();
  const agentEvalLogId = randomUUID();

  await db.query(
    `
      INSERT INTO public.imos (id, name, code)
      VALUES ($1::uuid, 'Security IMO', 'SEC_' || substr(($1::uuid)::text, 1, 6))
    `,
    [imoId],
  );

  await db.query(
    `
      INSERT INTO public.agencies (id, imo_id, name, code, owner_id)
      VALUES ($1::uuid, $2::uuid, 'Security Agency', 'SEC_AGENCY', $3::uuid)
    `,
    [agencyId, imoId, ownerUserId],
  );

  await db.query(
    `
      INSERT INTO public.user_profiles (
        id,
        email,
        approval_status,
        is_admin,
        subscription_tier,
        uw_wizard_enabled,
        imo_id,
        agency_id,
        roles,
        hierarchy_path,
        hierarchy_depth,
        upline_id,
        first_name,
        last_name
      )
      VALUES
        (
          $1::uuid,
          'security-owner@example.com',
          'approved',
          false,
          'pro',
          true,
          $2::uuid,
          $3::uuid,
          ARRAY['imo_admin']::text[],
          ($1::uuid)::text,
          0,
          NULL,
          'Security',
          'Owner'
        ),
        (
          $4::uuid,
          'security-agent@example.com',
          'approved',
          false,
          'pro',
          true,
          $2::uuid,
          $3::uuid,
          ARRAY['agent']::text[],
          ($1::uuid)::text || '.' || ($4::uuid)::text,
          1,
          $1::uuid,
          'Security',
          'Agent'
        ),
        (
          $5::uuid,
          'security-peer@example.com',
          'approved',
          false,
          'pro',
          true,
          $2::uuid,
          $3::uuid,
          ARRAY['agent']::text[],
          ($1::uuid)::text || '.' || ($5::uuid)::text,
          1,
          $1::uuid,
          'Security',
          'Peer'
        )
    `,
    [ownerUserId, imoId, agencyId, agentUserId, peerUserId],
  );

  await db.query(
    `
      INSERT INTO public.underwriting_sessions (
        id,
        imo_id,
        agency_id,
        created_by,
        client_name,
        client_age,
        client_gender,
        client_state,
        health_responses,
        conditions_reported,
        tobacco_use,
        requested_face_amount,
        requested_face_amounts,
        requested_product_types,
        status,
        result_source,
        notes,
        recommendations,
        eligibility_summary,
        evaluation_metadata
      )
      VALUES (
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4::uuid,
        'Security Agent Client',
        58,
        'male',
        'TX',
        '{"version":2,"conditionsByCode":{"diabetes":{"selected":true}}}'::jsonb,
        ARRAY['diabetes']::text[],
        false,
        100000,
        '[100000]'::jsonb,
        ARRAY['term_life']::text[],
        'saved',
        'backend_authoritative',
        'seeded security fixture',
        '[]'::jsonb,
        '{"eligibleCount":0,"unknownCount":1,"ineligibleCount":0,"totalProducts":1}'::jsonb,
        '{"engineVersion":"security-test"}'::jsonb
      )
    `,
    [agentSessionId, imoId, agencyId, agentUserId],
  );

  await db.query(
    `
      INSERT INTO public.underwriting_rule_evaluation_log (
        id,
        session_id,
        imo_id,
        condition_code,
        predicate_result,
        matched_conditions,
        failed_conditions,
        missing_fields,
        outcome_applied,
        input_hash
      )
      VALUES (
        $1::uuid,
        $2::uuid,
        $3::uuid,
        'diabetes',
        'unknown',
        '["diabetes"]'::jsonb,
        '[]'::jsonb,
        '["a1c"]'::jsonb,
        '{"status":"unknown"}'::jsonb,
        'security-hash'
      )
    `,
    [agentEvalLogId, agentSessionId, imoId],
  );

  return {
    imoId,
    agencyId,
    ownerUserId,
    agentUserId,
    peerUserId,
    agentSessionId,
    agentEvalLogId,
  };
}

describeDb("underwriting runtime access hardening", () => {
  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DB_URL });
    await client.connect();
  });

  afterAll(async () => {
    if (client) {
      await client.end();
      client = null;
    }
  });

  beforeEach(async () => {
    await beginTestTransaction();
    await ensureSecurityBaselinePolicies();
  });

  afterEach(async () => {
    await rollbackTestTransaction();
  });

  it("exposes only the intended execute privileges on underwriting RPCs", async () => {
    const db = getClient();
    const { rows } = await db.query<{
      role_name: string;
      can_save_v2: boolean;
      can_persist_v1: boolean;
      can_log_eval: boolean;
      can_list_my: boolean;
      can_list_agency: boolean;
    }>(
      `
        SELECT
          role_name,
          has_function_privilege(role_name, 'public.save_underwriting_session_v2(jsonb)', 'EXECUTE') AS can_save_v2,
          has_function_privilege(role_name, 'public.persist_underwriting_run_v1(uuid, jsonb, jsonb, jsonb)', 'EXECUTE') AS can_persist_v1,
          has_function_privilege(role_name, 'public.log_underwriting_rule_evaluation(uuid, uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb, text)', 'EXECUTE') AS can_log_eval,
          has_function_privilege(role_name, 'public.list_my_underwriting_sessions_v1(integer, integer, text)', 'EXECUTE') AS can_list_my,
          has_function_privilege(role_name, 'public.list_agency_underwriting_sessions_v1(integer, integer, text)', 'EXECUTE') AS can_list_agency
        FROM (VALUES ('anon'), ('authenticated'), ('service_role')) AS roles(role_name)
        ORDER BY role_name
      `,
    );

    expect(rows).toEqual([
      {
        role_name: "anon",
        can_save_v2: false,
        can_persist_v1: false,
        can_log_eval: false,
        can_list_my: false,
        can_list_agency: false,
      },
      {
        role_name: "authenticated",
        can_save_v2: false,
        can_persist_v1: false,
        can_log_eval: false,
        can_list_my: true,
        can_list_agency: true,
      },
      {
        role_name: "service_role",
        can_save_v2: false,
        can_persist_v1: true,
        can_log_eval: false,
        can_list_my: false,
        can_list_agency: false,
      },
    ]);
  });

  it("blocks a same-IMO peer from selecting another agent's session row directly", async () => {
    const fixture = await seedSecurityFixtures();
    const db = getClient();

    await setAuthenticatedUser(fixture.peerUserId);
    const peerResult = await db.query<{ id: string }>(
      `
        SELECT id
        FROM public.underwriting_sessions
        WHERE id = $1::uuid
      `,
      [fixture.agentSessionId],
    );

    expect(peerResult.rows).toHaveLength(0);

    await setAuthenticatedUser(fixture.ownerUserId);
    const ownerResult = await db.query<{ id: string }>(
      `
        SELECT id
        FROM public.underwriting_sessions
        WHERE id = $1::uuid
      `,
      [fixture.agentSessionId],
    );

    expect(ownerResult.rows).toHaveLength(1);
    expect(ownerResult.rows[0]?.id).toBe(fixture.agentSessionId);
  });

  it("blocks direct authenticated inserts into underwriting_sessions", async () => {
    const fixture = await seedSecurityFixtures();
    const db = getClient();

    await setAuthenticatedUser(fixture.agentUserId);

    const insertAttempt = db.query(
      `
        INSERT INTO public.underwriting_sessions (
          id,
          imo_id,
          agency_id,
          created_by,
          client_name,
          client_age,
          client_gender,
          client_state,
          health_responses,
          conditions_reported,
          tobacco_use,
          requested_face_amount,
          requested_face_amounts,
          requested_product_types,
          status,
          result_source,
          recommendations,
          eligibility_summary,
          evaluation_metadata
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4::uuid,
          'Unauthorized Direct Insert',
          44,
          'female',
          'TX',
          '{"version":2}'::jsonb,
          ARRAY[]::text[],
          false,
          50000,
          '[50000]'::jsonb,
          ARRAY['term_life']::text[],
          'saved',
          'backend_authoritative',
          '[]'::jsonb,
          '{"eligibleCount":0,"unknownCount":0,"ineligibleCount":0,"totalProducts":0}'::jsonb,
          '{}'::jsonb
        )
      `,
      [randomUUID(), fixture.imoId, fixture.agencyId, fixture.agentUserId],
    );

    await expect(insertAttempt).rejects.toMatchObject({
      code: "42501",
    });
  });

  it("blocks same-IMO peer access to underwriting evaluation logs without session access", async () => {
    const fixture = await seedSecurityFixtures();
    const db = getClient();

    await setAuthenticatedUser(fixture.peerUserId);
    const peerResult = await db.query<{ id: string }>(
      `
        SELECT id
        FROM public.underwriting_rule_evaluation_log
        WHERE session_id = $1::uuid
      `,
      [fixture.agentSessionId],
    );

    expect(peerResult.rows).toHaveLength(0);

    await setAuthenticatedUser(fixture.ownerUserId);
    const ownerResult = await db.query<{ id: string }>(
      `
        SELECT id
        FROM public.underwriting_rule_evaluation_log
        WHERE session_id = $1::uuid
      `,
      [fixture.agentSessionId],
    );

    expect(ownerResult.rows).toHaveLength(1);
    expect(ownerResult.rows[0]?.id).toBe(fixture.agentEvalLogId);
  });
});
