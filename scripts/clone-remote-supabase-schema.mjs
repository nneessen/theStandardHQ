import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import dotenv from 'dotenv';

const ROOT = process.cwd();
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'supabase-schema-clone-'));

const envFiles = ['.env.local', '.env'];
for (const envFile of envFiles) {
  const envPath = path.join(ROOT, envFile);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

const remoteDbUrl = process.env.REMOTE_DATABASE_URL || process.env.DATABASE_URL;
const localAdminDbUrl =
  process.env.LOCAL_SUPABASE_ADMIN_DATABASE_URL ||
  'postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres';

if (!remoteDbUrl) {
  console.error(
    'Missing REMOTE_DATABASE_URL or DATABASE_URL in your environment. This command needs a remote Postgres URL.',
  );
  process.exit(1);
}

const encodedRemoteDbUrl = new URL(remoteDbUrl).toString();
const schemaDumpPath = path.join(TMP_DIR, 'remote_schema.sql');
const patchedSchemaDumpPath = path.join(TMP_DIR, 'remote_schema_patched.sql');
const bucketsCsvPath = path.join(TMP_DIR, 'storage_buckets.csv');
const migrationsCsvPath = path.join(TMP_DIR, 'schema_migrations.csv');
const prepareLocalSqlPath = path.join(TMP_DIR, 'prepare_local.sql');
const exactPolicySqlPath = path.join(TMP_DIR, 'restore_exact_is_agency_owner_policies.sql');

function run(command, args, options = {}) {
  console.log(`$ ${command} ${args.join(' ')}`);
  execFileSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    ...options,
  });
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function cleanup() {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
}

const prepareLocalSql = `
drop extension if exists pg_net;

drop schema if exists auth cascade;
drop schema if exists storage cascade;
drop schema if exists public cascade;

create schema if not exists public;
create schema if not exists extensions;
create schema if not exists graphql;
create schema if not exists vault;
create schema if not exists pgmq;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_stat_statements with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists hypopg with schema extensions;
create extension if not exists index_advisor with schema extensions;
create extension if not exists pg_graphql with schema graphql;
create extension if not exists supabase_vault with schema vault;
create extension if not exists pgmq with schema pgmq;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema public;
`;

