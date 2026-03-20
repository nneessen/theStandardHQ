import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import pg from 'pg';

const { Client } = pg;

const ROOT = process.cwd();
const DEFAULT_LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';
const DEFAULT_LOCAL_DB_URL =
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const DEFAULT_SUPER_ADMIN_EMAIL = 'nickneessen@thestandardhq.com';
const DEFAULT_SUPER_ADMIN_PASSWORD = 'LocalSuperAdmin2026!Reset1';
const DEFAULT_LOCAL_USER_PASSWORD = 'LocalUser2026!Reset1';
const THE_STANDARD_AGENCY_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const DATA_TABLES = [
  'roles',
  'permissions',
  'role_permissions',
  'constants',
  'imos',
  'subscription_plans',
  'subscription_addons',
  'agencies',
  'carriers',
  'carrier_build_charts',
  'products',
  'pipeline_templates',
  'pipeline_phases',
  'phase_checklist_items',
  'subscription_settings',
];

const EXTRA_LOCAL_USERS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    emailEnv: 'LOCAL_BOOTSTRAP_ACTIVE_AGENT_EMAIL',
    defaultEmail: 'local.agent@thestandardhq.test',
    passwordEnv: 'LOCAL_BOOTSTRAP_ACTIVE_AGENT_PASSWORD',
    defaultPassword: DEFAULT_LOCAL_USER_PASSWORD,
    firstName: 'Local',
    lastName: 'Agent',
    roles: ['agent'],
    isAdmin: false,
    isSuperAdmin: false,
    approvalStatus: 'approved',
    agentStatus: 'licensed',
    assignToStandardAgency: true,
    upline: 'super_admin',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    emailEnv: 'LOCAL_BOOTSTRAP_TRAINER_EMAIL',
    defaultEmail: 'local.trainer@thestandardhq.test',
    passwordEnv: 'LOCAL_BOOTSTRAP_TRAINER_PASSWORD',
    defaultPassword: DEFAULT_LOCAL_USER_PASSWORD,
    firstName: 'Local',
    lastName: 'Trainer',
    roles: ['trainer'],
    isAdmin: false,
    isSuperAdmin: false,
    approvalStatus: 'approved',
    agentStatus: 'not_applicable',
    assignToStandardAgency: true,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    emailEnv: 'LOCAL_BOOTSTRAP_CONTRACTING_MANAGER_EMAIL',
    defaultEmail: 'local.contracting@thestandardhq.test',
    passwordEnv: 'LOCAL_BOOTSTRAP_CONTRACTING_MANAGER_PASSWORD',
    defaultPassword: DEFAULT_LOCAL_USER_PASSWORD,
    firstName: 'Local',
    lastName: 'Contracting',
    roles: ['contracting_manager'],
    isAdmin: false,
    isSuperAdmin: false,
    approvalStatus: 'approved',
    agentStatus: 'not_applicable',
    assignToStandardAgency: true,
  },
];

for (const envFile of ['.env.local', '.env']) {
  dotenv.config({
    path: path.join(ROOT, envFile),
    override: false,
  });
}

const remoteDbUrl = process.env.REMOTE_DATABASE_URL;
const localDbUrl = process.env.LOCAL_DATABASE_URL || DEFAULT_LOCAL_DB_URL;
const localStatusEnv = getSupabaseStatusEnv();
const localSupabaseUrl =
  process.env.LOCAL_SUPABASE_URL ||
  process.env.VITE_LOCAL_SUPABASE_URL ||
  localStatusEnv.API_URL ||
  DEFAULT_LOCAL_SUPABASE_URL;
const localServiceRoleKey =
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ||
  localStatusEnv.SERVICE_ROLE_KEY;
const superAdminEmail =
  process.env.LOCAL_BOOTSTRAP_SUPER_ADMIN_EMAIL || DEFAULT_SUPER_ADMIN_EMAIL;
const superAdminPassword =
  process.env.LOCAL_BOOTSTRAP_SUPER_ADMIN_PASSWORD ||
  DEFAULT_SUPER_ADMIN_PASSWORD;

if (!remoteDbUrl) {
  console.error(
    'Missing REMOTE_DATABASE_URL. Local bootstrap intentionally refuses to reuse DATABASE_URL because dev defaults now point at local Supabase.',
  );
  process.exit(1);
}

if (!localServiceRoleKey) {
  console.error(
    'Missing a local Supabase service role key. Start the local stack with `npm run supabase:start` or set LOCAL_SUPABASE_SERVICE_ROLE_KEY.',
  );
  process.exit(1);
}

