// scripts/verify-member-access-ban.mjs
//
// Smoke test for the Supabase admin ban API used by the set-member-access edge
// function (reversible "disable access"). Runs against LOCAL Supabase only, on a
// throwaway user it creates and deletes — never touches real accounts.
//
// Usage: node scripts/verify-member-access-ban.mjs
import { createClient } from "@supabase/supabase-js";

const URL = process.env.LOCAL_SUPABASE_URL || "http://127.0.0.1:54321";
// Standard local-dev service_role key from `supabase start` (not a production secret).
const SERVICE_ROLE_KEY =
  process.env.LOCAL_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const admin = createClient(URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = `bantest_${Date.now()}@example.com`;
const { data: created, error: cErr } = await admin.auth.admin.createUser({
  email,
  password: "TempPass12345!",
  email_confirm: true,
});
if (cErr) {
  console.log("CREATE_ERR", cErr.message);
  process.exit(1);
}
const id = created.user.id;

const { error: bErr } = await admin.auth.admin.updateUserById(id, {
  ban_duration: "876600h",
});
const { data: afterBan } = await admin.auth.admin.getUserById(id);

const { error: uErr } = await admin.auth.admin.updateUserById(id, {
  ban_duration: "none",
});
const { data: afterUnban } = await admin.auth.admin.getUserById(id);

console.log(
  JSON.stringify(
    {
      banErr: bErr?.message || null,
      banned_until_after_ban: afterBan?.user?.banned_until || null,
      unbanErr: uErr?.message || null,
      banned_until_after_unban: afterUnban?.user?.banned_until || null,
      getUserById_works: !!afterBan?.user?.id,
    },
    null,
    2,
  ),
);

await admin.auth.admin.deleteUser(id);
console.log("cleaned up throwaway user");