const exactPolicySql = `
begin;

drop function public.is_agency_owner(uuid) cascade;

create function public.is_agency_owner(p_agency_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
BEGIN
  IF p_agency_id IS NULL THEN
    -- Check if user owns any agency
    RETURN EXISTS (
      SELECT 1 FROM agencies
      WHERE owner_id = auth.uid()
    );
  ELSE
    -- Check if user owns specific agency
    RETURN EXISTS (
      SELECT 1 FROM agencies
      WHERE id = p_agency_id AND owner_id = auth.uid()
    );
  END IF;
END;
$function$;

alter function public.is_agency_owner(uuid) owner to postgres;
grant all on function public.is_agency_owner(uuid) to anon;
grant all on function public.is_agency_owner(uuid) to authenticated;
grant all on function public.is_agency_owner(uuid) to service_role;
comment on function public.is_agency_owner(uuid) is 'Checks if the current user owns a specific agency (or any agency if no ID provided).';

drop policy if exists "Agency owners can delete override_commissions in own agency" on public.override_commissions;
create policy "Agency owners can delete override_commissions in own agency" on public.override_commissions for delete to authenticated using (((agency_id is not null) and (imo_id = public.get_my_imo_id()) and public.is_agency_owner(agency_id)));

drop policy if exists "Agency owners can insert override_commissions in own agency" on public.override_commissions;
create policy "Agency owners can insert override_commissions in own agency" on public.override_commissions for insert to authenticated with check (((agency_id is not null) and (imo_id = public.get_my_imo_id()) and public.is_agency_owner(agency_id)));

drop policy if exists "Agency owners can update override_commissions in own agency" on public.override_commissions;
create policy "Agency owners can update override_commissions in own agency" on public.override_commissions for update to authenticated using (((agency_id is not null) and (imo_id = public.get_my_imo_id()) and public.is_agency_owner(agency_id)));

drop policy if exists "Agency owners can view override_commissions in own agency" on public.override_commissions;
create policy "Agency owners can view override_commissions in own agency" on public.override_commissions for select to authenticated using (((agency_id is not null) and (imo_id = public.get_my_imo_id()) and public.is_agency_owner(agency_id)));

drop policy if exists pipeline_phases_agency_owner_delete on public.pipeline_phases;
create policy pipeline_phases_agency_owner_delete on public.pipeline_phases for delete to authenticated using ((public.is_agency_owner(NULL::uuid) and (exists ( select 1 from public.pipeline_templates pt where ((pt.id = pipeline_phases.template_id) and (pt.created_by = ( select auth.uid() as uid)))))));

drop policy if exists pipeline_phases_agency_owner_insert on public.pipeline_phases;
create policy pipeline_phases_agency_owner_insert on public.pipeline_phases for insert to authenticated with check ((public.is_agency_owner(NULL::uuid) and (exists ( select 1 from public.pipeline_templates pt where ((pt.id = pipeline_phases.template_id) and (pt.created_by = ( select auth.uid() as uid)))))));

drop policy if exists pipeline_phases_agency_owner_select on public.pipeline_phases;
create policy pipeline_phases_agency_owner_select on public.pipeline_phases for select to authenticated using ((public.is_agency_owner(NULL::uuid) and (exists ( select 1 from public.pipeline_templates pt where ((pt.id = pipeline_phases.template_id) and ((pt.imo_id = public.get_my_imo_id()) or (pt.imo_id is null) or (pt.created_by = ( select auth.uid() as uid))))))));

drop policy if exists pipeline_phases_agency_owner_update on public.pipeline_phases;
create policy pipeline_phases_agency_owner_update on public.pipeline_phases for update to authenticated using ((public.is_agency_owner(NULL::uuid) and (exists ( select 1 from public.pipeline_templates pt where ((pt.id = pipeline_phases.template_id) and (pt.created_by = ( select auth.uid() as uid))))))) with check ((public.is_agency_owner(NULL::uuid) and (exists ( select 1 from public.pipeline_templates pt where ((pt.id = pipeline_phases.template_id) and (pt.created_by = ( select auth.uid() as uid)))))));

drop policy if exists pipeline_templates_agency_owner_delete on public.pipeline_templates;
create policy pipeline_templates_agency_owner_delete on public.pipeline_templates for delete to authenticated using ((public.is_agency_owner(NULL::uuid) and (created_by = ( select auth.uid() as uid))));

drop policy if exists pipeline_templates_agency_owner_insert on public.pipeline_templates;
create policy pipeline_templates_agency_owner_insert on public.pipeline_templates for insert to authenticated with check ((public.is_agency_owner(NULL::uuid) and (created_by = ( select auth.uid() as uid))));

drop policy if exists pipeline_templates_agency_owner_select on public.pipeline_templates;
create policy pipeline_templates_agency_owner_select on public.pipeline_templates for select to authenticated using ((public.is_agency_owner(NULL::uuid) and ((imo_id = public.get_my_imo_id()) or (imo_id is null) or (created_by = ( select auth.uid() as uid)))));

drop policy if exists pipeline_templates_agency_owner_update on public.pipeline_templates;
create policy pipeline_templates_agency_owner_update on public.pipeline_templates for update to authenticated using ((public.is_agency_owner(NULL::uuid) and (created_by = ( select auth.uid() as uid)))) with check ((public.is_agency_owner(NULL::uuid) and (created_by = ( select auth.uid() as uid))));

drop policy if exists "Agency owners can delete agency assets" on storage.objects;
create policy "Agency owners can delete agency assets" on storage.objects for delete to authenticated using (((bucket_id = 'agency-assets'::text) and (public.safe_uuid_from_text((storage.foldername(name))[1]) = public.get_my_agency_id()) and (public.is_agency_owner() or public.is_imo_admin())));

drop policy if exists "Agency owners can update agency assets" on storage.objects;
create policy "Agency owners can update agency assets" on storage.objects for update to authenticated using (((bucket_id = 'agency-assets'::text) and (public.safe_uuid_from_text((storage.foldername(name))[1]) = public.get_my_agency_id()) and (public.is_agency_owner() or public.is_imo_admin())));

drop policy if exists "Agency owners can upload agency assets" on storage.objects;
create policy "Agency owners can upload agency assets" on storage.objects for insert to authenticated with check (((bucket_id = 'agency-assets'::text) and (public.safe_uuid_from_text((storage.foldername(name))[1]) = public.get_my_agency_id()) and (public.is_agency_owner() or public.is_imo_admin())));

create or replace function public.is_agency_owner(p_agency_id uuid default null::uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
BEGIN
  IF p_agency_id IS NULL THEN
    -- Check if user owns any agency
    RETURN EXISTS (
      SELECT 1 FROM agencies
      WHERE owner_id = auth.uid()
    );
  ELSE
    -- Check if user owns specific agency
    RETURN EXISTS (
      SELECT 1 FROM agencies
      WHERE id = p_agency_id AND owner_id = auth.uid()
    );
  END IF;
END;
$function$;

alter function public.is_agency_owner(uuid) owner to postgres;
grant all on function public.is_agency_owner(uuid) to anon;
grant all on function public.is_agency_owner(uuid) to authenticated;
grant all on function public.is_agency_owner(uuid) to service_role;
comment on function public.is_agency_owner(uuid) is 'Checks if the current user owns a specific agency (or any agency if no ID provided).';

commit;
`;

