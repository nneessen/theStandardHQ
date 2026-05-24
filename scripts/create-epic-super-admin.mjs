#!/usr/bin/env node
// scripts/create-epic-super-admin.mjs
//
// Creates a Super-Admin account scoped to a default home IMO of Epic Life.
// - Creates auth.users (or no-ops if email exists)
// - Inserts user_profiles row with is_super_admin=true, imo_id=Epic Life
// - Generates a Supabase recovery (password-reset) link the user can click to
//   set their password
//
// Defaults to REMOTE (prod). Pass `--local` to target the local stack.
//
// Usage:
//   node scripts/create-epic-super-admin.mjs                           # remote, default email
//   node scripts/create-epic-super-admin.mjs --email foo@bar.com       # remote, custom email
//   node scripts/create-epic-super-admin.mjs --local                   # local stack

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const DEFAULT_EMAIL = "epiclife.neessen@gmail.com";
const EPIC_LIFE_IMO_ID = "89514211-f2bd-4440-9527-90a472c5e622";

const args = process.argv.slice(2);
const isLocal = args.includes("--local");
const emailIdx = args.indexOf("--email");
const email = emailIdx >= 0 ? args[emailIdx + 1] : DEFAULT_EMAIL;

const supabaseUrl = isLocal
  ? process.env.VITE_SUPABASE_URL
  : process.env.REMOTE_SUPABASE_URL;
const serviceRoleKey = isLocal
  ? process.env.SUPABASE_SERVICE_ROLE_KEY
  : process.env.REMOTE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase URL or service-role key in .env");
  console.error(
    `Need: ${isLocal ? "VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY" : "REMOTE_SUPABASE_URL + REMOTE_SUPABASE_SERVICE_ROLE_KEY"}`,
  );
  process.exit(1);
}

console.log("Target:", isLocal ? "LOCAL" : "REMOTE", supabaseUrl);
console.log("Email :", email);
console.log("IMO   :", "Epic Life", `(${EPIC_LIFE_IMO_ID})`);
console.log("");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SUPER_ADMIN_METADATA = {
  first_name: "Nick",
  last_name: "Neessen",
  full_name: "Nick Neessen",
  imo_id: EPIC_LIFE_IMO_ID,
  is_admin: true,
  is_super_admin: true,
  is_active: true,
};

async function findAuthUserByEmail(targetEmail) {
  // listUsers paginates; we filter client-side to match exactly.
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw error;
  return (
    data?.users?.find(
      (u) => u.email?.toLowerCase() === targetEmail.toLowerCase(),
    ) || null
  );
}

async function ensureAuthUser(targetEmail) {
  const existing = await findAuthUserByEmail(targetEmail);
  if (existing) {
    console.log("Auth user already exists:", existing.id);
    return { user: existing, created: false };
  }

  console.log("Creating auth user...");
  const { data, error } = await supabase.auth.admin.createUser({
    email: targetEmail,
    email_confirm: true,
    user_metadata: SUPER_ADMIN_METADATA,
  });
  if (error) throw error;
  console.log("Auth user created:", data.user.id);
  return { user: data.user, created: true };
}

async function ensureMetadataClaims(userId) {
  // Several SECURITY DEFINER RPCs (admin_get_pending_users, admin_get_user_profile,
  // is_caller_admin) read these claims directly from raw_user_meta_data, NOT from
  // user_profiles. No custom access token hook exists, so the JWT mirrors metadata
  // verbatim. We have to bake them in here.
  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: SUPER_ADMIN_METADATA,
  });
  if (error) throw error;
  console.log("Metadata claims set:", Object.keys(SUPER_ADMIN_METADATA).join(", "));
  return data;
}

async function ensureProfile(userId, targetEmail) {
  const { data: existing, error: selErr } = await supabase
    .from("user_profiles")
    .select("id, email, is_super_admin, imo_id")
    .eq("id", userId)
    .maybeSingle();
  if (selErr) throw selErr;

  // The handle_new_user trigger inserts a default profile (roles=['agent'],
  // first_name=email-prefix). We always overwrite the super-admin-relevant
  // fields to match nickneessen@thestandardhq.com's setup exactly — anything
  // less and has_role(uid,'super-admin') returns false and the entire admin
  // surface stays hidden in the UI.
  const desired = {
    email: targetEmail,
    first_name: "Nick",
    last_name: "Neessen",
    roles: ["super-admin", "admin", "agent"],
    is_admin: true,
    is_super_admin: true,
    imo_id: EPIC_LIFE_IMO_ID,
    approval_status: "approved",
    agent_status: "licensed",
  };

  if (!existing) {
    console.log("Inserting user_profiles row...");
    const { error: insErr } = await supabase
      .from("user_profiles")
      .insert({ id: userId, ...desired });
    if (insErr) throw insErr;
    console.log("Profile inserted");
    return;
  }

  console.log("Profile exists — normalizing to super-admin baseline...");
  const { error: updErr } = await supabase
    .from("user_profiles")
    .update(desired)
    .eq("id", userId);
  if (updErr) throw updErr;
  console.log("Profile updated: roles =", desired.roles.join(","));
}

async function generateRecoveryLink(targetEmail) {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email: targetEmail,
  });
  if (error) throw error;
  return (
    data?.properties?.action_link ||
    data?.action_link ||
    null
  );
}

async function main() {
  try {
    const { user } = await ensureAuthUser(email);
    await ensureMetadataClaims(user.id);
    await ensureProfile(user.id, email);
    const link = await generateRecoveryLink(email);

    console.log("");
    console.log("============================================================");
    console.log("  SUCCESS");
    console.log("============================================================");
    console.log("");
    console.log("User ID :", user.id);
    console.log("Email   :", email);
    console.log("IMO     : Epic Life", `(${EPIC_LIFE_IMO_ID})`);
    console.log("Role    : Super-Admin");
    console.log("");
    console.log("Click this link to set a password:");
    console.log("");
    console.log(link || "(no link generated — check Supabase config)");
    console.log("");
  } catch (e) {
    console.error("FAILED:", e.message || e);
    console.error(e);
    process.exit(1);
  }
}

main();
