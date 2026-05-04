---
name: chatgpt-image-skill
description: Use when Codex needs to generate images, send prompts, or extract generated pictures through the ChatGPT web app at chatgpt.com. Trigger on requests like "ChatGPT 生图", "用 ChatGPT 画图", "生成图片", "重新出图", or when the user explicitly wants a browser-based ChatGPT image workflow instead of direct API calls.
---

# ChatGPT Image Skill

Use the daemon-backed MCP tools from this skill to work with ChatGPT image generation in a persistent browser session.

## Workflow

1. Prefer the MCP tools from this skill.
2. Reuse the managed ChatGPT browser session instead of opening a separate browser manually.
3. Fall back to browser inspection only after explaining why the MCP flow was insufficient.

## Rules

- Use `chatgpt_generate_image` for normal image generation requests.
- Use `chatgpt_new_chat` before a fresh run if prior context may interfere.
- Use `chatgpt_get_images` and `chatgpt_extract_image` when you need to inspect or save a specific generated image.
- Keep long-running tool calls alive until they return a final result.
- Do not launch an unrelated browser instance for ChatGPT while this skill is in use.

## Tools

- `chatgpt_generate_image`: Start a fresh or existing ChatGPT conversation, send an image-generation prompt, wait for images, and save the newest one locally.
- `chatgpt_send_message`: Send a normal ChatGPT prompt and return the latest text response.
- `chatgpt_new_chat`: Reset to a clean ChatGPT conversation.
- `chatgpt_get_images`: List candidate images found in the current conversation.
- `chatgpt_extract_image`: Save a specific image URL from the conversation to the local output directory.
- `chatgpt_check_login`: Verify that ChatGPT is reachable and likely logged in.
- `chatgpt_reload_page`: Reload the active ChatGPT tab if the page is stale.
- `chatgpt_browser_info`: Return daemon/CDP connection details for debugging.

## MCP Setup

```json
{
  "mcpServers": {
    "chatgpt-image": {
      "command": "node",
      "args": ["<absolute-path-to-skill>/src/mcp-server.js"]
    }
  }
}
```

## Failure Handling

- If login is missing, ask the user to sign into ChatGPT in the managed browser profile first.
- If generation times out, retry with a shorter prompt or a clean chat.
- If selectors drift, use `chatgpt_browser_info` plus page inspection to update the skill rather than bypassing it.
