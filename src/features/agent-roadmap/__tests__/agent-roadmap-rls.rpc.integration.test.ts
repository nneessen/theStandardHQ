// @vitest-environment node
//
// RLS integration tests for the Agent Roadmap feature. Addresses B-4 from
// the review: the smoke tests run as the postgres superuser (bypasses RLS),
// so until this file existed there was zero proof that cross-tenant
// isolation actually works.
//
// Pattern: src/features/underwriting/__tests__/*.rpc.integration.test.ts
//
// Gated by RUN_DB_TESTS=1 so it doesn't run in the default test command.
// Run with: RUN_DB_TESTS=1 npx vitest run src/features/agent-roadmap/__tests__/agent-roadmap-rls.rpc.integration.test.ts
//
// What's covered:
//   1. Cross-agency read rejection (agent in Agency A cannot SELECT items in Agency B)
//   2. Cross-agency write rejection (non-super-admin cannot INSERT anywhere)
//   3. Own-agency unpublished item hiding (agents can't SELECT draft items)
//   4. B-3 RPC visibility gate (non-super-admin cannot upsert progress against draft items even in own agency)
//   5. Progress user_id cannot be forged (RLS enforces user_id = auth.uid())
//   6. User cannot DELETE their own progress row (audit trail preserved)
//   7. Super-admin can do everything the RLS policies say they can

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
  process.env.AGENT_ROADMAP_TEST_DB_URL ??
  process.env.UNDERWRITING_TEST_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const describeDb = RUN_DB_TESTS ? describe : describe.skip;

type Fixture = {
  agencyAId: string;
  agencyBId: string;
  superAdminId: string;
  agentAId: string;
  agentBId: string;
  roadmapAId: string;
  roadmapBId: string;
  sectionAId: string;
  sectionBId: string;
  itemAPublishedId: string;
  itemADraftId: string;
  itemBPublishedId: string;
  itemInDraftRoadmapId: string;
};

let client: Client | null = null;

function getClient(): Client {
  if (!client) throw new Error("DB client not initialized");
  return client;
}

async function beginTx() {
  await getClient().query("BEGIN");
}

async function rollbackTx() {
  const db = getClient();
  await db.query("ROLLBACK");
  await db.query("RESET ROLE");
}

