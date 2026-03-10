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
import type { Database } from "@/types/database.types";

const RUN_DB_TESTS = process.env.RUN_DB_TESTS === "1";
const TEST_DB_URL =
  process.env.UNDERWRITING_TEST_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const describeDb = RUN_DB_TESTS ? describe : describe.skip;

type SessionSummaryRow =
  Database["public"]["Functions"]["list_my_underwriting_sessions_v1"]["Returns"][number];

type TopRecommendationSummary = {
  carrierId: string | null;
  carrierName: string;
  productId: string | null;
  productName: string | null;
  monthlyPremium: number | null;
  healthClassResult: string | null;
  recommendationRank: number | null;
};

type FixtureIds = {
  ownerUserId: string;
  agentUserId: string;
  peerUserId: string;
  otherAgencyUserId: string;
  otherTenantUserId: string;
  ownerSessionId: string;
  agentSessionId: string;
  peerSessionId: string;
  otherAgencySessionId: string;
  otherTenantSessionId: string;
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
  await db.query("RESET ROLE");
  await db.query("ROLLBACK");
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

async function queryAsUser(
  userId: string,
  sql: string,
  values: unknown[] = [],
) {
  const db = getClient();
  await setAuthenticatedUser(userId);
  const result = await db.query<SessionSummaryRow>(sql, values);
  return result.rows;
}

function readTopRecommendation(
  value: SessionSummaryRow["top_recommendation"],
): TopRecommendationSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as TopRecommendationSummary;
}

