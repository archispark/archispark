import { app } from "./server.js";

const PORT = process.env["MCP_PORT"] ? parseInt(process.env["MCP_PORT"]) : 8001;
const HOST = process.env["HOST"] ?? "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`ArchiMate MCP server running on http://${HOST}:${PORT}`);
  console.log(`MCP endpoint: http://${HOST}:${PORT}/mcp/`);
});