async function setAuthUser(userId: string) {
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

async function seedFixtures(): Promise<Fixture> {
  const db = getClient();

  // Use an existing IMO so FK constraints are satisfied
  const { rows: imoRows } = await db.query<{ id: string }>(
    "SELECT id FROM public.imos LIMIT 1",
  );
  if (imoRows.length === 0) {
    throw new Error("No imos found — seed the DB before running these tests");
  }
  const imoId = imoRows[0].id;

  const f: Fixture = {
    agencyAId: randomUUID(),
    agencyBId: randomUUID(),
    superAdminId: randomUUID(),
    agentAId: randomUUID(),
    agentBId: randomUUID(),
    roadmapAId: randomUUID(),
    roadmapBId: randomUUID(),
    sectionAId: randomUUID(),
    sectionBId: randomUUID(),
    itemAPublishedId: randomUUID(),
    itemADraftId: randomUUID(),
    itemBPublishedId: randomUUID(),
    itemInDraftRoadmapId: randomUUID(),
  };

  // Create two agencies with unique codes (agencies table has a
  // UNIQUE(imo_id, code) constraint, so parallel test runs need distinct codes)
  const codeSuffix = randomUUID().slice(0, 8);
  await db.query(
    `
      INSERT INTO public.agencies (id, imo_id, name, code, is_active)
      VALUES ($1, $2, 'Agency A (test)', $3, true),
             ($4, $2, 'Agency B (test)', $5, true)
    `,
    [
      f.agencyAId,
      imoId,
      `TEST_A_${codeSuffix}`,
      f.agencyBId,
      `TEST_B_${codeSuffix}`,
    ],
  );

  // Create three users: a super-admin, one agent per agency
  await db.query(
    `
      INSERT INTO public.user_profiles (id, agency_id, imo_id, is_super_admin, email)
      VALUES
        ($1, $2, $3, true,  'superadmin@test.example'),
        ($4, $2, $3, false, 'agentA@test.example'),
        ($5, $6, $3, false, 'agentB@test.example')
    `,
    [f.superAdminId, f.agencyAId, imoId, f.agentAId, f.agentBId, f.agencyBId],
  );

  // Agency A: one published roadmap with one published item + one draft item
  await db.query(
    `
      INSERT INTO public.roadmap_templates (id, agency_id, title, is_published, created_by)
      VALUES ($1, $2, 'Roadmap A (published)', true, $3)
    `,
    [f.roadmapAId, f.agencyAId, f.superAdminId],
  );
  await db.query(
    `
      INSERT INTO public.roadmap_sections (id, roadmap_id, agency_id, title, sort_order)
      VALUES ($1, $2, '00000000-0000-0000-0000-000000000000', 'Section A', 0)
    `,
    [f.sectionAId, f.roadmapAId],
  );
  await db.query(
    `
      INSERT INTO public.roadmap_items
        (id, section_id, roadmap_id, agency_id, title, sort_order, is_published)
      VALUES
        ($1, $2, '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'Published item in A', 0, true),
        ($3, $2, '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'Draft item in A', 1, false)
    `,
    [f.itemAPublishedId, f.sectionAId, f.itemADraftId],
  );

  // Agency B: one published roadmap with one published item
  await db.query(
    `
      INSERT INTO public.roadmap_templates (id, agency_id, title, is_published, created_by)
      VALUES ($1, $2, 'Roadmap B (published)', true, $3)
    `,
    [f.roadmapBId, f.agencyBId, f.superAdminId],
  );
  await db.query(
    `
      INSERT INTO public.roadmap_sections (id, roadmap_id, agency_id, title, sort_order)
      VALUES ($1, $2, '00000000-0000-0000-0000-000000000000', 'Section B', 0)
    `,
    [f.sectionBId, f.roadmapBId],
  );
  await db.query(
    `
      INSERT INTO public.roadmap_items
        (id, section_id, roadmap_id, agency_id, title, sort_order, is_published)
      VALUES
        ($1, $2, '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'Published item in B', 0, true)
    `,
    [f.itemBPublishedId, f.sectionBId],
  );

  // Agency A: a draft (unpublished) roadmap containing a published item
  // — tests that "item is published AND parent template is published" is enforced
  const draftRoadmapId = randomUUID();
  const draftSectionId = randomUUID();
  await db.query(
    `
      INSERT INTO public.roadmap_templates (id, agency_id, title, is_published, created_by)
      VALUES ($1, $2, 'Roadmap A (draft)', false, $3)
    `,
    [draftRoadmapId, f.agencyAId, f.superAdminId],
  );
  await db.query(
    `
      INSERT INTO public.roadmap_sections (id, roadmap_id, agency_id, title, sort_order)
      VALUES ($1, $2, '00000000-0000-0000-0000-000000000000', 'Draft Section', 0)
    `,
    [draftSectionId, draftRoadmapId],
  );
  await db.query(
    `
      INSERT INTO public.roadmap_items
        (id, section_id, roadmap_id, agency_id, title, sort_order, is_published)
      VALUES ($1, $2, '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'Pub item in draft roadmap', 0, true)
    `,
    [f.itemInDraftRoadmapId, draftSectionId],
  );

  return f;
}

// --- Test suite -----------------------------------------------------------

describeDb("Agent Roadmap RLS integration (B-4)", () => {
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

  let fixture: Fixture;

  beforeEach(async () => {
    await beginTx();
    fixture = await seedFixtures();
  });

  afterEach(async () => {
    await rollbackTx();
  });

  // -----------------------------------------------------------------------
  // 1. Cross-agency read rejection
  // -----------------------------------------------------------------------

  describe("cross-agency SELECT rejection", () => {
    it("agent A cannot see roadmap_templates from agency B", async () => {
      await setAuthUser(fixture.agentAId);
      const { rows } = await getClient().query(
        "SELECT id FROM public.roadmap_templates WHERE id = $1",
        [fixture.roadmapBId],
      );
      expect(rows).toHaveLength(0);
    });

    it("agent A cannot see roadmap_sections from agency B", async () => {
      await setAuthUser(fixture.agentAId);
      const { rows } = await getClient().query(
        "SELECT id FROM public.roadmap_sections WHERE id = $1",
        [fixture.sectionBId],
      );
      expect(rows).toHaveLength(0);
    });

    it("agent A cannot see roadmap_items from agency B", async () => {
      await setAuthUser(fixture.agentAId);
      const { rows } = await getClient().query(
        "SELECT id FROM public.roadmap_items WHERE id = $1",
        [fixture.itemBPublishedId],
      );
      expect(rows).toHaveLength(0);
    });

    it("agent A CAN see published items in their own agency", async () => {
      await setAuthUser(fixture.agentAId);
      const { rows } = await getClient().query(
        "SELECT id FROM public.roadmap_items WHERE id = $1",
        [fixture.itemAPublishedId],
      );
      expect(rows).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // 2. Own-agency unpublished item hiding
  // -----------------------------------------------------------------------

  describe("unpublished item hiding in own agency", () => {
    it("agent A cannot SELECT a draft item in their own agency", async () => {
      await setAuthUser(fixture.agentAId);
      const { rows } = await getClient().query(
        "SELECT id FROM public.roadmap_items WHERE id = $1",
        [fixture.itemADraftId],
      );
      expect(rows).toHaveLength(0);
    });

    it("agent A cannot SELECT items inside a draft roadmap", async () => {
      await setAuthUser(fixture.agentAId);
      const { rows } = await getClient().query(
        "SELECT id FROM public.roadmap_items WHERE id = $1",
        [fixture.itemInDraftRoadmapId],
      );
      expect(rows).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // 3. Cross-agency WRITE rejection (non-super-admin can't write anywhere)
  // -----------------------------------------------------------------------

  describe("non-super-admin write rejection", () => {
    it("agent A cannot INSERT a roadmap_template (even in own agency)", async () => {
      await setAuthUser(fixture.agentAId);
      const newId = randomUUID();
      await expect(
        getClient().query(
          `
            INSERT INTO public.roadmap_templates (id, agency_id, title, created_by)
            VALUES ($1, $2, 'Should fail', $3)
          `,
          [newId, fixture.agencyAId, fixture.agentAId],
        ),
      ).rejects.toThrow(/new row violates row-level security/i);
    });

    it("agent A cannot UPDATE a roadmap_template they can see", async () => {
      await setAuthUser(fixture.agentAId);
      // The UPDATE silently updates 0 rows under RLS (no error, just
      // affects 0 rows because the row isn't visible for UPDATE).
      const res = await getClient().query(
        "UPDATE public.roadmap_templates SET title = 'Pwned' WHERE id = $1",
        [fixture.roadmapAId],
      );
      expect(res.rowCount).toBe(0);

      // Verify title is unchanged (reset role to see the truth)
      await getClient().query("RESET ROLE");
      const { rows } = await getClient().query(
        "SELECT title FROM public.roadmap_templates WHERE id = $1",
        [fixture.roadmapAId],
      );
      expect(rows[0].title).toBe("Roadmap A (published)");
    });

    it("agent A cannot INSERT a roadmap_section", async () => {
      await setAuthUser(fixture.agentAId);
      const newId = randomUUID();
      await expect(
        getClient().query(
          `
            INSERT INTO public.roadmap_sections (id, roadmap_id, agency_id, title, sort_order)
            VALUES ($1, $2, '00000000-0000-0000-0000-000000000000', 'Should fail', 999)
          `,
          [newId, fixture.roadmapAId],
        ),
      ).rejects.toThrow(/new row violates row-level security/i);
    });

    it("agent A cannot INSERT a roadmap_item", async () => {
      await setAuthUser(fixture.agentAId);
      const newId = randomUUID();
      await expect(
        getClient().query(
          `
            INSERT INTO public.roadmap_items
              (id, section_id, roadmap_id, agency_id, title, sort_order)
            VALUES ($1, $2, '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'Should fail', 999)
          `,
          [newId, fixture.sectionAId],
        ),
      ).rejects.toThrow(/new row violates row-level security/i);
    });
  });

  // -----------------------------------------------------------------------
  // 4. Progress RLS: user cannot forge user_id, cannot DELETE own row
  // -----------------------------------------------------------------------

  describe("progress RLS", () => {
    it("agent A can insert their OWN progress row", async () => {
      await setAuthUser(fixture.agentAId);
      const res = await getClient().query(
        `
          INSERT INTO public.roadmap_item_progress
            (user_id, item_id, roadmap_id, agency_id, status)
          VALUES ($1, $2, '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'in_progress')
          RETURNING id
        `,
        [fixture.agentAId, fixture.itemAPublishedId],
      );
      expect(res.rows).toHaveLength(1);
    });

    it("agent A cannot forge a progress row with agent B's user_id", async () => {
      await setAuthUser(fixture.agentAId);
      await expect(
        getClient().query(
          `
            INSERT INTO public.roadmap_item_progress
              (user_id, item_id, roadmap_id, agency_id, status)
            VALUES ($1, $2, '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'completed')
          `,
          [fixture.agentBId, fixture.itemAPublishedId],
        ),
      ).rejects.toThrow(/new row violates row-level security/i);
    });

    it("agent A cannot insert progress for an item in agency B", async () => {
      await setAuthUser(fixture.agentAId);
      await expect(
        getClient().query(
          `
            INSERT INTO public.roadmap_item_progress
              (user_id, item_id, roadmap_id, agency_id, status)
            VALUES ($1, $2, '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'in_progress')
          `,
          [fixture.agentAId, fixture.itemBPublishedId],
        ),
      ).rejects.toThrow(/new row violates row-level security/i);
    });

    it("agent A cannot DELETE their own progress row (audit trail preserved)", async () => {
      // First seed a progress row directly as super-admin role so the
      // insertion bypasses RLS-on-insert semantics
      await setAuthUser(fixture.agentAId);
      await getClient().query(
        `
          INSERT INTO public.roadmap_item_progress
            (user_id, item_id, roadmap_id, agency_id, status)
          VALUES ($1, $2, '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'completed')
        `,
        [fixture.agentAId, fixture.itemAPublishedId],
      );

      // Attempt delete — RLS policy `rp_delete_super` only allows super-admin
      const res = await getClient().query(
        "DELETE FROM public.roadmap_item_progress WHERE user_id = $1 AND item_id = $2",
        [fixture.agentAId, fixture.itemAPublishedId],
      );
      expect(res.rowCount).toBe(0);

      // Row still exists
      await getClient().query("RESET ROLE");
      const { rows } = await getClient().query(
        "SELECT id FROM public.roadmap_item_progress WHERE user_id = $1 AND item_id = $2",
        [fixture.agentAId, fixture.itemAPublishedId],
      );
      expect(rows).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // 5. B-3 RPC visibility gate
  // -----------------------------------------------------------------------

  describe("roadmap_upsert_progress visibility gate (B-3)", () => {
    it("rejects upsert against a DRAFT item in the caller's own agency", async () => {
      await setAuthUser(fixture.agentAId);
      await expect(
        getClient().query(
          "SELECT public.roadmap_upsert_progress($1, 'completed')",
          [fixture.itemADraftId],
        ),
      ).rejects.toThrow(/not accessible/i);
    });

    it("rejects upsert against an item inside a DRAFT roadmap", async () => {
      await setAuthUser(fixture.agentAId);
      await expect(
        getClient().query(
          "SELECT public.roadmap_upsert_progress($1, 'completed')",
          [fixture.itemInDraftRoadmapId],
        ),
      ).rejects.toThrow(/not accessible/i);
    });

    it("rejects upsert against an item in ANOTHER agency", async () => {
      await setAuthUser(fixture.agentAId);
      await expect(
        getClient().query(
          "SELECT public.roadmap_upsert_progress($1, 'completed')",
          [fixture.itemBPublishedId],
        ),
      ).rejects.toThrow(/not accessible/i);
    });

    it("rejects upsert against a nonexistent UUID", async () => {
      await setAuthUser(fixture.agentAId);
      await expect(
        getClient().query(
          "SELECT public.roadmap_upsert_progress($1, 'completed')",
          [randomUUID()],
        ),
      ).rejects.toThrow(/not accessible/i);
    });

    it("ACCEPTS upsert against a published item in a published roadmap in the caller's own agency", async () => {
      await setAuthUser(fixture.agentAId);
      const res = await getClient().query(
        "SELECT public.roadmap_upsert_progress($1, 'completed') AS row",
        [fixture.itemAPublishedId],
      );
      expect(res.rows[0].row).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // 6. Super-admin bypass
  // -----------------------------------------------------------------------

  describe("super-admin bypass", () => {
    it("super-admin can SELECT items across agencies", async () => {
      await setAuthUser(fixture.superAdminId);
      const { rows } = await getClient().query(
        "SELECT id FROM public.roadmap_items WHERE id IN ($1, $2, $3)",
        [
          fixture.itemAPublishedId,
          fixture.itemBPublishedId,
          fixture.itemADraftId,
        ],
      );
      expect(rows.length).toBe(3);
    });

    it("super-admin can INSERT a roadmap_template", async () => {
      await setAuthUser(fixture.superAdminId);
      const newId = randomUUID();
      await expect(
        getClient().query(
          `
            INSERT INTO public.roadmap_templates (id, agency_id, title, created_by)
            VALUES ($1, $2, 'Super admin created', $3)
          `,
          [newId, fixture.agencyAId, fixture.superAdminId],
        ),
      ).resolves.toBeDefined();
    });

    it("super-admin CAN upsert progress against a draft item (for test-driving)", async () => {
      await setAuthUser(fixture.superAdminId);
      const res = await getClient().query(
        "SELECT public.roadmap_upsert_progress($1, 'completed') AS row",
        [fixture.itemADraftId],
      );
      expect(res.rows[0].row).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // 7. M-1 expansion: RPC super-admin guards
  //
  // The review flagged that the reorder / move / set_default RPCs added
  // explicit is_super_admin() guards in the RPC hardening migration, but
  // had zero integration test coverage. Each test below proves the guard
  // actually rejects a non-super-admin caller at the RPC layer before any
  // UPDATE runs — belt-and-suspenders on top of the rt_write / rs_write /
  // ri_write RLS policies.
  // -----------------------------------------------------------------------

  describe("RPC super-admin guards (M-1)", () => {
    it("roadmap_reorder_templates rejects a non-super-admin", async () => {
      await setAuthUser(fixture.agentAId);
      await expect(
        getClient().query("SELECT public.roadmap_reorder_templates($1, $2)", [
          fixture.agencyAId,
          [fixture.roadmapAId],
        ]),
      ).rejects.toThrow(/super-admin required/i);
    });

    it("roadmap_reorder_sections rejects a non-super-admin", async () => {
      await setAuthUser(fixture.agentAId);
      await expect(
        getClient().query("SELECT public.roadmap_reorder_sections($1, $2)", [
          fixture.roadmapAId,
          [fixture.sectionAId],
        ]),
      ).rejects.toThrow(/super-admin required/i);
    });

    it("roadmap_reorder_items rejects a non-super-admin", async () => {
      await setAuthUser(fixture.agentAId);
      await expect(
        getClient().query("SELECT public.roadmap_reorder_items($1, $2)", [
          fixture.sectionAId,
          [fixture.itemAPublishedId],
        ]),
      ).rejects.toThrow(/super-admin required/i);
    });

    it("roadmap_move_item rejects a non-super-admin", async () => {
      await setAuthUser(fixture.agentAId);
      await expect(
        getClient().query("SELECT public.roadmap_move_item($1, $2, 0)", [
          fixture.itemAPublishedId,
          fixture.sectionAId,
        ]),
      ).rejects.toThrow(/super-admin required/i);
    });

    it("roadmap_set_default rejects a non-super-admin", async () => {
      await setAuthUser(fixture.agentAId);
      await expect(
        getClient().query("SELECT public.roadmap_set_default($1)", [
          fixture.roadmapAId,
        ]),
      ).rejects.toThrow(/super-admin required/i);
    });
  });

  // -----------------------------------------------------------------------
  // 8. roadmap_reorder_templates correctness
  // -----------------------------------------------------------------------

  describe("roadmap_reorder_templates correctness", () => {
    it("rejects an empty array", async () => {
      await setAuthUser(fixture.superAdminId);
      await expect(
        getClient().query(
          "SELECT public.roadmap_reorder_templates($1, $2::uuid[])",
          [fixture.agencyAId, []],
        ),
      ).rejects.toThrow(/must not be empty/i);
    });

    it("rejects ids belonging to another agency", async () => {
      await setAuthUser(fixture.superAdminId);
      await expect(
        getClient().query("SELECT public.roadmap_reorder_templates($1, $2)", [
          fixture.agencyAId,
          [fixture.roadmapBId],
        ]),
      ).rejects.toThrow(/do not belong to agency/i);
    });

    it("rejects a subset of the agency's templates (must pass ALL)", async () => {
      await setAuthUser(fixture.superAdminId);
      // Fixture creates 2 roadmaps in Agency A (roadmapAId = published +
      // one draft roadmap with itemInDraftRoadmapId). Passing only one id
      // should be rejected because the RPC requires the caller to pass
      // every template in the agency.
      await expect(
        getClient().query("SELECT public.roadmap_reorder_templates($1, $2)", [
          fixture.agencyAId,
          [fixture.roadmapAId],
        ]),
      ).rejects.toThrow(/passed 1 ids but agency has 2/i);
    });

    it("accepts a valid reorder from super-admin and updates sort_order", async () => {
      await setAuthUser(fixture.superAdminId);
      // Fetch the 2 Agency A roadmap ids in their current order
      const { rows: before } = await getClient().query(
        `SELECT id FROM public.roadmap_templates
         WHERE agency_id = $1
         ORDER BY sort_order, created_at`,
        [fixture.agencyAId],
      );
      expect(before.length).toBe(2);

      // Reorder by swapping
      const reversed = [before[1].id, before[0].id];
      await getClient().query(
        "SELECT public.roadmap_reorder_templates($1, $2)",
        [fixture.agencyAId, reversed],
      );

      // Verify sort_order updated
      await getClient().query("RESET ROLE");
      const { rows: after } = await getClient().query(
        `SELECT id, sort_order FROM public.roadmap_templates
         WHERE agency_id = $1
         ORDER BY sort_order`,
        [fixture.agencyAId],
      );
      expect(after[0].id).toBe(reversed[0]);
      expect(after[0].sort_order).toBe(0);
      expect(after[1].id).toBe(reversed[1]);
      expect(after[1].sort_order).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // 9. roadmap_move_item cross-roadmap rejection
  // -----------------------------------------------------------------------

  describe("roadmap_move_item cross-roadmap enforcement", () => {
    it("rejects moving an item to a section in a different roadmap", async () => {
      await setAuthUser(fixture.superAdminId);
      // Try to move Agency A's published item into Agency B's section.
      // The agencies are different, so the sections belong to different
      // roadmaps, so the RPC's cross-roadmap check should fire.
      await expect(
        getClient().query("SELECT public.roadmap_move_item($1, $2, 0)", [
          fixture.itemAPublishedId,
          fixture.sectionBId,
        ]),
      ).rejects.toThrow(/cannot move item across roadmaps/i);
    });
  });
});
