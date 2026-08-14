// Side-effect import: `import "@workspace/env/register"` loads the repo
// root `.env` (if present) into process.env, without overriding variables
// already set. Must be the first import in any entry point that reads
// process.env at module-init time.
import { loadEnv } from "./index.js"

loadEnv()
