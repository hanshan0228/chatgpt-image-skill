import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createChatGPTSession, disconnect } from './index.js';
import config from './config.js';

const originalStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = function (chunk, encoding, callback) {
  const text = typeof chunk === 'string' ? chunk : chunk.toString();
  if (text.trimStart().startsWith('{')) {
    return originalStdoutWrite(chunk, encoding, callback);
  }
  return process.stderr.write(chunk, encoding, callback);
};
console.log = console.error;
console.warn = console.error;
console.info = console.error;
console.debug = console.error;

const server = new McpServer({
  name: 'chatgpt-image-mcp-server',
  version: '0.1.0'
});

server.registerTool(
  'chatgpt_generate_image',
  {
    description: 'Generate an image through the ChatGPT web app and save the newest result locally.',
    inputSchema: {
      prompt: z.string().describe('Image prompt to send to ChatGPT.'),
      newSession: z.boolean().default(false).describe('Start from a fresh chat before sending the prompt.'),
      timeout: z.number().default(180000).describe('Maximum wait time in milliseconds.')
    }
  },
  async ({ prompt, newSession, timeout }) => {
    try {
      const { ops } = await createChatGPTSession();
      const loginCheck = await ops.checkLogin();
      if (!loginCheck.ok || !loginCheck.loggedIn) {
        disconnect();
        return { content: [{ type: 'text', text: 'ChatGPT is not ready or not logged in.' }], isError: true };
      }

      const result = await ops.generateImage(prompt, { timeout, newSession });
      disconnect();

      if (!result.ok) {
        return { content: [{ type: 'text', text: `Image generation failed: ${result.error}` }], isError: true };
      }

      return { content: [{ type: 'text', text: `Image generated successfully: ${result.filePath}` }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Execution failed: ${error.message}` }], isError: true };
    }
  }
);

server.registerTool(
  'chatgpt_send_message',
  {
    description: 'Send a normal prompt to ChatGPT and return the latest text response.',
    inputSchema: {
      message: z.string().describe('Prompt text.'),
      newSession: z.boolean().default(false).describe('Reset the conversation before sending.'),
      timeout: z.number().default(120000).describe('Maximum wait time in milliseconds.')
    }
  },
  async ({ message, newSession, timeout }) => {
    try {
      const { ops } = await createChatGPTSession();
      const result = await ops.sendMessage(message, { newSession, timeout });
      disconnect();

      if (!result.ok) {
        return { content: [{ type: 'text', text: `Send message failed: ${result.error}` }], isError: true };
      }

      return { content: [{ type: 'text', text: result.text || '' }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Execution failed: ${error.message}` }], isError: true };
    }
  }
);

server.registerTool(
  'chatgpt_new_chat',
  {
    description: 'Open a clean ChatGPT conversation.',
    inputSchema: {}
  },
  async () => {
    try {
      const { ops } = await createChatGPTSession();
      const result = await ops.newChat();
      disconnect();

      if (!result.ok) {
        return { content: [{ type: 'text', text: `New chat failed: ${result.error}` }], isError: true };
      }

      return { content: [{ type: 'text', text: 'Opened a fresh ChatGPT chat.' }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Execution failed: ${error.message}` }], isError: true };
    }
  }
);

server.registerTool(
  'chatgpt_get_images',
  {
    description: 'List the image candidates found in the current ChatGPT conversation.',
    inputSchema: {}
  },
  async () => {
    try {
      const { ops } = await createChatGPTSession();
      const result = await ops.getAllImages();
      disconnect();

      if (!result.ok) {
        return { content: [{ type: 'text', text: `Image scan failed: ${result.error}` }], isError: true };
      }

      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Execution failed: ${error.message}` }], isError: true };
    }
  }
);

server.registerTool(
  'chatgpt_extract_image',
  {
    description: 'Save a specific conversation image URL to the local output directory.',
    inputSchema: {
      imageUrl: z.string().describe('Image URL returned by chatgpt_get_images.')
    }
  },
  async ({ imageUrl }) => {
    try {
      const { ops } = await createChatGPTSession();
      const result = await ops.saveImageFromUrl(imageUrl);
      disconnect();

      if (!result.ok) {
        return { content: [{ type: 'text', text: `Image extraction failed: ${result.error}` }], isError: true };
      }

      return { content: [{ type: 'text', text: `Saved image to ${result.filePath}` }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Execution failed: ${error.message}` }], isError: true };
    }
  }
);

server.registerTool(
  'chatgpt_check_login',
  {
    description: 'Check whether the managed ChatGPT browser session appears logged in and ready.',
    inputSchema: {}
  },
  async () => {
    try {
      const { ops } = await createChatGPTSession();
      const result = await ops.checkLogin();
      disconnect();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Execution failed: ${error.message}` }], isError: true };
    }
  }
);

server.registerTool(
  'chatgpt_reload_page',
  {
    description: 'Reload the active ChatGPT page.',
    inputSchema: {
      timeout: z.number().default(30000).describe('Maximum wait time in milliseconds.')
    }
  },
  async ({ timeout }) => {
    try {
      const { ops } = await createChatGPTSession();
      const result = await ops.reloadPage({ timeout });
      disconnect();

      if (!result.ok) {
        return { content: [{ type: 'text', text: `Reload failed: ${result.error}` }], isError: true };
      }

      return { content: [{ type: 'text', text: `Reloaded ${result.url}` }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Execution failed: ${error.message}` }], isError: true };
    }
  }
);

server.registerTool(
  'chatgpt_browser_info',
  {
    description: 'Return daemon and CDP connection details for the managed ChatGPT browser.',
    inputSchema: {}
  },
  async () => {
    const daemonUrl = `http://127.0.0.1:${config.daemonPort}`;

    try {
      const healthResponse = await fetch(`${daemonUrl}/health`, { signal: AbortSignal.timeout(3000) });
      const health = await healthResponse.json();
      if (!health.ok) {
        return { content: [{ type: 'text', text: 'Daemon is not healthy.' }], isError: true };
      }

      const acquireResponse = await fetch(`${daemonUrl}/browser/acquire`, { signal: AbortSignal.timeout(5000) });
      const acquire = await acquireResponse.json();

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            daemon: {
              url: daemonUrl,
              port: config.daemonPort
            },
            browser: {
              cdpPort: config.browserDebugPort,
              wsEndpoint: acquire.wsEndpoint || null,
              pid: acquire.pid || null
            },
            config: {
              outputDir: config.outputDir,
              protocolTimeout: config.browserProtocolTimeout,
              daemonTTL: config.daemonTTL
            }
          }, null, 2)
        }]
      };
    } catch (error) {
      return { content: [{ type: 'text', text: `Cannot reach daemon: ${error.message}` }], isError: true };
    }
  }
);

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ChatGPT image MCP server running on stdio');
}

run().catch(console.error);
