# image-vision-mcp

A tiny **stdio MCP server** that gives your AI coding assistant (Codex, Claude Code, etc.) the ability to **see images**.

It exposes a single tool, `describe_image`, which sends a local file path, an HTTP(S) URL, or a base64 data URI to a multimodal vision model through any **OpenAI-compatible** `/v1/chat/completions` endpoint, and returns a detailed text description the calling model can use.

No native binaries, no Python — just one Node.js file and one dependency (`@modelcontextprotocol/sdk`).

---

## Features

- `describe_image` tool with an OpenAI-compatible vision backend
- Accepts **local file paths**, **http(s) URLs**, and **base64 data URIs**
- 20 MB image size guard
- Fully configurable via environment variables (model, endpoint, auth token)
- Works with any MCP client: Codex, Claude Code, etc.

---

## Requirements

- [Node.js](https://nodejs.org/) `>= 18` (needs global `fetch`)
- An OpenAI-compatible multimodal endpoint. This can be:
  - A local proxy such as [CC Switch](https://github.com/farion1231/cc-switch) running on `127.0.0.1:15721`
  - A cloud provider (OpenAI, etc.)
  - A self-hosted gateway

---

## Install

```bash
git clone https://github.com/<your-user>/image-vision-mcp.git
cd image-vision-mcp
npm install
```

> No global install is needed — MCP clients launch the server via `node server.js`.

---

## Configuration

All settings are environment variables:

| Variable             | Default                       | Description                                                                 |
| -------------------- | ----------------------------- | --------------------------------------------------------------------------- |
| `VISION_PROXY_BASE`  | `http://127.0.0.1:15721`      | Base URL of an OpenAI-compatible endpoint (the server appends `/v1/chat/completions`). |
| `VISION_MODEL`       | `mimo-v2.5`                   | Multimodal model name to request.                                           |
| `VISION_PROXY_TOKEN` | *(empty)*                     | Bearer token sent as `Authorization`. Falls back to `"none"` when empty.  |

---

## Usage with Codex

Add this to `~/.codex/config.toml` (Windows: `%USERPROFILE%\.codex\config.toml`):

```toml
[mcp_servers.image_vision]
args = ['<absolute-path-to-this-repo>/server.js']
command = 'node'
startup_timeout_sec = 15

[mcp_servers.image_vision.env]
VISION_MODEL = "mimo-v2.5"
VISION_PROXY_BASE = "http://127.0.0.1:15721"
# Optional: VISION_PROXY_TOKEN = "sk-..."
```

Then restart Codex and send it an image — the model will call `describe_image` automatically.

### Direct endpoint (no proxy)

```toml
[mcp_servers.image_vision.env]
VISION_MODEL = "gpt-4o"
VISION_PROXY_BASE = "https://api.openai.com/v1"
VISION_PROXY_TOKEN = "sk-your-key-here"
```

---

## Usage with Claude Code

Add an MCP server pointing at this repo:

```bash
claude mcp add image-vision-mcp -- node /absolute/path/to/image-vision-mcp/server.js
```

Then set env vars (e.g. through your shell or Claude Code's config):

```bash
export VISION_PROXY_BASE="http://127.0.0.1:15721"
export VISION_MODEL="mimo-v2.5"
export VISION_PROXY_TOKEN="sk-..."   # optional
```

---

## Verify it works

```bash
npm run check   # syntax check of server.js
npm start        # should start and wait on stdio; Ctrl+C to exit
```

End-to-end test (quick smoke from a script):

```js
// test-smoke.mjs — run after setting the env vars above
import { callVisionModel } from "./server.js"; // not exported; see note
```

> `callVisionModel` is not exported by default. For a real smoke test, send any image through your MCP client and check that a text description comes back.

---

## How it works

1. The MCP client receives an image reference from the model.
2. It calls `describe_image` with `image_path` (and optional `question`).
3. The server reads the file (or fetches the URL), encodes to a base64 data URL, and POSTs to `${VISION_PROXY_BASE}/v1/chat/completions` with the model in `VISION_MODEL`.
4. The returned text description is handed back to the calling model as tool output.

---

## License

MIT
