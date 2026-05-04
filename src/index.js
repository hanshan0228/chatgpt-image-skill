import { ensureBrowser, disconnect } from './browser.js';
import { createOps } from './chatgpt-ops.js';

export { disconnect };

export async function createChatGPTSession() {
  const { browser, page } = await ensureBrowser();
  const ops = createOps(page);
  return { ops, page, browser };
}
