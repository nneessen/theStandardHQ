import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

import dotenv from 'dotenv';

const ROOT = process.cwd();

for (const envFile of ['.env.local', '.env']) {
  dotenv.config({
    path: path.join(ROOT, envFile),
    override: false,
  });
}

const useLocalSupabase = process.env.VITE_USE_LOCAL === 'true';
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// ── Kill zombie dev processes from previous sessions ──
killZombieDevProcesses();

// ── Local-mode bootstrap: Docker → Supabase → then dev:local ──
if (useLocalSupabase) {
  await ensureDocker();
  await ensureSupabase();
}

const scriptName = useLocalSupabase ? 'dev:local' : 'dev:web';

const child = spawn(npmCommand, ['run', scriptName], {
  cwd: ROOT,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

// ── Helpers ─────────────────────────────────────────────────────

function isDockerRunning() {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function ensureDocker() {
  if (isDockerRunning()) {
    console.log('✅ Docker is running');
    return;
  }

  console.log('🐳 Starting Docker Desktop...');
  try {
    execSync('open -a Docker', { stdio: 'ignore' });
  } catch {
    console.error('❌ Could not launch Docker Desktop. Please start it manually.');
    process.exit(1);
  }

  // Wait up to 60s for Docker daemon to be ready
  const maxWait = 60;
  for (let i = 0; i < maxWait; i++) {
    if (isDockerRunning()) {
      console.log('✅ Docker is ready');
      return;
    }
    await sleep(1000);
    if (i > 0 && i % 10 === 0) {
      console.log(`   …still waiting for Docker (${i}s)`);
    }
  }

  console.error('❌ Docker did not start within 60s. Please start it manually.');
  process.exit(1);
}

function isSupabaseRunning() {
  try {
    const out = execSync('supabase status', { cwd: ROOT, stdio: 'pipe' }).toString();
    // If status output contains the API URL, it's running
    return out.includes('127.0.0.1') || out.includes('localhost');
  } catch {
    return false;
  }
}

async function ensureSupabase() {
  if (isSupabaseRunning()) {
    console.log('✅ Supabase is running');
    return;
  }

  console.log('🟢 Starting Supabase (supabase start)...');
  try {
    execSync('supabase start', { cwd: ROOT, stdio: 'inherit', timeout: 120_000 });
    console.log('✅ Supabase is ready');
  } catch (err) {
    console.error('❌ Failed to start Supabase:', err.message);
    process.exit(1);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function killZombieDevProcesses() {
  try {
    // Find node processes listening on ports 3000-3010 (zombie Vite/Express from previous sessions)
    const lsofOutput = execSync(
      'lsof -i -P -n 2>/dev/null | grep "node.*LISTEN" | grep -E ":(30[0-9]{2})" || true',
      { stdio: 'pipe' }
    ).toString().trim();

    if (!lsofOutput) return;

    const pids = [...new Set(lsofOutput.split('\n').map(line => line.trim().split(/\s+/)[1]).filter(Boolean))];
    if (pids.length > 0) {
      console.log(`🧹 Killing ${pids.length} zombie dev process(es) on ports 3000-3010...`);
      execSync(`kill ${pids.join(' ')} 2>/dev/null || true`, { stdio: 'ignore' });
    }
  } catch {
    // Non-critical — proceed even if cleanup fails
  }
}