async function seedSessionHistoryFixtures(): Promise<FixtureIds> {
  const db = getClient();

  const imoA = randomUUID();
  const imoB = randomUUID();
  const agencyA = randomUUID();
  const agencyB = randomUUID();
  const agencyA2 = randomUUID();

  const ownerUserId = randomUUID();
  const agentUserId = randomUUID();
  const peerUserId = randomUUID();
  const otherAgencyUserId = randomUUID();
  const otherTenantUserId = randomUUID();

  const carrierA = randomUUID();
  const productA = randomUUID();

  const ownerSessionId = randomUUID();
  const agentSessionId = randomUUID();
  const peerSessionId = randomUUID();
  const otherAgencySessionId = randomUUID();
  const otherTenantSessionId = randomUUID();

  await db.query(
    `
      INSERT INTO public.imos (id, name, code)
      VALUES
        ($1, 'IMO A', 'IMO_A_' || substr($1::text, 1, 6)),
        ($2, 'IMO B', 'IMO_B_' || substr($2::text, 1, 6))
    `,
    [imoA, imoB],
  );

  await db.query(
    `
      INSERT INTO public.agencies (id, imo_id, name, code, owner_id)
      VALUES
        ($1, $2, 'Agency A', 'AGENCY_A', NULL),
        ($3, $2, 'Agency A2', 'AGENCY_A2', NULL),
        ($4, $5, 'Agency B', 'AGENCY_B', NULL)
    `,
    [agencyA, imoA, agencyA2, agencyB, imoB],
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
          $1,
          'owner-a@example.com',
          'approved',
          false,
          'pro',
          true,
          $2,
          $3,
          ARRAY['imo_admin']::text[],
          $1::text,
          0,
          NULL,
          'Owner',
          'A'
        ),
        (
          $4,
          'agent-a@example.com',
          'approved',
          false,
          'pro',
          true,
          $2,
          $3,
          ARRAY['agent']::text[],
          $1::text || '.' || $4::text,
          1,
          $1,
          'Agent',
          'A'
        ),
        (
          $5,
          'peer-a@example.com',
          'approved',
          false,
          'pro',
          true,
          $2,
          $3,
          ARRAY['agent']::text[],
          $1::text || '.' || $5::text,
          1,
          $1,
          'Peer',
          'A'
        ),
        (
          $6,
          'other-agency@example.com',
          'approved',
          false,
          'pro',
          true,
          $2,
          $7,
          ARRAY['agent']::text[],
          $6::text,
          0,
          NULL,
          'Other',
          'Agency'
        ),
        (
          $8,
          'tenant-b@example.com',
          'approved',
          false,
          'pro',
          true,
          $9,
          $10,
          ARRAY['agent']::text[],
          $8::text,
          0,
          NULL,
          'Tenant',
          'B'
        )
    `,
    [
      ownerUserId,
      imoA,
      agencyA,
      agentUserId,
      peerUserId,
      otherAgencyUserId,
      agencyA2,
      otherTenantUserId,
      imoB,
      agencyB,
    ],
  );

  await db.query(
    `
      UPDATE public.agencies
      SET owner_id = CASE id
        WHEN $1 THEN $2
        WHEN $3 THEN $4
        WHEN $5 THEN $6
      END
      WHERE id IN ($1, $3, $5)
    `,
    [
      agencyA,
      ownerUserId,
      agencyA2,
      otherAgencyUserId,
      agencyB,
      otherTenantUserId,
    ],
  );

  await db.query(
    `
      INSERT INTO public.carriers (id, imo_id, name, code, is_active)
      VALUES ($1, $2, 'Carrier A', 'CARRIER_A', true)
    `,
    [carrierA, imoA],
  );

  await db.query(
    `
      INSERT INTO public.products (
        id,
        carrier_id,
        imo_id,
        name,
        code,
        product_type,
        is_active
      )
      VALUES ($1, $2, $3, 'Product A', 'PRODUCT_A', 'term_life', true)
    `,
    [productA, carrierA, imoA],
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
        client_height_inches,
        client_weight_lbs,
        client_bmi,
        health_responses,
        requested_face_amount,
        requested_face_amounts,
        requested_product_types,
        eligibility_summary,
        recommendations,
        result_source,
        selected_term_years,
        evaluation_metadata,
        health_tier,
        status,
        created_at
      )
      VALUES
        (
          $1, $2, $3, $4, 'Owner Client', 54, 'male', 'TX', 70, 190, 27.3,
          '{}'::jsonb, 100000, '[100000]'::jsonb, ARRAY['term_life']::text[],
          '{"eligible": 1, "unknown": 0, "ineligible": 0}'::jsonb,
          '[]'::jsonb, 'backend_authoritative', 20,
          '{"engineVersion":"p3-test"}'::jsonb, 'standard', 'saved',
          '2026-03-10T12:00:00Z'::timestamptz
        ),
        (
          $5, $2, $3, $6, 'Agent Client', 47, 'female', 'FL', 65, 145, 24.1,
          '{}'::jsonb, 150000, '[150000,200000]'::jsonb, ARRAY['term_life']::text[],
          '{"eligible": 1, "unknown": 1, "ineligible": 0}'::jsonb,
          '[]'::jsonb, 'backend_authoritative', 15,
          '{"engineVersion":"p3-test"}'::jsonb, 'preferred', 'saved',
          '2026-03-10T13:00:00Z'::timestamptz
        ),
        (
          $7, $2, $3, $8, 'Peer Client', 39, 'female', 'GA', 64, 138, 23.7,
          '{}'::jsonb, 200000, '[200000]'::jsonb, ARRAY['term_life']::text[],
          '{"eligible": 0, "unknown": 1, "ineligible": 0}'::jsonb,
          '[]'::jsonb, 'backend_authoritative', 10,
          '{"engineVersion":"p3-test"}'::jsonb, 'standard_plus', 'saved',
          '2026-03-10T14:00:00Z'::timestamptz
        ),
        (
          $9, $2, $10, $11, 'Other Agency Client', 41, 'male', 'AL', 71, 180, 25.1,
          '{}'::jsonb, 120000, '[120000]'::jsonb, ARRAY['term_life']::text[],
          '{"eligible": 1, "unknown": 0, "ineligible": 0}'::jsonb,
          '[]'::jsonb, 'backend_authoritative', 15,
          '{"engineVersion":"p3-test"}'::jsonb, 'standard', 'saved',
          '2026-03-10T15:00:00Z'::timestamptz
        ),
        (
          $12, $13, $14, $15, 'Tenant B Client', 44, 'male', 'NC', 69, 175, 25.8,
          '{}'::jsonb, 180000, '[180000]'::jsonb, ARRAY['term_life']::text[],
          '{"eligible": 1, "unknown": 0, "ineligible": 0}'::jsonb,
          '[]'::jsonb, 'backend_authoritative', 20,
          '{"engineVersion":"p3-test"}'::jsonb, 'standard', 'saved',
          '2026-03-10T16:00:00Z'::timestamptz
        )
    `,
    [
      ownerSessionId,
      imoA,
      agencyA,
      ownerUserId,
      agentSessionId,
      agentUserId,
      peerSessionId,
      peerUserId,
      otherAgencySessionId,
      agencyA2,
      otherAgencyUserId,
      otherTenantSessionId,
      imoB,
      agencyB,
      otherTenantUserId,
    ],
  );

  await db.query(
    `
      INSERT INTO public.underwriting_session_recommendations (
        session_id,
        product_id,
        carrier_id,
        imo_id,
        eligibility_status,
        health_class_result,
        monthly_premium,
        annual_premium,
        score,
        recommendation_rank,
        recommendation_reason
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        'eligible',
        'preferred',
        82.50,
        990.00,
        0.9321,
        1,
        'best_value'
      )
    `,
    [agentSessionId, productA, carrierA, imoA],
  );

  return {
    ownerUserId,
    agentUserId,
    peerUserId,
    otherAgencyUserId,
    otherTenantUserId,
    ownerSessionId,
    agentSessionId,
    peerSessionId,
    otherAgencySessionId,
    otherTenantSessionId,
  };
}

