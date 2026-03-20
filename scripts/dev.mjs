import { spawn } from 'node:child_process';
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
