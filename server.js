import express from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const PORT = process.env.PORT || 3000;
const OPENWEBUI_BASE_URL = process.env.OPENWEBUI_BASE_URL;
const OPENWEBUI_API_KEY = process.env.OPENWEBUI_API_KEY || "";

if (!OPENWEBUI_BASE_URL) {
  console.error("Missing OPENWEBUI_BASE_URL");
}

async function callOpenWebUI(path, body) {
  const headers = {
    "Content-Type": "application/json"
  };

  if (OPENWEBUI_API_KEY) {
    headers["Authorization"] = `Bearer ${OPENWEBUI_API_KEY}`;
  }

  const res = await fetch(`${OPENWEBUI_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Open WebUI error: ${res.status} ${text}`);
  }

  return await res.json();
}

const mcpServer = new McpServer({
  name: "openwebui-mcp",
  version: "1.0.0"
});

mcpServer.registerTool(
  "chat_completion",
  {
    title: "Chat Completion",
    description: "Send a prompt to Open WebUI and return the assistant response.",
    inputSchema: {
      model: z.string().describe("The model name to use in Open WebUI"),
      prompt: z.string().describe("The user prompt to send")
    }
  },
  async ({ model, prompt }) => {
    const result = await callOpenWebUI("/api/chat/completions", {
      model,
      messages: [{ role: "user", content: prompt }]
    });

    const text =
      result?.choices?.[0]?.message?.content ??
      JSON.stringify(result);

    return {
      content: [
        {
          type: "text",
          text
        }
      ]
    };
  }
);

const app = express();
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("OpenWebUI MCP server is running.");
});

// Optional health check
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// MCP endpoint for ChatGPT
app.all("/mcp", async (req, res) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

    res.on("close", () => {
      transport.close();
    });

    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP transport error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: error?.message || "Internal server error"
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