describeDb("underwriting session history RPCs", () => {
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
  });

  afterEach(async () => {
    await rollbackTestTransaction();
  });

  it("returns only the caller's own rows from list_my_underwriting_sessions_v1", async () => {
    const fixture = await seedSessionHistoryFixtures();

    const result = await queryAsUser(
      fixture.agentUserId,
      `
        SELECT *
        FROM public.list_my_underwriting_sessions_v1(0, 20, NULL)
      `,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.session_id).toBe(fixture.agentSessionId);
    expect(result[0]?.total_count).toBe(1);
    expect(result[0]?.requested_face_amounts).toEqual([150000, 200000]);

    const topRecommendation = readTopRecommendation(
      result[0]?.top_recommendation,
    );
    expect(topRecommendation).toMatchObject({
      carrierName: "Carrier A",
      productName: "Product A",
      recommendationRank: 1,
      healthClassResult: "preferred",
      monthlyPremium: 82.5,
    });
  });

  it("returns only same-agency sessions to the agency summary even for an IMO admin", async () => {
    const fixture = await seedSessionHistoryFixtures();

    const result = await queryAsUser(
      fixture.ownerUserId,
      `
        SELECT *
        FROM public.list_agency_underwriting_sessions_v1(0, 20, NULL)
      `,
    );

    expect(result.map((row) => row.session_id)).toEqual([
      fixture.peerSessionId,
      fixture.agentSessionId,
      fixture.ownerSessionId,
    ]);
    expect(result[0]?.total_count).toBe(3);
    expect(result.map((row) => row.session_id)).not.toContain(
      fixture.otherAgencySessionId,
    );
    expect(result.map((row) => row.session_id)).not.toContain(
      fixture.otherTenantSessionId,
    );
  });

  it("does not expose peer sessions through agency summary to a non-admin peer", async () => {
    const fixture = await seedSessionHistoryFixtures();

    const result = await queryAsUser(
      fixture.peerUserId,
      `
        SELECT *
        FROM public.list_agency_underwriting_sessions_v1(0, 20, NULL)
      `,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.session_id).toBe(fixture.peerSessionId);
    expect(result[0]?.total_count).toBe(1);
  });

  it("applies search and pagination to the agency summary read model", async () => {
    const fixture = await seedSessionHistoryFixtures();

    const pageOne = await queryAsUser(
      fixture.ownerUserId,
      `
        SELECT *
        FROM public.list_agency_underwriting_sessions_v1(0, 1, NULL)
      `,
    );

    expect(pageOne).toHaveLength(1);
    expect(pageOne[0]?.session_id).toBe(fixture.peerSessionId);
    expect(pageOne[0]?.total_count).toBe(3);

    const filtered = await queryAsUser(
      fixture.ownerUserId,
      `
        SELECT *
        FROM public.list_agency_underwriting_sessions_v1(0, 20, 'Agent Client')
      `,
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.session_id).toBe(fixture.agentSessionId);
    expect(filtered[0]?.total_count).toBe(1);
  });
});
