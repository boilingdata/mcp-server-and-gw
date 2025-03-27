import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  JSONRPCMessage,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { asyncQueryDuckDB } from "./duckdb.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import jsonBigInt from "json-bigint";
import express from "express";
import duckdb from "duckdb";

const { Database } = duckdb;

const app = express();

const server = new Server(
  {
    name: "boiling-insights",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      // prompts: {},
      templates: {},
    },
  }
);

const SCHEMA_PATH = "schema";
const PORT = process.env.PORT || 8808;
const db = new Database("test.duckdb");

// const PROMPTS = {
//   "list-charts": {
//     name: "list-charts",
//     description:
//       "List chart configuration files. A chart configuration file includes SQL and Apache ECharts configuration in JSON format under the top level key 'echartsconfig'.",
//     arguments: [],
//   },
// };

// const subscriptions: Set<string> = new Set();
// const updateInterval: NodeJS.Timeout | undefined = setInterval(() => {
//   for (const uri of subscriptions) {
//     server.notification({
//       method: "notifications/resources/updated",
//       params: { uri },
//     });
//   }
// }, 5000);

// server.setRequestHandler(ListPromptsRequestSchema, async () => {
//   try {
//     const resp = {
//       prompts: Object.values(PROMPTS),
//     };
//     // console.log("ListResourcesRequestSchema", resp);
//     return resp;
//   } catch (err) {
//     console.error(err);
//     throw err;
//   }
// });

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    const result = await asyncQueryDuckDB(
      db,
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'"
    );
    const resp = {
      resources: result.map((row) => ({
        uri: new URL(`duckdb://127.0.0.1:${PORT}/${row.table_name}/${SCHEMA_PATH}`).href,
        mimeType: "application/json",
        name: `"${row.table_name}" database schema`,
      })),
    };
    // console.log("ListResourcesRequestSchema", resp);
    return resp;
  } catch (err) {
    console.error(err);
    throw err;
  }
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const resourceUrl = new URL(request.params.uri);
  const pathComponents = resourceUrl.pathname.split("/");
  const comps = [...pathComponents];
  const schema = pathComponents.pop();
  const tableName = pathComponents.pop();

  if (schema !== SCHEMA_PATH) {
    throw new Error("Invalid resource URI");
  }

  try {
    const sql = `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${tableName}'`;
    console.log({ sql, comps, schema, tableName });
    const result = await asyncQueryDuckDB(db, sql);

    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: "application/json",
          text: jsonBigInt.stringify(result, null, 2),
        },
      ],
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "query",
        description: "Run a read-only SQL query on a DuckDB database",
        inputSchema: {
          type: "object",
          properties: {
            sql: { type: "string" },
          },
        },
      },
      {
        name: "visualise",
        description:
          "Visualise SQL query results as an Apache ECharts chart. Provide the SQL clause that produces the data for the visualisation. Provide chart JSON configuration for Apache ECharts.",
        inputSchema: {
          type: "object",
          properties: {
            sql: { type: "string" },
            chart: { type: "string" },
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const tool = request.params.name;
    if (tool === "visualise") {
      // console.log(request.params);
      const result = await asyncQueryDuckDB(db, request.params.arguments?.sql as string);
      return {
        content: [{ type: "text", text: jsonBigInt.stringify(result, null, 2) }],
        isError: false,
      };
    } else if (tool === "query") {
      const sql = request.params.arguments?.sql as string;
      const result = await asyncQueryDuckDB(db, sql);
      return {
        content: [{ type: "text", text: jsonBigInt.stringify(result, null, 2) }],
        isError: false,
      };
    } else {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
});

export async function runMCPServer() {
  let transport: SSEServerTransport;

  app.get("/sse", async (req, res) => {
    console.log("--> Received connection:", req.url);
    transport = new SSEServerTransport("/message", res);
    console.log("New SSE connection.");
    await server.connect(transport);
    const _onMsg = transport.onmessage; // original hook
    const _onClose = transport.onclose;
    const _onErr = transport.onerror;
    transport.onmessage = (msg: JSONRPCMessage) => {
      console.log(msg);
      if (_onMsg) _onMsg(msg);
    };
    transport.onclose = () => {
      console.log("Transport closed.");
      if (_onClose) _onClose();
    };
    transport.onerror = (err) => {
      console.error(err);
      if (_onErr) _onErr(err);
    };
    server.onclose = async () => {
      //clearInterval(updateInterval);
      await server.close();
      console.log("SSE connection closed.");
    };
  });

  app.post("/message", async (req, res) => {
    console.log("--> Received message (post)");
    if (transport?.handlePostMessage) {
      await transport.handlePostMessage(req, res);
    } else {
      console.error("transport.handlePostMessage UNDEFINED!");
    }
    console.log("<--", res.statusCode, res.statusMessage);
  });

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

runMCPServer().catch(console.error);
