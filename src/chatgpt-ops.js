import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import config from './config.js';
import { createOperator } from './operator.js';
import { sleep } from './util.js';

const SELECTORS = {
  promptInput: [
    '#prompt-textarea',
    'div#prompt-textarea[contenteditable="true"]',
    'textarea[name="prompt-textarea"]',
    'textarea[placeholder]',
    'div[contenteditable="true"][data-lexical-editor="true"]'
  ],
  sendBtn: [
    'button[data-testid="send-button"]',
    'button[aria-label*="Send prompt" i]',
    'button[aria-label*="Send" i]',
    'button.composer-submit-button-color',
    'button[class*="composer-submit-button-color"]'
  ],
  assistantTurns: [
    '[data-message-author-role="assistant"]',
    'div[data-message-author-role="assistant"]',
    'main [data-message-author-role="assistant"]'
  ],
  candidateImages: [
    '[data-message-author-role="assistant"] img',
    'img[src*="files.oaiusercontent.com"]',
    'img[src*="oaidalleapiprod"]',
    'main article img',
    'main img[alt]',
    'main img[src]'
  ]
};

export function createOps(page) {
  const op = createOperator(page);

  return {
    operator: op,
    selectors: SELECTORS,

    async newChat() {
      try {
        await page.goto('https://chatgpt.com/', { waitUntil: 'networkidle2', timeout: 30_000 });
        await sleep(500);
        return { ok: true, url: page.url() };
      } catch (error) {
        return { ok: false, error: 'new_chat_failed', detail: error.message };
      }
    },

    async checkLogin() {
      try {
        return await op.query((selectors) => {
          const hasPrompt = selectors.promptInput.some((sel) => {
            try {
              return !!document.querySelector(sel);
            } catch {
              return false;
            }
          });

          const href = window.location.href;
          const title = document.title || '';
          const bodyText = document.body?.innerText || '';
          const loggedOutHints = /log in|sign up|sign in/i.test(bodyText);

          return {
            ok: true,
            loggedIn: hasPrompt || (!loggedOutHints && /chatgpt\.com|chat\.openai\.com/i.test(href)),
            hasPrompt,
            href,
            title
          };
        }, SELECTORS);
      } catch (error) {
        return { ok: false, error: 'login_check_failed', detail: error.message };
      }
    },

    async fillPrompt(text) {
      return op.fill(SELECTORS.promptInput, text);
    },

    async clickSend() {
      return op.click(SELECTORS.sendBtn);
    },

    async getAllTextResponses() {
      try {
        return await op.query((selectors) => {
          const seen = new Set();
          const nodes = [];

          for (const sel of selectors) {
            try {
              for (const el of document.querySelectorAll(sel)) {
                if (!seen.has(el)) {
                  seen.add(el);
                  nodes.push(el);
                }
              }
            } catch {
              // ignore selector errors
            }
          }

          const responses = [];
          nodes.forEach((node, index) => {
            const text = (node.innerText || '').trim();
            if (text) {
              responses.push({ index, text });
            }
          });

          return { ok: true, total: responses.length, responses };
        }, SELECTORS.assistantTurns);
      } catch (error) {
        return { ok: false, error: 'text_response_scan_failed', detail: error.message };
      }
    },

    async getLatestTextResponse() {
      const result = await this.getAllTextResponses();
      if (!result.ok) return result;
      const latest = result.responses.at(-1);
      if (!latest) return { ok: false, error: 'no_text_response_found' };
      return { ok: true, ...latest };
    },

    async getAllImages() {
      try {
        return await op.query((selectors) => {
          const seen = new Set();
          const images = [];

          for (const sel of selectors) {
            try {
              for (const img of document.querySelectorAll(sel)) {
                if (seen.has(img)) continue;
                seen.add(img);

                const rect = img.getBoundingClientRect();
                const src = img.getAttribute('src') || '';
                if (!src) continue;
                if (rect.width < 120 || rect.height < 120) continue;

                images.push({
                  src,
                  alt: img.getAttribute('alt') || '',
                  width: Math.round(rect.width),
                  height: Math.round(rect.height),
                  naturalWidth: img.naturalWidth || 0,
                  naturalHeight: img.naturalHeight || 0
                });
              }
            } catch {
              // ignore selector errors
            }
          }

          return {
            ok: true,
            total: images.length,
            images: images.map((image, index) => ({ index, ...image }))
          };
        }, SELECTORS.candidateImages);
      } catch (error) {
        return { ok: false, error: 'image_scan_failed', detail: error.message };
      }
    },

    async extractImageBase64(imageUrl) {
      try {
        return await op.query(async (url) => {
          const response = await fetch(url);
          if (!response.ok) {
            return { ok: false, error: 'image_fetch_failed', detail: `${response.status} ${response.statusText}` };
          }

          const blob = await response.blob();
          const reader = new FileReader();
          const dataUrl = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('file_reader_failed'));
            reader.readAsDataURL(blob);
          });

          return { ok: true, dataUrl, mimeType: blob.type || 'image/png' };
        }, imageUrl);
      } catch (error) {
        return { ok: false, error: 'extract_image_failed', detail: error.message };
      }
    },

    async saveImageFromUrl(imageUrl, prefix = 'chatgpt') {
      const extracted = await this.extractImageBase64(imageUrl);
      if (!extracted.ok) return extracted;

      const base64Data = extracted.dataUrl.split(',')[1];
      const extension = extracted.mimeType.split('/')[1] || 'png';
      mkdirSync(config.outputDir, { recursive: true });
      const filePath = join(config.outputDir, `${prefix}_${Date.now()}.${extension}`);
      writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

      return { ok: true, filePath, mimeType: extracted.mimeType };
    },

    async sendMessage(message, { timeout = 120_000, newSession = false } = {}) {
      if (newSession) {
        const reset = await this.newChat();
        if (!reset.ok) return reset;
      }

      const before = await this.getAllTextResponses();
      const beforeCount = before.ok ? before.total : 0;

      const fillResult = await this.fillPrompt(message);
      if (!fillResult.ok) return { ok: false, error: 'fill_failed', detail: fillResult.error || '' };

      await sleep(300);
      const clickResult = await this.clickSend();
      if (!clickResult.ok) return { ok: false, error: 'send_click_failed', detail: clickResult.error || '' };

      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        await sleep(1500);
        const responses = await this.getAllTextResponses();
        if (responses.ok && responses.total > beforeCount) {
          const latest = responses.responses.at(-1);
          return { ok: true, text: latest?.text || '' };
        }
      }

      return { ok: false, error: 'text_response_timeout' };
    },

    async generateImage(prompt, { timeout = 180_000, newSession = false } = {}) {
      if (newSession) {
        const reset = await this.newChat();
        if (!reset.ok) return reset;
      }

      const beforeImages = await this.getAllImages();
      const beforeCount = beforeImages.ok ? beforeImages.total : 0;

      const fillResult = await this.fillPrompt(prompt);
      if (!fillResult.ok) return { ok: false, error: 'fill_failed', detail: fillResult.error || '' };

      await sleep(300);
      const clickResult = await this.clickSend();
      if (!clickResult.ok) return { ok: false, error: 'send_click_failed', detail: clickResult.error || '' };

      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        await sleep(2000);
        const images = await this.getAllImages();
        if (images.ok && images.total > beforeCount) {
          const latest = images.images.at(-1);
          const saved = await this.saveImageFromUrl(latest.src);
          if (!saved.ok) return saved;
          return { ok: true, filePath: saved.filePath, imageUrl: latest.src, total: images.total };
        }
      }

      return { ok: false, error: 'image_generation_timeout' };
    },

    async reloadPage({ timeout = 30_000 } = {}) {
      try {
        await page.reload({ waitUntil: 'networkidle2', timeout });
        return { ok: true, url: page.url() };
      } catch (error) {
        return { ok: false, error: 'reload_failed', detail: error.message };
      }
    }
  };
}
