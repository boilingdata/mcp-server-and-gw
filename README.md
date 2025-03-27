# MCP Gateway, Server, and Client

As long as Claude Desktop does not support connecting to remote servers, you can use this script to run a bridge from stdio to HTTP SSE (Server-Sent Events) endpoint.

## Installation

You can install the package globally or use it directly with npx:

```shell
# Global installation
npm install -g mcp-server-and-gw

# Or install as a project dependency
npm install mcp-server-and-gw
```

## Usage

You can use the gateway in several ways:

```shell
# Using npx (no installation required)
npx claude_gateway http://localhost:9999

# If installed globally
claude_gateway http://localhost:9999

# Using environment variables
MCP_HOST=localhost MCP_PORT=9999 npx claude_gateway
```

> The bridge script is node javasscript, but your server code can be whatever you use.

A [Model Context Protocol](https://www.anthropic.com/news/model-context-protocol) gateway [src/claude_gateway.ts](src/claude_gateway.ts) from [stdio](https://spec.modelcontextprotocol.io/specification/basic/transports/#stdio) to [HTTP SSE](https://spec.modelcontextprotocol.io/specification/basic/transports/#http-with-sse) transport.

```shell
## 1. Build
yarn install
yarn build

## 2. Copy the code or update the claude_desktop_config.json to match the script location
##    (You many need to set the node path to full path)
cp build/claude_gateway.js /tmp
echo '{
  "mcpServers": {
    "Claude Gateway Example": {
      "command": "node",
      "args": [
        "/tmp/claude_gateway.js"
      ]
    }
  }
}' > ~/Library/Application\ Support/Claude/claude_desktop_config.json

## 3. Start server so that claude can connect to it for discoverying its resources, tools, etc.
node build/server.js

## 4. Start Claude Desktop
```

## Example Server and Client

You can also develop the SSE server independently from Claude Desktop so you get faster iterations. For example, run the `src/server.ts` and use the `src/client.ts` as the client.

Start server, once you start the client on another terminal, you see the server output.

```shell
% node build/server.js
Server is running on port 8808

--> Received connection: /sse
New SSE connection.
--> Received message (post)
{
  jsonrpc: '2.0',
  id: 0,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'example-client', version: '1.0.0' }
  }
}
<-- 202 Accepted
--> Received message (post)
{ jsonrpc: '2.0', method: 'notifications/initialized' }
<-- 202 Accepted
--> Received message (post)
{ jsonrpc: '2.0', id: 1, method: 'resources/list' }
<-- 202 Accepted
--> Received message (post)
{ jsonrpc: '2.0', id: 2, method: 'tools/list' }
<-- 202 Accepted
--> Received message (post)
{
  jsonrpc: '2.0',
  id: 3,
  method: 'tools/call',
  params: { name: 'query', arguments: { sql: 'SELECT 42;' } }
}
<-- 202 Accepted
```

Start the client

```shell
% node build/client.js
Connecting...
Connected: { resources: {}, tools: {}, templates: {} }
{ resources: [] }
{
  tools: [
    {
      name: 'query',
      description: 'Run a read-only SQL query on a DuckDB database',
      inputSchema: { type: 'object', properties: { sql: { type: 'string' } } }
    },
    {
      name: 'visualise',
      description: 'Visualise SQL query results as an Apache ECharts chart. Provide the SQL clause that produces the data for the visualisation. Provide chart JSON configuration for Apache ECharts.',
      inputSchema: {
        type: 'object',
        properties: { sql: { type: 'string' }, chart: { type: 'string' } }
      }
    }
  ]
}
{
  content: [ { type: 'text', text: '[\n  {\n    "42": 42\n  }\n]' } ],
  isError: false
}
```

## Publishing New Versions

This package uses GitHub Actions to automatically publish to NPM when a new release is created.

### For Maintainers

To release a new version:

1. Make your changes and commit them
2. Run one of the release commands:
   ```shell
   # For patch releases (bug fixes)
   npm run release:patch
   
   # For minor releases (backward compatible features)
   npm run release:minor
   
   # For major releases (breaking changes)
   npm run release:major
   ```
3. This will:
   - Update the version in package.json
   - Create a git tag for the version
   - Push the changes and tags to GitHub
   
4. Go to GitHub and create a new release from the tag
   - This will trigger the GitHub Action to publish to NPM

### NPM Token Setup

To set up automatic publishing:

1. Create an NPM token with publish permissions
2. Add the token to your GitHub repository secrets with the name `NPM_TOKEN`
3. The publishing workflow will use this token to authenticate with NPM
