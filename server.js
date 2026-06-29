// image-vision-mcp: a stdio MCP server that describes images via a multimodal vision model.
// @ts-nocheck
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

// --- Config (env-overridable) ---
// VISION_PROXY_BASE: base URL of an OpenAI-compatible chat completions endpoint.
//   Default points to a local CC Switch proxy (https://github.com/farion1231/cc-switch)
//   running on 127.0.0.1:15721. You can point this at any compatible endpoint,
//   e.g. "https://api.openai.com/v1" or a self-hosted gateway.
// VISION_MODEL: the multimodal model name to request (default "mimo-v2.5").
// VISION_PROXY_TOKEN: bearer token sent as Authorization (optional).
const PROXY_BASE = process.env.VISION_PROXY_BASE || "http://127.0.0.1:15721";
const VISION_MODEL = process.env.VISION_MODEL || "mimo-v2.5";
const VISION_PROXY_TOKEN = process.env.VISION_PROXY_TOKEN || "";
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const MIME_BY_EXT = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
};

function guessMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] || "image/png";
}

async function fileToBase64DataUrl(filePath) {
  const resolved = path.resolve(filePath);
  if (!existsSync(resolved)) {
    throw new Error(`Image file not found: ${resolved}`);
  }
  const stat = statSync(resolved);
  if (stat.size > MAX_IMAGE_BYTES) {
    throw new Error(`Image too large: ${stat.size} bytes (max ${MAX_IMAGE_BYTES}).`);
  }
  const buf = await readFile(resolved);
  const mime = guessMime(resolved);
  const b64 = buf.toString("base64");
  return `data:${mime};base64,${b64}`;
}

async function urlToContent(url) {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return { type: "image_url", image_url: { url } };
  }
  const dataUrl = await fileToBase64DataUrl(url);
  return { type: "image_url", image_url: { url: dataUrl } };
}

async function callVisionModel(imageContent, prompt) {
  const body = {
    model: VISION_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          imageContent,
        ],
      },
    ],
    max_tokens: 8192,
    temperature: 0.3,
  };

  // Send an explicit Bearer token when provided. When empty, send "none" so
  // proxies that require a header still forward the request.
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${VISION_PROXY_TOKEN || "none"}`,
  };

  const resp = await fetch(`${PROXY_BASE}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`Vision API returned ${resp.status}: ${errText.slice(0, 500)}`);
  }

  const data = await resp.json();
  const choice = data.choices?.[0];
  const msg = choice?.message;
  const content = msg?.content;
  if (!content) {
    const reasoning = msg?.reasoning_content;
    if (reasoning) {
      return "[Reasoning only, content was empty]\n" + reasoning;
    }
    throw new Error("Vision API returned no content");
  }
  return typeof content === "string" ? content : JSON.stringify(content);
}

const server = new Server(
  { name: "image-vision", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "describe_image",
      description:
        "Describe or analyze an image using a multimodal vision model (MiMo-V2.5). " +
        "Provide a local file path, an http(s) URL, or a base64 data URI. " +
        "Returns a detailed text description that the calling model can use. " +
        "Use this whenever the user references an image file or asks about visual content.",
      inputSchema: {
        type: "object",
        properties: {
          image_path: {
            type: "string",
            description:
              "Path to a local image file, or an http(s) URL pointing to an image.",
          },
          question: {
            type: "string",
            description:
              "What you want to know about the image, e.g. 'Describe this image in detail' or 'What does this error message say?'",
            default:
              "Describe this image in detail, including any text, layout, colors, and notable elements.",
          },
        },
        required: ["image_path"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name !== "describe_image") {
    throw new Error(`Unknown tool: ${name}`);
  }

  const imagePath = args?.image_path;
  if (!imagePath) {
    throw new Error("image_path is required");
  }

  const question =
    args?.question ||
    "Describe this image in detail, including any text, layout, colors, and notable elements.";

  try {
    const imageContent = await urlToContent(imagePath);
    const description = await callVisionModel(imageContent, question);
    return {
      content: [{ type: "text", text: description }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: "text",
          text: `Error describing image: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
