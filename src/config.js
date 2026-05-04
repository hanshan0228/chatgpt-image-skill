import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const content = readFileSync(filePath, 'utf-8');
  const result = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) result[key] = value;
  }

  return result;
}

const devEnv = parseEnvFile(join(projectRoot, '.env.development'));
const baseEnv = parseEnvFile(join(projectRoot, '.env'));

for (const [key, value] of Object.entries(baseEnv)) {
  if (process.env[key] === undefined || process.env[key] === '') {
    process.env[key] = value;
  }
}

for (const [key, value] of Object.entries(devEnv)) {
  if (process.env[key] === undefined || process.env[key] === '') {
    process.env[key] = value;
  }
}

function envBool(key, fallback) {
  const value = process.env[key];
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

function envInt(key, fallback) {
  const value = process.env[key];
  if (value === undefined || value === '') return fallback;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function envStr(key, fallback) {
  const value = process.env[key];
  return value !== undefined && value !== '' ? value : fallback;
}

const config = {
  browserPath: envStr('BROWSER_PATH', undefined),
  browserDebugPort: envInt('BROWSER_DEBUG_PORT', 40831),
  browserUserDataDir: envStr('BROWSER_USER_DATA_DIR', undefined),
  browserHeadless: envBool('BROWSER_HEADLESS', false),
  browserProtocolTimeout: envInt('BROWSER_PROTOCOL_TIMEOUT', 60_000),
  outputDir: envStr('OUTPUT_DIR', join(projectRoot, 'chatgpt-image')),
  daemonPort: envInt('DAEMON_PORT', 40235),
  daemonTTL: envInt('DAEMON_TTL_MS', 30 * 60 * 1000)
};

export default config;
