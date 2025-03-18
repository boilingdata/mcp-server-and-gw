import EventSource from "eventsource";

const MCP_HOST = process.env["MCP_HOST"] ?? "localhost";
const MCP_PORT = process.env["MCP_PORT"] ?? 8808;
const baseUrl = `http://${MCP_HOST}:${MCP_PORT}`;
const backendUrlSse = `${baseUrl}/sse`;
let messageEndpoint: string | null = null; // Will be dynamically set from the endpoint event

const debug = console.error;
const respond = console.log;

// Establish SSE connection and listen for endpoint event
function connectSSEBackend() {
  return new Promise((resolve, reject) => {
    const source = new EventSource(backendUrlSse);
    source.onopen = () => debug(`--- SSE backend connected`);
    source.addEventListener("error", (e) => debug(`--- SSE backend error: ${e}`));
    
    // Listen for endpoint event to get the correct message endpoint
    source.addEventListener("endpoint", (event) => {
      messageEndpoint = `${baseUrl}${event.data}`;
      debug(`Message endpoint set to: ${messageEndpoint}`);
      resolve(source);
    });
    
    source.addEventListener("message", (e) => {
      debug(`<-- ${e.data}`);
      respond(e.data); // Forward to Claude Desktop App
    });
    
    // Set a connection timeout
    setTimeout(() => {
      if (!messageEndpoint) {
        debug("Connection timeout - no endpoint received");
        reject(new Error("Connection timeout"));
      }
    }, 10000);
  });
}

// Forward messages to the MCP server using the dynamic endpoint
async function processMessage(inp: Buffer) {
  if (!messageEndpoint) {
    debug("Error: No message endpoint available");
    return;
  }
  
  const msg = inp.toString();
  debug("-->", msg.trim());
  
  try {
    const response = await fetch(messageEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: msg
    });
    
    if (!response.ok) {
      debug(`HTTP error: ${response.status} ${response.statusText}`);
    }
  } catch (e) {
    debug("fetch error:", e);
  }
}

async function runBridge() {
  await connectSSEBackend();
  process.stdin.on("data", processMessage);
  debug("-- MCP stdio to SSE gw running");
}

runBridge().catch((error) => {
  debug("Fatal error running server:", error);
  process.exit(1);
});