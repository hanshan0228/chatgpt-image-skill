# ChatGPT Image Skill

A daemon-backed MCP skill for generating images through the ChatGPT web app.

## Features

- Generate images from ChatGPT in a persistent browser session
- Send normal text prompts and read the latest response
- Extract generated images to local files
- Reuse a managed browser instead of opening a new session every time

## Requirements

- Node.js 18+
- Chrome or Edge installed locally
- A ChatGPT account already signed in inside the managed browser profile

## Install

```bash
git clone https://github.com/hanshan0228/chatgpt-image-skill.git
cd chatgpt-image-skill
npm install
```

## MCP Config

Add this to your MCP client config:

```json
{
  "mcpServers": {
    "chatgpt-image": {
      "command": "node",
      "args": ["<absolute-path-to-project>/src/mcp-server.js"]
    }
  }
}
```

## Available Tools

- `chatgpt_generate_image`
- `chatgpt_send_message`
- `chatgpt_new_chat`
- `chatgpt_get_images`
- `chatgpt_extract_image`
- `chatgpt_check_login`
- `chatgpt_reload_page`
- `chatgpt_browser_info`

## Local Scripts

```bash
npm run mcp
npm run daemon
```

## Notes

- Generated images are saved into `chatgpt-image/` by default.
- If image generation times out, try a shorter prompt or a clean chat.
- If ChatGPT changes its page structure, the selectors in `src/chatgpt-ops.js` may need updating.

## License

ISC
