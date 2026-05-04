import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import puppeteerCore from 'puppeteer-core';
import { addExtra } from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import config from './config.js';
import { sleep } from './util.js';

const puppeteer = addExtra(puppeteerCore);
puppeteer.use(StealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DAEMON_SCRIPT = join(__dirname, 'daemon', 'server.js');

let browserRef = null;

const DAEMON_URL = `http://127.0.0.1:${config.daemonPort}`;
const DAEMON_READY_TIMEOUT = 15_000;
const DAEMON_POLL_INTERVAL = 500;

async function isDaemonAlive() {
  try {
    const response = await fetch(`${DAEMON_URL}/health`, { signal: AbortSignal.timeout(2000) });
    const data = await response.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

function spawnDaemon() {
  const child = spawn(process.execPath, [DAEMON_SCRIPT], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env }
  });
  child.unref();
}

async function ensureDaemon() {
  if (await isDaemonAlive()) return;

  spawnDaemon();
  const deadline = Date.now() + DAEMON_READY_TIMEOUT;
  while (Date.now() < deadline) {
    await sleep(DAEMON_POLL_INTERVAL);
    if (await isDaemonAlive()) return;
  }

  throw new Error('ChatGPT browser daemon did not become healthy in time.');
}

async function findOrCreateChatGPTPage(browser) {
  const pages = await browser.pages();

  for (const page of pages) {
    const url = page.url();
    if (url.includes('chatgpt.com') || url.includes('chat.openai.com')) {
      await page.bringToFront();
      return page;
    }
  }

  const page = pages.length > 0 ? pages[0] : await browser.newPage();
  await page.goto('https://chatgpt.com/', {
    waitUntil: 'networkidle2',
    timeout: 30_000
  });
  return page;
}

export async function ensureBrowser() {
  if (browserRef && browserRef.isConnected()) {
    const page = await findOrCreateChatGPTPage(browserRef);
    return { browser: browserRef, page };
  }

  await ensureDaemon();

  const response = await fetch(`${DAEMON_URL}/browser/acquire`);
  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.detail || data.error || 'Failed to acquire browser from daemon.');
  }

  browserRef = await puppeteer.connect({
    browserWSEndpoint: data.wsEndpoint,
    defaultViewport: null,
    protocolTimeout: config.browserProtocolTimeout
  });

  const page = await findOrCreateChatGPTPage(browserRef);
  return { browser: browserRef, page };
}

export function disconnect() {
  if (!browserRef) return;
  browserRef.disconnect();
  browserRef = null;
}
