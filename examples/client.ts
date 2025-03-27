import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import * as eventsource from "eventsource";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import {
  CallToolResultSchema,
  ListResourcesResultSchema,
  ListToolsResultSchema,
  ReadResourceResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import util from "node:util";

// @ts-expect-error
global.EventSource = eventsource;

const transport = new SSEClientTransport(new URL("http://127.0.0.1:8808/sse"));

// const transport = new StdioClientTransport({
//   command: "path/to/server",
// });

const client = new Client(
  {
    name: "example-client",
    version: "1.0.0",
  },
  {
    capabilities: {},
  }
);

async function main() {
  console.log("Connecting...");
  await client.connect(transport);
  console.log("Connected:", client.getServerCapabilities());

  // 1. List available resources
  const resources = await client.request({ method: "resources/list" }, ListResourcesResultSchema);
  console.log(util.inspect(resources, false, 20, true));

  // Read a specific resource
  if (Array.isArray(resources.resources) && resources.resources.length) {
    const resourceContent = await client.request(
      {
        method: "resources/read",
        params: {
          uri: resources?.resources?.[0]?.uri, // 1st..
        },
      },
      ReadResourceResultSchema
    );
    console.log(util.inspect(resourceContent, false, 20, true));
  }

  // 2. List available tools
  const tools = await client.request({ method: "tools/list" }, ListToolsResultSchema);
  console.log(util.inspect(tools, false, 20, true));

  // Example tools call
  const toolResp = await client.request(
    {
      method: "tools/call",
      params: {
        name: "query",
        arguments: { sql: "SELECT 42;" },
      },
    },
    CallToolResultSchema
  );
  console.log(util.inspect(toolResp, false, 20, true));
}

main().catch(console.error);
