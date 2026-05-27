import { app } from "./app.js";

const PORT = process.env["PORT"] ? parseInt(process.env["PORT"]) : 8000;
const HOST = process.env["HOST"] ?? "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`ArchiMate API running on http://${HOST}:${PORT}`);
  console.log(`MCP endpoint: http://${HOST}:${PORT}/mcp/`);
});
