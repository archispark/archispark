import { runMigrations, runOrganizationBackfill } from "@workspace/db"
import { app } from "./app.js"

const PORT = process.env["PORT"] ? parseInt(process.env["PORT"]) : 3000
const HOST = process.env["HOST"] ?? "0.0.0.0"

runMigrations()
  .then(() => runOrganizationBackfill())
  .then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`ArchiSpark API running on http://${HOST}:${PORT}`)
    })
  })
  .catch((err) => {
    console.error("Startup failed:", err)
    process.exit(1)
  })
