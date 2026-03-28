import express from "express";
import { z } from "zod";

const app = express();
app.use(express.json());

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

app.get("/", (_req, res) => {
  res.send("OpenWebUI MCP server is running.");
});

/*
  Very simple MCP-like endpoints for testing.
  In production, use a fuller MCP server implementation/transport.
*/

app.get("/sse", (_req, res) => {
  res.status(200).set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });

  res.write(`event: message\n`);
  res.write(`data: {"status":"connected"}\n\n`);
});

app.post("/tools/list", (_req, res) => {
  res.json({
    tools: [
      {
        name: "chat_completion",
        description: "Send a chat request to Open WebUI and return the answer.",
        inputSchema: {
          type: "object",
          properties: {
            model: { type: "string" },
            prompt: { type: "string" }
          },
          required: ["model", "prompt"]
        }
      }
    ]
  });
});

app.post("/tools/call", async (req, res) => {
  try {
    const schema = z.object({
      name: z.string(),
      arguments: z.object({
        model: z.string(),
        prompt: z.string()
      })
    });

    const parsed = schema.parse(req.body);

    if (parsed.name !== "chat_completion") {
      return res.status(400).json({ error: "Unknown tool" });
    }

    const result = await callOpenWebUI("/api/chat/completions", {
      model: parsed.arguments.model,
      messages: [
        { role: "user", content: parsed.arguments.prompt }
      ]
    });

    const text =
      result?.choices?.[0]?.message?.content ||
      JSON.stringify(result);

    res.json({
      content: [
        {
          type: "text",
          text
        }
      ]
    });
  } catch (err) {
    res.status(500).json({
      error: err.message || "Unknown error"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