writeFile(prepareLocalSqlPath, prepareLocalSql);
writeFile(exactPolicySqlPath, exactPolicySql);

try {
  run('supabase', [
    'db',
    'dump',
    '--db-url',
    encodedRemoteDbUrl,
    '--schema',
    'public,storage,auth',
    '--file',
    schemaDumpPath,
  ]);

  const rawSchemaDump = fs.readFileSync(schemaDumpPath, 'utf8');
  const policyRewrites = [
    [
      '"public"."is_agency_owner"() OR "public"."is_imo_admin"()',
      '"public"."is_agency_owner"(NULL::uuid) OR "public"."is_imo_admin"()',
    ],
  ];

  let patchedSchemaDump = rawSchemaDump;
  for (const [from, to] of policyRewrites) {
    const occurrences = patchedSchemaDump.split(from).length - 1;
    if (occurrences === 0) {
      throw new Error(`Expected to patch at least one occurrence of: ${from}`);
    }
    patchedSchemaDump = patchedSchemaDump.replaceAll(from, to);
  }
  writeFile(patchedSchemaDumpPath, patchedSchemaDump);

  run('psql', [remoteDbUrl, '-c', `\\copy storage.buckets to '${bucketsCsvPath}' csv`]);
  run('psql', [
    remoteDbUrl,
    '-c',
    `\\copy supabase_migrations.schema_migrations to '${migrationsCsvPath}' csv`,
  ]);

  run('psql', [localAdminDbUrl, '-v', 'ON_ERROR_STOP=1', '-f', prepareLocalSqlPath]);
  run('psql', [localAdminDbUrl, '-v', 'ON_ERROR_STOP=1', '-f', patchedSchemaDumpPath]);
  run('psql', [localAdminDbUrl, '-v', 'ON_ERROR_STOP=1', '-f', exactPolicySqlPath]);
  run('psql', [
    localAdminDbUrl,
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    'truncate table supabase_migrations.schema_migrations',
  ]);
  run('psql', [localAdminDbUrl, '-c', `\\copy storage.buckets from '${bucketsCsvPath}' csv`]);
  run('psql', [
    localAdminDbUrl,
    '-c',
    `\\copy supabase_migrations.schema_migrations from '${migrationsCsvPath}' csv`,
  ]);

  console.log('\nLocal clone summary:');
  run('psql', [
    localAdminDbUrl,
    '-Atqc',
    `
      select 'public_functions=' || count(*)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public';

      select 'tables=' || count(*)
      from information_schema.tables
      where table_schema in ('public', 'auth', 'storage')
        and table_type = 'BASE TABLE';

      select 'views=' || count(*)
      from information_schema.views
      where table_schema in ('public', 'auth', 'storage');

      select 'policies=' || count(*)
      from pg_policies
      where schemaname in ('public', 'auth', 'storage');

      select 'schema_migrations=' || count(*)
      from supabase_migrations.schema_migrations;

      select 'bucket_rows=' || count(*)
      from storage.buckets;

      select 'auth_users=' || count(*)
      from auth.users;

      select 'user_profiles=' || count(*)
      from public.user_profiles;

      select 'storage_objects=' || count(*)
      from storage.objects;
    `,
  ]);

  console.log(
    '\nLocal auth/public/storage now mirrors the remote schema and metadata. Table data remains empty by design.',
  );
  cleanup();
} catch (error) {
  console.error(`\nClone failed. Temporary files were left in ${TMP_DIR}`);
  throw error;
}