const remoteDb = new Client({ connectionString: remoteDbUrl });
const localDb = new Client({ connectionString: localDbUrl });
const localAdmin = createClient(localSupabaseUrl, localServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

await remoteDb.connect();
await localDb.connect();

try {
  const tableRows = new Map();
  const tableColumnTypes = new Map();

  for (const table of DATA_TABLES) {
    tableRows.set(table, await fetchRows(remoteDb, table));
    tableColumnTypes.set(table, await fetchColumnTypes(localDb, table));
  }

  const agencies = tableRows.get('agencies');
  const pipelineTemplates = tableRows.get('pipeline_templates');
  const subscriptionSettings = tableRows.get('subscription_settings');
  const standardAgency =
    agencies.find((agency) => agency.id === THE_STANDARD_AGENCY_ID) || null;
  const superAdminId = resolveSuperAdminId({
    agencies,
    pipelineTemplates,
    standardAgency,
  });
  const referencedUserIds = collectReferencedUserIds({
    agencies,
    pipelineTemplates,
    subscriptionSettings,
  });
  const remoteUserProfiles = await fetchRemoteUserProfiles(
    remoteDb,
    referencedUserIds,
  );
  const bootstrapUsers = buildBootstrapUsers({
    agencies,
    remoteUserProfiles,
    referencedUserIds,
    superAdminId,
    standardAgency,
    superAdminEmail,
    superAdminPassword,
  });

  await ensureLocalAuthUsers(localAdmin, bootstrapUsers);

  await localDb.query('begin');
  try {
    await localDb.query('set local session_replication_role = replica');
    await truncateLocalPublicData(localDb);
    await upsertLocalProfiles(localDb, bootstrapUsers, {
      includeOrgAssignments: false,
    });

    for (const table of DATA_TABLES) {
      await replaceTableRows(
        localDb,
        table,
        tableRows.get(table),
        tableColumnTypes.get(table),
      );
    }

    await replaceAppConfig(localDb, {
      localSupabaseUrl,
      localServiceRoleKey,
    });

    await localDb.query('set local session_replication_role = origin');
    await upsertLocalProfiles(localDb, bootstrapUsers, {
      includeOrgAssignments: true,
    });

    await localDb.query('commit');
  } catch (error) {
    await localDb.query('rollback');
    throw error;
  }

  console.log('\nLocal bootstrap summary:');
  for (const table of [...DATA_TABLES, 'app_config']) {
    const result = await localDb.query(
      `select count(*)::int as count from public.${quoteIdent(table)}`,
    );
    console.log(`- ${table}: ${result.rows[0].count}`);
  }
  console.log(`- auth fixtures: ${bootstrapUsers.length}`);
  console.log(`- super admin: ${superAdminEmail}`);
  console.log(
    '- local password reset emails: http://127.0.0.1:54324 (Mailpit/Inbucket)',
  );
} finally {
  await remoteDb.end();
  await localDb.end();
}

function getSupabaseStatusEnv() {
  try {
    const output = execFileSync('supabase', ['status', '-o', 'env'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    return Object.fromEntries(
      output
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.includes('='))
        .map((line) => {
          const separatorIndex = line.indexOf('=');
          const key = line.slice(0, separatorIndex);
          const rawValue = line.slice(separatorIndex + 1);
          return [key, stripQuotes(rawValue)];
        }),
    );
  } catch {
    return {};
  }
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function quoteIdent(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function fetchRows(client, table) {
  const result = await client.query(`select * from public.${quoteIdent(table)}`);
  return result.rows;
}

async function fetchColumnTypes(client, table) {
  const result = await client.query(
    `
      select column_name, data_type
      from information_schema.columns
      where table_schema = 'public'
        and table_name = $1
    `,
    [table],
  );

  return new Map(result.rows.map((row) => [row.column_name, row.data_type]));
}

function resolveSuperAdminId({ agencies, pipelineTemplates, standardAgency }) {
  if (standardAgency?.owner_id) {
    return standardAgency.owner_id;
  }

  const createdBy = pipelineTemplates.find((template) => template.created_by)?.created_by;
  if (createdBy) {
    return createdBy;
  }

  const firstOwner = agencies.find((agency) => agency.owner_id)?.owner_id;
  if (firstOwner) {
    return firstOwner;
  }

  throw new Error('Could not resolve a bootstrap super admin user ID from remote reference data.');
}

function collectReferencedUserIds({
  agencies,
  pipelineTemplates,
  subscriptionSettings,
}) {
  const ids = new Set();

  for (const agency of agencies) {
    if (agency.owner_id) {
      ids.add(agency.owner_id);
    }
  }

  for (const template of pipelineTemplates) {
    if (template.created_by) {
      ids.add(template.created_by);
    }
  }

  for (const settings of subscriptionSettings) {
    if (settings.updated_by) {
      ids.add(settings.updated_by);
    }
  }

  return [...ids];
}

async function fetchRemoteUserProfiles(client, userIds) {
  if (userIds.length === 0) {
    return new Map();
  }

  const result = await client.query(
    `
      select
        id,
        roles,
        is_admin,
        is_super_admin,
        approval_status,
        agent_status::text as agent_status,
        imo_id,
        agency_id
      from public.user_profiles
      where id = any($1::uuid[])
    `,
    [userIds],
  );

  return new Map(result.rows.map((row) => [row.id, row]));
}

function buildBootstrapUsers({
  agencies,
  remoteUserProfiles,
  referencedUserIds,
  superAdminId,
  standardAgency,
  superAdminEmail,
  superAdminPassword,
}) {
  const standardImoId = standardAgency?.imo_id || null;
  const users = [];
  const agencyByOwnerId = new Map(
    agencies
      .filter((agency) => agency.owner_id)
      .map((agency) => [agency.owner_id, agency]),
  );

  for (const userId of referencedUserIds) {
    const remoteProfile = remoteUserProfiles.get(userId);
    const ownedAgency =
      agencyByOwnerId.get(userId) ||
      agencies.find((agency) => agency.id === remoteProfile?.agency_id) ||
      null;

    if (userId === superAdminId) {
      users.push({
        id: userId,
        email: superAdminEmail,
        password: superAdminPassword,
        firstName: 'Nick',
        lastName: 'Neessen',
        roles: remoteProfile?.roles || ['super-admin', 'admin', 'agent'],
        isAdmin: remoteProfile?.is_admin ?? true,
        isSuperAdmin: remoteProfile?.is_super_admin ?? true,
        approvalStatus: remoteProfile?.approval_status || 'approved',
        agentStatus: remoteProfile?.agent_status || 'licensed',
        desiredImoId: remoteProfile?.imo_id || standardImoId,
        desiredAgencyId: remoteProfile?.agency_id || standardAgency?.id || null,
      });
      continue;
    }

    const fallbackAgencyCode = slugify(
      ownedAgency?.code || ownedAgency?.name || userId.slice(0, 8),
    );
    users.push({
      id: userId,
      email: `owner-${fallbackAgencyCode}@local.thestandardhq.test`,
      password: DEFAULT_LOCAL_USER_PASSWORD,
      firstName: 'Local',
      lastName: ownedAgency?.name || 'Agency Owner',
      roles: remoteProfile?.roles || ['agent'],
      isAdmin: remoteProfile?.is_admin ?? false,
      isSuperAdmin: remoteProfile?.is_super_admin ?? false,
      approvalStatus: remoteProfile?.approval_status || 'approved',
      agentStatus: remoteProfile?.agent_status || 'licensed',
      desiredImoId: remoteProfile?.imo_id || standardImoId,
      desiredAgencyId: remoteProfile?.agency_id || ownedAgency?.id || null,
    });
  }

  for (const localUser of EXTRA_LOCAL_USERS) {
    users.push({
      id: localUser.id,
      email: process.env[localUser.emailEnv] || localUser.defaultEmail,
      password: process.env[localUser.passwordEnv] || localUser.defaultPassword,
      firstName: localUser.firstName,
      lastName: localUser.lastName,
      roles: localUser.roles,
      isAdmin: localUser.isAdmin,
      isSuperAdmin: localUser.isSuperAdmin,
      approvalStatus: localUser.approvalStatus,
      agentStatus: localUser.agentStatus,
      desiredImoId: localUser.assignToStandardAgency ? standardImoId : null,
      desiredAgencyId: localUser.assignToStandardAgency ? standardAgency?.id || null : null,
      uplineId: localUser.upline === 'super_admin' ? superAdminId : null,
    });
  }

  return dedupeUsers(users);
}

function dedupeUsers(users) {
  const byId = new Map();
  for (const user of users) {
    byId.set(user.id, {
      uplineId: null,
      ...user,
    });
  }
  return [...byId.values()];
}

async function ensureLocalAuthUsers(adminClient, users) {
  const existingUsers = await listLocalAuthUsers(adminClient);
  const byId = new Map(existingUsers.map((user) => [user.id, user]));
  const byEmail = new Map(
    existingUsers
      .filter((user) => user.email)
      .map((user) => [user.email.toLowerCase(), user]),
  );

  for (const user of users) {
    const emailKey = user.email.toLowerCase();
    const conflictingUser = byEmail.get(emailKey);

    if (conflictingUser && conflictingUser.id !== user.id) {
      const { error } = await adminClient.auth.admin.deleteUser(conflictingUser.id);
      if (error) {
        throw error;
      }
      byId.delete(conflictingUser.id);
      byEmail.delete(emailKey);
    }

    const payload = {
      id: user.id,
      email: user.email,
      password: user.password,
      email_confirm: true,
      role: 'authenticated',
      app_metadata: {
        provider: 'email',
        providers: ['email'],
      },
      user_metadata: {
        first_name: user.firstName,
        last_name: user.lastName,
        roles: user.roles,
      },
    };

    if (byId.has(user.id)) {
      const { error } = await adminClient.auth.admin.updateUserById(user.id, payload);
      if (error) {
        throw error;
      }
      continue;
    }

    const { error } = await adminClient.auth.admin.createUser(payload);
    if (error) {
      throw error;
    }
  }
}

async function listLocalAuthUsers(adminClient) {
  const users = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    users.push(...data.users);

    if (data.users.length < perPage) {
      break;
    }

    page += 1;
  }

  return users;
}

async function upsertLocalProfiles(client, users, { includeOrgAssignments }) {
  for (const user of users) {
    await client.query(
      `
        insert into public.user_profiles (
          id,
          email,
          first_name,
          last_name,
          roles,
          is_admin,
          is_super_admin,
          approval_status,
          agent_status,
          imo_id,
          agency_id,
          upline_id,
          approved_at,
          password_set_at,
          updated_at
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15
        )
        on conflict (id) do update
        set email = excluded.email,
            first_name = excluded.first_name,
            last_name = excluded.last_name,
            roles = excluded.roles,
            is_admin = excluded.is_admin,
            is_super_admin = excluded.is_super_admin,
            approval_status = excluded.approval_status,
            agent_status = excluded.agent_status,
            imo_id = excluded.imo_id,
            agency_id = excluded.agency_id,
            upline_id = excluded.upline_id,
            approved_at = excluded.approved_at,
            password_set_at = excluded.password_set_at,
            updated_at = excluded.updated_at
      `,
      [
        user.id,
        user.email,
        user.firstName,
        user.lastName,
        user.roles,
        user.isAdmin,
        user.isSuperAdmin,
        user.approvalStatus,
        user.agentStatus,
        includeOrgAssignments ? user.desiredImoId : null,
        includeOrgAssignments ? user.desiredAgencyId : null,
        user.uplineId || null,
        user.approvalStatus === 'approved' ? new Date() : null,
        new Date(),
        new Date(),
      ],
    );
  }
}

async function truncateLocalPublicData(client) {
  const result = await client.query(
    `
      select tablename
      from pg_tables
      where schemaname = 'public'
      order by tablename
    `,
  );
  const tablesSql = result.rows
    .map((row) => `public.${quoteIdent(row.tablename)}`)
    .join(', ');

  if (!tablesSql) {
    return;
  }

  await client.query(`truncate table ${tablesSql}`);
}

async function replaceTableRows(client, table, rows, columnTypes = new Map()) {
  if (!rows || rows.length === 0) {
    return;
  }

  const columns = Object.keys(rows[0]);
  const values = [];
  const valueGroups = rows.map((row, rowIndex) => {
    const placeholders = columns.map((column, columnIndex) => {
      values.push(normalizeValue(row[column], columnTypes.get(column)));
      return `$${rowIndex * columns.length + columnIndex + 1}`;
    });
    return `(${placeholders.join(', ')})`;
  });

  const sql = `
    insert into public.${quoteIdent(table)} (${columns.map(quoteIdent).join(', ')})
    values ${valueGroups.join(', ')}
  `;

  await client.query(sql, values);
}

function normalizeValue(value, dataType) {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return null;
  }

  if (dataType === 'json' || dataType === 'jsonb') {
    return JSON.stringify(value);
  }

  return value;
}

async function replaceAppConfig(client, { localSupabaseUrl, localServiceRoleKey }) {
  await client.query(
    `
      insert into public.app_config (key, value, description)
      values
        ('supabase_project_url', $1, 'Local Supabase URL for Docker development'),
        ('supabase_service_role_key', $2, 'Local Supabase service role key for Docker development')
    `,
    [localSupabaseUrl, localServiceRoleKey],
  );
}
